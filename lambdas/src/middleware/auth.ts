import type { MiddlewareHandler } from "hono";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { UserEntity } from "@eduboost/db";
import { env } from "../env.js";

const verifier = env.userPoolId
  ? CognitoJwtVerifier.create({
      userPoolId: env.userPoolId,
      tokenUse: "access",
      clientId: env.userPoolClientId,
    })
  : null;

export type AuthContext = {
  sub: string;
  email?: string;
  groups: string[];
};

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const token = header.slice(7);
  if (!verifier) return c.json({ error: "auth not configured" }, 500);
  let sub: string;
  let groups: string[];
  let email: string | undefined;
  try {
    const payload = await verifier.verify(token);
    sub = payload.sub;
    email = typeof payload.email === "string" ? payload.email : undefined;
    groups = Array.isArray(payload["cognito:groups"]) ? (payload["cognito:groups"] as string[]) : [];
  } catch {
    return c.json({ error: "invalid token" }, 401);
  }

  // Ban check: one DDB GetItem per authenticated request.
  // NOTE (MVP tradeoff #1 — N+1 on auth): this adds a DDB read to every
  // authenticated call. For MVP load this is fine (single-digit ms, on-demand
  // table). If cost/latency matter later, cache by `sub` for ~60s in-memory
  // per-Lambda, or push ban state into a custom Cognito token claim via a
  // pre-token-generation trigger.
  // NOTE (MVP tradeoff #2 — fail-open): if the DDB lookup throws (transient
  // error, throttling), we LOG AND ALLOW the request rather than 500. Rationale:
  // ban is rare; availability of the whole API matters more than same-second
  // enforcement for the 1-hour JWT window. Revisit if we see a ban-evasion
  // incident tied to this.
  try {
    const user = await UserEntity.get({ userId: sub }).go();
    if (user.data?.bannedAt) {
      return c.json({ error: "banned", reason: user.data.banReason ?? "Account suspended" }, 403);
    }
  } catch (err) {
    console.warn("requireAuth: ban-check lookup failed (allowing request)", err);
  }

  c.set("auth", { sub, email, groups });
  await next();
};

export const requireGroup =
  (group: string): MiddlewareHandler =>
  async (c, next) => {
    const auth = c.get("auth");
    if (!auth?.groups.includes(group)) return c.json({ error: "forbidden" }, 403);
    await next();
  };

// NOTE (MVP tradeoff): authorization is driven by the Cognito "admin" GROUP
// (read from the `cognito:groups` access-token claim), NOT by the DDB
// UserEntity.role === "admin" field. The two are independent by design:
//   - `cognito:groups` is the source of truth for what the API trusts.
//   - UserEntity.role is a display/routing hint captured at sign-up
//     (custom:role) and can drift from group membership.
// Consequences:
//   - Admins must be added to the "admin" Cognito group explicitly; setting
//     role=admin in DDB alone grants nothing.
//   - The ban route blocks banning users whose DDB role is "admin" as a
//     defence-in-depth check, but the real gate is group membership.
// Reconciling the two (e.g., a background job, or deriving role from group)
// is tracked as post-MVP work.
export const requireAdmin = requireGroup("admin");
