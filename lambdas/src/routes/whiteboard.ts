import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  WhiteboardEntity,
  ClassroomEntity,
  ClassroomMembershipEntity,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";

export const whiteboardRoutes = new Hono();

whiteboardRoutes.use("*", requireAuth);

// Cap total strokes per board so DDB's 400KB item limit isn't hit. Each point
// is a two-integer tuple that serializes to ~15-20 bytes of DDB-encoded JSON
// (including list overhead), so one maximally-populated stroke (250 points)
// is ~5KB. 50 strokes × 5KB ≈ 250KB, leaving comfortable headroom under the
// 400KB item limit. Oldest strokes are dropped when the cap is reached.
const MAX_STROKES = 50;
const MAX_POINTS_PER_STROKE = 250;

// Point is [x, y] — integers 0..10000 so the canvas can be rendered at any
// resolution by dividing client-side. Stored as a tuple, not an object, to
// keep each stroke small.
const pointSchema = z.tuple([z.number().int().min(0).max(10_000), z.number().int().min(0).max(10_000)]);

const strokeSchema = z.object({
  points: z.array(pointSchema).min(1).max(MAX_POINTS_PER_STROKE),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  width: z.number().int().min(1).max(40),
});

type Stroke = z.infer<typeof strokeSchema> & { authorId: string; at: string };

async function canAccess(classroomId: string, sub: string): Promise<{ ok: boolean; teacher: boolean }> {
  const [classroom, membership] = await Promise.all([
    ClassroomEntity.get({ classroomId }).go(),
    ClassroomMembershipEntity.get({ classroomId, userId: sub }).go(),
  ]);
  if (!classroom.data) return { ok: false, teacher: false };
  if (classroom.data.teacherId === sub) return { ok: true, teacher: true };
  if (membership.data) return { ok: true, teacher: false };
  return { ok: false, teacher: false };
}

whiteboardRoutes.get(
  "/classroom/:classroomId",
  zValidator("param", z.object({ classroomId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { classroomId } = c.req.valid("param");
    const access = await canAccess(classroomId, sub);
    if (!access.ok) return c.json({ error: "forbidden" }, 403);

    const result = await WhiteboardEntity.get({ classroomId }).go();
    if (!result.data) {
      return c.json({ classroomId, strokes: [], version: 0 });
    }
    return c.json({
      classroomId,
      strokes: result.data.strokes ?? [],
      version: result.data.version ?? 0,
    });
  },
);

whiteboardRoutes.post(
  "/classroom/:classroomId/strokes",
  zValidator("param", z.object({ classroomId: z.string().min(1) })),
  zValidator("json", strokeSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { classroomId } = c.req.valid("param");
    const body = c.req.valid("json");

    const access = await canAccess(classroomId, sub);
    if (!access.ok) return c.json({ error: "forbidden" }, 403);

    const newStroke: Stroke = {
      points: body.points,
      color: body.color,
      width: body.width,
      authorId: sub,
      at: new Date().toISOString(),
    };

    // Concurrency-safe path: atomic DDB list_append + ADD on version (ElectroDB
    // `.upsert().append().add()`), so two clients posting at the same moment
    // don't clobber each other's stroke. Works whether or not the item exists.
    // The MAX_STROKES trim can't be expressed atomically, so when the list
    // has grown past the cap we fall back to a read-modify-write that slices
    // oldest strokes. This is eventually-consistent at the cap boundary (a
    // concurrent writer during the trim can still drop a stroke), which is
    // acceptable for MVP — trimming only fires when a board already has 50+
    // strokes, not on every write.
    const existing = await WhiteboardEntity.get({ classroomId }).go();
    const currentCount = (existing.data?.strokes ?? []).length;

    if (currentCount >= MAX_STROKES) {
      const current: Stroke[] = (existing.data?.strokes ?? []) as Stroke[];
      const next = [...current, newStroke].slice(-MAX_STROKES);
      const version = (existing.data?.version ?? 0) + 1;
      await WhiteboardEntity.patch({ classroomId }).set({ strokes: next, version }).go();
      return c.json({ version, stroke: newStroke }, 201);
    }

    const result = await WhiteboardEntity.upsert({ classroomId })
      .append({ strokes: [newStroke] })
      .add({ version: 1 })
      .go({ response: "all_new" });
    const version = (result.data as { version?: number }).version ?? (existing.data?.version ?? 0) + 1;
    return c.json({ version, stroke: newStroke }, 201);
  },
);

whiteboardRoutes.delete(
  "/classroom/:classroomId",
  zValidator("param", z.object({ classroomId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { classroomId } = c.req.valid("param");
    const access = await canAccess(classroomId, sub);
    if (!access.ok) return c.json({ error: "forbidden" }, 403);
    // Only the classroom teacher can clear. Members drawing on the whiteboard
    // is fine; wholesale clear is a teacher-only destructive action.
    if (!access.teacher) return c.json({ error: "only_teachers" }, 403);

    const existing = await WhiteboardEntity.get({ classroomId }).go();
    const version = (existing.data?.version ?? 0) + 1;
    if (!existing.data) {
      await WhiteboardEntity.create({ classroomId, strokes: [], version }).go();
    } else {
      await WhiteboardEntity.patch({ classroomId }).set({ strokes: [], version }).go();
    }
    return c.json({ ok: true, version });
  },
);
