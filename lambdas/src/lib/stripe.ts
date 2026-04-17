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
