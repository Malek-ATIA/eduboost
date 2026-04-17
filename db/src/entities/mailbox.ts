import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

// Threaded parent↔teacher async inbox. Distinct from DMs: a thread carries a
// subject line, a participant pair, and a last-message pointer so the UI can
// render a classic email-style list without scanning every message.
//
// threadId is deterministic from the sorted pair of userIds so the same two
// users can't accidentally open two parallel threads — call dmThreadId() in
// route code to build it.

export const MailboxThreadEntity = new Entity(
  {
    model: { entity: "mailboxThread", version: "1", service: SERVICE },
    attributes: {
      threadId: { type: "string", required: true },
      participantA: { type: "string", required: true },
      participantB: { type: "string", required: true },
      subject: { type: "string", required: true },
      lastMessageBody: { type: "string" },
      lastMessageAt: { type: "string", default: () => new Date().toISOString() },
      lastMessageAuthorId: { type: "string" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["threadId"] },
        sk: { field: "sk", composite: [] },
      },
      byParticipantA: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["participantA"] },
        sk: { field: "gsi1sk", composite: ["lastMessageAt"] },
      },
      byParticipantB: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["participantB"] },
        sk: { field: "gsi2sk", composite: ["lastMessageAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export const MailboxMessageEntity = new Entity(
  {
    model: { entity: "mailboxMessage", version: "1", service: SERVICE },
    attributes: {
      threadId: { type: "string", required: true },
      messageId: { type: "string", required: true },
      authorId: { type: "string", required: true },
      body: { type: "string", required: true },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["threadId"] },
        sk: { field: "sk", composite: ["messageId"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export function dmThreadId(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return `mth_${x}_${y}`;
}

export function makeMailboxMessageId(): string {
  const ts = new Date().toISOString();
  const suffix = Math.random().toString(36).slice(2, 8);
  return `mmg#${ts}#${suffix}`;
}
