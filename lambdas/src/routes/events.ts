import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  EventEntity,
  EventTicketEntity,
  PaymentEntity,
  EVENT_STATUSES,
  UserEntity,
  makeEventId,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { stripe, MIN_PRICE_CENTS } from "../lib/stripe.js";
import { notify } from "../lib/notifications.js";

async function cancelEventWithRefunds(eventId: string, event: { title: string; priceCents: number }) {
  const tickets = await EventTicketEntity.query.primary({ eventId }).go({ limit: 500 });
  const paidTickets = tickets.data.filter((t) => t.status === "paid");

  const results: { userId: string; refunded: boolean; error?: string }[] = [];

  for (const ticket of paidTickets) {
    let refunded = false;
    if (ticket.priceCents > 0 && ticket.stripePaymentIntentId) {
      try {
        await stripe().refunds.create({ payment_intent: ticket.stripePaymentIntentId });
        refunded = true;
      } catch (err) {
        console.error(`event.cancel: refund failed for ticket user=${ticket.userId}`, err);
        results.push({ userId: ticket.userId, refunded: false, error: (err as Error).message });
      }
    } else {
      refunded = true;
    }

    try {
      await EventTicketEntity.patch({ eventId, userId: ticket.userId })
        .set({ status: refunded ? "refunded" : "cancelled" })
        .go();
    } catch (err) {
      console.error(`event.cancel: ticket status patch failed user=${ticket.userId}`, err);
    }

    try {
      await notify({
        userId: ticket.userId,
        type: "event_cancelled",
        title: "Event cancelled",
        body: `"${event.title}" has been cancelled.${refunded && ticket.priceCents > 0 ? " Your payment has been refunded." : ""}`,
        linkPath: `/events/${eventId}`,
      });
    } catch (err) {
      console.error(`event.cancel: notify failed user=${ticket.userId}`, err);
    }

    if (!results.find((r) => r.userId === ticket.userId)) {
      results.push({ userId: ticket.userId, refunded });
    }
  }

  await EventEntity.patch({ eventId }).set({ status: "cancelled" }).go();
  return { ticketsRefunded: results.filter((r) => r.refunded).length, ticketsFailed: results.filter((r) => !r.refunded).length };
}

export const eventRoutes = new Hono();

// -------- Public browse --------
//
// Public reads (listing + single event detail) stay readable without auth —
// matches the marketplace browse surface. We register these BEFORE the
// `requireAuth` middleware so Hono never runs the auth layer for them. Every
// subsequent route (create, patch, ticket purchase, my events, ticket holder
// list) sits below the `use("*", requireAuth)` line and is authenticated.

eventRoutes.get("/", async (c) => {
  const now = new Date().toISOString();
  const result = await EventEntity.query
    .byStatus({ status: "published" })
    .where(({ startsAt }, { gte }) => gte(startsAt, now))
    .go({ limit: 100 });
  return c.json({ items: result.data });
});

eventRoutes.get(
  "/:eventId",
  zValidator("param", z.object({ eventId: z.string().min(1) })),
  async (c) => {
    const { eventId } = c.req.valid("param");
    const event = await EventEntity.get({ eventId }).go();
    if (!event.data) return c.json({ error: "not_found" }, 404);
    return c.json(event.data);
  },
);

// Everything registered below requires an authenticated caller.
eventRoutes.use("*", requireAuth);

// -------- Organizer CRUD --------

const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).optional(),
  venue: z.string().trim().min(1).max(200),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  capacity: z.number().int().min(1).max(10_000),
  priceCents: z.number().int().min(0),
  currency: z.string().length(3).default("TND"),
});

// Events are organizer-run experiences. Teachers and admins can create them;
// students/parents cannot. Paid events must clear MIN_PRICE_CENTS so we don't
// undercut Stripe's real minimum; free events (priceCents=0) are allowed since
// the ticket flow short-circuits Stripe for them.
eventRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const { sub, groups } = c.get("auth");
  const body = c.req.valid("json");
  const isAdmin = groups.includes("admin");

  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);
  if (!isAdmin && user.data.role !== "teacher") {
    return c.json({ error: "only_teachers_or_admins" }, 403);
  }
  if (new Date(body.startsAt).getTime() >= new Date(body.endsAt).getTime()) {
    return c.json({ error: "endsAt_must_be_after_startsAt" }, 400);
  }
  if (body.priceCents > 0 && body.priceCents < MIN_PRICE_CENTS) {
    return c.json({ error: `price_below_minimum_${MIN_PRICE_CENTS}` }, 400);
  }

  const eventId = makeEventId();
  const row = await EventEntity.create({
    eventId,
    organizerId: sub,
    ...body,
    status: "draft",
  }).go();
  return c.json(row.data, 201);
});

const patchSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  venue: z.string().trim().min(1).max(200).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  capacity: z.number().int().min(1).max(10_000).optional(),
  priceCents: z.number().int().min(0).optional(),
  status: z.enum(EVENT_STATUSES).optional(),
});

eventRoutes.patch(
  "/:eventId",
  zValidator("param", z.object({ eventId: z.string().min(1) })),
  zValidator("json", patchSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { eventId } = c.req.valid("param");
    const body = c.req.valid("json");
    const event = await EventEntity.get({ eventId }).go();
    if (!event.data) return c.json({ error: "not_found" }, 404);
    if (event.data.organizerId !== sub) return c.json({ error: "forbidden" }, 403);
    if (Object.keys(body).length === 0) return c.json({ error: "no_fields" }, 400);
    if (body.priceCents !== undefined && body.priceCents > 0 && body.priceCents < MIN_PRICE_CENTS) {
      return c.json({ error: `price_below_minimum_${MIN_PRICE_CENTS}` }, 400);
    }

    if (body.status === "cancelled") {
      if (event.data.status === "cancelled") return c.json({ error: "already_cancelled" }, 409);
      const result = await cancelEventWithRefunds(eventId, event.data);
      return c.json({ ok: true, ...result });
    }

    await EventEntity.patch({ eventId }).set(body).go();
    return c.json({ ok: true });
  },
);

eventRoutes.get("/mine/organizing", async (c) => {
  const { sub } = c.get("auth");
  const result = await EventEntity.query
    .byOrganizer({ organizerId: sub })
    .go({ limit: 100, order: "desc" });
  return c.json({ items: result.data });
});

eventRoutes.get(
  "/:eventId/tickets",
  zValidator("param", z.object({ eventId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { eventId } = c.req.valid("param");
    const event = await EventEntity.get({ eventId }).go();
    if (!event.data) return c.json({ error: "not_found" }, 404);
    if (event.data.organizerId !== sub) return c.json({ error: "forbidden" }, 403);
    const result = await EventTicketEntity.query.primary({ eventId }).go({ limit: 500 });
    return c.json({ items: result.data });
  },
);

// -------- Tickets --------

eventRoutes.post(
  "/:eventId/tickets",
  zValidator("param", z.object({ eventId: z.string().min(1) })),
  async (c) => {
    const { sub, email } = c.get("auth");
    const { eventId } = c.req.valid("param");

    const event = await EventEntity.get({ eventId }).go();
    if (!event.data) return c.json({ error: "event_not_found" }, 404);
    if (event.data.status !== "published") {
      return c.json({ error: "not_published" }, 409);
    }
    if (new Date(event.data.startsAt).getTime() < Date.now()) {
      return c.json({ error: "event_already_started" }, 409);
    }

    const existing = await EventTicketEntity.get({ eventId, userId: sub }).go();
    if (existing.data && existing.data.status === "paid") {
      return c.json({ error: "already_holding_ticket" }, 409);
    }

    // Capacity check: count current paid tickets; reject when full.
    const tickets = await EventTicketEntity.query.primary({ eventId }).go({ limit: 500 });
    const paidCount = tickets.data.filter((t) => t.status === "paid").length;
    if (paidCount >= event.data.capacity) {
      return c.json({ error: "sold_out" }, 409);
    }

    // Free events short-circuit Stripe: ticket is marked "paid" immediately.
    if (event.data.priceCents === 0) {
      if (existing.data) {
        await EventTicketEntity.patch({ eventId, userId: sub })
          .set({ status: "paid" })
          .go();
      } else {
        await EventTicketEntity.create({
          eventId,
          userId: sub,
          priceCents: 0,
          currency: event.data.currency ?? "TND",
          status: "paid",
        }).go();
      }
      return c.json({ outcome: "free_ticket_issued" }, 201);
    }

    const intent = await stripe().paymentIntents.create({
      amount: event.data.priceCents,
      currency: (event.data.currency ?? "TND").toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        kind: "event_ticket",
        eventId,
        userId: sub,
        organizerId: event.data.organizerId,
      },
      receipt_email: email,
      description: `EduBoost event ticket: ${event.data.title}`,
    });

    if (existing.data) {
      await EventTicketEntity.patch({ eventId, userId: sub })
        .set({
          status: "pending",
          stripePaymentIntentId: intent.id,
          priceCents: event.data.priceCents,
        })
        .go();
    } else {
      await EventTicketEntity.create({
        eventId,
        userId: sub,
        status: "pending",
        stripePaymentIntentId: intent.id,
        priceCents: event.data.priceCents,
        currency: event.data.currency ?? "TND",
      }).go();
    }

    try {
      await notify({
        userId: event.data.organizerId,
        type: "listing_sold", // reuse generic type; dedicated "ticket_sold" deferred
        title: "New event ticket",
        body: `${event.data.title}: a buyer started checkout for ${((event.data.priceCents ?? 0) / 100).toFixed(2)} ${event.data.currency ?? "TND"}`,
        linkPath: `/events/${eventId}`,
      });
    } catch (err) {
      console.error("events.post: organizer notify failed (non-fatal)", err);
    }

    return c.json({
      clientSecret: intent.client_secret,
      priceCents: event.data.priceCents,
      currency: event.data.currency,
    });
  },
);

eventRoutes.get("/mine/tickets", async (c) => {
  const { sub } = c.get("auth");
  const result = await EventTicketEntity.query.byUser({ userId: sub }).go({ limit: 100 });
  return c.json({ items: result.data });
});
