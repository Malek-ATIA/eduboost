import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const TICKET_CATEGORIES = [
  "payment_dispute",
  "review_dispute",
  "booking_issue",
  "account",
  "technical",
  "abuse_report",
  "other",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_STATUSES = [
  "open",
  "in_review",
  "awaiting_user",
  "resolved",
  "closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_RESOLUTIONS = [
  "no_action",
  "refund_full",
  "refund_partial",
  "review_removed",
  "warning_issued",
] as const;
export type TicketResolution = (typeof TICKET_RESOLUTIONS)[number];

export const SupportTicketEntity = new Entity(
  {
    model: { entity: "supportTicket", version: "1", service: SERVICE },
    attributes: {
      ticketId: { type: "string", required: true },
      userId: { type: "string", required: true },
      subject: { type: "string", required: true },
      category: { type: TICKET_CATEGORIES, required: true },
      status: { type: TICKET_STATUSES, default: "open" },
      priority: { type: TICKET_PRIORITIES, default: "normal" },
      bookingId: { type: "string" },
      assignedAdminId: { type: "string" },
      // Dispute extensions — populated when the ticket is filed against a
      // specific payment or review. SLA deadline is computed from priority at
      // creation time; admins resolve by setting resolution + resolvedAt.
      relatedPaymentId: { type: "string" },
      relatedReviewId: { type: "string" },
      slaDeadline: { type: "string" },
      resolvedAt: { type: "string" },
      resolvedBy: { type: "string" },
      resolution: { type: TICKET_RESOLUTIONS },
      resolutionNote: { type: "string" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["ticketId"] },
        sk: { field: "sk", composite: [] },
      },
      byUser: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["userId"] },
        sk: { field: "gsi1sk", composite: ["createdAt"] },
      },
      byStatus: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["status"] },
        sk: { field: "gsi2sk", composite: ["createdAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export const TICKET_AUTHOR_ROLES = ["user", "admin", "system"] as const;
export type TicketAuthorRole = (typeof TICKET_AUTHOR_ROLES)[number];

export const TicketMessageEntity = new Entity(
  {
    model: { entity: "ticketMessage", version: "1", service: SERVICE },
    attributes: {
      ticketId: { type: "string", required: true },
      messageId: { type: "string", required: true },
      authorId: { type: "string", required: true },
      authorRole: { type: TICKET_AUTHOR_ROLES, required: true },
      body: { type: "string", required: true },
      attachments: {
        type: "list",
        items: {
          type: "map",
          properties: {
            s3Key: { type: "string", required: true },
            filename: { type: "string", required: true },
            mimeType: { type: "string" },
            sizeBytes: { type: "number" },
          },
        },
        default: [],
      },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["ticketId"] },
        sk: { field: "sk", composite: ["messageId"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export function makeTicketId(): string {
  const ts = Date.now().toString(36);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `tkt_${ts}${suffix}`;
}

export function makeTicketMessageId(): string {
  const ts = new Date().toISOString();
  const suffix = Math.random().toString(36).slice(2, 8);
  return `msg#${ts}#${suffix}`;
}
