import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const VERIFICATION_STATUSES = [
  "unsubmitted",
  "pending",
  "verified",
  "rejected",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const TeacherProfileEntity = new Entity(
  {
    model: { entity: "teacherProfile", version: "1", service: SERVICE },
    attributes: {
      userId: { type: "string", required: true },
      bio: { type: "string" },
      subjects: { type: "list", items: { type: "string" }, default: [] },
      languages: { type: "list", items: { type: "string" }, default: [] },
      yearsExperience: { type: "number", default: 0 },
      hourlyRateCents: { type: "number", required: true },
      currency: { type: "string", default: "EUR" },
      ratingAvg: { type: "number", default: 0 },
      ratingCount: { type: "number", default: 0 },
      verifiedAt: { type: "string" },
      // Sponsored teacher slot: admins set this to an ISO timestamp; profiles
      // with `sponsoredUntil > now` bubble to the top of the teacher browse
      // results. MVP: admin-managed only (no self-serve purchase flow yet).
      sponsoredUntil: { type: "string" },
      verificationStatus: { type: VERIFICATION_STATUSES, default: "unsubmitted" },
      verificationNotes: { type: "string" },
      verifiedBy: { type: "string" },
      trialSession: { type: "boolean", default: false },
      individualSessions: { type: "boolean", default: true },
      groupSessions: { type: "boolean", default: false },
      city: { type: "string" },
      country: { type: "string" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["userId"] },
        sk: { field: "sk", composite: [] },
      },
      byCountry: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["country"] },
        sk: { field: "gsi1sk", composite: ["ratingAvg"] },
      },
      byVerificationStatus: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["verificationStatus"] },
        sk: { field: "gsi2sk", composite: ["updatedAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);
