import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const ASSESSMENT_STATUSES = ["draft", "published", "archived"] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

// Question shape is enforced by the route-level zod schema since ElectroDB's
// type system can't express discriminated unions. Stored as raw list items.
// Shape:
//   { kind: "mcq", prompt: string, options: string[], correctIndex: number }
//   { kind: "short", prompt: string }

export const AssessmentEntity = new Entity(
  {
    model: { entity: "assessment", version: "1", service: SERVICE },
    attributes: {
      examId: { type: "string", required: true },
      teacherId: { type: "string", required: true },
      title: { type: "string", required: true },
      description: { type: "string" },
      questions: { type: "list", items: { type: "any" }, default: [] },
      status: { type: ASSESSMENT_STATUSES, default: "draft" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["examId"] },
        sk: { field: "sk", composite: [] },
      },
      byTeacher: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["teacherId"] },
        sk: { field: "gsi1sk", composite: ["createdAt"] },
      },
      byStatus: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["status"] },
        sk: { field: "gsi2sk", composite: ["createdAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

// Per (exam, student) attempt row. `answers` parallels the exam's questions
// list; for MCQ it stores the chosen option index (number), for short-answer
// a free-text string. `autoScore` is the sum of correctly-answered MCQ items,
// `maxMcqScore` is the total number of MCQ questions. Manual grading for
// short-answer is not part of the aggregate; the teacher sees raw answers.

export const AssessmentAttemptEntity = new Entity(
  {
    model: { entity: "assessmentAttempt", version: "1", service: SERVICE },
    attributes: {
      examId: { type: "string", required: true },
      studentId: { type: "string", required: true },
      answers: { type: "list", items: { type: "any" }, default: [] },
      autoScore: { type: "number", required: true },
      maxMcqScore: { type: "number", required: true },
      submittedAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["examId"] },
        sk: { field: "sk", composite: ["studentId"] },
      },
      byStudent: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["studentId"] },
        sk: { field: "gsi1sk", composite: ["examId"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export function makeExamId(): string {
  return `ex_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
