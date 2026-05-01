import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  SessionEntity,
  SessionNoteEntity,
  ClassroomMembershipEntity,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";

export const noteRoutes = new Hono();

noteRoutes.use("*", requireAuth);

// Personal session notes. Each caller can read/write only their own row for a
// given session; nobody (not even the teacher) can see another user's notes.
// Session participation is verified against ClassroomMembershipEntity so a
// stranger can't seed notes against a session they aren't in.

async function canParticipate(sessionId: string, sub: string): Promise<boolean> {
  const session = await SessionEntity.get({ sessionId }).go();
  if (!session.data) return false;
  if (session.data.teacherId === sub) return true;
  const member = await ClassroomMembershipEntity.get({
    classroomId: session.data.classroomId,
    userId: sub,
  }).go();
  return !!member.data;
}

noteRoutes.get(
  "/sessions/:sessionId",
  zValidator("param", z.object({ sessionId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { sessionId } = c.req.valid("param");
    if (!(await canParticipate(sessionId, sub))) {
      return c.json({ error: "forbidden" }, 403);
    }
    const row = await SessionNoteEntity.get({ sessionId, userId: sub }).go();
    return c.json(row.data ?? { sessionId, userId: sub, body: "" });
  },
);

noteRoutes.put(
  "/sessions/:sessionId",
  zValidator("param", z.object({ sessionId: z.string().min(1) })),
  zValidator("json", z.object({ body: z.string().max(20_000) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { sessionId } = c.req.valid("param");
    const { body } = c.req.valid("json");
    if (!(await canParticipate(sessionId, sub))) {
      return c.json({ error: "forbidden" }, 403);
    }
    const existing = await SessionNoteEntity.get({ sessionId, userId: sub }).go();
    if (!existing.data) {
      await SessionNoteEntity.create({ sessionId, userId: sub, body }).go();
    } else {
      await SessionNoteEntity.patch({ sessionId, userId: sub }).set({ body }).go();
    }
    return c.json({ ok: true });
  },
);

noteRoutes.delete(
  "/sessions/:sessionId",
  zValidator("param", z.object({ sessionId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { sessionId } = c.req.valid("param");
    await SessionNoteEntity.delete({ sessionId, userId: sub }).go();
    return c.json({ ok: true });
  },
);

// Lightweight cross-session index for the current user — used by a dedicated
// notes UI so learners can revisit prior sessions they took notes on.
noteRoutes.get("/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await SessionNoteEntity.query
    .byUser({ userId: sub })
    .go({ limit: 100, order: "desc" });
  return c.json({ items: result.data });
});
