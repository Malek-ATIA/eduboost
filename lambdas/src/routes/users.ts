import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { UserEntity } from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";

export const userRoutes = new Hono();

userRoutes.use("*", requireAuth);

userRoutes.get("/me", async (c) => {
  const { sub } = c.get("auth");
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "not found" }, 404);
  return c.json(user.data);
});

const upsertSchema = z.object({
  email: z.string().email(),
  role: z.enum(["parent", "student", "teacher", "org_admin", "admin"]),
  displayName: z.string().min(1).max(100),
  avatarUrl: z.string().url().optional(),
});

userRoutes.post("/me", zValidator("json", upsertSchema), async (c) => {
  const { sub } = c.get("auth");
  const body = c.req.valid("json");
  const result = await UserEntity.upsert({
    userId: sub,
    cognitoSub: sub,
    ...body,
  }).go();
  return c.json(result.data);
});
