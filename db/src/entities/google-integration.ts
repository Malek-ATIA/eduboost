import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const GoogleIntegrationEntity = new Entity(
  {
    model: { entity: "googleIntegration", version: "1", service: SERVICE },
    attributes: {
      userId: { type: "string", required: true },
      googleUserId: { type: "string" },
      googleEmail: { type: "string" },
      accessToken: { type: "string", required: true },
      refreshToken: { type: "string" },
      expiresAt: { type: "string", required: true },
      scope: { type: "string" },
      calendarId: { type: "string", default: "primary" },
      connectedAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["userId"] },
        sk: { field: "sk", composite: [] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

// Stores Google-issued Calendar event IDs per session so we can update/delete
// them later. Keyed by sessionId + the user whose Calendar the event lives in,
// because a single EduBoost session can have a Calendar event in the teacher's
// AND each member's linked Google account.
export const GoogleCalendarEventEntity = new Entity(
  {
    model: { entity: "googleCalendarEvent", version: "1", service: SERVICE },
    attributes: {
      sessionId: { type: "string", required: true },
      userId: { type: "string", required: true },
      googleEventId: { type: "string", required: true },
      calendarId: { type: "string", default: "primary" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
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
