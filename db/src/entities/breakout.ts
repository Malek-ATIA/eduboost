import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const BreakoutRoomEntity = new Entity(
  {
    model: { entity: "breakoutRoom", version: "1", service: SERVICE },
    attributes: {
      sessionId: { type: "string", required: true },
      breakoutId: { type: "string", required: true },
      label: { type: "string", required: true },
      chimeMeetingId: { type: "string", required: true },
      createdBy: { type: "string", required: true },
      assignedUserIds: { type: "list", items: { type: "string" }, default: [] },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["sessionId"] },
        sk: { field: "sk", composite: ["breakoutId"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export function makeBreakoutId(): string {
  return `brk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
