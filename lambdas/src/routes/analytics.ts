import { Hono } from "hono";
import {
  AttendanceEntity,
  PaymentEntity,
  BookingEntity,
  ReviewEntity,
  AiGradeEntity,
  ParentChildLinkEntity,
  SessionEntity,
  TeacherProfileEntity,
  UserEntity,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";

export const analyticsRoutes = new Hono();

analyticsRoutes.use("*", requireAuth);

type UserMetrics = {
  userId: string;
  displayName: string;
  sessionsAttended: number;
  attendanceRate: number | null;
  totalHoursAttended: number;
  totalSpentCents: number;
  currency: string;
  bookingCount: number;
  reviewsLeft: number;
  aiGradeAvg: number | null;
  aiGradeCount: number;
};

// Computes all student-facing metrics for a single userId. Kept as a pure
// function so the parent endpoint can fan out across linked children and sum
// them cheaply. Each entity is queried via its byUser/byPayer/byReviewer GSI
// with a generous limit — this endpoint is MVP-admin-ish traffic, not hot path.
async function metricsFor(userId: string): Promise<UserMetrics> {
  const [user, attendance, payments, bookings, reviews, grades] = await Promise.all([
    UserEntity.get({ userId }).go(),
    AttendanceEntity.query.byUser({ userId }).go({ limit: 1000 }),
    PaymentEntity.query.byPayer({ payerId: userId }).go({ limit: 1000 }),
    BookingEntity.query.byStudent({ studentId: userId }).go({ limit: 1000 }),
    ReviewEntity.query.byReviewer({ reviewerId: userId }).go({ limit: 1000 }),
    AiGradeEntity.query.byStudent({ studentId: userId }).go({ limit: 1000 }),
  ]);

  // Attendance: only count finalized statuses (present/late). "excused" means
  // the student had a valid reason to miss; "absent" is a miss. Count
  // attendance rate as (present + late) / (all marked).
  const markedCount = attendance.data.length;
  const attendedCount = attendance.data.filter(
    (a) => a.status === "present" || a.status === "late",
  ).length;
  const attendanceRate = markedCount === 0 ? null : attendedCount / markedCount;

  // Hours: approximate by counting attended sessions × 1 hour. A real
  // aggregate would fetch each SessionEntity to get actual duration; MVP
  // accepts the average-session-hour approximation to avoid N lookups.
  const totalHoursAttended = attendedCount;

  // Spend: sum succeeded payments only. Refunded rows are excluded — the
  // net-money-out number is what parents actually want to see.
  const succeeded = payments.data.filter((p) => p.status === "succeeded");
  const totalSpentCents = succeeded.reduce((sum, p) => sum + (p.amountCents ?? 0), 0);
  const currency = succeeded[0]?.currency ?? "EUR";

  // Grades: average as a percentage (score/maxScore), excluding edge cases
  // where maxScore is 0 or missing.
  const gradedValid = grades.data.filter(
    (g) => typeof g.maxScore === "number" && g.maxScore > 0,
  );
  // `gradedValid` above already filters to maxScore > 0, so the divisor is
  // guaranteed > 0 here — no fallback needed.
  const aiGradeAvg =
    gradedValid.length === 0
      ? null
      : gradedValid.reduce((s, g) => s + (g.score / g.maxScore!) * 100, 0) /
        gradedValid.length;

  return {
    userId,
    displayName: user.data?.displayName ?? userId,
    sessionsAttended: attendedCount,
    attendanceRate,
    totalHoursAttended,
    totalSpentCents,
    currency,
    bookingCount: bookings.data.length,
    reviewsLeft: reviews.data.length,
    aiGradeAvg,
    aiGradeCount: gradedValid.length,
  };
}

analyticsRoutes.get("/student", async (c) => {
  const { sub } = c.get("auth");
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);
  if (user.data.role !== "student" && user.data.role !== "parent") {
    return c.json({ error: "not_available_for_role" }, 403);
  }
  const m = await metricsFor(sub);
  return c.json(m);
});

// Teacher view: symmetric to the student/parent surface but built around the
// teacher's inflows and teaching cadence instead of spend + attendance. Keeps
// the "analytics space" promise in the spec for teachers (separate from the
// financial /reports dashboard which focuses on gross/fee/net).
analyticsRoutes.get("/teacher", async (c) => {
  const { sub } = c.get("auth");
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);
  if (user.data.role !== "teacher") {
    return c.json({ error: "not_available_for_role" }, 403);
  }

  const [profile, bookings, sessions, payments, grades] = await Promise.all([
    TeacherProfileEntity.get({ userId: sub }).go(),
    BookingEntity.query.byTeacher({ teacherId: sub }).go({ limit: 1000 }),
    SessionEntity.query.byTeacher({ teacherId: sub }).go({ limit: 1000 }),
    PaymentEntity.query.byPayee({ payeeId: sub }).go({ limit: 1000 }),
    AiGradeEntity.query.byTeacher({ teacherId: sub }).go({ limit: 1000 }),
  ]);

  // Unique student count across all the teacher's bookings. Dedup with a Set
  // so one student who books a package + a trial still counts once.
  const uniqueStudents = new Set(bookings.data.map((b) => b.studentId));

  // Completed-session approximation of hours taught. SessionEntity has
  // startsAt/endsAt so a future pass could compute real durations; MVP keeps
  // the one-hour fallback used elsewhere in the analytics surface.
  const completed = sessions.data.filter((s) => s.status === "completed");

  // Earnings: net of platformFeeCents so the number matches /teacher/earnings
  // (teachers see take-home, not gross). Refunded payments are excluded.
  const succeeded = payments.data.filter((p) => p.status === "succeeded");
  const totalEarningsCents = succeeded.reduce(
    (sum, p) => sum + (p.amountCents ?? 0) - (p.platformFeeCents ?? 0),
    0,
  );
  const currency = succeeded[0]?.currency ?? "EUR";

  return c.json({
    userId: sub,
    displayName: user.data.displayName,
    sessionsHeld: completed.length,
    upcomingSessions: sessions.data.filter(
      (s) => s.status === "scheduled" || s.status === "live",
    ).length,
    hoursTaught: completed.length,
    uniqueStudents: uniqueStudents.size,
    totalBookings: bookings.data.length,
    totalEarningsCents,
    currency,
    ratingAvg: profile.data?.ratingAvg ?? null,
    ratingCount: profile.data?.ratingCount ?? 0,
    gradesGiven: grades.data.length,
  });
});

// Parent view: aggregate across all accepted children, plus the parent's own
// spend. Each child is listed individually so parents can see per-child detail;
// the summary totals everything so parents get a single headline number.
analyticsRoutes.get("/parent", async (c) => {
  const { sub } = c.get("auth");
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);
  if (user.data.role !== "parent") {
    return c.json({ error: "not_available_for_role" }, 403);
  }

  const links = await ParentChildLinkEntity.query
    .primary({ parentId: sub })
    .go({ limit: 50 });
  const accepted = links.data.filter((l) => l.status === "accepted");

  const [self, ...children] = await Promise.all([
    metricsFor(sub),
    ...accepted.map((l) => metricsFor(l.childId)),
  ]);

  const summary = {
    totalSpentCents:
      self.totalSpentCents + children.reduce((s, c) => s + c.totalSpentCents, 0),
    sessionsAttended:
      self.sessionsAttended + children.reduce((s, c) => s + c.sessionsAttended, 0),
    currency: self.currency,
    childCount: children.length,
  };

  return c.json({ self, children, summary });
});
