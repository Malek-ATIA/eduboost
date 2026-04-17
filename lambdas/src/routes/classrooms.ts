import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import { ClassroomEntity, ClassroomMembershipEntity } from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";

export const classroomRoutes = new Hono();

classroomRoutes.use("*", requireAuth);

classroomRoutes.get("/mine", async (c) => {
  const { sub } = c.get("auth");
  const memberships = await ClassroomMembershipEntity.query.byUser({ userId: sub }).go();
  return c.json({ items: memberships.data });
});

const createSchema = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  maxStudents: z.number().int().min(1).max(250).default(1),
});

classroomRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const { sub } = c.get("auth");
  const body = c.req.valid("json");
  const classroomId = `cls_${nanoid(12)}`;
  const result = await ClassroomEntity.create({
    classroomId,
    teacherId: sub,
    status: "active",
    ...body,
  }).go();
  await ClassroomMembershipEntity.create({ classroomId, userId: sub, role: "teacher" }).go();
  return c.json(result.data, 201);
});

classroomRoutes.get("/:classroomId", async (c) => {
  const classroomId = c.req.param("classroomId");
  const result = await ClassroomEntity.get({ classroomId }).go();
  if (!result.data) return c.json({ error: "not found" }, 404);
  return c.json(result.data);
});

// External resource links (Drive/Docs/Slides/Sheets/videos/other). Teacher-only
// patch; replaces the whole list atomically so the caller doesn't race itself
// by appending while a stale copy is in state. Capped at 25 to bound the row.
const resourcesSchema = z.object({
  resources: z
    .array(
      z.object({
        url: z.string().url().max(2000),
        label: z.string().trim().min(1).max(120),
        kind: z
          .enum(["drive", "docs", "slides", "sheets", "video", "other"])
          .default("other"),
      }),
    )
    .max(25),
});

classroomRoutes.put(
  "/:classroomId/resources",
  zValidator("json", resourcesSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const classroomId = c.req.param("classroomId");
    const { resources } = c.req.valid("json");
    const existing = await ClassroomEntity.get({ classroomId }).go();
    if (!existing.data) return c.json({ error: "not_found" }, 404);
    if (existing.data.teacherId !== sub) return c.json({ error: "forbidden" }, 403);
    await ClassroomEntity.patch({ classroomId }).set({ resources }).go();
    return c.json({ ok: true, resources });
  },
);
