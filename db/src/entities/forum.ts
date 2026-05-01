import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const FORUM_VOTE_TARGETS = ["post", "comment"] as const;
export type ForumVoteTarget = (typeof FORUM_VOTE_TARGETS)[number];

export const FORUM_VOTE_DIRECTIONS = ["up", "down"] as const;
export type ForumVoteDirection = (typeof FORUM_VOTE_DIRECTIONS)[number];

export const ForumPostEntity = new Entity(
  {
    model: { entity: "forumPost", version: "1", service: SERVICE },
    attributes: {
      postId: { type: "string", required: true },
      channelId: { type: "string", required: true },
      authorId: { type: "string", required: true },
      title: { type: "string", required: true },
      body: { type: "string", required: true },
      upvotes: { type: "number", default: 0 },
      downvotes: { type: "number", default: 0 },
      score: { type: "number", default: 0 },
      commentCount: { type: "number", default: 0 },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["postId"] },
        sk: { field: "sk", composite: [] },
      },
      byChannel: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["channelId"] },
        sk: { field: "gsi1sk", composite: ["createdAt"] },
      },
      byAuthor: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["authorId"] },
        sk: { field: "gsi2sk", composite: ["createdAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export const ForumCommentEntity = new Entity(
  {
    model: { entity: "forumComment", version: "1", service: SERVICE },
    attributes: {
      postId: { type: "string", required: true },
      commentId: { type: "string", required: true },
      authorId: { type: "string", required: true },
      body: { type: "string", required: true },
      upvotes: { type: "number", default: 0 },
      downvotes: { type: "number", default: 0 },
      score: { type: "number", default: 0 },
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

export const ForumVoteEntity = new Entity(
  {
    model: { entity: "forumVote", version: "1", service: SERVICE },
    attributes: {
      targetId: { type: "string", required: true },
      userId: { type: "string", required: true },
      targetType: { type: FORUM_VOTE_TARGETS, required: true },
      direction: { type: FORUM_VOTE_DIRECTIONS, required: true },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["targetId"] },
        sk: { field: "sk", composite: ["userId"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export const FORUM_REACTIONS = ["like", "love", "laugh", "wow", "insightful", "celebrate"] as const;
export type ForumReaction = (typeof FORUM_REACTIONS)[number];

export const ForumReactionEntity = new Entity(
  {
    model: { entity: "forumReaction", version: "1", service: SERVICE },
    attributes: {
      targetId: { type: "string", required: true },
      userId: { type: "string", required: true },
      targetType: { type: FORUM_VOTE_TARGETS, required: true },
      reaction: { type: FORUM_REACTIONS, required: true },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["targetId"] },
        sk: { field: "sk", composite: ["userId", "reaction"] },
      },
      byUser: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["userId"] },
        sk: { field: "gsi1sk", composite: ["targetId"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export function makePostId(): string {
  return `post_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function makeCommentId(): string {
  const ts = new Date().toISOString();
  const suffix = Math.random().toString(36).slice(2, 8);
  return `c#${ts}#${suffix}`;
}
