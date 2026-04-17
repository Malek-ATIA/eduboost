import {
  NotificationEntity,
  makeNotificationId,
  type NotificationType,
  UserEntity,
} from "@eduboost/db";
import { sendEmail } from "./resend.js";

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

  if (args.email) {
    try {
      const user = await UserEntity.get({ userId: args.userId }).go();
      if (user.data?.email) {
        await sendEmail({ to: user.data.email, subject: args.email.subject, html: args.email.html });
      }
    } catch (err) {
      console.error("notify: email send failed (non-fatal)", err);
    }
  }
}
