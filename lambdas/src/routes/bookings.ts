import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import { BookingEntity, UserEntity } from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { stripe, computePlatformFeeCents } from "../lib/stripe.js";
import { notify } from "../lib/notifications.js";

export const bookingRoutes = new Hono();

bookingRoutes.use("*", requireAuth);

bookingRoutes.get("/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await BookingEntity.query.byStudent({ studentId: sub }).go({ limit: 50 });
  return c.json({ items: result.data });
});

bookingRoutes.get("/:bookingId", async (c) => {
  const bookingId = c.req.param("bookingId");
  const result = await BookingEntity.get({ bookingId }).go();
  if (!result.data) return c.json({ error: "not found" }, 404);
  const { sub } = c.get("auth");
  if (result.data.studentId !== sub && result.data.teacherId !== sub) {
    return c.json({ error: "forbidden" }, 403);
  }
  return c.json(result.data);
});

const createSchema = z.object({
  teacherId: z.string().min(1),
  classroomId: z.string().optional(),
  type: z.enum(["trial", "single", "package"]),
  amountCents: z.number().int().min(50),
  currency: z.string().length(3).default("EUR"),
});

bookingRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const { sub, email } = c.get("auth");
  const body = c.req.valid("json");
  const bookingId = `bk_${nanoid(12)}`;

  const [student, teacher] = await Promise.all([
    UserEntity.get({ userId: sub }).go(),
    UserEntity.get({ userId: body.teacherId }).go(),
  ]);
  if (!student.data) return c.json({ error: "user_not_found" }, 404);
  if (!teacher.data || teacher.data.role !== "teacher") {
    return c.json({ error: "teacher_not_found" }, 404);
  }

  const intent = await stripe().paymentIntents.create({
    amount: body.amountCents,
    currency: body.currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: {
      bookingId,
      studentId: sub,
      teacherId: body.teacherId,
      type: body.type,
    },
    receipt_email: email,
    description: `EduBoost ${body.type} session booking`,
  });

  const result = await BookingEntity.create({
    bookingId,
    studentId: sub,
    status: "pending",
    stripePaymentIntentId: intent.id,
    ...body,
  }).go();

  await notify({
    userId: body.teacherId,
    type: "booking_created",
    title: "New booking",
    body: `${student.data.displayName} booked a ${body.type} session with you.`,
    linkPath: `/bookings/${bookingId}`,
    email: {
      subject: "New booking on EduBoost",
      html: `<p>Hi ${escapeHtml(teacher.data.displayName)},</p><p><strong>${escapeHtml(
        student.data.displayName,
      )}</strong> just booked a ${body.type} session with you for €${(body.amountCents / 100).toFixed(
        2,
      )}. Payment is pending confirmation.</p>`,
    },
  });

  return c.json(
    {
      booking: result.data,
      clientSecret: intent.client_secret,
      platformFeeCents: computePlatformFeeCents(body.amountCents),
    },
    201,
  );
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
