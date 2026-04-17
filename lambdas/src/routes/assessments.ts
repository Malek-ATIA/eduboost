import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  AssessmentEntity,
  AssessmentAttemptEntity,
  UserEntity,
  ASSESSMENT_STATUSES,
  makeExamId,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";

export const assessmentRoutes = new Hono();

assessmentRoutes.use("*", requireAuth);

// Discriminated union on question kind. MCQ carries the correct answer as an
// index into its options; short-answer has no auto-grade. Teachers create
// these; the public shape given to students strips `correctIndex` so the
// student can't peek at the answer key by inspecting network traffic.

const mcqQuestionSchema = z.object({
  kind: z.literal("mcq"),
  prompt: z.string().trim().min(1).max(1000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(8),
  correctIndex: z.number().int().min(0),
});

const shortQuestionSchema = z.object({
  kind: z.literal("short"),
  prompt: z.string().trim().min(1).max(1000),
});

const questionSchema = z.discriminatedUnion("kind", [mcqQuestionSchema, shortQuestionSchema]);

type MCQQuestion = z.infer<typeof mcqQuestionSchema>;
type ShortQuestion = z.infer<typeof shortQuestionSchema>;
type Question = MCQQuestion | ShortQuestion;

const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  questions: z.array(questionSchema).min(1).max(100),
});

// Additional validation that zod can't do: MCQ's correctIndex must fall inside
// its options array. Run once at create-time and once per patch.
function validateQuestions(questions: Question[]): string | null {
  for (const [i, q] of questions.entries()) {
    if (q.kind === "mcq" && (q.correctIndex < 0 || q.correctIndex >= q.options.length)) {
      return `question_${i}_correctIndex_out_of_range`;
    }
  }
  return null;
}

// ---- Teacher CRUD ----

assessmentRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const { sub, groups } = c.get("auth");
  const body = c.req.valid("json");
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);
  if (!groups.includes("admin") && user.data.role !== "teacher") {
    return c.json({ error: "only_teachers_or_admins" }, 403);
  }
  const err = validateQuestions(body.questions);
  if (err) return c.json({ error: err }, 400);

  const examId = makeExamId();
  const row = await AssessmentEntity.create({
    examId,
    teacherId: sub,
    title: body.title,
    description: body.description,
    questions: body.questions,
    status: "draft",
  }).go();
  return c.json(row.data, 201);
});

const patchSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  questions: z.array(questionSchema).min(1).max(100).optional(),
  status: z.enum(ASSESSMENT_STATUSES).optional(),
});

assessmentRoutes.patch(
  "/:examId",
  zValidator("param", z.object({ examId: z.string().min(1) })),
  zValidator("json", patchSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { examId } = c.req.valid("param");
    const body = c.req.valid("json");
    const exam = await AssessmentEntity.get({ examId }).go();
    if (!exam.data) return c.json({ error: "not_found" }, 404);
    if (exam.data.teacherId !== sub) return c.json({ error: "forbidden" }, 403);
    if (Object.keys(body).length === 0) return c.json({ error: "no_fields" }, 400);
    if (body.questions) {
      const err = validateQuestions(body.questions);
      if (err) return c.json({ error: err }, 400);
    }
    await AssessmentEntity.patch({ examId }).set(body).go();
    return c.json({ ok: true });
  },
);

assessmentRoutes.get("/teacher/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await AssessmentEntity.query
    .byTeacher({ teacherId: sub })
    .go({ limit: 100, order: "desc" });
  return c.json({ items: result.data });
});

// Published exams — the public browse surface. Students pick from here and
// take the one they want. Returns scalar summary fields only (not the
// question list) to keep the payload small; question detail comes via the
// per-exam GET below.
assessmentRoutes.get("/", async (c) => {
  const result = await AssessmentEntity.query
    .byStatus({ status: "published" })
    .go({ limit: 200, order: "desc" });
  const items = result.data.map((r) => ({
    examId: r.examId,
    teacherId: r.teacherId,
    title: r.title,
    description: r.description,
    questionCount: (r.questions ?? []).length,
    createdAt: r.createdAt,
  }));
  return c.json({ items });
});

// Per-exam GET. Students see the questions WITHOUT correctIndex; the teacher
// (or admin) sees the full exam. The answer key is a secret maintained by the
// teacher and never leaked to students.
assessmentRoutes.get(
  "/:examId",
  zValidator("param", z.object({ examId: z.string().min(1) })),
  async (c) => {
    const { sub, groups } = c.get("auth");
    const { examId } = c.req.valid("param");
    const exam = await AssessmentEntity.get({ examId }).go();
    if (!exam.data) return c.json({ error: "not_found" }, 404);
    const isOwnerOrAdmin = exam.data.teacherId === sub || groups.includes("admin");
    if (!isOwnerOrAdmin && exam.data.status !== "published") {
      return c.json({ error: "not_published" }, 404);
    }
    const questions = isOwnerOrAdmin
      ? exam.data.questions
      : (exam.data.questions ?? []).map((q: Question) => {
          if (q.kind === "mcq") {
            const { correctIndex: _ignored, ...rest } = q;
            void _ignored;
            return rest;
          }
          return q;
        });
    return c.json({ ...exam.data, questions });
  },
);

// ---- Attempts ----

const attemptSchema = z.object({
  answers: z.array(z.union([z.number().int().min(0), z.string().max(5000)])),
});

assessmentRoutes.post(
  "/:examId/attempts",
  zValidator("param", z.object({ examId: z.string().min(1) })),
  zValidator("json", attemptSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { examId } = c.req.valid("param");
    const { answers } = c.req.valid("json");

    const exam = await AssessmentEntity.get({ examId }).go();
    if (!exam.data) return c.json({ error: "not_found" }, 404);
    if (exam.data.status !== "published") return c.json({ error: "not_published" }, 404);
    if (exam.data.teacherId === sub) {
      return c.json({ error: "teacher_cannot_attempt_own_exam" }, 409);
    }

    const existing = await AssessmentAttemptEntity.get({ examId, studentId: sub }).go();
    if (existing.data) return c.json({ error: "already_attempted" }, 409);

    const questions = (exam.data.questions ?? []) as Question[];
    if (answers.length !== questions.length) {
      return c.json({ error: "answer_count_mismatch" }, 400);
    }

    // Score MCQ items only. Short-answer responses are recorded for the
    // teacher but don't count toward the auto-score — that's by design.
    let autoScore = 0;
    let maxMcqScore = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const a = answers[i];
      if (!q) continue;
      if (q.kind === "mcq") {
        maxMcqScore += 1;
        if (typeof a === "number" && a === q.correctIndex) autoScore += 1;
      }
    }

    const saved = await AssessmentAttemptEntity.create({
      examId,
      studentId: sub,
      answers,
      autoScore,
      maxMcqScore,
    }).go();
    return c.json(
      {
        examId,
        studentId: sub,
        autoScore,
        maxMcqScore,
        submittedAt: saved.data.submittedAt,
      },
      201,
    );
  },
);

// Teacher sees every attempt on their exam. Hydrates student displayName for
// the grading UI; email is intentionally NOT hydrated to avoid leaking
// contact details via an exams endpoint.
assessmentRoutes.get(
  "/:examId/attempts",
  zValidator("param", z.object({ examId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { examId } = c.req.valid("param");
    const exam = await AssessmentEntity.get({ examId }).go();
    if (!exam.data) return c.json({ error: "not_found" }, 404);
    if (exam.data.teacherId !== sub) return c.json({ error: "forbidden" }, 403);
    const result = await AssessmentAttemptEntity.query
      .primary({ examId })
      .go({ limit: 500 });
    const hydrated = await Promise.all(
      result.data.map(async (a) => {
        try {
          const u = await UserEntity.get({ userId: a.studentId }).go();
          return { ...a, student: u.data ? { userId: u.data.userId, displayName: u.data.displayName } : null };
        } catch {
          return { ...a, student: null };
        }
      }),
    );
    return c.json({ items: hydrated });
  },
);

assessmentRoutes.get("/student/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await AssessmentAttemptEntity.query
    .byStudent({ studentId: sub })
    .go({ limit: 100, order: "desc" });
  return c.json({ items: result.data });
});
