import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

// Post-session structured quiz distinct from the star-review system: a student
// rates their teacher on three named dimensions (0..5) plus a "would recommend"
// boolean. One response per booking; pk=teacherId so aggregation is a single
// partition read.

export const TeacherQuizResponseEntity = new Entity(
  {
    model: { entity: "teacherQuizResponse", version: "1", service: SERVICE },
    attributes: {
      teacherId: { type: "string", required: true },
      bookingId: { type: "string", required: true },
      studentId: { type: "string", required: true },
      knowledge: { type: "number", required: true },
      clarity: { type: "number", required: true },
      patience: { type: "number", required: true },
      wouldRecommend: { type: "boolean", required: true },
      comment: { type: "string" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["teacherId"] },
        sk: { field: "sk", composite: ["bookingId"] },
      },
      byBooking: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["bookingId"] },
        sk: { field: "gsi1sk", composite: [] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);
