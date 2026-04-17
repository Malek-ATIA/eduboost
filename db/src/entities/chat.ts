import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const ChatMessageEntity = new Entity(
  {
    model: { entity: "chatMessage", version: "1", service: SERVICE },
    attributes: {
      channelId: { type: "string", required: true },
      messageId: { type: "string", required: true },
      senderId: { type: "string", required: true },
      body: { type: "string", required: true },
      kind: { type: ["text", "system"] as const, default: "text" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["channelId"] },
        sk: { field: "sk", composite: ["messageId"] },
      },
      bySender: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["senderId"] },
        sk: { field: "gsi1sk", composite: ["createdAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export function dmChannelId(userA: string, userB: string): string {
  const [a, b] = [userA, userB].sort();
  return `dm#${a}#${b}`;
}

export function classroomChannelId(classroomId: string): string {
  return `classroom#${classroomId}`;
}
