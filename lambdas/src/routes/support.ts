import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
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

export const supportRoutes = new Hono();

supportRoutes.use("*", requireAuth);

const createSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES).default("normal"),
  body: z.string().trim().min(10).max(8000),
  bookingId: z.string().trim().min(1).optional(),
});

supportRoutes.post("/tickets", zValidator("json", createSchema), async (c) => {
  const { sub } = c.get("auth");
  const { subject, category, priority, body, bookingId } = c.req.valid("json");

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

const replySchema = z.object({ body: z.string().trim().min(1).max(8000) });

supportRoutes.post(
  "/tickets/:ticketId/messages",
  zValidator("json", replySchema),
  async (c) => {
    const { sub, groups } = c.get("auth");
    const ticketId = c.req.param("ticketId");
    const { body } = c.req.valid("json");

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

    const authorRole: "user" | "admin" = isAdmin && !isOwner ? "admin" : "user";

    const message = await TicketMessageEntity.create({
      ticketId,
      messageId: makeTicketMessageId(),
      authorId: sub,
      authorRole,
      body,
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
