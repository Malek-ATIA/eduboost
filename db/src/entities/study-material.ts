import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const STUDY_MATERIAL_KINDS = ["exam", "notes", "answers", "other"] as const;
export type StudyMaterialKind = (typeof STUDY_MATERIAL_KINDS)[number];

// Peer-shared study materials — students and teachers alike can upload exam
// papers, notes, and answer keys for other learners to download. No price,
// no storefront: this is the free counterpart to the marketplace.

export const StudyMaterialEntity = new Entity(
  {
    model: { entity: "studyMaterial", version: "1", service: SERVICE },
    attributes: {
      materialId: { type: "string", required: true },
      authorId: { type: "string", required: true },
      kind: { type: STUDY_MATERIAL_KINDS, required: true },
      title: { type: "string", required: true },
      subject: { type: "string", required: true },
      description: { type: "string" },
      // Premium materials require an active student_premium membership to
      // download. The listing + metadata remains visible to all users so
      // upsell hooks can render a "premium" badge and a "Subscribe to unlock"
      // prompt. Authors and admins can always download their own/any material.
      premium: { type: "boolean", default: false },
      fileS3Key: { type: "string" },
      fileMimeType: { type: "string" },
      fileSizeBytes: { type: "number" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["materialId"] },
        sk: { field: "sk", composite: [] },
      },
      byAuthor: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["authorId"] },
        sk: { field: "gsi1sk", composite: ["createdAt"] },
      },
      byKind: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["kind"] },
        sk: { field: "gsi2sk", composite: ["createdAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export function makeMaterialId(): string {
  return `mat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
