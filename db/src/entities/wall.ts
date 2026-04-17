import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const WallPostEntity = new Entity(
  {
    model: { entity: "wallPost", version: "1", service: SERVICE },
    attributes: {
      postId: { type: "string", required: true },
      teacherId: { type: "string", required: true },
      body: { type: "string", required: true },
      commentCount: { type: "number", default: 0 },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["postId"] },
        sk: { field: "sk", composite: [] },
      },
      byTeacher: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["teacherId"] },
        sk: { field: "gsi1sk", composite: ["createdAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export const WallCommentEntity = new Entity(
  {
    model: { entity: "wallComment", version: "1", service: SERVICE },
    attributes: {
      postId: { type: "string", required: true },
      commentId: { type: "string", required: true },
      authorId: { type: "string", required: true },
      body: { type: "string", required: true },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["postId"] },
        sk: { field: "sk", composite: ["commentId"] },
      },
      byAuthor: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["authorId"] },
        sk: { field: "gsi1sk", composite: ["createdAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export function makeWallPostId(): string {
  return `wall_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function makeWallCommentId(): string {
  const ts = new Date().toISOString();
  const suffix = Math.random().toString(36).slice(2, 8);
  return `wc#${ts}#${suffix}`;
}
