import {
  SessionEntity,
  ClassroomEntity,
  ClassroomMembershipEntity,
  UserEntity,
} from "@eduboost/db";
import { notify } from "../lib/notifications.js";

type ReminderEvent = {
  sessionId: string;
  kind: "24h" | "1h";
};

export const handler = async (event: ReminderEvent): Promise<void> => {
  const { sessionId, kind } = event;
  if (!sessionId) {
    console.warn("reminder: no sessionId in event");
    return;
  }

  const session = await SessionEntity.get({ sessionId }).go();
  if (!session.data) {
    console.warn("reminder: session not found", { sessionId });
    return;
  }

  if (session.data.status === "cancelled" || session.data.status === "completed") {
    console.log("reminder: session no longer active, skipping", { sessionId, status: session.data.status });
    return;
  }

  const [members, classroom] = await Promise.all([
    ClassroomMembershipEntity.query
      .primary({ classroomId: session.data.classroomId })
      .go({ limit: 250 }),
    ClassroomEntity.get({ classroomId: session.data.classroomId }).go(),
  ]);

  const startLocal = new Date(session.data.startsAt).toLocaleString("en-IE", {
    timeZone: "Europe/Dublin",
    dateStyle: "full",
    timeStyle: "short",
  });
  const subject = classroom.data?.subject ?? "your session";
  const when =
    kind === "24h"
      ? "tomorrow"
      : kind === "1h"
        ? "in about an hour"
        : `on ${startLocal}`;

  await Promise.all(
    members.data.map(async (m) => {
      const user = await UserEntity.get({ userId: m.userId }).go();
      const displayName = user.data?.displayName ?? "there";
      const html = `<p>Hi ${escape(displayName)},</p>
<p>Reminder: your ${escape(subject)} session is ${escape(when)} (${escape(startLocal)}).</p>
<p><a href="https://eduboost.com/calendar">Open your calendar</a> to join.</p>`;
      await notify({
        userId: m.userId,
        type: "session_reminder",
        title: kind === "24h" ? "Session tomorrow" : "Session in 1 hour",
        body: `Your ${subject} session starts ${when}.`,
        linkPath: `/calendar`,
        email: { subject: `Reminder: session ${when}`, html },
      });
    }),
  );
};

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
