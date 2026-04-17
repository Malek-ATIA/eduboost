import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  BookingEntity,
  UserEntity,
  SessionEntity,
  PaymentEntity,
  SupportTicketEntity,
  TicketMessageEntity,
  makeTicketId,
  makeTicketMessageId,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { stripe, computePlatformFeeCents } from "../lib/stripe.js";
import { notify } from "../lib/notifications.js";

// Money-back guarantee: students can cancel a booking and get an automatic
// refund if the linked session is more than this many hours away (or no
// session has been scheduled yet). Inside the window we route to a dispute
// ticket so the teacher+admin can review case-by-case.
const BOOKING_AUTO_REFUND_WINDOW_HOURS = 24;

export const bookingRoutes = new Hono();

bookingRoutes.use("*", requireAuth);

bookingRoutes.get("/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await BookingEntity.query.byStudent({ studentId: sub }).go({ limit: 50 });
  return c.json({ items: result.data });
});

bookingRoutes.get("/as-teacher", async (c) => {
  const { sub } = c.get("auth");
  const result = await BookingEntity.query.byTeacher({ teacherId: sub }).go({ limit: 50 });
  return c.json({ items: result.data });
});

bookingRoutes.get("/:bookingId", async (c) => {
  const bookingId = c.req.param("bookingId");
  const result = await BookingEntity.get({ bookingId }).go();
  if (!result.data) return c.json({ error: "not found" }, 404);
  const { sub } = c.get("auth");
  if (result.data.studentId !== sub && result.data.teacherId !== sub) {
    return c.json({ error: "forbidden" }, 403);
  }
  return c.json(result.data);
});

const createSchema = z.object({
  teacherId: z.string().min(1),
  classroomId: z.string().optional(),
  type: z.enum(["trial", "single", "package"]),
  amountCents: z.number().int().min(50),
  currency: z.string().length(3).default("EUR"),
});

bookingRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const { sub, email } = c.get("auth");
  const body = c.req.valid("json");
  const bookingId = `bk_${nanoid(12)}`;

  const [student, teacher] = await Promise.all([
    UserEntity.get({ userId: sub }).go(),
    UserEntity.get({ userId: body.teacherId }).go(),
  ]);
  if (!student.data) return c.json({ error: "user_not_found" }, 404);
  if (!teacher.data || teacher.data.role !== "teacher") {
    return c.json({ error: "teacher_not_found" }, 404);
  }

  const intent = await stripe().paymentIntents.create({
    amount: body.amountCents,
    currency: body.currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: {
      bookingId,
      studentId: sub,
      teacherId: body.teacherId,
      type: body.type,
    },
    receipt_email: email,
    description: `EduBoost ${body.type} session booking`,
  });

  const result = await BookingEntity.create({
    bookingId,
    studentId: sub,
    status: "pending",
    stripePaymentIntentId: intent.id,
    ...body,
  }).go();

  await notify({
    userId: body.teacherId,
    type: "booking_created",
    title: "New booking",
    body: `${student.data.displayName} booked a ${body.type} session with you.`,
    linkPath: `/bookings/${bookingId}`,
    email: {
      subject: "New booking on EduBoost",
      html: `<p>Hi ${escapeHtml(teacher.data.displayName)},</p><p><strong>${escapeHtml(
        student.data.displayName,
      )}</strong> just booked a ${body.type} session with you for €${(body.amountCents / 100).toFixed(
        2,
      )}. Payment is pending confirmation.</p>`,
    },
  });

  return c.json(
    {
      booking: result.data,
      clientSecret: intent.client_secret,
      platformFeeCents: computePlatformFeeCents(body.amountCents),
    },
    201,
  );
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const cancelSchema = z.object({
  reason: z.string().trim().min(10).max(1000),
});

// POST /bookings/:bookingId/cancel — student-initiated cancellation + refund
// request. Auto-refunds via Stripe when the linked session starts more than
// BOOKING_AUTO_REFUND_WINDOW_HOURS from now (or no session has been scheduled
// yet). Inside the window, routes to the dispute system so a human can decide.
bookingRoutes.post(
  "/:bookingId/cancel",
  zValidator("param", z.object({ bookingId: z.string().min(1) })),
  zValidator("json", cancelSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { bookingId } = c.req.valid("param");
    const { reason } = c.req.valid("json");

    const booking = await BookingEntity.get({ bookingId }).go();
    if (!booking.data) return c.json({ error: "not_found" }, 404);
    if (booking.data.studentId !== sub) return c.json({ error: "not_your_booking" }, 403);
    if (booking.data.status === "cancelled" || booking.data.status === "refunded") {
      return c.json({ error: "already_cancelled" }, 409);
    }
    if (booking.data.status === "completed") {
      return c.json({ error: "already_completed" }, 409);
    }

    // Is the linked session far enough in the future to auto-refund? If no
    // session is scheduled yet, treat it as auto-refundable (the teacher
    // hasn't committed time yet).
    let autoRefund = true;
    if (booking.data.sessionId) {
      const session = await SessionEntity.get({ sessionId: booking.data.sessionId }).go();
      if (session.data?.startsAt) {
        const startsMs = new Date(session.data.startsAt).getTime();
        const windowMs = BOOKING_AUTO_REFUND_WINDOW_HOURS * 3600 * 1000;
        if (startsMs - Date.now() < windowMs) autoRefund = false;
      }
    }

    if (autoRefund) {
      // Find the succeeded PaymentEntity for this booking to refund.
      const payments = await PaymentEntity.query
        .byBooking({ bookingId })
        .go({ limit: 5 });
      const succeeded = payments.data.find((p) => p.status === "succeeded");
      if (succeeded?.providerPaymentId) {
        try {
          await stripe().refunds.create({
            payment_intent: succeeded.providerPaymentId,
          });
          await PaymentEntity.patch({ paymentId: succeeded.paymentId })
            .set({ status: "refunded" })
            .go();
        } catch (err) {
          console.error("booking.cancel: stripe refund failed", err);
          return c.json({ error: "refund_failed", message: (err as Error).message }, 502);
        }
      }
      // If there's no succeeded payment (pending PaymentIntent never
      // captured), just mark the booking cancelled. The PaymentIntent will
      // expire on Stripe's side without a charge.
      await BookingEntity.patch({ bookingId }).set({ status: "refunded" }).go();

      try {
        await notify({
          userId: booking.data.teacherId,
          type: "booking_refunded",
          title: "Booking cancelled & refunded",
          body: `Booking ${bookingId} was cancelled by the student with a same-day refund. Reason: ${reason.slice(0, 200)}`,
          linkPath: `/bookings`,
        });
      } catch (err) {
        console.error("booking.cancel: notify failed (non-fatal)", err);
      }

      return c.json({ outcome: "auto_refunded" });
    }

    // Inside the auto-refund window — route to dispute system. Build a
    // SupportTicketEntity row + an initial user message so the same admin
    // resolve flow from Phase 2F.4 handles it.
    const payments = await PaymentEntity.query.byBooking({ bookingId }).go({ limit: 5 });
    const relatedPaymentId = payments.data.find((p) => p.status === "succeeded")?.paymentId;
    const ticketId = makeTicketId();
    const slaDeadlineHours = 24;
    const slaDeadline = new Date(
      Date.now() + slaDeadlineHours * 3600 * 1000,
    ).toISOString();
    await SupportTicketEntity.create({
      ticketId,
      userId: sub,
      subject: `Refund request for ${booking.data.type} booking`,
      category: "payment_dispute",
      priority: "high",
      bookingId,
      relatedPaymentId,
      slaDeadline,
      status: "open",
    }).go();
    await TicketMessageEntity.create({
      ticketId,
      messageId: makeTicketMessageId(),
      authorId: sub,
      authorRole: "user",
      body: `Auto-escalated from booking cancel (session within ${BOOKING_AUTO_REFUND_WINDOW_HOURS}h). Student reason:\n\n${reason}`,
      attachments: [],
    }).go();

    return c.json({ outcome: "dispute_created", ticketId });
  },
);
