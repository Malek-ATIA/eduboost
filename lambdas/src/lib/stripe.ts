import Stripe from "stripe";
import { env } from "../env.js";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    if (!env.stripeSecretKey) throw new Error("STRIPE_SECRET_KEY not set");
    client = new Stripe(env.stripeSecretKey, { apiVersion: "2025-02-24.acacia" });
  }
  return client;
}

export const PLATFORM_FEE_BPS = 1500;

export function computePlatformFeeCents(amountCents: number): number {
  return Math.round((amountCents * PLATFORM_FEE_BPS) / 10_000);
}

// Minimum chargeable amount across bookings and marketplace listings. Chosen
// to sit above Stripe's hard minimum (€0.50 for EUR) with a practical cushion
// so teachers don't price below the sustainability floor. A future phase can
// promote this to per-country table lookup; MVP keeps a single global floor.
export const MIN_PRICE_CENTS = 500;

export function assertAboveMinimum(amountCents: number): void {
  if (amountCents < MIN_PRICE_CENTS) {
    throw new Error(
      `price_below_minimum:${MIN_PRICE_CENTS}`,
    );
  }
}
