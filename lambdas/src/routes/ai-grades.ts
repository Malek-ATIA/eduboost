import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  AiGradeEntity,
  UserEntity,
  ClassroomMembershipEntity,
  makeGradeId,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { gradeSubmission } from "../lib/ai-grader.js";
import { notify } from "../lib/notifications.js";

export const aiGradeRoutes = new Hono();

aiGradeRoutes.use("*", requireAuth);

const createSchema = z.object({
  studentId: z.string().min(1),
  classroomId: z.string().min(1).optional(),
  subject: z.string().trim().min(1).max(100),
  rubric: z.string().trim().max(4000).optional(),
  submission: z.string().trim().min(10).max(20_000),
  maxScore: z.number().int().min(1).max(1000).default(100),
});

aiGradeRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const { sub } = c.get("auth");
  const body = c.req.valid("json");

  const [teacher, student] = await Promise.all([
    UserEntity.get({ userId: sub }).go(),
    UserEntity.get({ userId: body.studentId }).go(),
  ]);
  if (!teacher.data) return c.json({ error: "user_not_found" }, 404);
  if (teacher.data.role !== "teacher") return c.json({ error: "only_teachers" }, 403);
  if (!student.data) return c.json({ error: "student_not_found" }, 404);

  if (body.classroomId) {
    const membership = await ClassroomMembershipEntity.get({
      classroomId: body.classroomId,
      userId: body.studentId,
    }).go();
    if (!membership.data) return c.json({ error: "student_not_in_classroom" }, 403);
  }

  let result;
  try {
    result = await gradeSubmission({
      subject: body.subject,
      rubric: body.rubric,
      submission: body.submission,
      maxScore: body.maxScore,
    });
  } catch (err) {
    console.error("ai-grades: Bedrock grading failed", err);
    return c.json({ error: "grading_failed", message: (err as Error).message }, 502);
  }

  const gradeId = makeGradeId();
  const saved = await AiGradeEntity.create({
    gradeId,
    studentId: body.studentId,
    teacherId: sub,
    subject: body.subject,
    rubric: body.rubric,
    // Store a trimmed excerpt for display; full submission is deliberately NOT
    // persisted to avoid unbounded DDB item size growth.
    submissionExcerpt: body.submission.slice(0, 500),
    submissionLength: body.submission.length,
    score: result.score,
    maxScore: result.maxScore,
    feedback: result.feedback,
    modelId: result.modelId,
  }).go();

  try {
    await notify({
      userId: body.studentId,
      type: "new_grade",
      title: `New grade: ${body.subject} — ${result.score}/${result.maxScore}`,
      body: result.feedback.slice(0, 200),
      linkPath: `/grades/${gradeId}`,
    });
  } catch (err) {
    console.error("ai-grades: notify failed (non-fatal)", err);
  }

  return c.json(saved.data, 201);
});

aiGradeRoutes.get("/student/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await AiGradeEntity.query
    .byStudent({ studentId: sub })
    .go({ limit: 50, order: "desc" });
  return c.json({ items: result.data });
});

aiGradeRoutes.get("/teacher/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await AiGradeEntity.query
    .byTeacher({ teacherId: sub })
    .go({ limit: 50, order: "desc" });
  return c.json({ items: result.data });
});

aiGradeRoutes.get(
  "/:gradeId",
  zValidator("param", z.object({ gradeId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { gradeId } = c.req.valid("param");
    const result = await AiGradeEntity.get({ gradeId }).go();
    if (!result.data) return c.json({ error: "not_found" }, 404);
    if (result.data.studentId !== sub && result.data.teacherId !== sub) {
      return c.json({ error: "forbidden" }, 403);
    }
    return c.json(result.data);
  },
);
