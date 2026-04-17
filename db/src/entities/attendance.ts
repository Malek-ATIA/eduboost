import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const ATTENDANCE_STATUSES = ["present", "absent", "excused", "late"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const AttendanceEntity = new Entity(
  {
    model: { entity: "attendance", version: "1", service: SERVICE },
    attributes: {
      sessionId: { type: "string", required: true },
      userId: { type: "string", required: true },
      status: { type: ATTENDANCE_STATUSES, required: true },
      notes: { type: "string" },
      markedBy: { type: "string", required: true },
      markedAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["sessionId"] },
        sk: { field: "sk", composite: ["userId"] },
      },
      byUser: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["userId"] },
        sk: { field: "gsi1sk", composite: ["markedAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);
