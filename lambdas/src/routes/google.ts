import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { GoogleIntegrationEntity } from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { buildAuthorizeUrl, completeConnect, signState, verifyState } from "../lib/google.js";
import { env } from "../env.js";

export const googleRoutes = new Hono();

// Auth gates. /callback is intentionally NOT wrapped — Google redirects the
// user's browser there without our bearer token. Authorization is carried
// inside the signed `state` parameter instead.
googleRoutes.use("/connect-url", requireAuth);
googleRoutes.use("/me", requireAuth);
googleRoutes.use("/disconnect", requireAuth);

googleRoutes.get("/connect-url", async (c) => {
  const { sub } = c.get("auth");
  if (
    !env.googleClientId ||
    !env.googleClientSecret ||
    !env.googleRedirectUrl ||
    !env.googleStateSecret
  ) {
    return c.json({ error: "google_not_configured" }, 503);
  }
  const state = signState(sub);
  return c.json({ authorizeUrl: buildAuthorizeUrl(state) });
});

googleRoutes.get(
  "/callback",
  zValidator(
    "query",
    z.object({
      code: z.string().min(1).optional(),
      state: z.string().min(1).optional(),
      error: z.string().optional(),
    }),
  ),
  async (c) => {
    const { code, state, error } = c.req.valid("query");
    const redirectBase = `${env.webBaseUrl}/settings/google`;

    if (error) return c.redirect(`${redirectBase}?status=denied&reason=${encodeURIComponent(error)}`);
    if (!code || !state) return c.redirect(`${redirectBase}?status=error&reason=missing_params`);

    const decoded = verifyState(state);
    if (!decoded) return c.redirect(`${redirectBase}?status=error&reason=invalid_state`);

    try {
      await completeConnect(decoded.userId, code);
    } catch (err) {
      console.error("google.callback: exchange failed", err);
      return c.redirect(`${redirectBase}?status=error&reason=exchange_failed`);
    }

    return c.redirect(`${redirectBase}?status=connected`);
  },
);

googleRoutes.get("/me", async (c) => {
  const { sub } = c.get("auth");
  const row = await GoogleIntegrationEntity.get({ userId: sub }).go();
  if (!row.data) return c.json({ connected: false });
  return c.json({
    connected: true,
    googleEmail: row.data.googleEmail ?? null,
    calendarId: row.data.calendarId ?? "primary",
    connectedAt: row.data.connectedAt,
    expiresAt: row.data.expiresAt,
  });
});

googleRoutes.post("/disconnect", async (c) => {
  const { sub } = c.get("auth");
  const row = await GoogleIntegrationEntity.get({ userId: sub }).go();
  if (!row.data) return c.json({ ok: true });
  // Attempt token revocation at Google so the refresh token is invalidated,
  // but don't fail the disconnect if Google is unreachable — the DDB delete
  // still removes our copy.
  try {
    const tokenToRevoke = row.data.refreshToken ?? row.data.accessToken;
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`,
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" } },
    );
  } catch (err) {
    console.warn("google.disconnect: revoke failed (non-fatal)", err);
  }
  await GoogleIntegrationEntity.delete({ userId: sub }).go();
  return c.json({ ok: true });
});
