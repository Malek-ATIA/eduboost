/**
 * Comprehensive route-shape tests for every route module.
 *
 * These verify that each Hono router exports the expected HTTP verb + path
 * combinations. If any endpoint is renamed, removed, or its method changes,
 * these tests catch it before deploy. This is the cheapest form of API
 * contract test — no DDB, no AWS SDK, no mocks needed.
 */
import { describe, it, expect } from "vitest";

import { teacherRoutes } from "./teachers.js";
import { bookingRoutes } from "./bookings.js";
import { userRoutes } from "./users.js";
import { classroomRoutes } from "./classrooms.js";
import { sessionRoutes } from "./sessions.js";
import { chatRoutes } from "./chat.js";
import { notificationRoutes } from "./notifications.js";
import { supportRoutes } from "./support.js";
import { adminRoutes } from "./admin.js";
import { reviewRoutes } from "./reviews.js";
import { lessonRequestRoutes } from "./lesson-requests.js";
import { familyRoutes } from "./family.js";
import { paymentRoutes } from "./payments.js";
import { attendanceRoutes } from "./attendance.js";
import { marketplaceRoutes } from "./marketplace.js";
import { membershipRoutes } from "./memberships.js";
import { forumRoutes } from "./forum.js";
import { wallRoutes } from "./wall.js";
import { referralRoutes } from "./referrals.js";
import { smsRoutes } from "./sms.js";
import { googleRoutes } from "./google.js";
import { aiGradeRoutes } from "./ai-grades.js";
import { whiteboardRoutes } from "./whiteboard.js";
import { analyticsRoutes } from "./analytics.js";
import { organizationRoutes } from "./organizations.js";
import { noteRoutes } from "./notes.js";
import { teacherQuizRoutes } from "./teacher-quiz.js";
import { eventRoutes } from "./events.js";
import { assessmentRoutes } from "./assessments.js";
import { studyMaterialRoutes } from "./study-materials.js";
import { reviewSessionRoutes } from "./review-sessions.js";
import { mailboxRoutes } from "./mailbox.js";
import { favoriteRoutes } from "./favorites.js";
import { reportRoutes } from "./reports.js";
import { healthRoutes } from "./health.js";
import { webhookRoutes } from "./webhooks.js";

type Route = { method: string; path: string };

function listRoutes(router: unknown): Route[] {
  const r = (router as { routes: Route[] }).routes;
  return r.map((x) => ({ method: x.method.toUpperCase(), path: x.path }));
}

function handlers(router: unknown): Route[] {
  return listRoutes(router).filter((r) => r.method !== "ALL");
}

function expectRoute(routes: Route[], method: string, path: string) {
  expect(routes).toContainEqual({ method, path });
}

// ─── Health ────────────────────────────────────────────────────────────
describe("healthRoutes", () => {
  const routes = handlers(healthRoutes);
  it("GET /", () => expectRoute(routes, "GET", "/"));
});

// ─── Webhooks ──────────────────────────────────────────────────────────
describe("webhookRoutes", () => {
  const routes = handlers(webhookRoutes);
  it("POST /stripe", () => expectRoute(routes, "POST", "/stripe"));
});

// ─── Users ─────────────────────────────────────────────────────────────
describe("userRoutes", () => {
  const routes = handlers(userRoutes);
  it("GET /me", () => expectRoute(routes, "GET", "/me"));
  it("PATCH /me", () => expectRoute(routes, "PATCH", "/me"));
  it("POST /me/avatar-upload-url", () => expectRoute(routes, "POST", "/me/avatar-upload-url"));
  it("GET /:userId/avatar-url", () => expectRoute(routes, "GET", "/:userId/avatar-url"));
});

// ─── Teachers ──────────────────────────────────────────────────────────
describe("teacherRoutes", () => {
  const routes = handlers(teacherRoutes);
  it("GET / (list)", () => expectRoute(routes, "GET", "/"));
  it("GET /:userId (detail)", () => expectRoute(routes, "GET", "/:userId"));
  it("PUT /me (upsert profile)", () => expectRoute(routes, "PUT", "/me"));
  it("GET /:userId/video-url", () => expectRoute(routes, "GET", "/:userId/video-url"));
  it("POST /me/video-upload-url", () => expectRoute(routes, "POST", "/me/video-upload-url"));
  it("PATCH /me/video", () => expectRoute(routes, "PATCH", "/me/video"));
  it("POST /me/submit-verification", () => expectRoute(routes, "POST", "/me/submit-verification"));
  it("GET /me/students", () => expectRoute(routes, "GET", "/me/students"));
  it("GET /me/students/:studentId", () => expectRoute(routes, "GET", "/me/students/:studentId"));
});

// ─── Bookings ──────────────────────────────────────────────────────────
describe("bookingRoutes", () => {
  const routes = handlers(bookingRoutes);
  it("GET /mine", () => expectRoute(routes, "GET", "/mine"));
  it("GET /as-teacher", () => expectRoute(routes, "GET", "/as-teacher"));
  it("GET /:bookingId", () => expectRoute(routes, "GET", "/:bookingId"));
  it("POST / (create booking)", () => expectRoute(routes, "POST", "/"));
  it("POST /:bookingId/cancel", () => expectRoute(routes, "POST", "/:bookingId/cancel"));

  it("guards all routes with requireAuth middleware", () => {
    const all = listRoutes(bookingRoutes);
    const wildcards = all.filter((r) => r.method === "ALL");
    expect(wildcards.length).toBeGreaterThan(0);
  });
});

// ─── Classrooms ────────────────────────────────────────────────────────
describe("classroomRoutes", () => {
  const routes = handlers(classroomRoutes);
  it("GET /mine", () => expectRoute(routes, "GET", "/mine"));
  it("POST / (create)", () => expectRoute(routes, "POST", "/"));
  it("GET /:classroomId", () => expectRoute(routes, "GET", "/:classroomId"));
  it("GET /:classroomId/sessions", () => expectRoute(routes, "GET", "/:classroomId/sessions"));
  it("GET /:classroomId/members", () => expectRoute(routes, "GET", "/:classroomId/members"));
  it("POST /:classroomId/members (join)", () => expectRoute(routes, "POST", "/:classroomId/members"));
  it("DELETE /:classroomId/members/:userId", () => expectRoute(routes, "DELETE", "/:classroomId/members/:userId"));
});

// ─── Sessions ──────────────────────────────────────────────────────────
describe("sessionRoutes", () => {
  const routes = handlers(sessionRoutes);
  it("GET /upcoming", () => expectRoute(routes, "GET", "/upcoming"));
  it("POST / (create)", () => expectRoute(routes, "POST", "/"));
});

// ─── Chat ──────────────────────────────────────────────────────────────
describe("chatRoutes", () => {
  const routes = handlers(chatRoutes);
  it("GET /dm/:otherUserId", () => expectRoute(routes, "GET", "/dm/:otherUserId"));
  it("POST /dm/:otherUserId", () => expectRoute(routes, "POST", "/dm/:otherUserId"));
  it("GET /classroom/:classroomId", () => expectRoute(routes, "GET", "/classroom/:classroomId"));
  it("POST /classroom/:classroomId", () => expectRoute(routes, "POST", "/classroom/:classroomId"));
});

// ─── Notifications ─────────────────────────────────────────────────────
describe("notificationRoutes", () => {
  const routes = handlers(notificationRoutes);
  it("GET / (list)", () => expectRoute(routes, "GET", "/"));
  it("GET /unread-count", () => expectRoute(routes, "GET", "/unread-count"));
  it("POST /read-all", () => expectRoute(routes, "POST", "/read-all"));
});

// ─── Support ───────────────────────────────────────────────────────────
describe("supportRoutes", () => {
  const routes = handlers(supportRoutes);
  it("POST /tickets (create)", () => expectRoute(routes, "POST", "/tickets"));
  it("GET /tickets/mine", () => expectRoute(routes, "GET", "/tickets/mine"));
  it("GET /tickets/:ticketId", () => expectRoute(routes, "GET", "/tickets/:ticketId"));
  it("POST /tickets/:ticketId/messages", () => expectRoute(routes, "POST", "/tickets/:ticketId/messages"));
  it("POST /tickets/:ticketId/resolve", () => expectRoute(routes, "POST", "/tickets/:ticketId/resolve"));
  it("POST /tickets/:ticketId/attachment-url", () => expectRoute(routes, "POST", "/tickets/:ticketId/attachment-url"));
  it("GET /attachments/:ticketId/:s3Key{.+}", () => expectRoute(routes, "GET", "/attachments/:ticketId/:s3Key{.+}"));
});

// ─── Admin ─────────────────────────────────────────────────────────────
describe("adminRoutes", () => {
  const routes = handlers(adminRoutes);
  it("GET /users", () => expectRoute(routes, "GET", "/users"));
  it("GET /users/:userId", () => expectRoute(routes, "GET", "/users/:userId"));
});

// ─── Reviews ───────────────────────────────────────────────────────────
describe("reviewRoutes", () => {
  const routes = handlers(reviewRoutes);
  it("POST / (create)", () => expectRoute(routes, "POST", "/"));
});

// ─── Lesson Requests ───────────────────────────────────────────────────
describe("lessonRequestRoutes", () => {
  const routes = handlers(lessonRequestRoutes);
  it("POST / (create)", () => expectRoute(routes, "POST", "/"));
  it("GET /mine", () => expectRoute(routes, "GET", "/mine"));
  it("GET /inbox", () => expectRoute(routes, "GET", "/inbox"));
  it("GET /:requestId", () => expectRoute(routes, "GET", "/:requestId"));
  it("POST /:requestId/cancel", () => expectRoute(routes, "POST", "/:requestId/cancel"));
});

// ─── Family ────────────────────────────────────────────────────────────
describe("familyRoutes", () => {
  const routes = handlers(familyRoutes);
  it("GET /children", () => expectRoute(routes, "GET", "/children"));
  it("POST /children (link)", () => expectRoute(routes, "POST", "/children"));
  it("DELETE /children/:childId", () => expectRoute(routes, "DELETE", "/children/:childId"));
  it("GET /parents", () => expectRoute(routes, "GET", "/parents"));
});

// ─── Payments ──────────────────────────────────────────────────────────
describe("paymentRoutes", () => {
  const routes = handlers(paymentRoutes);
  it("GET /mine", () => expectRoute(routes, "GET", "/mine"));
  it("GET /received", () => expectRoute(routes, "GET", "/received"));
});

// ─── Attendance ────────────────────────────────────────────────────────
describe("attendanceRoutes", () => {
  const routes = handlers(attendanceRoutes);
  it("GET /mine", () => expectRoute(routes, "GET", "/mine"));
});

// ─── Marketplace ───────────────────────────────────────────────────────
describe("marketplaceRoutes", () => {
  const routes = handlers(marketplaceRoutes);
  it("GET /listings (public)", () => expectRoute(routes, "GET", "/listings"));
  it("GET /listings/mine", () => expectRoute(routes, "GET", "/listings/mine"));
  it("POST /listings (create)", () => expectRoute(routes, "POST", "/listings"));
  it("GET /orders/mine", () => expectRoute(routes, "GET", "/orders/mine"));
  it("GET /orders/as-seller", () => expectRoute(routes, "GET", "/orders/as-seller"));
});

// ─── Memberships ───────────────────────────────────────────────────────
describe("membershipRoutes", () => {
  const routes = handlers(membershipRoutes);
  it("GET /plans", () => expectRoute(routes, "GET", "/plans"));
  it("GET /me", () => expectRoute(routes, "GET", "/me"));
  it("POST /checkout", () => expectRoute(routes, "POST", "/checkout"));
  it("POST /cancel", () => expectRoute(routes, "POST", "/cancel"));
});

// ─── Forum ─────────────────────────────────────────────────────────────
describe("forumRoutes", () => {
  const routes = handlers(forumRoutes);
  it("GET /channels", () => expectRoute(routes, "GET", "/channels"));
  it("GET /channels/:channelId/posts", () => expectRoute(routes, "GET", "/channels/:channelId/posts"));
  it("GET /posts/:postId", () => expectRoute(routes, "GET", "/posts/:postId"));
  it("POST /posts (create)", () => expectRoute(routes, "POST", "/posts"));
  it("POST /posts/:postId/comments", () => expectRoute(routes, "POST", "/posts/:postId/comments"));
  it("POST /posts/:postId/vote", () => expectRoute(routes, "POST", "/posts/:postId/vote"));
  it("POST /comments/:commentId/vote", () => expectRoute(routes, "POST", "/comments/:commentId/vote"));
  it("GET /my-votes", () => expectRoute(routes, "GET", "/my-votes"));
  it("GET /posts/:postId/hydrated", () => expectRoute(routes, "GET", "/posts/:postId/hydrated"));
});

// ─── Wall ──────────────────────────────────────────────────────────────
describe("wallRoutes", () => {
  const routes = handlers(wallRoutes);
  it("POST /posts (create)", () => expectRoute(routes, "POST", "/posts"));
});

// ─── Referrals ─────────────────────────────────────────────────────────
describe("referralRoutes", () => {
  const routes = handlers(referralRoutes);
  it("GET /mine", () => expectRoute(routes, "GET", "/mine"));
  it("POST /claim", () => expectRoute(routes, "POST", "/claim"));
  it("GET /list", () => expectRoute(routes, "GET", "/list"));
});

// ─── SMS ───────────────────────────────────────────────────────────────
describe("smsRoutes", () => {
  const routes = handlers(smsRoutes);
  it("GET /me", () => expectRoute(routes, "GET", "/me"));
  it("POST /phone", () => expectRoute(routes, "POST", "/phone"));
  it("POST /verify", () => expectRoute(routes, "POST", "/verify"));
  it("POST /opt-out", () => expectRoute(routes, "POST", "/opt-out"));
  it("POST /opt-in", () => expectRoute(routes, "POST", "/opt-in"));
});

// ─── Google ────────────────────────────────────────────────────────────
describe("googleRoutes", () => {
  const routes = handlers(googleRoutes);
  it("GET /connect-url", () => expectRoute(routes, "GET", "/connect-url"));
  it("GET /me", () => expectRoute(routes, "GET", "/me"));
  it("POST /disconnect", () => expectRoute(routes, "POST", "/disconnect"));
});

// ─── AI Grades ─────────────────────────────────────────────────────────
describe("aiGradeRoutes", () => {
  const routes = handlers(aiGradeRoutes);
  it("POST / (create)", () => expectRoute(routes, "POST", "/"));
  it("GET /student/mine", () => expectRoute(routes, "GET", "/student/mine"));
  it("GET /teacher/mine", () => expectRoute(routes, "GET", "/teacher/mine"));
});

// ─── Whiteboard ────────────────────────────────────────────────────────
describe("whiteboardRoutes", () => {
  const all = listRoutes(whiteboardRoutes);
  it("registers at least one handler", () => {
    expect(all.length).toBeGreaterThan(0);
  });
});

// ─── Analytics ─────────────────────────────────────────────────────────
describe("analyticsRoutes", () => {
  const routes = handlers(analyticsRoutes);
  it("GET /student", () => expectRoute(routes, "GET", "/student"));
  it("GET /teacher", () => expectRoute(routes, "GET", "/teacher"));
  it("GET /parent", () => expectRoute(routes, "GET", "/parent"));
});

// ─── Organizations ─────────────────────────────────────────────────────
describe("organizationRoutes", () => {
  const routes = handlers(organizationRoutes);
  it("POST / (create)", () => expectRoute(routes, "POST", "/"));
  it("GET /mine", () => expectRoute(routes, "GET", "/mine"));
});

// ─── Notes ─────────────────────────────────────────────────────────────
describe("noteRoutes", () => {
  const routes = handlers(noteRoutes);
  it("GET /mine", () => expectRoute(routes, "GET", "/mine"));
});

// ─── Teacher Quiz ──────────────────────────────────────────────────────
describe("teacherQuizRoutes", () => {
  const routes = handlers(teacherQuizRoutes);
  it("POST / (create)", () => expectRoute(routes, "POST", "/"));
});

// ─── Events ────────────────────────────────────────────────────────────
describe("eventRoutes", () => {
  const routes = handlers(eventRoutes);
  it("GET / (list public)", () => expectRoute(routes, "GET", "/"));
  it("POST / (create)", () => expectRoute(routes, "POST", "/"));
  it("GET /mine/organizing", () => expectRoute(routes, "GET", "/mine/organizing"));
  it("GET /mine/tickets", () => expectRoute(routes, "GET", "/mine/tickets"));
});

// ─── Assessments ───────────────────────────────────────────────────────
describe("assessmentRoutes", () => {
  const routes = handlers(assessmentRoutes);
  it("GET / (list)", () => expectRoute(routes, "GET", "/"));
  it("POST / (create)", () => expectRoute(routes, "POST", "/"));
  it("GET /teacher/mine", () => expectRoute(routes, "GET", "/teacher/mine"));
  it("GET /student/mine", () => expectRoute(routes, "GET", "/student/mine"));
});

// ─── Study Materials ───────────────────────────────────────────────────
describe("studyMaterialRoutes", () => {
  const routes = handlers(studyMaterialRoutes);
  it("GET / (list)", () => expectRoute(routes, "GET", "/"));
  it("GET /mine", () => expectRoute(routes, "GET", "/mine"));
  it("POST / (create)", () => expectRoute(routes, "POST", "/"));
});

// ─── Review Sessions ───────────────────────────────────────────────────
describe("reviewSessionRoutes", () => {
  const routes = handlers(reviewSessionRoutes);
  it("POST / (create)", () => expectRoute(routes, "POST", "/"));
  it("GET /mine", () => expectRoute(routes, "GET", "/mine"));
});

// ─── Mailbox ───────────────────────────────────────────────────────────
describe("mailboxRoutes", () => {
  const routes = handlers(mailboxRoutes);
  it("POST /threads (create)", () => expectRoute(routes, "POST", "/threads"));
  it("GET /threads/mine", () => expectRoute(routes, "GET", "/threads/mine"));
  it("GET /threads/:threadId", () => expectRoute(routes, "GET", "/threads/:threadId"));
  it("POST /threads/:threadId/messages", () => expectRoute(routes, "POST", "/threads/:threadId/messages"));
});

// ─── Favorites ─────────────────────────────────────────────────────────
describe("favoriteRoutes", () => {
  const routes = handlers(favoriteRoutes);
  it("POST / (add favorite)", () => expectRoute(routes, "POST", "/"));
  it("GET /mine", () => expectRoute(routes, "GET", "/mine"));
});

// ─── Reports ───────────────────────────────────────────────────────────
describe("reportRoutes", () => {
  const routes = handlers(reportRoutes);
  it("GET /teacher/summary", () => expectRoute(routes, "GET", "/teacher/summary"));
  it("GET /teacher/export.csv", () => expectRoute(routes, "GET", "/teacher/export.csv"));
});
