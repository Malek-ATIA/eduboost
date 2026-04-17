import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { env } from "./env";

let promise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!promise) {
    if (!env.stripePublishableKey) {
      console.warn("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY not set");
      promise = Promise.resolve(null);
    } else {
      promise = loadStripe(env.stripePublishableKey);
    }
  }
  return promise;
}
