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

// Minimum chargeable amount across bookings and marketplace listings. Values
// are stored in the smallest currency unit — for the Tunisian Dinar that's
// **millimes** (1 TND = 1000 millimes), which is what Stripe expects when
// currency="tnd". 5 000 millimes = 5 TND, sitting comfortably above Stripe's
// per-transaction minimum and low enough that a trial-tier teacher can still
// price a short session. A future phase can promote this to a per-country
// table; the MVP ships with a Tunisia-first default.
export const MIN_PRICE_CENTS = 5000;

export function assertAboveMinimum(amountCents: number): void {
  if (amountCents < MIN_PRICE_CENTS) {
    throw new Error(
      `price_below_minimum:${MIN_PRICE_CENTS}`,
    );
  }
}
