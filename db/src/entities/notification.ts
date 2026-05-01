import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const NOTIFICATION_TYPES = [
  "booking_created",
  "booking_confirmed",
  "booking_cancelled",
  "booking_refunded",
  "new_dm",
  "new_classroom_message",
  "support_ticket_reply",
  "review_posted",
  "lesson_request_created",
  "lesson_request_accepted",
  "lesson_request_rejected",
  "child_link_requested",
  "child_link_accepted",
  "child_link_rejected",
  "session_scheduled",
  "session_reminder",
  "listing_sold",
  "profile_verified",
  "profile_rejected",
  "new_grade",
  "event_cancelled",
  "session_cancelled",
  "member_removed",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NotificationEntity = new Entity(
  {
    model: { entity: "notification", version: "1", service: SERVICE },
    attributes: {
      userId: { type: "string", required: true },
      notificationId: { type: "string", required: true },
      type: { type: NOTIFICATION_TYPES, required: true },
      title: { type: "string", required: true },
      body: { type: "string", required: true },
      linkPath: { type: "string" },
      readAt: { type: "string" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["userId"] },
        sk: { field: "sk", composite: ["notificationId"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export function makeNotificationId(): string {
  const ts = new Date().toISOString();
  const suffix = Math.random().toString(36).slice(2, 8);
  return `notif#${ts}#${suffix}`;
}
