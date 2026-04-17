import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  CognitoIdentityProviderClient,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  UserEntity,
  SupportTicketEntity,
  TICKET_STATUSES,
  TeacherProfileEntity,
  VERIFICATION_STATUSES,
} from "@eduboost/db";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { sendEmail, emailTemplates } from "../lib/resend.js";
import { notify } from "../lib/notifications.js";
import { env } from "../env.js";

export const adminRoutes = new Hono();

adminRoutes.use("*", requireAuth, requireAdmin);

const cognito = new CognitoIdentityProviderClient({ region: env.region });

const listUsersQuery = z.object({
  role: z.enum(["parent", "student", "teacher", "org_admin", "admin"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

adminRoutes.get("/users", zValidator("query", listUsersQuery), async (c) => {
  const { role, limit } = c.req.valid("query");
  if (role) {
    const result = await UserEntity.query.byRole({ role }).go({ limit, order: "desc" });
    return c.json({ items: result.data });
  }
  const result = await UserEntity.scan.go({ limit });
  return c.json({ items: result.data });
});

adminRoutes.get(
  "/users/by-email/:email",
  zValidator("param", z.object({ email: z.string().email() })),
  async (c) => {
    const { email } = c.req.valid("param");
    const result = await UserEntity.query.byEmail({ email }).go({ limit: 1 });
    if (!result.data[0]) return c.json({ error: "not_found" }, 404);
    return c.json(result.data[0]);
  },
);

adminRoutes.get("/users/:userId", async (c) => {
  const userId = c.req.param("userId");
  const result = await UserEntity.get({ userId }).go();
  if (!result.data) return c.json({ error: "not_found" }, 404);
  return c.json(result.data);
});

const banSchema = z.object({ reason: z.string().trim().min(10).max(500) });

adminRoutes.post(
  "/users/:userId/ban",
  zValidator("json", banSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const userId = c.req.param("userId");
    const { reason } = c.req.valid("json");

    if (userId === sub) return c.json({ error: "cannot_ban_self" }, 400);

    const target = await UserEntity.get({ userId }).go();
    if (!target.data) return c.json({ error: "not_found" }, 404);
    if (target.data.role === "admin") return c.json({ error: "cannot_ban_admin" }, 403);
    if (target.data.bannedAt) return c.json({ error: "already_banned" }, 409);

    await UserEntity.patch({ userId })
      .set({ bannedAt: new Date().toISOString(), banReason: reason })
      .go();

    try {
      await cognito.send(
        new AdminDisableUserCommand({
          UserPoolId: env.userPoolId,
          Username: target.data.email,
        }),
      );
    } catch (err) {
      console.error("ban: cognito disable failed", err);
      return c.json({ error: "cognito_disable_failed" }, 500);
    }

    try {
      const tpl = emailTemplates.accountBanned(target.data.displayName, reason);
      await sendEmail({ to: target.data.email, subject: tpl.subject, html: tpl.html });
    } catch (err) {
      console.error("ban notification email failed (non-fatal)", err);
    }

    return c.json({ ok: true, bannedAt: new Date().toISOString(), reason });
  },
);

adminRoutes.post("/users/:userId/unban", async (c) => {
  const userId = c.req.param("userId");
  const target = await UserEntity.get({ userId }).go();
  if (!target.data) return c.json({ error: "not_found" }, 404);
  if (!target.data.bannedAt) return c.json({ error: "not_banned" }, 409);

  await UserEntity.patch({ userId }).remove(["bannedAt", "banReason"]).go();

  try {
    await cognito.send(
      new AdminEnableUserCommand({
        UserPoolId: env.userPoolId,
        Username: target.data.email,
      }),
    );
  } catch (err) {
    console.error("unban: cognito enable failed", err);
    return c.json({ error: "cognito_enable_failed" }, 500);
  }

  try {
    const tpl = emailTemplates.accountRestored(target.data.displayName);
    await sendEmail({ to: target.data.email, subject: tpl.subject, html: tpl.html });
  } catch (err) {
    console.error("unban email failed (non-fatal)", err);
  }

  return c.json({ ok: true });
});

const ticketsQuery = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

adminRoutes.get("/tickets", zValidator("query", ticketsQuery), async (c) => {
  const { status, limit } = c.req.valid("query");
  if (status) {
    const result = await SupportTicketEntity.query
      .byStatus({ status })
      .go({ limit, order: "desc" });
    return c.json({ items: result.data });
  }
  const result = await SupportTicketEntity.scan.go({ limit });
  return c.json({ items: result.data });
});

const verificationsQuery = z.object({
  status: z.enum(VERIFICATION_STATUSES).default("pending"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

adminRoutes.get(
  "/verifications",
  zValidator("query", verificationsQuery),
  async (c) => {
    const { status, limit } = c.req.valid("query");
    const result = await TeacherProfileEntity.query
      .byVerificationStatus({ verificationStatus: status })
      .go({ limit, order: "desc" });
    const hydrated = await Promise.all(
      result.data.map(async (p) => {
        try {
          const u = await UserEntity.get({ userId: p.userId }).go();
          return {
            ...p,
            user: u.data
              ? { userId: u.data.userId, email: u.data.email, displayName: u.data.displayName }
              : null,
          };
        } catch {
          return { ...p, user: null };
        }
      }),
    );
    return c.json({ items: hydrated });
  },
);

const decisionSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
});

adminRoutes.post(
  "/verifications/:userId/approve",
  zValidator("json", decisionSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const userId = c.req.param("userId");
    const { notes } = c.req.valid("json");

    const profile = await TeacherProfileEntity.get({ userId }).go();
    if (!profile.data) return c.json({ error: "not_found" }, 404);
    if (profile.data.verificationStatus === "verified") {
      return c.json({ error: "already_verified" }, 409);
    }
    // Note: we intentionally allow approval from any non-"verified" state
    // (including "unsubmitted") so admins can fast-track teachers out-of-band.

    await TeacherProfileEntity.patch({ userId })
      .set({
        verificationStatus: "verified",
        verifiedAt: new Date().toISOString(),
        verifiedBy: sub,
        verificationNotes: notes,
      })
      .go();

    try {
      await notify({
        userId,
        type: "profile_verified",
        title: "Profile verified",
        body: "Your teacher profile has been verified by the EduBoost team.",
        linkPath: `/teachers/${userId}`,
      });
    } catch (err) {
      console.error("verify notify failed (non-fatal)", err);
    }

    return c.json({ ok: true });
  },
);

const rejectSchema = z.object({
  notes: z.string().trim().min(10).max(2000),
});

adminRoutes.post(
  "/verifications/:userId/reject",
  zValidator("json", rejectSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const userId = c.req.param("userId");
    const { notes } = c.req.valid("json");

    const profile = await TeacherProfileEntity.get({ userId }).go();
    if (!profile.data) return c.json({ error: "not_found" }, 404);
    // Reject is allowed from "pending" (normal path) or "verified"
    // (revoking a prior verification). Re-rejecting an already-"rejected"
    // profile is a no-op; return 409 so the admin UI can surface it.
    if (profile.data.verificationStatus === "rejected") {
      return c.json({ error: "already_rejected" }, 409);
    }
    const wasVerified = profile.data.verificationStatus === "verified";

    const patch = TeacherProfileEntity.patch({ userId }).set({
      verificationStatus: "rejected",
      verifiedBy: sub,
      verificationNotes: notes,
    });
    // When revoking a previously-verified profile, clear verifiedAt so the
    // public "verified" badge disappears and stale timestamps don't linger.
    if (wasVerified) {
      await patch.remove(["verifiedAt"]).go();
    } else {
      await patch.go();
    }

    try {
      await notify({
        userId,
        type: "profile_rejected",
        title: "Profile not approved",
        body: `Reasons: ${notes.slice(0, 200)}`,
        linkPath: `/teacher/profile`,
      });
    } catch (err) {
      console.error("reject notify failed (non-fatal)", err);
    }

    return c.json({ ok: true });
  },
);
