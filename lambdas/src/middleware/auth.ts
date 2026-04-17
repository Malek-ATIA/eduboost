import type { MiddlewareHandler } from "hono";
import { CognitoJwtVerifier } from "aws-jwt-verify";
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
  try {
    const payload = await verifier.verify(token);
    c.set("auth", {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      groups: Array.isArray(payload["cognito:groups"]) ? (payload["cognito:groups"] as string[]) : [],
    });
    await next();
  } catch {
    return c.json({ error: "invalid token" }, 401);
  }
};

export const requireGroup =
  (group: string): MiddlewareHandler =>
  async (c, next) => {
    const auth = c.get("auth");
    if (!auth?.groups.includes(group)) return c.json({ error: "forbidden" }, 403);
    await next();
  };
