import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  ClassroomEntity,
  ClassroomMembershipEntity,
  SessionEntity,
  UserEntity,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";
import { notify } from "../lib/notifications.js";

const s3 = new S3Client({ region: env.region });

export const classroomRoutes = new Hono();

classroomRoutes.use("*", requireAuth);

// Hydrated list for the signed-in user: memberships joined against the
// classroom row so the UI can render title/subject/status directly without
// a follow-up N+1. Teachers see classrooms they teach; students/parents see
// ones they're enrolled in.
classroomRoutes.get("/mine", async (c) => {
  const { sub } = c.get("auth");
  const memberships = await ClassroomMembershipEntity.query.byUser({ userId: sub }).go();
  const classrooms = await Promise.all(
    memberships.data.map(async (m) => {
      const r = await ClassroomEntity.get({ classroomId: m.classroomId }).go();
      return r.data ? { ...r.data, myRole: m.role, joinedAt: m.joinedAt } : null;
    }),
  );
  return c.json({ items: classrooms.filter((x): x is NonNullable<typeof x> => !!x) });
});

const createSchema = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  maxStudents: z.number().int().min(1).max(250).default(1),
});

classroomRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const { sub, groups } = c.get("auth");
  // Role check goes against UserEntity.role (the source of truth at MVP),
  // not cognito:groups — the post-confirmation Lambda writes the DB row with
  // `role` set, but Cognito group assignment is a separate manual step the
  // platform hasn't automated yet. Admin-group callers can always create.
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);
  const isAdmin = groups.includes("admin");
  if (user.data.role !== "teacher" && !isAdmin) {
    return c.json({ error: "only_teachers_or_admins" }, 403);
  }
  const body = c.req.valid("json");
  const classroomId = `cls_${nanoid(12)}`;
  const result = await ClassroomEntity.create({
    classroomId,
    teacherId: sub,
    status: "active",
    ...body,
  }).go();
  await ClassroomMembershipEntity.create({ classroomId, userId: sub, role: "teacher" }).go();
  return c.json(result.data, 201);
});

classroomRoutes.get("/:classroomId", async (c) => {
  const classroomId = c.req.param("classroomId");
  const result = await ClassroomEntity.get({ classroomId }).go();
  if (!result.data) return c.json({ error: "not found" }, 404);
  return c.json(result.data);
});

// Teacher updates classroom metadata — title, subject, description, max
// students, chat toggle, status. Owner-only by design.
const patchClassroomSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    subject: z.string().min(1).max(100).optional(),
    description: z.string().max(2000).optional(),
    maxStudents: z.number().int().min(1).max(250).optional(),
    chatEnabled: z.boolean().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "no fields" });

classroomRoutes.patch(
  "/:classroomId",
  zValidator("json", patchClassroomSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const classroomId = c.req.param("classroomId");
    const existing = await ClassroomEntity.get({ classroomId }).go();
    if (!existing.data) return c.json({ error: "not_found" }, 404);
    if (existing.data.teacherId !== sub) return c.json({ error: "forbidden" }, 403);
    const body = c.req.valid("json");
    await ClassroomEntity.patch({ classroomId }).set(body).go();
    return c.json({ ok: true });
  },
);

// Sessions for a classroom — teacher + members only. Returns the scheduled
// session metadata plus a boolean indicating whether a recording file exists
// on S3 (so the UI can render a Download button without a second round-trip).
classroomRoutes.get("/:classroomId/sessions", async (c) => {
  const { sub } = c.get("auth");
  const classroomId = c.req.param("classroomId");
  const cls = await ClassroomEntity.get({ classroomId }).go();
  if (!cls.data) return c.json({ error: "not_found" }, 404);
  const membership = await ClassroomMembershipEntity.get({ classroomId, userId: sub }).go();
  if (cls.data.teacherId !== sub && !membership.data) {
    return c.json({ error: "forbidden" }, 403);
  }
  const rows = await SessionEntity.query.byClassroom({ classroomId }).go({ limit: 100 });
  const items = rows.data.map((s) => ({
    sessionId: s.sessionId,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    status: s.status,
    hasRecording: !!s.recordingS3Key,
  }));
  // ElectroDB returns oldest-first for the composite sort key; most users
  // expect "latest at top" for recordings, so we reverse before responding.
  items.sort((a, b) => (b.startsAt ?? "").localeCompare(a.startsAt ?? ""));
  return c.json({ items });
});

// Signed GET URL for a session recording. Authorised: teacher of the
// classroom OR any current member. 15-minute TTL is plenty for the user
// to click download; browser triggers the save once the request lands.
classroomRoutes.get("/:classroomId/sessions/:sessionId/recording-url", async (c) => {
  const { sub } = c.get("auth");
  const classroomId = c.req.param("classroomId");
  const sessionId = c.req.param("sessionId");
  const [cls, session] = await Promise.all([
    ClassroomEntity.get({ classroomId }).go(),
    SessionEntity.get({ sessionId }).go(),
  ]);
  if (!cls.data || !session.data) return c.json({ error: "not_found" }, 404);
  if (session.data.classroomId !== classroomId) {
    return c.json({ error: "not_found" }, 404);
  }
  if (!session.data.recordingS3Key) return c.json({ error: "no_file" }, 404);
  const membership = await ClassroomMembershipEntity.get({ classroomId, userId: sub }).go();
  if (cls.data.teacherId !== sub && !membership.data) {
    return c.json({ error: "forbidden" }, 403);
  }
  // Chime MediaPipelines writes a folder of media segments under the prefix;
  // we expose the prefix itself so the UI can link to an S3 console listing
  // if it wants, while "url" points at the manifest object (segment-0) which
  // is the common case for single-session playback.
  const cmd = new GetObjectCommand({
    Bucket: env.recordingsBucket,
    Key: session.data.recordingS3Key,
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn: 900 });
  return c.json({ url, prefix: session.data.recordingS3Key });
});

// Hydrated members list — teacher or current members may view. Strangers are
// blocked to prevent enumeration of who is in a given classroom.
classroomRoutes.get("/:classroomId/members", async (c) => {
  const { sub } = c.get("auth");
  const classroomId = c.req.param("classroomId");
  const cls = await ClassroomEntity.get({ classroomId }).go();
  if (!cls.data) return c.json({ error: "not_found" }, 404);
  const viewer = await ClassroomMembershipEntity.get({ classroomId, userId: sub }).go();
  if (cls.data.teacherId !== sub && !viewer.data) {
    return c.json({ error: "forbidden" }, 403);
  }
  const rows = await ClassroomMembershipEntity.query.primary({ classroomId }).go();
  const hydrated = await Promise.all(
    rows.data.map(async (m) => {
      const u = await UserEntity.get({ userId: m.userId }).go();
      return {
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        displayName: u.data?.displayName,
        email: u.data?.email,
      };
    }),
  );
  return c.json({ items: hydrated });
});

// Add a member by email. Teacher-only. Enforces the classroom's maxStudents
// cap when adding a student role so we don't over-sell a physical-room limit.
// Returns specific error codes the UI can map to friendly messages.
const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["student", "observer"]).default("student"),
});

classroomRoutes.post(
  "/:classroomId/members",
  zValidator("json", addMemberSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const classroomId = c.req.param("classroomId");
    const { email, role } = c.req.valid("json");

    const cls = await ClassroomEntity.get({ classroomId }).go();
    if (!cls.data) return c.json({ error: "not_found" }, 404);
    if (cls.data.teacherId !== sub) return c.json({ error: "forbidden" }, 403);

    const matches = await UserEntity.query.byEmail({ email }).go({ limit: 1 });
    const target = matches.data[0];
    if (!target) return c.json({ error: "user_not_found" }, 404);
    if (target.userId === sub) return c.json({ error: "cannot_add_self" }, 400);

    const existing = await ClassroomMembershipEntity.get({
      classroomId,
      userId: target.userId,
    }).go();
    if (existing.data) return c.json({ error: "already_member" }, 409);

    if (role === "student") {
      const all = await ClassroomMembershipEntity.query.primary({ classroomId }).go();
      const studentCount = all.data.filter((m) => m.role === "student").length;
      const cap = cls.data.maxStudents ?? 1;
      if (studentCount >= cap) {
        return c.json({ error: "classroom_full" }, 409);
      }
    }

    await ClassroomMembershipEntity.create({
      classroomId,
      userId: target.userId,
      role,
    }).go();

    return c.json(
      {
        userId: target.userId,
        role,
        displayName: target.displayName,
        email: target.email,
      },
      201,
    );
  },
);

// Remove a member. Teacher can remove anyone but themselves; members can
// remove themselves (leave the classroom). Teachers can't remove the teacher
// row — the ownership transfer story is deferred to post-MVP.
classroomRoutes.delete("/:classroomId/members/:userId", async (c) => {
  const { sub } = c.get("auth");
  const classroomId = c.req.param("classroomId");
  const userId = c.req.param("userId");

  const cls = await ClassroomEntity.get({ classroomId }).go();
  if (!cls.data) return c.json({ error: "not_found" }, 404);

  const isTeacher = cls.data.teacherId === sub;
  const isSelf = userId === sub;
  if (!isTeacher && !isSelf) return c.json({ error: "forbidden" }, 403);
  if (userId === cls.data.teacherId) {
    return c.json({ error: "cannot_remove_teacher" }, 400);
  }

  const existing = await ClassroomMembershipEntity.get({ classroomId, userId }).go();
  if (!existing.data) return c.json({ error: "not_a_member" }, 404);

  await ClassroomMembershipEntity.delete({ classroomId, userId }).go();

  if (userId !== sub) {
    try {
      await notify({
        userId,
        type: "member_removed",
        title: "Removed from classroom",
        body: `You have been removed from the classroom "${cls.data.title}".`,
        linkPath: `/classrooms`,
      });
    } catch (err) {
      console.error("classrooms.removeMember: notify failed (non-fatal)", err);
    }
  }

  return c.json({ ok: true });
});

// External resource links (Drive/Docs/Slides/Sheets/videos/other). Teacher-only
// patch; replaces the whole list atomically so the caller doesn't race itself
// by appending while a stale copy is in state. Capped at 25 to bound the row.
const resourcesSchema = z.object({
  resources: z
    .array(
      z.object({
        url: z.string().url().max(2000),
        label: z.string().trim().min(1).max(120),
        kind: z
          .enum(["drive", "docs", "slides", "sheets", "video", "other"])
          .default("other"),
      }),
    )
    .max(25),
});

classroomRoutes.put(
  "/:classroomId/resources",
  zValidator("json", resourcesSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const classroomId = c.req.param("classroomId");
    const { resources } = c.req.valid("json");
    const existing = await ClassroomEntity.get({ classroomId }).go();
    if (!existing.data) return c.json({ error: "not_found" }, 404);
    if (existing.data.teacherId !== sub) return c.json({ error: "forbidden" }, 403);
    await ClassroomEntity.patch({ classroomId }).set({ resources }).go();
    return c.json({ ok: true, resources });
  },
);
