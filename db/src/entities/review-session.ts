import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const REVIEW_SESSION_STATUSES = ["requested", "scheduled", "completed", "declined"] as const;
export type ReviewSessionStatus = (typeof REVIEW_SESSION_STATUSES)[number];

// Post-course retrospective meetings — distinct from a star review. A student
// or teacher can request one against a specific booking; the counterparty
// accepts + schedules a time; both parties mark it completed. No payment; the
// meeting is a courtesy wrap-up conversation.

export const ReviewSessionEntity = new Entity(
  {
    model: { entity: "reviewSession", version: "1", service: SERVICE },
    attributes: {
      reviewSessionId: { type: "string", required: true },
      bookingId: { type: "string", required: true },
      studentId: { type: "string", required: true },
      teacherId: { type: "string", required: true },
      requestedBy: { type: "string", required: true },
      status: { type: REVIEW_SESSION_STATUSES, default: "requested" },
      scheduledAt: { type: "string" },
      notes: { type: "string" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["reviewSessionId"] },
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
      byBooking: {
        index: "gsi3",
        pk: { field: "gsi3pk", composite: ["bookingId"] },
        sk: { field: "gsi3sk", composite: [] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export function makeReviewSessionId(): string {
  return `rvs_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
