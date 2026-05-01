import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  FavoriteEntity,
  FAVORITE_KINDS,
  UserEntity,
  TeacherProfileEntity,
  OrganizationEntity,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";

export const favoriteRoutes = new Hono();

favoriteRoutes.use("*", requireAuth);

const createSchema = z.object({
  favoriteId: z.string().min(1),
  kind: z.enum(FAVORITE_KINDS),
});

// Bookmark a teacher or an organization. We verify the target exists so
// bookmarks don't accumulate against deleted/non-existent records. Self-
// bookmarking a teacher who is also you is harmless but rejected for clarity.
favoriteRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const { sub } = c.get("auth");
  const { favoriteId, kind } = c.req.valid("json");
  if (favoriteId === sub) return c.json({ error: "cannot_favorite_self" }, 400);

  if (kind === "teacher") {
    const profile = await TeacherProfileEntity.get({ userId: favoriteId }).go();
    if (!profile.data) return c.json({ error: "teacher_not_found" }, 404);
  } else {
    const org = await OrganizationEntity.get({ orgId: favoriteId }).go();
    if (!org.data) return c.json({ error: "org_not_found" }, 404);
  }

  const existing = await FavoriteEntity.get({ userId: sub, favoriteId }).go();
  if (existing.data) return c.json(existing.data);

  const row = await FavoriteEntity.create({
    userId: sub,
    favoriteId,
    kind,
  }).go();
  return c.json(row.data, 201);
});

favoriteRoutes.delete(
  "/:favoriteId",
  zValidator("param", z.object({ favoriteId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { favoriteId } = c.req.valid("param");
    await FavoriteEntity.delete({ userId: sub, favoriteId }).go();
    return c.json({ ok: true });
  },
);

// List all my favorites. Hydrates the target: teachers come with display
// fields from TeacherProfileEntity + UserEntity; orgs come with their name.
// Missing/deleted targets surface as null so the UI can skip them.
favoriteRoutes.get("/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await FavoriteEntity.query
    .primary({ userId: sub })
    .go({ limit: 250, order: "desc" });
  const hydrated = await Promise.all(
    result.data.map(async (f) => {
      try {
        if (f.kind === "teacher") {
          const [user, profile] = await Promise.all([
            UserEntity.get({ userId: f.favoriteId }).go(),
            TeacherProfileEntity.get({ userId: f.favoriteId }).go(),
          ]);
          return {
            ...f,
            target: user.data
              ? {
                  id: user.data.userId,
                  displayName: user.data.displayName,
                  bio: profile.data?.bio,
                  subjects: profile.data?.subjects ?? [],
                  ratingAvg: profile.data?.ratingAvg ?? 0,
                  ratingCount: profile.data?.ratingCount ?? 0,
                  hourlyRateCents: profile.data?.hourlyRateCents ?? 0,
                  currency: profile.data?.currency ?? "TND",
                }
              : null,
          };
        }
        const org = await OrganizationEntity.get({ orgId: f.favoriteId }).go();
        return {
          ...f,
          target: org.data
            ? { id: org.data.orgId, displayName: org.data.name, kind: org.data.kind }
            : null,
        };
      } catch (err) {
        console.warn("favorites.mine: hydrate failed", err);
        return { ...f, target: null };
      }
    }),
  );
  return c.json({ items: hydrated });
});

favoriteRoutes.get(
  "/check/:favoriteId",
  zValidator("param", z.object({ favoriteId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { favoriteId } = c.req.valid("param");
    const row = await FavoriteEntity.get({ userId: sub, favoriteId }).go();
    return c.json({ favorited: !!row.data });
  },
);
