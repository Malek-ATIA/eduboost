import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const EVENT_STATUSES = ["draft", "published", "cancelled", "completed"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EventEntity = new Entity(
  {
    model: { entity: "event", version: "1", service: SERVICE },
    attributes: {
      eventId: { type: "string", required: true },
      organizerId: { type: "string", required: true },
      title: { type: "string", required: true },
      description: { type: "string" },
      venue: { type: "string", required: true },
      startsAt: { type: "string", required: true },
      endsAt: { type: "string", required: true },
      capacity: { type: "number", required: true },
      priceCents: { type: "number", required: true },
      currency: { type: "string", default: "TND" },
      status: { type: EVENT_STATUSES, default: "draft" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["eventId"] },
        sk: { field: "sk", composite: [] },
      },
      byOrganizer: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["organizerId"] },
        sk: { field: "gsi1sk", composite: ["startsAt"] },
      },
      byStatus: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["status"] },
        sk: { field: "gsi2sk", composite: ["startsAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export const EVENT_TICKET_STATUSES = ["pending", "paid", "cancelled", "refunded"] as const;
export type EventTicketStatus = (typeof EVENT_TICKET_STATUSES)[number];

export const EventTicketEntity = new Entity(
  {
    model: { entity: "eventTicket", version: "1", service: SERVICE },
    attributes: {
      eventId: { type: "string", required: true },
      userId: { type: "string", required: true },
      status: { type: EVENT_TICKET_STATUSES, default: "pending" },
      stripePaymentIntentId: { type: "string" },
      priceCents: { type: "number", required: true },
      currency: { type: "string", default: "TND" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["eventId"] },
        sk: { field: "sk", composite: ["userId"] },
      },
      byUser: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["userId"] },
        sk: { field: "gsi1sk", composite: ["eventId"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export function makeEventId(): string {
  return `evt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
