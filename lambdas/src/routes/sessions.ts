import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  SessionEntity,
  ClassroomEntity,
  ClassroomMembershipEntity,
  BookingEntity,
  UserEntity,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../lib/notifications.js";
import { scheduleReminders, rescheduleReminders, cancelReminders } from "../lib/scheduler.js";

export const sessionRoutes = new Hono();

sessionRoutes.use("*", requireAuth);

sessionRoutes.get("/upcoming", async (c) => {
  const { sub } = c.get("auth");
  const now = new Date().toISOString();

  // Sessions where caller is the teacher.
  const asTeacher = await SessionEntity.query
    .byTeacher({ teacherId: sub })
    .gte({ startsAt: now })
    .go({ limit: 50 });

  // Sessions where caller is a classroom member (student / observer).
  const memberships = await ClassroomMembershipEntity.query
    .byUser({ userId: sub })
    .go({ limit: 100 });

  const asMember = (
    await Promise.all(
      memberships.data
        .filter((m) => m.role !== "teacher")
        .map((m) =>
          SessionEntity.query
            .byClassroom({ classroomId: m.classroomId })
            .gte({ startsAt: now })
            .go({ limit: 50 })
            .then((r) => r.data),
        ),
    )
  ).flat();

  // Dedupe by sessionId (teacher + membership may overlap if a teacher is also a member).
  const map = new Map<string, (typeof asTeacher.data)[number]>();
  for (const s of [...asTeacher.data, ...asMember]) map.set(s.sessionId, s);
  const items = Array.from(map.values()).sort((a, b) =>
    a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0,
  );

  return c.json({ items });
});

sessionRoutes.get(
  "/:sessionId",
  zValidator("param", z.object({ sessionId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { sessionId } = c.req.valid("param");

    const session = await SessionEntity.get({ sessionId }).go();
    if (!session.data) return c.json({ error: "not_found" }, 404);

    if (session.data.teacherId !== sub) {
      const member = await ClassroomMembershipEntity.get({
        classroomId: session.data.classroomId,
        userId: sub,
      }).go();
      if (!member.data) return c.json({ error: "forbidden" }, 403);
    }

    return c.json(session.data);
  },
);

const createSchema = z
  .object({
    bookingId: z.string().trim().min(1).optional(),
    classroomId: z.string().trim().min(1).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .refine((d) => d.bookingId || d.classroomId, {
    message: "bookingId or classroomId is required",
  })
  .refine((d) => new Date(d.endsAt) > new Date(d.startsAt), {
    message: "endsAt must be after startsAt",
  })
  .refine((d) => new Date(d.startsAt) > new Date(Date.now() - 60_000), {
    message: "startsAt must be in the future",
  });

sessionRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const { sub } = c.get("auth");
  const body = c.req.valid("json");

  let classroomId = body.classroomId;
  let studentIdsToAdd: string[] = [];

  if (body.bookingId) {
    const booking = await BookingEntity.get({ bookingId: body.bookingId }).go();
    if (!booking.data) return c.json({ error: "booking_not_found" }, 404);
    if (booking.data.teacherId !== sub) return c.json({ error: "not_your_booking" }, 403);
    if (booking.data.status !== "confirmed" && booking.data.status !== "completed") {
      return c.json({ error: "booking_not_paid" }, 409);
    }

    if (booking.data.classroomId) {
      classroomId = booking.data.classroomId;
    } else {
      // Ad-hoc classroom for a 1:1 booking.
      classroomId = `cls_${nanoid(12)}`;
      let fallbackName: string;
      const student = await UserEntity.get({ userId: booking.data.studentId }).go();
      if (student.data?.displayName) {
        fallbackName = student.data.displayName;
      } else {
        const teacher = await UserEntity.get({ userId: sub }).go();
        fallbackName = teacher.data?.displayName ?? `user_${sub.slice(0, 6)}`;
      }
      const title = body.title ?? `Session with ${fallbackName}`;
      await ClassroomEntity.create({
        classroomId,
        teacherId: sub,
        title,
        subject: "General",
        maxStudents: 1,
        status: "active",
      }).go();
      await ClassroomMembershipEntity.create({ classroomId, userId: sub, role: "teacher" }).go();
      await BookingEntity.patch({ bookingId: body.bookingId }).set({ classroomId }).go();
    }
    studentIdsToAdd.push(booking.data.studentId);
  } else if (classroomId) {
    const classroom = await ClassroomEntity.get({ classroomId }).go();
    if (!classroom.data) return c.json({ error: "classroom_not_found" }, 404);
    if (classroom.data.teacherId !== sub) return c.json({ error: "not_your_classroom" }, 403);
  }

  if (!classroomId) return c.json({ error: "classroom_required" }, 400);

  // Ensure students have membership on the classroom.
  for (const studentId of studentIdsToAdd) {
    const existing = await ClassroomMembershipEntity.get({ classroomId, userId: studentId }).go();
    if (!existing.data) {
      await ClassroomMembershipEntity.create({
        classroomId,
        userId: studentId,
        role: "student",
      }).go();
    }
  }

  const sessionId = `ses_${nanoid(12)}`;
  const session = await SessionEntity.create({
    sessionId,
    classroomId,
    teacherId: sub,
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    status: "scheduled",
  }).go();

  // Schedule 24h / 1h reminders via EventBridge Scheduler (non-fatal on failure).
  try {
    await scheduleReminders(sessionId, body.startsAt);
  } catch (err) {
    console.error("sessions.post: scheduleReminders failed (non-fatal)", err);
  }

  // Notify all non-teacher members of this classroom.
  try {
    const members = await ClassroomMembershipEntity.query
      .primary({ classroomId })
      .go({ limit: 250 });
    const teacher = await UserEntity.get({ userId: sub }).go();
    const teacherName = teacher.data?.displayName ?? "Your teacher";
    const startLocal = new Date(body.startsAt).toLocaleString();
    await Promise.all(
      members.data
        .filter((m) => m.userId !== sub)
        .map((m) =>
          notify({
            userId: m.userId,
            type: "session_scheduled",
            title: "Session scheduled",
            body: `${teacherName} scheduled a session on ${startLocal}.`,
            linkPath: `/calendar`,
          }),
        ),
    );
  } catch (err) {
    console.error("sessions.post: notify failed (non-fatal)", err);
  }

  return c.json(session.data, 201);
});

const patchSchema = z
  .object({
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    status: z.enum(["scheduled", "cancelled"]).optional(),
  })
  .refine((d) => d.startsAt || d.endsAt || d.status, {
    message: "at least one field required",
  });

sessionRoutes.patch(
  "/:sessionId",
  zValidator("param", z.object({ sessionId: z.string().min(1) })),
  zValidator("json", patchSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { sessionId } = c.req.valid("param");
    const body = c.req.valid("json");
    const session = await SessionEntity.get({ sessionId }).go();
    if (!session.data) return c.json({ error: "not_found" }, 404);
    if (session.data.teacherId !== sub) return c.json({ error: "forbidden" }, 403);
    if (session.data.status === "completed") {
      return c.json({ error: "already_completed" }, 409);
    }
    const effectiveStartsAt = body.startsAt ?? session.data.startsAt;
    const effectiveEndsAt = body.endsAt ?? session.data.endsAt;
    if (new Date(effectiveEndsAt) <= new Date(effectiveStartsAt)) {
      return c.json({ error: "endsAt_before_startsAt" }, 400);
    }
    await SessionEntity.patch({ sessionId }).set(body).go();

    // Keep EventBridge Scheduler entries in sync with the updated session.
    try {
      if (body.status === "cancelled") {
        await cancelReminders(sessionId);
      } else if (body.startsAt && body.startsAt !== session.data.startsAt) {
        await rescheduleReminders(sessionId, body.startsAt);
      }
    } catch (err) {
      console.error("sessions.patch: reminder sync failed (non-fatal)", err);
    }

    return c.json({ ok: true });
  },
);
