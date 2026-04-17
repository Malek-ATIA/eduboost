import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  BookingEntity,
  TeacherQuizResponseEntity,
  UserEntity,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";

export const teacherQuizRoutes = new Hono();

teacherQuizRoutes.use("*", requireAuth);

// Post-session structured quiz. One response per (teacher, booking); the
// booking's student is the only party allowed to submit. Aggregate dimensions
// are exposed publicly on teacher profiles so prospective students can see
// trend data distinct from the star-review free-text.

const submitSchema = z.object({
  bookingId: z.string().min(1),
  knowledge: z.number().int().min(0).max(5),
  clarity: z.number().int().min(0).max(5),
  patience: z.number().int().min(0).max(5),
  wouldRecommend: z.boolean(),
  comment: z.string().trim().max(1000).optional(),
});

teacherQuizRoutes.post("/", zValidator("json", submitSchema), async (c) => {
  const { sub } = c.get("auth");
  const body = c.req.valid("json");

  const booking = await BookingEntity.get({ bookingId: body.bookingId }).go();
  if (!booking.data) return c.json({ error: "booking_not_found" }, 404);
  if (booking.data.studentId !== sub) return c.json({ error: "not_your_booking" }, 403);
  if (booking.data.status !== "confirmed" && booking.data.status !== "completed") {
    return c.json({ error: "booking_not_completed" }, 409);
  }

  const existing = await TeacherQuizResponseEntity.query
    .byBooking({ bookingId: body.bookingId })
    .go({ limit: 1 });
  if (existing.data[0]) {
    return c.json({ error: "already_submitted" }, 409);
  }

  const row = await TeacherQuizResponseEntity.create({
    teacherId: booking.data.teacherId,
    bookingId: body.bookingId,
    studentId: sub,
    knowledge: body.knowledge,
    clarity: body.clarity,
    patience: body.patience,
    wouldRecommend: body.wouldRecommend,
    comment: body.comment,
  }).go();
  return c.json(row.data, 201);
});

// Aggregate summary for a teacher's profile. Anonymised — individual responses
// aren't returned, only dimension averages and the "would recommend" share.
teacherQuizRoutes.get(
  "/teachers/:teacherId/summary",
  zValidator("param", z.object({ teacherId: z.string().min(1) })),
  async (c) => {
    const { teacherId } = c.req.valid("param");
    const teacher = await UserEntity.get({ userId: teacherId }).go();
    if (!teacher.data) return c.json({ error: "not_found" }, 404);

    const result = await TeacherQuizResponseEntity.query
      .primary({ teacherId })
      .go({ limit: 500 });
    const count = result.data.length;
    if (count === 0) {
      return c.json({
        teacherId,
        count: 0,
        knowledgeAvg: null,
        clarityAvg: null,
        patienceAvg: null,
        wouldRecommendPct: null,
      });
    }
    const knowledgeAvg = result.data.reduce((s, r) => s + r.knowledge, 0) / count;
    const clarityAvg = result.data.reduce((s, r) => s + r.clarity, 0) / count;
    const patienceAvg = result.data.reduce((s, r) => s + r.patience, 0) / count;
    const wouldRecommendPct =
      result.data.filter((r) => r.wouldRecommend).length / count;

    return c.json({
      teacherId,
      count,
      knowledgeAvg: Math.round(knowledgeAvg * 100) / 100,
      clarityAvg: Math.round(clarityAvg * 100) / 100,
      patienceAvg: Math.round(patienceAvg * 100) / 100,
      wouldRecommendPct: Math.round(wouldRecommendPct * 100) / 100,
    });
  },
);
