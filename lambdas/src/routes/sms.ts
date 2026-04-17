import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { UserEntity } from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { sendSms, generateOtp, hashOtp, isValidE164 } from "../lib/sms.js";

export const smsRoutes = new Hono();

smsRoutes.use("*", requireAuth);

smsRoutes.get("/me", async (c) => {
  const { sub } = c.get("auth");
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);
  return c.json({
    phoneNumber: user.data.phoneNumber ?? null,
    phoneVerifiedAt: user.data.phoneVerifiedAt ?? null,
    smsOptIn: user.data.smsOptIn ?? false,
  });
});

const phoneSchema = z.object({
  phoneNumber: z.string().trim().refine(isValidE164, {
    message: "phone_number must be E.164 (e.g. +35318001234)",
  }),
});

smsRoutes.post("/phone", zValidator("json", phoneSchema), async (c) => {
  const { sub } = c.get("auth");
  const { phoneNumber } = c.req.valid("json");

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  await UserEntity.patch({ userId: sub })
    .set({
      phoneNumber,
      smsVerifyCodeHash: hashOtp(otp),
      smsVerifyExpiresAt: expiresAt,
    })
    .remove(["phoneVerifiedAt"])
    .go();

  try {
    await sendSms(phoneNumber, `Your EduBoost verification code is ${otp}. Expires in 10 minutes.`);
  } catch (err) {
    console.error("sms.phone: SNS publish failed", err);
    return c.json({ error: "sms_send_failed" }, 502);
  }

  return c.json({ ok: true, expiresAt });
});

const verifySchema = z.object({
  code: z.string().trim().length(6).regex(/^\d+$/),
});

smsRoutes.post("/verify", zValidator("json", verifySchema), async (c) => {
  const { sub } = c.get("auth");
  const { code } = c.req.valid("json");

  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);
  if (!user.data.smsVerifyCodeHash || !user.data.smsVerifyExpiresAt) {
    return c.json({ error: "no_pending_verification" }, 409);
  }
  if (new Date(user.data.smsVerifyExpiresAt) < new Date()) {
    return c.json({ error: "code_expired" }, 410);
  }
  if (hashOtp(code) !== user.data.smsVerifyCodeHash) {
    return c.json({ error: "wrong_code" }, 401);
  }

  await UserEntity.patch({ userId: sub })
    .set({
      phoneVerifiedAt: new Date().toISOString(),
      smsOptIn: true,
    })
    .remove(["smsVerifyCodeHash", "smsVerifyExpiresAt"])
    .go();

  return c.json({ ok: true });
});

smsRoutes.post("/opt-out", async (c) => {
  const { sub } = c.get("auth");
  await UserEntity.patch({ userId: sub }).set({ smsOptIn: false }).go();
  return c.json({ ok: true });
});

smsRoutes.post("/opt-in", async (c) => {
  const { sub } = c.get("auth");
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);
  if (!user.data.phoneVerifiedAt) return c.json({ error: "phone_not_verified" }, 409);
  await UserEntity.patch({ userId: sub }).set({ smsOptIn: true }).go();
  return c.json({ ok: true });
});
