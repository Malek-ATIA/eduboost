import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const BookingEntity = new Entity(
  {
    model: { entity: "booking", version: "1", service: SERVICE },
    attributes: {
      bookingId: { type: "string", required: true },
      studentId: { type: "string", required: true },
      teacherId: { type: "string", required: true },
      classroomId: { type: "string" },
      sessionId: { type: "string" },
      type: { type: ["trial", "single", "package"] as const, required: true },
      status: { type: ["pending", "confirmed", "cancelled", "refunded", "completed"] as const, default: "pending" },
      amountCents: { type: "number", required: true },
      currency: { type: "string", default: "TND" },
      stripePaymentIntentId: { type: "string" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["bookingId"] },
        sk: { field: "sk", composite: [] },
      },
      byStudent: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["studentId"] },
        sk: { field: "gsi1sk", composite: ["createdAt"] },
      },
      byTeacher: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["teacherId"] },
        sk: { field: "gsi2sk", composite: ["createdAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);
