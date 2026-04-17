import {
  NotificationEntity,
  makeNotificationId,
  type NotificationType,
  UserEntity,
} from "@eduboost/db";
import { sendEmail } from "./resend.js";
import { sendSms } from "./sms.js";

// Notification types that are urgent enough to also SMS opted-in users.
// Keep this list tight so users with SMS opt-in don't get spammed by
// low-priority notifications.
const SMS_NOTIFICATION_TYPES: readonly NotificationType[] = [
  "booking_confirmed",
  "booking_cancelled",
  "booking_refunded",
  "session_reminder",
  "lesson_request_accepted",
  "support_ticket_reply",
];

type NotifyArgs = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkPath?: string;
  email?: { subject: string; html: string } | null;
};

export async function notify(args: NotifyArgs): Promise<void> {
  try {
    await NotificationEntity.create({
      userId: args.userId,
      notificationId: makeNotificationId(),
      type: args.type,
      title: args.title,
      body: args.body,
      linkPath: args.linkPath,
    }).go();
  } catch (err) {
    console.error("notify: failed to create notification", { userId: args.userId, type: args.type, err });
  }

  // Load the user once if we need it for email AND/OR SMS.
  const needsUser = !!args.email || SMS_NOTIFICATION_TYPES.includes(args.type);
  if (!needsUser) return;

  let user;
  try {
    user = await UserEntity.get({ userId: args.userId }).go();
  } catch (err) {
    console.error("notify: user lookup failed (non-fatal)", err);
    return;
  }
  if (!user.data) return;

  if (args.email) {
    try {
      if (user.data.email) {
        await sendEmail({ to: user.data.email, subject: args.email.subject, html: args.email.html });
      }
    } catch (err) {
      console.error("notify: email send failed (non-fatal)", err);
    }
  }

  if (
    SMS_NOTIFICATION_TYPES.includes(args.type) &&
    user.data.smsOptIn &&
    user.data.phoneVerifiedAt &&
    user.data.phoneNumber
  ) {
    try {
      // Cap at 300 chars — fits two SMS segments (GSM-7 encoding), keeping
      // cost predictable while leaving enough room for title + body.
      const smsBody = `EduBoost: ${args.title} — ${args.body}`.slice(0, 300);
      await sendSms(user.data.phoneNumber, smsBody);
    } catch (err) {
      console.error("notify: sms send failed (non-fatal)", err);
    }
  }
}
