import { Hono } from "hono";
import { nanoid } from "nanoid";
import type Stripe from "stripe";
import {
  BookingEntity,
  PaymentEntity,
  UserEntity,
  OrderEntity,
  ListingEntity,
  SubscriptionEntity,
  PLAN_IDS,
} from "@eduboost/db";
import type { PlanId } from "@eduboost/db";
import { stripe, computePlatformFeeCents } from "../lib/stripe.js";
import { sendEmail, emailTemplates } from "../lib/resend.js";
import { notify } from "../lib/notifications.js";
import { env } from "../env.js";

export const webhookRoutes = new Hono();

webhookRoutes.post("/stripe", async (c) => {
  if (!env.stripeWebhookSecret) return c.json({ error: "webhook not configured" }, 500);

  const sig = c.req.header("stripe-signature");
  if (!sig) return c.json({ error: "missing signature" }, 400);

  const payload = await c.req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, sig, env.stripeWebhookSecret);
  } catch (err) {
    console.warn("stripe: signature verification failed", err);
    return c.json({ error: "invalid signature" }, 400);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await onPaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await onPaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case "charge.refunded":
        await onRefund(event.data.object as Stripe.Charge);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await onSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("stripe webhook handler error", err);
    return c.json({ error: "handler_error" }, 500);
  }

  return c.json({ received: true });
});

async function onPaymentSucceeded(pi: Stripe.PaymentIntent) {
  const kind = pi.metadata?.kind;
  if (kind === "marketplace_order") {
    await onMarketplacePaid(pi);
    return;
  }

  const bookingId = pi.metadata?.bookingId;
  if (!bookingId) return;

  await BookingEntity.patch({ bookingId }).set({ status: "confirmed" }).go();

  const booking = await BookingEntity.get({ bookingId }).go();
  if (!booking.data) return;

  await PaymentEntity.create({
    paymentId: `pay_${nanoid(12)}`,
    bookingId,
    payerId: booking.data.studentId,
    payeeId: booking.data.teacherId,
    amountCents: pi.amount,
    platformFeeCents: computePlatformFeeCents(pi.amount),
    currency: (pi.currency ?? "eur").toUpperCase(),
    provider: "stripe",
    providerPaymentId: pi.id,
    status: "succeeded",
  }).go();

  try {
    const [student, teacher] = await Promise.all([
      UserEntity.get({ userId: booking.data.studentId }).go(),
      UserEntity.get({ userId: booking.data.teacherId }).go(),
    ]);
    if (student.data?.email && teacher.data) {
      const tpl = emailTemplates.bookingConfirmed(
        student.data.displayName,
        teacher.data.displayName,
        booking.data.createdAt,
      );
      await sendEmail({ to: student.data.email, subject: tpl.subject, html: tpl.html });
    }
    if (student.data && teacher.data) {
      await notify({
        userId: booking.data.studentId,
        type: "booking_confirmed",
        title: "Booking confirmed",
        body: `Your session with ${teacher.data.displayName} is confirmed.`,
        linkPath: `/bookings/${booking.data.bookingId}`,
      });
      await notify({
        userId: booking.data.teacherId,
        type: "booking_confirmed",
        title: "Payment received",
        body: `${student.data.displayName}'s payment for the ${booking.data.type} session has cleared.`,
        linkPath: `/bookings/${booking.data.bookingId}`,
      });
    }
  } catch (err) {
    console.error("booking confirmed notifications failed (non-fatal)", err);
  }
}

async function onPaymentFailed(pi: Stripe.PaymentIntent) {
  if (pi.metadata?.kind === "marketplace_order") {
    const orderId = pi.metadata.orderId;
    if (!orderId) return;
    await OrderEntity.patch({ orderId }).set({ status: "cancelled" }).go();
    return;
  }
  const bookingId = pi.metadata?.bookingId;
  if (!bookingId) return;
  await BookingEntity.patch({ bookingId }).set({ status: "cancelled" }).go();
  const booking = await BookingEntity.get({ bookingId }).go();
  if (!booking.data) return;
  await notify({
    userId: booking.data.studentId,
    type: "booking_cancelled",
    title: "Payment failed",
    body: "Your booking payment could not be completed.",
    linkPath: `/bookings/${bookingId}`,
  });
}

async function onRefund(charge: Stripe.Charge) {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return;

  if (charge.metadata?.kind === "marketplace_order") {
    const orderId = charge.metadata.orderId;
    if (!orderId) return;
    await OrderEntity.patch({ orderId }).set({ status: "refunded" }).go();
    return;
  }

  const bookingId = charge.metadata?.bookingId;
  if (!bookingId) return;
  await BookingEntity.patch({ bookingId }).set({ status: "refunded" }).go();
  const booking = await BookingEntity.get({ bookingId }).go();
  if (!booking.data) return;
  await Promise.all([
    notify({
      userId: booking.data.studentId,
      type: "booking_refunded",
      title: "Booking refunded",
      body: "Your booking has been refunded.",
      linkPath: `/bookings/${bookingId}`,
    }),
    notify({
      userId: booking.data.teacherId,
      type: "booking_refunded",
      title: "Booking refunded",
      body: "A booking was refunded.",
      linkPath: `/bookings/${bookingId}`,
    }),
  ]);
}

async function onSubscriptionUpsert(s: Stripe.Subscription) {
  const userId = (s.metadata?.userId as string) ?? "";
  const rawPlanId = s.metadata?.planId ?? "";
  if (!userId || !rawPlanId) {
    console.warn("subscription upsert: missing metadata", { subscriptionId: s.id });
    return;
  }
  if (!(PLAN_IDS as readonly string[]).includes(rawPlanId)) {
    console.warn("subscription upsert: unknown planId", {
      subscriptionId: s.id,
      planId: rawPlanId,
    });
    return;
  }
  const planId = rawPlanId as PlanId;
  const customerId = typeof s.customer === "string" ? s.customer : s.customer.id;
  const periodEnd = s.current_period_end
    ? new Date(s.current_period_end * 1000).toISOString()
    : undefined;

  await SubscriptionEntity.upsert({
    userId,
    planId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: s.id,
    status: s.status as
      | "trialing"
      | "active"
      | "past_due"
      | "canceled"
      | "incomplete"
      | "incomplete_expired"
      | "unpaid"
      | "paused",
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: s.cancel_at_period_end ?? false,
  }).go();
}

async function onSubscriptionDeleted(s: Stripe.Subscription) {
  const userId = (s.metadata?.userId as string) ?? "";
  if (!userId) {
    // Fall back to byStripeSubscription GSI lookup.
    const existing = await SubscriptionEntity.query
      .byStripeSubscription({ stripeSubscriptionId: s.id })
      .go({ limit: 1 });
    const row = existing.data[0];
    if (!row) return;
    await SubscriptionEntity.patch({ userId: row.userId })
      .set({ status: "canceled", cancelAtPeriodEnd: false })
      .go();
    return;
  }
  await SubscriptionEntity.patch({ userId })
    .set({ status: "canceled", cancelAtPeriodEnd: false })
    .go();
}

async function onMarketplacePaid(pi: Stripe.PaymentIntent) {
  const orderId = pi.metadata?.orderId;
  const listingId = pi.metadata?.listingId;
  if (!orderId || !listingId) return;

  await OrderEntity.patch({ orderId }).set({ status: "paid" }).go();
  const [order, listing] = await Promise.all([
    OrderEntity.get({ orderId }).go(),
    ListingEntity.get({ listingId }).go(),
  ]);
  if (!order.data) return;

  await PaymentEntity.create({
    paymentId: `pay_${nanoid(12)}`,
    bookingId: orderId,
    payerId: order.data.buyerId,
    payeeId: order.data.sellerId,
    amountCents: pi.amount,
    platformFeeCents: computePlatformFeeCents(pi.amount),
    currency: (pi.currency ?? "eur").toUpperCase(),
    provider: "stripe",
    providerPaymentId: pi.id,
    status: "succeeded",
  }).go();

  try {
    const [buyer, seller] = await Promise.all([
      UserEntity.get({ userId: order.data.buyerId }).go(),
      UserEntity.get({ userId: order.data.sellerId }).go(),
    ]);
    const listingTitle = listing.data?.title ?? "a listing";
    if (buyer.data && seller.data) {
      await notify({
        userId: order.data.sellerId,
        type: "listing_sold",
        title: "Listing sold",
        body: `${buyer.data.displayName} bought "${listingTitle}".`,
        linkPath: `/seller/orders`,
      });
    }
  } catch (err) {
    console.error("marketplace paid notifications failed (non-fatal)", err);
  }
}
