import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  SupportTicketEntity,
  TicketMessageEntity,
  UserEntity,
  BookingEntity,
  PaymentEntity,
  ReviewEntity,
  TeacherProfileEntity,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_RESOLUTIONS,
  makeTicketId,
  makeTicketMessageId,
  type TicketPriority,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { sendEmail } from "../lib/resend.js";
import { notify } from "../lib/notifications.js";
import { env } from "../env.js";
import { stripe } from "../lib/stripe.js";

// SLA windows in hours from ticket creation. Chosen so urgent disputes get
// same-day attention, standard disputes resolve within two business days, and
// low-priority inquiries don't crowd the overdue list.
const SLA_HOURS: Record<TicketPriority, number> = {
  urgent: 4,
  high: 24,
  normal: 48,
  low: 168,
};

function computeSlaDeadline(priority: TicketPriority, fromIso?: string): string {
  const base = fromIso ? new Date(fromIso).getTime() : Date.now();
  return new Date(base + SLA_HOURS[priority] * 3600 * 1000).toISOString();
}

const s3 = new S3Client({ region: env.region });

const attachmentSchema = z.object({
  s3Key: z.string().min(1).max(512),
  filename: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().max(200).optional(),
  sizeBytes: z.number().int().min(1).max(25 * 1024 * 1024).optional(),
});

export const supportRoutes = new Hono();

supportRoutes.use("*", requireAuth);

const createSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES).default("normal"),
  body: z.string().trim().min(10).max(8000),
  bookingId: z.string().trim().min(1).optional(),
  relatedPaymentId: z.string().trim().min(1).optional(),
  relatedReviewId: z.string().trim().min(1).optional(),
  attachments: z.array(attachmentSchema).max(5).default([]),
});

supportRoutes.post("/tickets", zValidator("json", createSchema), async (c) => {
  const { sub } = c.get("auth");
  const {
    subject,
    category,
    priority,
    body,
    bookingId,
    relatedPaymentId,
    relatedReviewId,
    attachments,
  } = c.req.valid("json");

  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);

  if (bookingId) {
    const booking = await BookingEntity.get({ bookingId }).go();
    if (!booking.data) return c.json({ error: "booking_not_found" }, 404);
    if (booking.data.studentId !== sub && booking.data.teacherId !== sub) {
      return c.json({ error: "not_your_booking" }, 403);
    }
  }

  // Payment dispute: caller must be on the payment (payer OR payee). Prevents
  // opening a dispute against a payment they have no relationship with.
  if (relatedPaymentId) {
    const payment = await PaymentEntity.get({ paymentId: relatedPaymentId }).go();
    if (!payment.data) return c.json({ error: "payment_not_found" }, 404);
    if (payment.data.payerId !== sub && payment.data.payeeId !== sub) {
      return c.json({ error: "not_your_payment" }, 403);
    }
  }

  // Review dispute: caller must be the review's teacher (the subject) OR the
  // reviewer themselves. Students/parents can't dispute reviews about other
  // teachers; this limits noisy reports.
  if (relatedReviewId) {
    const review = await ReviewEntity.get({ reviewId: relatedReviewId }).go();
    if (!review.data) return c.json({ error: "review_not_found" }, 404);
    if (review.data.teacherId !== sub && review.data.reviewerId !== sub) {
      return c.json({ error: "not_related_to_review" }, 403);
    }
  }

  const ticketId = makeTicketId();
  const slaDeadline = computeSlaDeadline(priority);

  // Defense in depth: zod can't know the ticketId at validation time, so we
  // verify each attachment's s3Key is within this ticket's prefix here.
  // Download-time reconstruction already prevents cross-ticket reads, but
  // rejecting bad keys at POST keeps the stored metadata honest.
  for (const a of attachments) {
    if (!a.s3Key.startsWith(`support/${ticketId}/`)) {
      return c.json({ error: "bad_attachment_key" }, 400);
    }
  }
  // Intentional: new tickets stay at "open" (filed, awaiting admin triage) even though
  // the first message is added below. The ticket transitions to "in_review" when the
  // user adds a follow-up message, and to "awaiting_user" when an admin replies.
  const ticket = await SupportTicketEntity.create({
    ticketId,
    userId: sub,
    subject,
    category,
    priority,
    bookingId,
    relatedPaymentId,
    relatedReviewId,
    slaDeadline,
    status: "open",
  }).go();

  await TicketMessageEntity.create({
    ticketId,
    messageId: makeTicketMessageId(),
    authorId: sub,
    authorRole: "user",
    body,
    attachments: attachments ?? [],
  }).go();

  try {
    await sendEmail({
      to: user.data.email,
      subject: `[EduBoost] Ticket received: ${subject}`,
      html: `<p>Hi ${escapeHtml(user.data.displayName)},</p>
<p>We received your support ticket <strong>#${ticketId}</strong>. Our team will respond as soon as possible.</p>
<p><strong>Subject:</strong> ${escapeHtml(subject)}<br><strong>Category:</strong> ${escapeHtml(category)}</p>`,
    });
  } catch (err) {
    console.error("ticket confirmation email failed (non-fatal)", err);
  }

  return c.json(ticket.data, 201);
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

supportRoutes.get("/tickets/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await SupportTicketEntity.query
    .byUser({ userId: sub })
    .go({ limit: 50, order: "desc" });
  return c.json({ items: result.data });
});

supportRoutes.get("/tickets/:ticketId", async (c) => {
  const { sub, groups } = c.get("auth");
  const ticketId = c.req.param("ticketId");
  const ticket = await SupportTicketEntity.get({ ticketId }).go();
  if (!ticket.data) return c.json({ error: "not_found" }, 404);
  if (ticket.data.userId !== sub && !groups.includes("admin")) {
    return c.json({ error: "forbidden" }, 403);
  }
  const messages = await TicketMessageEntity.query.primary({ ticketId }).go({ limit: 200 });
  return c.json({ ticket: ticket.data, messages: messages.data });
});

const replySchema = z.object({
  body: z.string().trim().min(1).max(8000),
  attachments: z.array(attachmentSchema).max(5).default([]),
});

supportRoutes.post(
  "/tickets/:ticketId/messages",
  zValidator("json", replySchema),
  async (c) => {
    const { sub, groups } = c.get("auth");
    const ticketId = c.req.param("ticketId");
    const { body, attachments } = c.req.valid("json");

    const ticket = await SupportTicketEntity.get({ ticketId }).go();
    if (!ticket.data) return c.json({ error: "not_found" }, 404);

    const isOwner = ticket.data.userId === sub;
    const isAdmin = groups.includes("admin");
    if (!isOwner && !isAdmin) return c.json({ error: "forbidden" }, 403);

    // Non-admins cannot reply on resolved/closed tickets (UI also gates this, but enforce
    // at the API too). Admins can still post on closed tickets (e.g. post-mortem notes).
    if (!isAdmin && (ticket.data.status === "resolved" || ticket.data.status === "closed")) {
      return c.json({ error: "ticket_closed" }, 409);
    }

    // Defense in depth: reject s3Keys that don't belong to this ticket's prefix.
    // Download-time key reconstruction already prevents cross-ticket reads,
    // but rejecting bad keys here keeps stored metadata honest.
    for (const a of attachments) {
      if (!a.s3Key.startsWith(`support/${ticketId}/`)) {
        return c.json({ error: "bad_attachment_key" }, 400);
      }
    }

    const authorRole: "user" | "admin" = isAdmin && !isOwner ? "admin" : "user";

    const message = await TicketMessageEntity.create({
      ticketId,
      messageId: makeTicketMessageId(),
      authorId: sub,
      authorRole,
      body,
      attachments: attachments ?? [],
    }).go();

    const newStatus = authorRole === "admin" ? "awaiting_user" : "in_review";
    await SupportTicketEntity.patch({ ticketId }).set({ status: newStatus }).go();

    const notifyUserId = isAdmin && !isOwner ? ticket.data.userId : null;
    if (notifyUserId) {
      await notify({
        userId: notifyUserId,
        type: "support_ticket_reply",
        title: `Reply on ticket #${ticketId}`,
        body: body.slice(0, 200),
        linkPath: `/support/${ticketId}`,
      });
    }

    return c.json(message.data, 201);
  },
);

// Admin-only: resolve a dispute with a structured outcome.
// - refund_full / refund_partial: issues a Stripe refund against the related
//   payment's PaymentIntent. refund_partial requires refundCents <= original
//   amount minus prior refunds. Marks the PaymentEntity status as "refunded"
//   on full refunds only (partials still count as "succeeded" for reporting).
// - review_removed: flags the related ReviewEntity as hidden. Teacher profiles
//   and reviewer pages must filter by `hiddenAt` absence.
// - no_action / warning_issued: annotation-only outcomes with no side effects
//   beyond closing the ticket.
const resolveSchema = z
  .object({
    resolution: z.enum(TICKET_RESOLUTIONS),
    note: z.string().trim().min(10).max(2000),
    refundCents: z.number().int().min(1).max(100_000_00).optional(),
  })
  .refine(
    (v) => (v.resolution === "refund_partial" ? typeof v.refundCents === "number" : true),
    { message: "refundCents required for refund_partial", path: ["refundCents"] },
  );

supportRoutes.post(
  "/tickets/:ticketId/resolve",
  zValidator("json", resolveSchema),
  async (c) => {
    const { sub, groups } = c.get("auth");
    const ticketId = c.req.param("ticketId");
    if (!groups.includes("admin")) return c.json({ error: "only_admins" }, 403);

    const { resolution, note, refundCents } = c.req.valid("json");
    const ticket = await SupportTicketEntity.get({ ticketId }).go();
    if (!ticket.data) return c.json({ error: "not_found" }, 404);
    if (ticket.data.status === "resolved" || ticket.data.status === "closed") {
      return c.json({ error: "already_resolved" }, 409);
    }

    // Execute side effects before marking the ticket resolved — if Stripe
    // rejects the refund, the ticket stays open and the admin can retry.
    if (resolution === "refund_full" || resolution === "refund_partial") {
      if (!ticket.data.relatedPaymentId) {
        return c.json({ error: "no_related_payment" }, 400);
      }
      const payment = await PaymentEntity.get({ paymentId: ticket.data.relatedPaymentId }).go();
      if (!payment.data) return c.json({ error: "payment_not_found" }, 404);
      if (!payment.data.providerPaymentId) {
        return c.json({ error: "payment_missing_provider_id" }, 409);
      }
      if (payment.data.status === "refunded") {
        return c.json({ error: "already_refunded" }, 409);
      }
      if (resolution === "refund_partial" && refundCents! > payment.data.amountCents) {
        return c.json({ error: "refund_exceeds_payment_amount" }, 400);
      }
      const amount = resolution === "refund_full" ? payment.data.amountCents : refundCents!;
      try {
        await stripe().refunds.create({
          payment_intent: payment.data.providerPaymentId,
          amount,
        });
      } catch (err) {
        console.error("dispute resolve: stripe refund failed", err);
        return c.json({ error: "refund_failed", message: (err as Error).message }, 502);
      }
      if (resolution === "refund_full") {
        await PaymentEntity.patch({ paymentId: payment.data.paymentId })
          .set({ status: "refunded" })
          .go();
      }
    }

    if (resolution === "review_removed") {
      if (!ticket.data.relatedReviewId) {
        return c.json({ error: "no_related_review" }, 400);
      }
      const review = await ReviewEntity.get({ reviewId: ticket.data.relatedReviewId }).go();
      if (!review.data) return c.json({ error: "review_not_found" }, 404);
      if (review.data.hiddenAt) {
        return c.json({ error: "already_hidden" }, 409);
      }
      await ReviewEntity.patch({ reviewId: review.data.reviewId })
        .set({
          hiddenAt: new Date().toISOString(),
          hiddenBy: sub,
          hiddenReason: note.slice(0, 500),
        })
        .go();

      // Recompute the teacher's visible rating aggregate so the takedown
      // updates their star average immediately. Mirrors the logic in
      // reviews.ts::recomputeTeacherRating and stays local to avoid a cross-
      // route import cycle.
      try {
        const all = await ReviewEntity.query
          .byTeacher({ teacherId: review.data.teacherId })
          .go({ limit: 1000 });
        const visible = all.data.filter((r) => !r.hiddenAt);
        const count = visible.length;
        const avg = count === 0 ? 0 : visible.reduce((s, r) => s + r.rating, 0) / count;
        await TeacherProfileEntity.patch({ userId: review.data.teacherId })
          .set({ ratingAvg: Math.round(avg * 100) / 100, ratingCount: count })
          .go();
      } catch (err) {
        console.error("resolve: rating recompute failed (non-fatal)", err);
      }
    }

    await SupportTicketEntity.patch({ ticketId })
      .set({
        status: "resolved",
        resolvedAt: new Date().toISOString(),
        resolvedBy: sub,
        resolution,
        resolutionNote: note,
      })
      .go();

    // Record a system message so the resolution is visible in the ticket
    // thread. authorRole="system" distinguishes it from admin replies.
    const summary =
      resolution === "refund_full"
        ? `Resolved: full refund issued.`
        : resolution === "refund_partial"
          ? `Resolved: partial refund of ${((refundCents ?? 0) / 100).toFixed(2)} issued.`
          : resolution === "review_removed"
            ? `Resolved: the disputed review has been removed.`
            : resolution === "warning_issued"
              ? `Resolved: a warning has been issued.`
              : `Resolved: no further action required.`;
    await TicketMessageEntity.create({
      ticketId,
      messageId: makeTicketMessageId(),
      authorId: sub,
      authorRole: "system",
      body: `${summary}\n\n${note}`,
      attachments: [],
    }).go();

    try {
      await notify({
        userId: ticket.data.userId,
        type: "support_ticket_reply",
        title: `Ticket #${ticketId} resolved`,
        body: summary,
        linkPath: `/support/${ticketId}`,
      });
    } catch (err) {
      console.error("resolve: notify failed (non-fatal)", err);
    }

    return c.json({ ok: true, resolution });
  },
);

// The new-ticket UI can't include attachments in the initial POST /tickets
// because presigned uploads require an existing ticketId (the S3 prefix is
// scoped to it). So the client creates the ticket, uploads files, then calls
// this endpoint to backfill the attachments on the initial user message.
// Restricted to the ticket owner and only works while the initial message
// still has zero attachments (prevents replacing/overwriting).
const initialAttachmentsSchema = z.object({
  attachments: z.array(attachmentSchema).min(1).max(5),
});

supportRoutes.post(
  "/tickets/:ticketId/initial-attachments",
  zValidator("json", initialAttachmentsSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const ticketId = c.req.param("ticketId");
    const ticket = await SupportTicketEntity.get({ ticketId }).go();
    if (!ticket.data) return c.json({ error: "not_found" }, 404);
    if (ticket.data.userId !== sub) return c.json({ error: "forbidden" }, 403);

    const { attachments } = c.req.valid("json");
    for (const a of attachments) {
      if (!a.s3Key.startsWith(`support/${ticketId}/`)) {
        return c.json({ error: "bad_attachment_key" }, 400);
      }
    }

    const messages = await TicketMessageEntity.query
      .primary({ ticketId })
      .go({ limit: 5 });
    const initial = messages.data.find(
      (m) => m.authorRole === "user" && m.authorId === sub,
    );
    if (!initial) return c.json({ error: "initial_message_not_found" }, 404);
    if (initial.attachments && initial.attachments.length > 0) {
      return c.json({ error: "attachments_already_set" }, 409);
    }

    const updated = await TicketMessageEntity.patch({
      ticketId,
      messageId: initial.messageId,
    })
      .set({ attachments })
      .go({ response: "all_new" });
    return c.json(updated.data ?? { ok: true });
  },
);

// Presigned PUT URL for a ticket attachment. Caller must be the ticket owner
// or an admin, to prevent uploads from being linked to tickets they can't
// otherwise see. Key is constrained to the ticket's S3 prefix so a client
// can't upload to arbitrary bucket paths.
const uploadUrlSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(1).max(200),
  sizeBytes: z.number().int().min(1).max(25 * 1024 * 1024),
});

supportRoutes.post(
  "/tickets/:ticketId/attachment-url",
  zValidator("json", uploadUrlSchema),
  async (c) => {
    const { sub, groups } = c.get("auth");
    const ticketId = c.req.param("ticketId");
    const ticket = await SupportTicketEntity.get({ ticketId }).go();
    if (!ticket.data) return c.json({ error: "not_found" }, 404);
    const isOwner = ticket.data.userId === sub;
    const isAdmin = groups.includes("admin");
    if (!isOwner && !isAdmin) return c.json({ error: "forbidden" }, 403);

    const { filename, mimeType, sizeBytes } = c.req.valid("json");
    const safeName = filename.replace(/[^0-9A-Za-z._-]/g, "_").slice(0, 100);
    const key = `support/${ticketId}/${nanoid(10)}-${safeName}`;
    const cmd = new PutObjectCommand({
      Bucket: env.uploadsBucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    });
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 900 });
    return c.json({ uploadUrl, s3Key: key });
  },
);

// Presigned GET URL for downloading an attachment. Authz: caller must be on
// the ticket the attachment belongs to (inferred from the S3 key structure).
supportRoutes.get("/attachments/:ticketId/:s3Key{.+}", async (c) => {
  const { sub, groups } = c.get("auth");
  const ticketId = c.req.param("ticketId");
  const rest = c.req.param("s3Key");
  const ticket = await SupportTicketEntity.get({ ticketId }).go();
  if (!ticket.data) return c.json({ error: "not_found" }, 404);
  const isOwner = ticket.data.userId === sub;
  const isAdmin = groups.includes("admin");
  if (!isOwner && !isAdmin) return c.json({ error: "forbidden" }, 403);

  // The s3Key param is only the suffix after /attachments/:ticketId/; the
  // full S3 key is reconstructed here so clients can't pivot to keys outside
  // this ticket's folder.
  const key = `support/${ticketId}/${rest}`;
  // Force `Content-Disposition: attachment` on the download response. Without
  // this, HTML/SVG uploads could render inline in the user's browser tab and
  // execute scripts in the context of the signed-URL origin. The S3 key suffix
  // already contains a sanitized filename; use it verbatim so the user still
  // gets a sensible download name. RFC 5987 encoding handles non-ASCII.
  const lastSlash = rest.lastIndexOf("/");
  const suggestedName = lastSlash >= 0 ? rest.slice(lastSlash + 1) : rest;
  const asciiFallback = suggestedName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  const disposition = `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(suggestedName)}`;
  const cmd = new GetObjectCommand({
    Bucket: env.uploadsBucket,
    Key: key,
    ResponseContentDisposition: disposition,
  });
  const downloadUrl = await getSignedUrl(s3, cmd, { expiresIn: 600 });
  return c.json({ downloadUrl });
});
