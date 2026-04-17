import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

// Per-session, per-user personal learning notes. Each participant (student or
// teacher) has their own row; nobody else can read or write it. The entity is
// pk=sessionId, sk=userId so a session's notes fan out by participant.

export const SessionNoteEntity = new Entity(
  {
    model: { entity: "sessionNote", version: "1", service: SERVICE },
    attributes: {
      sessionId: { type: "string", required: true },
      userId: { type: "string", required: true },
      body: { type: "string", required: true },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["sessionId"] },
        sk: { field: "sk", composite: ["userId"] },
      },
      byUser: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["userId"] },
        sk: { field: "gsi1sk", composite: ["sessionId"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);
