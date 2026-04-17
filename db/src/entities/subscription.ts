import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
  "paused",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PLAN_IDS = ["student_premium", "teacher_pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const SubscriptionEntity = new Entity(
  {
    model: { entity: "subscription", version: "1", service: SERVICE },
    attributes: {
      userId: { type: "string", required: true },
      planId: { type: PLAN_IDS, required: true },
      stripeCustomerId: { type: "string", required: true },
      stripeSubscriptionId: { type: "string", required: true },
      status: { type: SUBSCRIPTION_STATUSES, required: true },
      currentPeriodEnd: { type: "string" },
      cancelAtPeriodEnd: { type: "boolean", default: false },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["userId"] },
        sk: { field: "sk", composite: [] },
      },
      byStripeSubscription: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["stripeSubscriptionId"] },
        sk: { field: "gsi1sk", composite: [] },
      },
      byStripeCustomer: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["stripeCustomerId"] },
        sk: { field: "gsi2sk", composite: [] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);
