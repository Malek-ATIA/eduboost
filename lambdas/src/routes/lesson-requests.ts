import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  LessonRequestEntity,
  UserEntity,
  makeLessonRequestId,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../lib/notifications.js";

export const lessonRequestRoutes = new Hono();

lessonRequestRoutes.use("*", requireAuth);

const createSchema = z.object({
  teacherId: z.string().min(1),
  subject: z.string().trim().min(1).max(200),
  preferredTime: z.string().trim().max(200).optional(),
  message: z.string().trim().max(2000).optional(),
});

lessonRequestRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const { sub } = c.get("auth");
  const body = c.req.valid("json");

  if (body.teacherId === sub) return c.json({ error: "cannot_request_self" }, 400);

  const teacher = await UserEntity.get({ userId: body.teacherId }).go();
  if (!teacher.data) return c.json({ error: "teacher_not_found" }, 404);
  if (teacher.data.role !== "teacher") return c.json({ error: "not_a_teacher" }, 400);

  const student = await UserEntity.get({ userId: sub }).go();
  if (!student.data) return c.json({ error: "user_not_found" }, 404);

  const requestId = makeLessonRequestId();
  const result = await LessonRequestEntity.create({
    requestId,
    studentId: sub,
    teacherId: body.teacherId,
    subject: body.subject,
    preferredTime: body.preferredTime,
    message: body.message,
    status: "pending",
  }).go();

  await notify({
    userId: body.teacherId,
    type: "lesson_request_created",
    title: "New lesson request",
    body: `${student.data.displayName} is asking about ${body.subject}.`,
    linkPath: `/requests/${requestId}`,
  });

  return c.json(result.data, 201);
});

lessonRequestRoutes.get("/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await LessonRequestEntity.query
    .byStudent({ studentId: sub })
    .go({ limit: 50, order: "desc" });
  return c.json({ items: result.data });
});

lessonRequestRoutes.get("/inbox", async (c) => {
  const { sub } = c.get("auth");
  const result = await LessonRequestEntity.query
    .byTeacher({ teacherId: sub })
    .go({ limit: 50, order: "desc" });
  return c.json({ items: result.data });
});

lessonRequestRoutes.get("/:requestId", async (c) => {
  const { sub } = c.get("auth");
  const requestId = c.req.param("requestId");
  const result = await LessonRequestEntity.get({ requestId }).go();
  if (!result.data) return c.json({ error: "not_found" }, 404);
  if (result.data.studentId !== sub && result.data.teacherId !== sub) {
    return c.json({ error: "forbidden" }, 403);
  }
  return c.json(result.data);
});

const respondSchema = z.object({ responseMessage: z.string().trim().max(2000).optional() });

async function respond(
  c: Context,
  requestId: string,
  decision: "accepted" | "rejected",
  responseMessage: string | undefined,
) {
  const { sub } = c.get("auth");
  const req = await LessonRequestEntity.get({ requestId }).go();
  if (!req.data) return c.json({ error: "not_found" }, 404);
  if (req.data.teacherId !== sub) return c.json({ error: "forbidden" }, 403);
  if (req.data.status !== "pending") {
    return c.json({ error: "already_resolved", status: req.data.status }, 409);
  }

  // Only include responseMessage in the patch when actually provided — passing
  // `undefined` to ElectroDB's .set() can either throw or create a tombstone
  // attribute, neither of which we want.
  const patchAttrs: { status: "accepted" | "rejected"; respondedAt: string; responseMessage?: string } = {
    status: decision,
    respondedAt: new Date().toISOString(),
  };
  if (responseMessage !== undefined) patchAttrs.responseMessage = responseMessage;

  await LessonRequestEntity.patch({ requestId }).set(patchAttrs).go();

  // Best-effort teacher name lookup. The status patch above has already
  // persisted the decision — a transient DDB failure here must NOT bubble up
  // as a 500 and mislead the teacher into thinking their response wasn't
  // recorded. Mirrors the reviewer-lookup pattern in reviews.ts.
  let teacherName = "Your teacher";
  try {
    const teacher = await UserEntity.get({ userId: sub }).go();
    if (teacher.data?.displayName) teacherName = teacher.data.displayName;
  } catch (err) {
    console.error("lesson-requests.respond: teacher name lookup failed (non-fatal)", err);
  }

  await notify({
    userId: req.data.studentId,
    type: decision === "accepted" ? "lesson_request_accepted" : "lesson_request_rejected",
    title: decision === "accepted" ? "Request accepted" : "Request declined",
    body:
      decision === "accepted"
        ? `${teacherName} accepted your request for ${req.data.subject}. You can book a session now.`
        : `${teacherName} declined your request for ${req.data.subject}.`,
    linkPath: `/requests/${requestId}`,
  });

  return c.json({ ok: true, status: decision });
}

lessonRequestRoutes.post(
  "/:requestId/accept",
  zValidator("json", respondSchema),
  async (c) => {
    const requestId = c.req.param("requestId");
    const { responseMessage } = c.req.valid("json");
    return respond(c, requestId, "accepted", responseMessage);
  },
);

lessonRequestRoutes.post(
  "/:requestId/reject",
  zValidator("json", respondSchema),
  async (c) => {
    const requestId = c.req.param("requestId");
    const { responseMessage } = c.req.valid("json");
    return respond(c, requestId, "rejected", responseMessage);
  },
);

lessonRequestRoutes.post("/:requestId/cancel", async (c) => {
  const { sub } = c.get("auth");
  const requestId = c.req.param("requestId");
  const req = await LessonRequestEntity.get({ requestId }).go();
  if (!req.data) return c.json({ error: "not_found" }, 404);
  if (req.data.studentId !== sub) return c.json({ error: "forbidden" }, 403);
  if (req.data.status !== "pending") {
    return c.json({ error: "cannot_cancel", status: req.data.status }, 409);
  }
  await LessonRequestEntity.patch({ requestId })
    .set({ status: "cancelled" })
    .go();
  return c.json({ ok: true });
});
