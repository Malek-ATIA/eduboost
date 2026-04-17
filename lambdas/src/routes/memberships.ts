import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { SubscriptionEntity, UserEntity, PLAN_IDS } from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { stripe } from "../lib/stripe.js";
import { getPlan, getPlans } from "../lib/plans.js";
import { env } from "../env.js";

export const membershipRoutes = new Hono();

// Plans list is public so the landing/pricing page can render it without auth.
membershipRoutes.get("/plans", (c) => {
  const plans = getPlans().map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    audience: p.audience,
    priceMonthlyCents: p.priceMonthlyCents,
    currency: p.currency,
    features: p.features,
  }));
  return c.json({ items: plans });
});

membershipRoutes.use("/me", requireAuth);
membershipRoutes.use("/checkout", requireAuth);
membershipRoutes.use("/cancel", requireAuth);

membershipRoutes.get("/me", async (c) => {
  const { sub } = c.get("auth");
  const sub_ = await SubscriptionEntity.get({ userId: sub }).go();
  return c.json({ subscription: sub_.data ?? null });
});

const checkoutSchema = z.object({
  planId: z.enum(PLAN_IDS),
});

membershipRoutes.post("/checkout", zValidator("json", checkoutSchema), async (c) => {
  const { sub, email } = c.get("auth");
  const { planId } = c.req.valid("json");

  const plan = getPlan(planId);
  if (!plan || !plan.stripePriceId) {
    return c.json({ error: "plan_not_configured" }, 500);
  }

  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);

  if (plan.audience === "teacher" && user.data.role !== "teacher") {
    return c.json({ error: "plan_not_for_your_role" }, 403);
  }
  if (plan.audience === "student" && user.data.role !== "student" && user.data.role !== "parent") {
    return c.json({ error: "plan_not_for_your_role" }, 403);
  }

  const existing = await SubscriptionEntity.get({ userId: sub }).go();
  if (existing.data && existing.data.status === "active" && !existing.data.cancelAtPeriodEnd) {
    return c.json({ error: "already_subscribed", planId: existing.data.planId }, 409);
  }

  let customerId = existing.data?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: email ?? user.data.email,
      name: user.data.displayName,
      metadata: { userId: sub },
    });
    customerId = customer.id;
  }

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${env.webBaseUrl}/membership?status=success`,
    cancel_url: `${env.webBaseUrl}/membership?status=cancelled`,
    subscription_data: {
      metadata: { userId: sub, planId },
    },
    client_reference_id: sub,
  });

  if (!session.url) return c.json({ error: "checkout_session_no_url" }, 500);
  return c.json({ checkoutUrl: session.url, sessionId: session.id });
});

membershipRoutes.post("/cancel", async (c) => {
  const { sub } = c.get("auth");
  const existing = await SubscriptionEntity.get({ userId: sub }).go();
  if (!existing.data) return c.json({ error: "no_subscription" }, 404);
  if (existing.data.status === "canceled") {
    return c.json({ error: "already_canceled" }, 409);
  }

  await stripe().subscriptions.update(existing.data.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
  await SubscriptionEntity.patch({ userId: sub }).set({ cancelAtPeriodEnd: true }).go();

  return c.json({ ok: true });
});
