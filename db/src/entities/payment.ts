import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const PaymentEntity = new Entity(
  {
    model: { entity: "payment", version: "1", service: SERVICE },
    attributes: {
      paymentId: { type: "string", required: true },
      bookingId: { type: "string", required: true },
      payerId: { type: "string", required: true },
      payeeId: { type: "string", required: true },
      amountCents: { type: "number", required: true },
      platformFeeCents: { type: "number", default: 0 },
      currency: { type: "string", default: "EUR" },
      provider: { type: ["stripe"] as const, default: "stripe" },
      providerPaymentId: { type: "string" },
      status: { type: ["pending", "succeeded", "failed", "refunded"] as const, default: "pending" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["paymentId"] },
        sk: { field: "sk", composite: [] },
      },
      byBooking: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["bookingId"] },
        sk: { field: "gsi1sk", composite: ["createdAt"] },
      },
      byPayer: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["payerId"] },
        sk: { field: "gsi2sk", composite: ["createdAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);
