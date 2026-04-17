import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { TeacherProfileEntity, UserEntity } from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";

export const teacherRoutes = new Hono();

const listQuerySchema = z.object({
  subject: z.string().trim().min(1).max(100).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  country: z
    .string()
    .trim()
    .length(2)
    .transform((s) => s.toUpperCase())
    .optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  minExperience: z.coerce.number().int().min(0).max(80).optional(),
  minRateCents: z.coerce.number().int().nonnegative().optional(),
  maxRateCents: z.coerce.number().int().nonnegative().optional(),
  trial: z
    .enum(["true", "false"])
    .transform((s) => s === "true")
    .optional(),
  individual: z
    .enum(["true", "false"])
    .transform((s) => s === "true")
    .optional(),
  group: z
    .enum(["true", "false"])
    .transform((s) => s === "true")
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

teacherRoutes.get("/", zValidator("query", listQuerySchema), async (c) => {
  const q = c.req.valid("query");

  const query = TeacherProfileEntity.scan.where((attr, op) => {
    const parts: string[] = [];
    if (q.subject) parts.push(op.contains(attr.subjects, q.subject));
    if (q.city) parts.push(op.eq(attr.city, q.city));
    if (q.country) parts.push(op.eq(attr.country, q.country));
    if (q.minRating !== undefined) parts.push(op.gte(attr.ratingAvg, q.minRating));
    if (q.minExperience !== undefined) parts.push(op.gte(attr.yearsExperience, q.minExperience));
    if (q.minRateCents !== undefined) parts.push(op.gte(attr.hourlyRateCents, q.minRateCents));
    if (q.maxRateCents !== undefined) parts.push(op.lte(attr.hourlyRateCents, q.maxRateCents));
    if (q.trial !== undefined) parts.push(op.eq(attr.trialSession, q.trial));
    if (q.individual !== undefined) parts.push(op.eq(attr.individualSessions, q.individual));
    if (q.group !== undefined) parts.push(op.eq(attr.groupSessions, q.group));
    return parts.join(" AND ");
  });

  const result = await query.go({ limit: q.limit });
  return c.json({ items: result.data, count: result.data.length });
});

teacherRoutes.get("/:userId", async (c) => {
  const userId = c.req.param("userId");
  const [profile, user] = await Promise.all([
    TeacherProfileEntity.get({ userId }).go(),
    UserEntity.get({ userId }).go(),
  ]);
  if (!profile.data || !user.data) return c.json({ error: "not found" }, 404);
  return c.json({ profile: profile.data, user: user.data });
});

const profileSchema = z.object({
  bio: z.string().max(2000).optional(),
  subjects: z.array(z.string().min(1).max(100)).max(20).default([]),
  languages: z.array(z.string().min(1).max(50)).max(10).default([]),
  yearsExperience: z.number().int().min(0).max(80).default(0),
  hourlyRateCents: z.number().int().positive(),
  trialSession: z.boolean().default(false),
  individualSessions: z.boolean().default(true),
  groupSessions: z.boolean().default(false),
  city: z.string().max(100).optional(),
  country: z
    .string()
    .length(2)
    .transform((s) => s.toUpperCase())
    .optional(),
});

teacherRoutes.put("/me", requireAuth, zValidator("json", profileSchema), async (c) => {
  const { sub } = c.get("auth");
  const body = c.req.valid("json");
  const result = await TeacherProfileEntity.upsert({ userId: sub, ...body }).go();
  return c.json(result.data);
});
