import {
  SchedulerClient,
  CreateScheduleCommand,
  UpdateScheduleCommand,
  DeleteScheduleCommand,
  ResourceNotFoundException,
  ConflictException,
  FlexibleTimeWindowMode,
} from "@aws-sdk/client-scheduler";
import { env } from "../env.js";

export type ReminderKind = "24h" | "1h";

type ReminderPayload = {
  sessionId: string;
  kind: ReminderKind;
};

const scheduler = new SchedulerClient({ region: env.region });

function scheduleName(sessionId: string, kind: ReminderKind): string {
  // EventBridge Scheduler names: [0-9A-Za-z._-]{1,64}. Replace any non-allowed chars.
  const safe = sessionId.replace(/[^0-9A-Za-z_-]/g, "_");
  return `s-${safe}-${kind}`.slice(0, 64);
}

function offsetMinutes(kind: ReminderKind): number {
  return kind === "24h" ? 24 * 60 : 60;
}

function fireAt(startsAtIso: string, kind: ReminderKind): Date {
  return new Date(new Date(startsAtIso).getTime() - offsetMinutes(kind) * 60_000);
}

function toScheduleExpression(fire: Date): string {
  // EventBridge Scheduler "at()" expects UTC without milliseconds or timezone.
  const iso = fire.toISOString().replace(/\.\d{3}Z$/, "");
  return `at(${iso})`;
}

async function upsertReminder(sessionId: string, kind: ReminderKind, startsAtIso: string): Promise<void> {
  if (!env.reminderLambdaArn || !env.schedulerRoleArn) {
    console.warn("scheduler: REMINDER_LAMBDA_ARN/SCHEDULER_ROLE_ARN not set, skipping schedule creation");
    return;
  }

  const fire = fireAt(startsAtIso, kind);
  // Reminders in the past get silently skipped; EventBridge Scheduler rejects them anyway.
  if (fire.getTime() <= Date.now() + 60_000) return;

  const name = scheduleName(sessionId, kind);
  const payload: ReminderPayload = { sessionId, kind };
  const common = {
    Name: name,
    GroupName: env.scheduleGroupName,
    ScheduleExpression: toScheduleExpression(fire),
    ScheduleExpressionTimezone: "UTC",
    FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
    Target: {
      Arn: env.reminderLambdaArn,
      RoleArn: env.schedulerRoleArn,
      Input: JSON.stringify(payload),
    },
    ActionAfterCompletion: "DELETE" as const,
  };

  try {
    await scheduler.send(new CreateScheduleCommand(common));
  } catch (err) {
    if (err instanceof ConflictException) {
      await scheduler.send(new UpdateScheduleCommand(common));
      return;
    }
    throw err;
  }
}

export async function scheduleReminders(sessionId: string, startsAtIso: string): Promise<void> {
  await Promise.all(
    (["24h", "1h"] as const).map((kind) =>
      upsertReminder(sessionId, kind, startsAtIso).catch((err) => {
        console.error("scheduler: upsertReminder failed (non-fatal)", { sessionId, kind, err });
      }),
    ),
  );
}

export async function rescheduleReminders(sessionId: string, startsAtIso: string): Promise<void> {
  // Same code path — upsert handles create-or-update.
  await scheduleReminders(sessionId, startsAtIso);
}

export async function cancelReminders(sessionId: string): Promise<void> {
  if (!env.schedulerRoleArn) return;
  await Promise.all(
    (["24h", "1h"] as const).map((kind) =>
      scheduler
        .send(
          new DeleteScheduleCommand({
            Name: scheduleName(sessionId, kind),
            GroupName: env.scheduleGroupName,
          }),
        )
        .catch((err) => {
          if (err instanceof ResourceNotFoundException) return;
          console.error("scheduler: cancelReminder failed (non-fatal)", { sessionId, kind, err });
        }),
    ),
  );
}
