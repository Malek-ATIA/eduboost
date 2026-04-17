import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const AiGradeEntity = new Entity(
  {
    model: { entity: "aiGrade", version: "1", service: SERVICE },
    attributes: {
      gradeId: { type: "string", required: true },
      studentId: { type: "string", required: true },
      teacherId: { type: "string", required: true },
      subject: { type: "string", required: true },
      rubric: { type: "string" },
      submissionExcerpt: { type: "string" },
      submissionLength: { type: "number" },
      score: { type: "number", required: true },
      maxScore: { type: "number", default: 100 },
      feedback: { type: "string", required: true },
      modelId: { type: "string", required: true },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["gradeId"] },
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

export function makeGradeId(): string {
  return `gr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
