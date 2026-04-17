import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  AttendanceEntity,
  ATTENDANCE_STATUSES,
  SessionEntity,
  ClassroomMembershipEntity,
  UserEntity,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";

export const attendanceRoutes = new Hono();

attendanceRoutes.use("*", requireAuth);

attendanceRoutes.get("/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await AttendanceEntity.query
    .byUser({ userId: sub })
    .go({ limit: 100, order: "desc" });
  return c.json({ items: result.data });
});

attendanceRoutes.get(
  "/sessions/:sessionId",
  zValidator("param", z.object({ sessionId: z.string().min(1) })),
  async (c) => {
    const { sub, groups } = c.get("auth");
    const { sessionId } = c.req.valid("param");
    const session = await SessionEntity.get({ sessionId }).go();
    if (!session.data) return c.json({ error: "session_not_found" }, 404);

    const isTeacher = session.data.teacherId === sub;
    const isAdmin = groups.includes("admin");
    if (!isTeacher && !isAdmin) {
      // Students can only read their OWN attendance record for this session.
      const own = await AttendanceEntity.get({ sessionId, userId: sub }).go();
      if (!own.data) return c.json({ items: [] });
      return c.json({ items: [own.data] });
    }

    const result = await AttendanceEntity.query.primary({ sessionId }).go({ limit: 250 });
    const hydrated = await Promise.all(
      result.data.map(async (r) => {
        try {
          const u = await UserEntity.get({ userId: r.userId }).go();
          return {
            ...r,
            user: u.data
              ? { userId: u.data.userId, displayName: u.data.displayName, email: u.data.email }
              : null,
          };
        } catch {
          return { ...r, user: null };
        }
      }),
    );
    return c.json({ items: hydrated });
  },
);

const markSchema = z.object({
  entries: z
    .array(
      z.object({
        userId: z.string().min(1),
        status: z.enum(ATTENDANCE_STATUSES),
        notes: z.string().trim().max(500).optional(),
      }),
    )
    .min(1)
    .max(250),
});

attendanceRoutes.post(
  "/sessions/:sessionId",
  zValidator("param", z.object({ sessionId: z.string().min(1) })),
  zValidator("json", markSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { sessionId } = c.req.valid("param");
    const { entries } = c.req.valid("json");

    const session = await SessionEntity.get({ sessionId }).go();
    if (!session.data) return c.json({ error: "session_not_found" }, 404);
    if (session.data.teacherId !== sub) return c.json({ error: "forbidden" }, 403);

    // Validate each userId is a classroom member so teachers can't mark random users.
    const memberships = await ClassroomMembershipEntity.query
      .primary({ classroomId: session.data.classroomId })
      .go({ limit: 250 });
    const memberSet = new Set(memberships.data.map((m) => m.userId));

    const accepted: typeof entries = [];
    const rejected: { userId: string; reason: string }[] = [];
    for (const e of entries) {
      if (memberSet.has(e.userId)) accepted.push(e);
      else rejected.push({ userId: e.userId, reason: "not_a_member" });
    }

    for (const e of accepted) {
      await AttendanceEntity.upsert({
        sessionId,
        userId: e.userId,
        status: e.status,
        notes: e.notes,
        markedBy: sub,
      }).go();
    }

    return c.json({ marked: accepted.length, rejected });
  },
);
