import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { SessionEntity, ClassroomMembershipEntity } from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";

export const sessionRoutes = new Hono();

sessionRoutes.use("*", requireAuth);

sessionRoutes.get(
  "/:sessionId",
  zValidator("param", z.object({ sessionId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { sessionId } = c.req.valid("param");

    const session = await SessionEntity.get({ sessionId }).go();
    if (!session.data) return c.json({ error: "not_found" }, 404);

    if (session.data.teacherId !== sub) {
      const member = await ClassroomMembershipEntity.get({
        classroomId: session.data.classroomId,
        userId: sub,
      }).go();
      if (!member.data) return c.json({ error: "forbidden" }, 403);
    }

    return c.json(session.data);
  },
);
