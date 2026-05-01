import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  TeacherProfileEntity,
  UserEntity,
  ClassroomEntity,
  ClassroomMembershipEntity,
  BookingEntity,
  AiGradeEntity,
  PaymentEntity,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";

const s3 = new S3Client({ region: env.region });
const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export const teacherRoutes = new Hono();

const listQuerySchema = z.object({
  subject: z.string().trim().min(1).max(100).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  country: z
    .string()
    .trim()
    .length(2)
    .transform((s) => s.toUpperCase())
    .optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  minExperience: z.coerce.number().int().min(0).max(80).optional(),
  minRateCents: z.coerce.number().int().nonnegative().optional(),
  maxRateCents: z.coerce.number().int().nonnegative().optional(),
  trial: z
    .enum(["true", "false"])
    .transform((s) => s === "true")
    .optional(),
  individual: z
    .enum(["true", "false"])
    .transform((s) => s === "true")
    .optional(),
  group: z
    .enum(["true", "false"])
    .transform((s) => s === "true")
    .optional(),
  // Scan-based browse with post-filter: DDB's Limit caps items EXAMINED per
  // page (not returned). Entities other than TeacherProfile share the table,
  // so a small limit can return fewer matches than expected. 200 is enough for
  // MVP volume; proper pagination via cursor is the next upgrade.
  limit: z.coerce.number().int().min(1).max(200).default(200),
});

teacherRoutes.get("/", zValidator("query", listQuerySchema), async (c) => {
  const q = c.req.valid("query");

  const query = TeacherProfileEntity.scan.where((attr, op) => {
    const parts: string[] = [];
    if (q.subject) parts.push(op.contains(attr.subjects, q.subject));
    if (q.city) parts.push(op.eq(attr.city, q.city));
    if (q.country) parts.push(op.eq(attr.country, q.country));
    if (q.minRating !== undefined) parts.push(op.gte(attr.ratingAvg, q.minRating));
    if (q.minExperience !== undefined) parts.push(op.gte(attr.yearsExperience, q.minExperience));
    if (q.minRateCents !== undefined) parts.push(op.gte(attr.hourlyRateCents, q.minRateCents));
    if (q.maxRateCents !== undefined) parts.push(op.lte(attr.hourlyRateCents, q.maxRateCents));
    if (q.trial !== undefined) parts.push(op.eq(attr.trialSession, q.trial));
    if (q.individual !== undefined) parts.push(op.eq(attr.individualSessions, q.individual));
    if (q.group !== undefined) parts.push(op.eq(attr.groupSessions, q.group));
    return parts.join(" AND ");
  });

  const result = await query.go({ limit: q.limit });
  // Sponsored teachers (sponsoredUntil > now) bubble to the top of the list.
  // Ordering is otherwise preserved — inside each group the scan's natural
  // order wins. This is a client-visible "Sponsored" slot the admin controls.
  const now = new Date().toISOString();
  const sponsored: typeof result.data = [];
  const regular: typeof result.data = [];
  for (const t of result.data) {
    if (t.sponsoredUntil && t.sponsoredUntil > now) sponsored.push(t);
    else regular.push(t);
  }
  const items = [...sponsored, ...regular];

  // Hydrate displayName from UserEntity so frontend can show teacher names.
  const userIds = items.map((t) => t.userId);
  const users = await Promise.all(
    userIds.map((id) => UserEntity.get({ userId: id }).go()),
  );
  const nameMap = new Map<string, string>();
  for (const u of users) {
    if (u.data) nameMap.set(u.data.userId, u.data.displayName);
  }
  const hydrated = items.map((t) => ({
    ...t,
    displayName: nameMap.get(t.userId) ?? undefined,
  }));

  return c.json({ items: hydrated, count: hydrated.length });
});

teacherRoutes.get("/:userId", async (c) => {
  const userId = c.req.param("userId");
  const [profile, user] = await Promise.all([
    TeacherProfileEntity.get({ userId }).go(),
    UserEntity.get({ userId }).go(),
  ]);
  if (!profile.data || !user.data) return c.json({ error: "not found" }, 404);
  return c.json({ profile: profile.data, user: user.data });
});

const profileSchema = z.object({
  bio: z.string().max(2000).optional(),
  subjects: z.array(z.string().min(1).max(100)).max(20).default([]),
  languages: z.array(z.string().min(1).max(50)).max(10).default([]),
  yearsExperience: z.number().int().min(0).max(80).default(0),
  hourlyRateCents: z.number().int().positive(),
  trialSession: z.boolean().default(false),
  individualSessions: z.boolean().default(true),
  groupSessions: z.boolean().default(false),
  city: z.string().max(100).optional(),
  country: z
    .string()
    .length(2)
    .transform((s) => s.toUpperCase())
    .optional(),
});

teacherRoutes.put("/me", requireAuth, zValidator("json", profileSchema), async (c) => {
  const { sub } = c.get("auth");
  const body = c.req.valid("json");
  const result = await TeacherProfileEntity.upsert({ userId: sub, ...body }).go();
  return c.json(result.data);
});

// Public: signed GET URL for a teacher's intro video.
teacherRoutes.get("/:userId/video-url", async (c) => {
  const userId = c.req.param("userId");
  const profile = await TeacherProfileEntity.get({ userId }).go();
  if (!profile.data?.introVideoUrl) return c.json({ error: "no_video" }, 404);
  const cmd = new GetObjectCommand({
    Bucket: env.uploadsBucket,
    Key: profile.data.introVideoUrl,
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
  return c.json({ url });
});

// Teacher uploads an intro video.
const videoUploadSchema = z.object({
  mimeType: z.enum(VIDEO_MIME_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_VIDEO_BYTES),
});

teacherRoutes.post(
  "/me/video-upload-url",
  requireAuth,
  zValidator("json", videoUploadSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { mimeType, sizeBytes } = c.req.valid("json");
    const ext = mimeType === "video/webm" ? "webm" : mimeType === "video/quicktime" ? "mov" : "mp4";
    const key = `videos/${sub}/${nanoid(10)}.${ext}`;
    const cmd = new PutObjectCommand({
      Bucket: env.uploadsBucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    });
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 900 });
    return c.json({ uploadUrl, key });
  },
);

// Save the video key to the teacher profile after upload.
teacherRoutes.patch(
  "/me/video",
  requireAuth,
  zValidator("json", z.object({ introVideoUrl: z.string().max(500) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { introVideoUrl } = c.req.valid("json");
    await TeacherProfileEntity.patch({ userId: sub })
      .set({ introVideoUrl })
      .go();
    return c.json({ ok: true });
  },
);

// Teacher submits their profile for verification review.
teacherRoutes.post("/me/submit-verification", requireAuth, async (c) => {
  const { sub } = c.get("auth");
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);
  if (user.data.role !== "teacher") return c.json({ error: "only_teachers" }, 403);

  const profile = await TeacherProfileEntity.get({ userId: sub }).go();
  if (!profile.data) return c.json({ error: "profile_required" }, 409);
  if (profile.data.verificationStatus === "pending") {
    return c.json({ error: "already_pending" }, 409);
  }
  if (profile.data.verificationStatus === "verified") {
    return c.json({ error: "already_verified" }, 409);
  }

  await TeacherProfileEntity.patch({ userId: sub })
    .set({ verificationStatus: "pending" })
    .go();
  return c.json({ ok: true, status: "pending" });
});

// My students: aggregated from classrooms I teach + bookings I've received.
// Dedup by studentId; latest engagement wins for sort order. Teacher-only.
teacherRoutes.get("/me/students", requireAuth, async (c) => {
  const { sub, groups } = c.get("auth");
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);
  if (user.data.role !== "teacher" && !groups.includes("admin")) {
    return c.json({ error: "only_teachers" }, 403);
  }

  const [myClassrooms, myBookings] = await Promise.all([
    ClassroomEntity.query.byTeacher({ teacherId: sub }).go({ limit: 250 }),
    BookingEntity.query.byTeacher({ teacherId: sub }).go({ limit: 500 }),
  ]);

  // Pull memberships for every classroom I teach. Small N × per-classroom
  // query — MVP-scale fine; if this grows we'll swap to a GSI on (teacherId,
  // studentId) on ClassroomMembershipEntity.
  const membershipsByClassroom = await Promise.all(
    myClassrooms.data.map((cls) =>
      ClassroomMembershipEntity.query.primary({ classroomId: cls.classroomId }).go({ limit: 250 }),
    ),
  );
  const enrolledStudents = membershipsByClassroom
    .flatMap((r, i) => {
      const cls = myClassrooms.data[i];
      if (!cls) return [];
      return r.data
        .filter((m) => m.role === "student")
        .map((m) => ({
          studentId: m.userId,
          classroomId: cls.classroomId,
          classroomTitle: cls.title,
          joinedAt: m.joinedAt,
        }));
    });

  // Merge into a map keyed by studentId. Capture the most recent classroom
  // enrollment plus counts across sources.
  type Entry = {
    studentId: string;
    displayName?: string;
    email?: string;
    avatarUrl?: string;
    bookingCount: number;
    classroomCount: number;
    lastEngagementAt: string;
  };
  const map = new Map<string, Entry>();
  for (const b of myBookings.data) {
    const createdAt = b.createdAt ?? "";
    const cur = map.get(b.studentId) ?? {
      studentId: b.studentId,
      bookingCount: 0,
      classroomCount: 0,
      lastEngagementAt: createdAt,
    };
    cur.bookingCount += 1;
    if (createdAt > cur.lastEngagementAt) cur.lastEngagementAt = createdAt;
    map.set(b.studentId, cur);
  }
  for (const m of enrolledStudents) {
    const joinedAt = m.joinedAt ?? "";
    const cur = map.get(m.studentId) ?? {
      studentId: m.studentId,
      bookingCount: 0,
      classroomCount: 0,
      lastEngagementAt: joinedAt,
    };
    cur.classroomCount += 1;
    if (joinedAt > cur.lastEngagementAt) cur.lastEngagementAt = joinedAt;
    map.set(m.studentId, cur);
  }

  // Hydrate user names; silently drop rows where the user was deleted.
  const entries = Array.from(map.values());
  const hydrated = await Promise.all(
    entries.map(async (e) => {
      const u = await UserEntity.get({ userId: e.studentId }).go();
      if (!u.data) return null;
      return {
        ...e,
        displayName: u.data.displayName,
        email: u.data.email,
        avatarUrl: u.data.avatarUrl,
      };
    }),
  );
  const items = hydrated
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.lastEngagementAt.localeCompare(a.lastEngagementAt));

  return c.json({ items });
});

// Per-student aggregate: bookings + classrooms shared + AI grades I gave +
// payments I received from them. Teacher-only; the student must have at
// least one relation to me (booking or shared classroom) — no enumeration
// of strangers.
teacherRoutes.get("/me/students/:studentId", requireAuth, async (c) => {
  const { sub, groups } = c.get("auth");
  const me = await UserEntity.get({ userId: sub }).go();
  if (!me.data) return c.json({ error: "user_not_found" }, 404);
  if (me.data.role !== "teacher" && !groups.includes("admin")) {
    return c.json({ error: "only_teachers" }, 403);
  }
  const studentId = c.req.param("studentId");
  if (studentId === sub) return c.json({ error: "cannot_view_self" }, 400);

  const [user, bookings, grades, payments, myClassrooms] = await Promise.all([
    UserEntity.get({ userId: studentId }).go(),
    BookingEntity.query.byTeacher({ teacherId: sub }).go({ limit: 500 }),
    AiGradeEntity.query.byTeacher({ teacherId: sub }).go({ limit: 500 }),
    PaymentEntity.query.byPayee({ payeeId: sub }).go({ limit: 500 }),
    ClassroomEntity.query.byTeacher({ teacherId: sub }).go({ limit: 250 }),
  ]);
  if (!user.data) return c.json({ error: "user_not_found" }, 404);

  // Filter to this student only.
  const studentBookings = bookings.data.filter((b) => b.studentId === studentId);
  const studentGrades = grades.data.filter((g) => g.studentId === studentId);
  const studentPayments = payments.data.filter((p) => p.payerId === studentId);

  // Shared classrooms: cross-check memberships.
  const sharedClassrooms: {
    classroomId: string;
    title: string;
    subject: string;
    status: string;
    joinedAt?: string;
  }[] = [];
  for (const cls of myClassrooms.data) {
    const m = await ClassroomMembershipEntity.get({
      classroomId: cls.classroomId,
      userId: studentId,
    }).go();
    if (m.data) {
      sharedClassrooms.push({
        classroomId: cls.classroomId,
        title: cls.title,
        subject: cls.subject,
        status: cls.status ?? "active",
        joinedAt: m.data.joinedAt,
      });
    }
  }

  if (studentBookings.length === 0 && sharedClassrooms.length === 0) {
    return c.json({ error: "no_relation" }, 403);
  }

  const gradeSummary = studentGrades.length
    ? {
        count: studentGrades.length,
        avg:
          Math.round(
            (studentGrades.reduce(
              (acc, g) => acc + (g.score / (g.maxScore || 100)) * 100,
              0,
            ) /
              studentGrades.length) *
              10,
          ) / 10,
      }
    : { count: 0, avg: 0 };

  const paymentsTotalCents = studentPayments
    .filter((p) => p.status === "succeeded")
    .reduce((acc, p) => acc + (p.amountCents - (p.platformFeeCents ?? 0)), 0);

  return c.json({
    user: {
      userId: user.data.userId,
      displayName: user.data.displayName,
      email: user.data.email,
      avatarUrl: user.data.avatarUrl,
      role: user.data.role,
    },
    bookings: studentBookings.map((b) => ({
      bookingId: b.bookingId,
      type: b.type,
      status: b.status,
      amountCents: b.amountCents,
      currency: b.currency,
      createdAt: b.createdAt,
    })),
    classrooms: sharedClassrooms,
    grades: studentGrades.map((g) => ({
      gradeId: g.gradeId,
      subject: g.subject,
      score: g.score,
      maxScore: g.maxScore,
      createdAt: g.createdAt,
    })),
    gradeSummary,
    payments: studentPayments.map((p) => ({
      paymentId: p.paymentId,
      status: p.status,
      amountCents: p.amountCents,
      platformFeeCents: p.platformFeeCents,
      currency: p.currency,
      createdAt: p.createdAt,
    })),
    paymentsNetTotalCents: paymentsTotalCents,
    paymentsCurrency: studentPayments[0]?.currency ?? "TND",
  });
});
