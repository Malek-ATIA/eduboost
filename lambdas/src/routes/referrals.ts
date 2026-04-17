import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  UserEntity,
  ReferralEntity,
  makeReferralCode,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";

export const referralRoutes = new Hono();

referralRoutes.use("*", requireAuth);

// Returns the caller's referral code. Generates + persists one on first call
// if the user doesn't already have one. Handles the rare GSI-unique-collision
// case by retrying with a fresh code.
referralRoutes.get("/mine", async (c) => {
  const { sub } = c.get("auth");
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);

  let code = user.data.referralCode;
  if (!code) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = makeReferralCode();
      const existing = await UserEntity.query.byReferralCode({ referralCode: candidate }).go({ limit: 1 });
      if (!existing.data[0]) {
        await UserEntity.patch({ userId: sub }).set({ referralCode: candidate }).go();
        code = candidate;
        break;
      }
    }
    if (!code) return c.json({ error: "code_generation_failed" }, 503);
  }

  return c.json({
    referralCode: code,
    shareUrl: `${env.webBaseUrl}/signup?ref=${code}`,
    referredByCode: user.data.referredByCode ?? null,
  });
});

const claimSchema = z.object({
  code: z.string().trim().min(4).max(16),
});

referralRoutes.post("/claim", zValidator("json", claimSchema), async (c) => {
  const { sub } = c.get("auth");
  const { code } = c.req.valid("json");
  const normalized = code.toUpperCase();

  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);
  if (user.data.referredByCode) return c.json({ error: "already_claimed" }, 409);

  const referrerLookup = await UserEntity.query
    .byReferralCode({ referralCode: normalized })
    .go({ limit: 1 });
  const referrer = referrerLookup.data[0];
  if (!referrer) return c.json({ error: "unknown_code" }, 404);
  if (referrer.userId === sub) return c.json({ error: "cannot_refer_self" }, 400);

  await UserEntity.patch({ userId: sub }).set({ referredByCode: normalized }).go();
  await ReferralEntity.create({
    referrerId: referrer.userId,
    referredId: sub,
    referralCode: normalized,
  }).go();

  return c.json({ ok: true, referrerDisplayName: referrer.displayName });
});

// Returns people who signed up with the caller's code.
referralRoutes.get("/list", async (c) => {
  const { sub } = c.get("auth");
  const result = await ReferralEntity.query
    .primary({ referrerId: sub })
    .go({ limit: 100 });
  const items = await Promise.all(
    result.data.map(async (r) => {
      try {
        const u = await UserEntity.get({ userId: r.referredId }).go();
        return {
          ...r,
          referred: u.data
            ? {
                userId: u.data.userId,
                displayName: u.data.displayName,
              }
            : null,
        };
      } catch {
        return { ...r, referred: null };
      }
    }),
  );
  return c.json({ items });
});
