import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  ReviewEntity,
  BookingEntity,
  TeacherProfileEntity,
  UserEntity,
  makeReviewId,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../lib/notifications.js";

export const reviewRoutes = new Hono();

reviewRoutes.get(
  "/teachers/:teacherId",
  zValidator("param", z.object({ teacherId: z.string().min(1) })),
  async (c) => {
    const { teacherId } = c.req.valid("param");
    const result = await ReviewEntity.query
      .byTeacher({ teacherId })
      .go({ limit: 50, order: "desc" });
    // Post-filter out admin-hidden reviews. The DDB row is retained for audit;
    // only the public rendering excludes them.
    const visible = result.data.filter((r) => !r.hiddenAt);
    return c.json({ items: visible });
  },
);

const createSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

reviewRoutes.post("/", requireAuth, zValidator("json", createSchema), async (c) => {
  const { sub } = c.get("auth");
  const { bookingId, rating, comment } = c.req.valid("json");

  const booking = await BookingEntity.get({ bookingId }).go();
  if (!booking.data) return c.json({ error: "booking_not_found" }, 404);
  if (booking.data.studentId !== sub) return c.json({ error: "not_your_booking" }, 403);
  if (booking.data.status !== "confirmed" && booking.data.status !== "completed") {
    return c.json({ error: "booking_not_completed" }, 409);
  }

  const existing = await ReviewEntity.query.byBooking({ bookingId }).go({ limit: 1 });
  if (existing.data[0]) return c.json({ error: "already_reviewed", reviewId: existing.data[0].reviewId }, 409);

  const teacherId = booking.data.teacherId;
  const reviewId = makeReviewId();
  const review = await ReviewEntity.create({
    reviewId,
    teacherId,
    reviewerId: sub,
    bookingId,
    rating,
    comment,
  }).go();

  await recomputeTeacherRating(teacherId);

  // Best-effort reviewer name lookup. A failure here must NOT cause the whole
  // POST to return 500, since the review + rating aggregate are already
  // persisted. Fall back to the same generic string used when the user has
  // no displayName.
  let reviewerName = "A student";
  try {
    const reviewer = await UserEntity.get({ userId: sub }).go();
    if (reviewer.data?.displayName) reviewerName = reviewer.data.displayName;
  } catch (err) {
    console.error("reviews.post: reviewer name lookup failed (non-fatal)", err);
  }

  await notify({
    userId: teacherId,
    type: "review_posted",
    title: `New ${rating}★ review`,
    body: `${reviewerName} left you a review.`,
    linkPath: `/teachers/${teacherId}#reviews`,
  });

  return c.json(review.data, 201);
});

reviewRoutes.delete(
  "/:reviewId",
  requireAuth,
  zValidator("param", z.object({ reviewId: z.string().min(1) })),
  async (c) => {
    const { sub, groups } = c.get("auth");
    const { reviewId } = c.req.valid("param");

    const review = await ReviewEntity.get({ reviewId }).go();
    if (!review.data) return c.json({ error: "not_found" }, 404);

    const isAdmin = groups.includes("admin");
    const isAuthor = review.data.reviewerId === sub;
    if (!isAuthor && !isAdmin) return c.json({ error: "forbidden" }, 403);

    await ReviewEntity.delete({ reviewId }).go();
    await recomputeTeacherRating(review.data.teacherId);

    return c.json({ ok: true });
  },
);

async function recomputeTeacherRating(teacherId: string): Promise<void> {
  // Aggregate by scanning the teacher's reviews via byTeacher GSI.
  // MVP: scan all reviews for this teacher every time a review is created/deleted.
  // Acceptable while a teacher has <~1000 reviews. Beyond that, maintain a running
  // aggregate via DDB Streams → small materialized counter instead.
  const all = await ReviewEntity.query.byTeacher({ teacherId }).go({ limit: 1000 });
  // Exclude hidden reviews from the aggregate so takedowns restore the
  // teacher's visible rating. Hidden rows stay for audit but must not
  // influence the public average.
  const visible = all.data.filter((r) => !r.hiddenAt);
  const count = visible.length;
  const avg = count === 0 ? 0 : visible.reduce((sum, r) => sum + r.rating, 0) / count;
  await TeacherProfileEntity.patch({ userId: teacherId })
    .set({ ratingAvg: Math.round(avg * 100) / 100, ratingCount: count })
    .go();
}
