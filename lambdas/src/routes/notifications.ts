import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { NotificationEntity } from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";

export const notificationRoutes = new Hono();

notificationRoutes.use("*", requireAuth);

notificationRoutes.get("/", async (c) => {
  const { sub } = c.get("auth");
  const result = await NotificationEntity.query
    .primary({ userId: sub })
    .go({ limit: 50, order: "desc" });
  return c.json({ items: result.data });
});

notificationRoutes.get("/unread-count", async (c) => {
  const { sub } = c.get("auth");
  // MVP limit: we cap at 100 unread. Users with >100 unread will see "99+" in the UI
  // anyway, so a single page is sufficient. Revisit with a dedicated counter if
  // the product needs an exact count beyond the cap.
  const result = await NotificationEntity.query
    .primary({ userId: sub })
    .where(({ readAt }, { notExists }) => notExists(readAt))
    .go({ limit: 100 });
  return c.json({ count: result.data.length });
});

notificationRoutes.post(
  "/:notificationId/read",
  zValidator("param", z.object({ notificationId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { notificationId } = c.req.valid("param");
    const result = await NotificationEntity.patch({ userId: sub, notificationId })
      .set({ readAt: new Date().toISOString() })
      .go({ response: "all_new" });
    return c.json(result.data);
  },
);

notificationRoutes.post("/read-all", async (c) => {
  const { sub } = c.get("auth");
  const now = new Date().toISOString();
  const all = await NotificationEntity.query
    .primary({ userId: sub })
    .where(({ readAt }, { notExists }) => notExists(readAt))
    .go({ limit: 200 });
  for (const n of all.data) {
    await NotificationEntity.patch({ userId: sub, notificationId: n.notificationId })
      .set({ readAt: now })
      .go();
  }
  return c.json({ marked: all.data.length });
});
