import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { healthRoutes } from "./routes/health.js";
import { userRoutes } from "./routes/users.js";
import { teacherRoutes } from "./routes/teachers.js";
import { classroomRoutes } from "./routes/classrooms.js";
import { chimeRoutes } from "./routes/chime.js";
import { bookingRoutes } from "./routes/bookings.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { chatRoutes } from "./routes/chat.js";
import { sessionRoutes } from "./routes/sessions.js";
import { notificationRoutes } from "./routes/notifications.js";
import { supportRoutes } from "./routes/support.js";
import { adminRoutes } from "./routes/admin.js";
import { reviewRoutes } from "./routes/reviews.js";
import { lessonRequestRoutes } from "./routes/lesson-requests.js";
import { familyRoutes } from "./routes/family.js";
import { paymentRoutes } from "./routes/payments.js";
import { attendanceRoutes } from "./routes/attendance.js";
import { marketplaceRoutes } from "./routes/marketplace.js";
import { membershipRoutes } from "./routes/memberships.js";

export const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    credentials: true,
  }),
);

app.route("/health", healthRoutes);
app.route("/webhooks", webhookRoutes);
app.route("/users", userRoutes);
app.route("/teachers", teacherRoutes);
app.route("/classrooms", classroomRoutes);
app.route("/bookings", bookingRoutes);
app.route("/sessions", sessionRoutes);
app.route("/chime", chimeRoutes);
app.route("/chat", chatRoutes);
app.route("/notifications", notificationRoutes);
app.route("/support", supportRoutes);
app.route("/admin", adminRoutes);
app.route("/reviews", reviewRoutes);
app.route("/lesson-requests", lessonRequestRoutes);
app.route("/family", familyRoutes);
app.route("/payments", paymentRoutes);
app.route("/attendance", attendanceRoutes);
app.route("/marketplace", marketplaceRoutes);
app.route("/memberships", membershipRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error", message: err.message }, 500);
});

app.notFound((c) => c.json({ error: "not_found", path: c.req.path }, 404));
