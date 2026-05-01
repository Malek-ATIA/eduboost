import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const SessionEntity = new Entity(
  {
    model: { entity: "session", version: "1", service: SERVICE },
    attributes: {
      sessionId: { type: "string", required: true },
      classroomId: { type: "string", required: true },
      teacherId: { type: "string", required: true },
      startsAt: { type: "string", required: true },
      endsAt: { type: "string", required: true },
      status: { type: ["scheduled", "live", "completed", "cancelled"] as const, default: "scheduled" },
      chimeMeetingId: { type: "string" },
      chimePipelineId: { type: "string" },
      bookingId: { type: "string" },
      recordingS3Key: { type: "string" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["sessionId"] },
        sk: { field: "sk", composite: [] },
      },
      byClassroom: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["classroomId"] },
        sk: { field: "gsi1sk", composite: ["startsAt"] },
      },
      byTeacher: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["teacherId"] },
        sk: { field: "gsi2sk", composite: ["startsAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);
