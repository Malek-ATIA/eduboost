import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const ReviewEntity = new Entity(
  {
    model: { entity: "review", version: "1", service: SERVICE },
    attributes: {
      reviewId: { type: "string", required: true },
      teacherId: { type: "string", required: true },
      reviewerId: { type: "string", required: true },
      bookingId: { type: "string", required: true },
      rating: { type: "number", required: true },
      comment: { type: "string" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["reviewId"] },
        sk: { field: "sk", composite: [] },
      },
      byTeacher: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["teacherId"] },
        sk: { field: "gsi1sk", composite: ["createdAt"] },
      },
      byReviewer: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["reviewerId"] },
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

export function makeReviewId(): string {
  const ts = Date.now().toString(36);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `rv_${ts}${suffix}`;
}
