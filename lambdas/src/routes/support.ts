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
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  makeTicketId,
  makeTicketMessageId,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { sendEmail } from "../lib/resend.js";
import { notify } from "../lib/notifications.js";
import { env } from "../env.js";

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
  attachments: z.array(attachmentSchema).max(5).default([]),
});

supportRoutes.post("/tickets", zValidator("json", createSchema), async (c) => {
  const { sub } = c.get("auth");
  const { subject, category, priority, body, bookingId, attachments } = c.req.valid("json");

  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);

  if (bookingId) {
    const booking = await BookingEntity.get({ bookingId }).go();
    if (!booking.data) return c.json({ error: "booking_not_found" }, 404);
    if (booking.data.studentId !== sub && booking.data.teacherId !== sub) {
      return c.json({ error: "not_your_booking" }, 403);
    }
  }

  const ticketId = makeTicketId();

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
