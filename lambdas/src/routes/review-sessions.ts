import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  BookingEntity,
  ReviewSessionEntity,
  makeReviewSessionId,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../lib/notifications.js";

export const reviewSessionRoutes = new Hono();

reviewSessionRoutes.use("*", requireAuth);

// A review session is a post-course retrospective meeting tied to a booking.
// Either party (student or teacher) can request one; the counterparty can
// schedule or decline. No payment; no Chime room auto-created — MVP treats it
// as a calendar intent that either side then handles out-of-band or via the
// existing scheduled-session plumbing.

const requestSchema = z.object({
  bookingId: z.string().min(1),
  notes: z.string().trim().max(1000).optional(),
});

reviewSessionRoutes.post("/", zValidator("json", requestSchema), async (c) => {
  const { sub } = c.get("auth");
  const { bookingId, notes } = c.req.valid("json");

  const booking = await BookingEntity.get({ bookingId }).go();
  if (!booking.data) return c.json({ error: "booking_not_found" }, 404);
  if (booking.data.studentId !== sub && booking.data.teacherId !== sub) {
    return c.json({ error: "not_your_booking" }, 403);
  }
  if (booking.data.status !== "confirmed" && booking.data.status !== "completed") {
    return c.json({ error: "booking_not_eligible" }, 409);
  }

  const existing = await ReviewSessionEntity.query
    .byBooking({ bookingId })
    .go({ limit: 5 });
  if (existing.data.find((r) => r.status !== "completed" && r.status !== "declined")) {
    return c.json({ error: "already_requested" }, 409);
  }

  const reviewSessionId = makeReviewSessionId();
  const row = await ReviewSessionEntity.create({
    reviewSessionId,
    bookingId,
    studentId: booking.data.studentId,
    teacherId: booking.data.teacherId,
    requestedBy: sub,
    notes,
  }).go();

  const counterpartyId =
    sub === booking.data.studentId ? booking.data.teacherId : booking.data.studentId;
  try {
    await notify({
      userId: counterpartyId,
      type: "review_posted", // generic type reuse; dedicated "review_session_requested" deferred
      title: "Review session requested",
      body: `${notes?.slice(0, 120) ?? "A review session was requested for your booking."}`,
      linkPath: `/review-sessions`,
    });
  } catch (err) {
    console.error("review-sessions.post: notify failed (non-fatal)", err);
  }

  return c.json(row.data, 201);
});

const patchSchema = z
  .object({
    status: z.enum(["requested", "scheduled", "completed", "declined"]).optional(),
    scheduledAt: z.string().datetime().optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "no_fields" });

reviewSessionRoutes.patch(
  "/:reviewSessionId",
  zValidator("param", z.object({ reviewSessionId: z.string().min(1) })),
  zValidator("json", patchSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { reviewSessionId } = c.req.valid("param");
    const body = c.req.valid("json");

    const row = await ReviewSessionEntity.get({ reviewSessionId }).go();
    if (!row.data) return c.json({ error: "not_found" }, 404);
    if (row.data.studentId !== sub && row.data.teacherId !== sub) {
      return c.json({ error: "forbidden" }, 403);
    }
    await ReviewSessionEntity.patch({ reviewSessionId }).set(body).go();
    return c.json({ ok: true });
  },
);

reviewSessionRoutes.get("/mine", async (c) => {
  const { sub } = c.get("auth");
  const [asStudent, asTeacher] = await Promise.all([
    ReviewSessionEntity.query.byStudent({ studentId: sub }).go({ limit: 50 }),
    ReviewSessionEntity.query.byTeacher({ teacherId: sub }).go({ limit: 50 }),
  ]);
  // Merge + dedupe (a teacher could theoretically book themselves — defensive).
  const byId = new Map<string, (typeof asStudent.data)[number]>();
  for (const r of [...asStudent.data, ...asTeacher.data]) byId.set(r.reviewSessionId, r);
  const items = [...byId.values()].sort(
    (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  );
  return c.json({ items });
});
