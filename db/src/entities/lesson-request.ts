import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const LESSON_REQUEST_STATUSES = ["pending", "accepted", "rejected", "expired", "cancelled"] as const;
export type LessonRequestStatus = (typeof LESSON_REQUEST_STATUSES)[number];

export const LessonRequestEntity = new Entity(
  {
    model: { entity: "lessonRequest", version: "1", service: SERVICE },
    attributes: {
      requestId: { type: "string", required: true },
      studentId: { type: "string", required: true },
      teacherId: { type: "string", required: true },
      subject: { type: "string", required: true },
      preferredTime: { type: "string" },
      message: { type: "string" },
      status: { type: LESSON_REQUEST_STATUSES, default: "pending" },
      responseMessage: { type: "string" },
      respondedAt: { type: "string" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["requestId"] },
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

export function makeLessonRequestId(): string {
  const ts = Date.now().toString(36);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `req_${ts}${suffix}`;
}
