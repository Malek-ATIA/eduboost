import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  WallPostEntity,
  WallCommentEntity,
  UserEntity,
  makeWallPostId,
  makeWallCommentId,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";

export const wallRoutes = new Hono();

// Public: list posts on a teacher's wall.
wallRoutes.get(
  "/:teacherId",
  zValidator("param", z.object({ teacherId: z.string().min(1) })),
  zValidator("query", z.object({ limit: z.coerce.number().int().min(1).max(50).default(25) })),
  async (c) => {
    const { teacherId } = c.req.valid("param");
    const { limit } = c.req.valid("query");
    const result = await WallPostEntity.query
      .byTeacher({ teacherId })
      .go({ limit, order: "desc" });
    return c.json({ items: result.data });
  },
);

// Public: single wall post with comments + hydrated author names.
wallRoutes.get(
  "/posts/:postId",
  zValidator("param", z.object({ postId: z.string().min(1) })),
  async (c) => {
    const { postId } = c.req.valid("param");
    const post = await WallPostEntity.get({ postId }).go();
    if (!post.data) return c.json({ error: "not_found" }, 404);
    const comments = await WallCommentEntity.query.primary({ postId }).go({ limit: 200 });

    const teacher = await UserEntity.get({ userId: post.data.teacherId }).go();
    const commenterIds = Array.from(new Set(comments.data.map((cm) => cm.authorId)));
    const commenterMap = new Map<string, string>();
    await Promise.all(
      commenterIds.map(async (uid) => {
        try {
          const u = await UserEntity.get({ userId: uid }).go();
          if (u.data) commenterMap.set(uid, u.data.displayName);
        } catch {
          /* ignore */
        }
      }),
    );

    return c.json({
      post: {
        ...post.data,
        authorName: teacher.data?.displayName ?? "Unknown",
      },
      comments: comments.data.map((cm) => ({
        ...cm,
        authorName: commenterMap.get(cm.authorId) ?? "Unknown",
      })),
    });
  },
);

// Authenticated: teacher creates post on their own wall.
// Uses `/posts` (exact, for create) and `/posts/*` (wildcard, for all
// nested write routes including /:postId, /:postId/comments, and
// /:postId/comments/:commentId DELETE). The wildcard is required because
// Hono's parametric `.use()` paths match exact segment count — an
// auth-only `use("/posts/:postId/comments", ...)` would NOT cover the
// 4-segment DELETE comment path, creating an auth bypass.
wallRoutes.use("/posts", requireAuth);
wallRoutes.use("/posts/*", requireAuth);

const createPostSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

wallRoutes.post("/posts", zValidator("json", createPostSchema), async (c) => {
  const { sub } = c.get("auth");
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);
  if (user.data.role !== "teacher") return c.json({ error: "only_teachers" }, 403);

  const postId = makeWallPostId();
  const result = await WallPostEntity.create({
    postId,
    teacherId: sub,
    body: c.req.valid("json").body,
  }).go();
  return c.json(result.data, 201);
});

wallRoutes.delete(
  "/posts/:postId",
  zValidator("param", z.object({ postId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { postId } = c.req.valid("param");
    const post = await WallPostEntity.get({ postId }).go();
    if (!post.data) return c.json({ error: "not_found" }, 404);
    if (post.data.teacherId !== sub) return c.json({ error: "forbidden" }, 403);
    const comments = await WallCommentEntity.query.primary({ postId }).go({ limit: 500 });
    await Promise.all(
      comments.data.map((cm) => WallCommentEntity.delete({ postId, commentId: cm.commentId }).go()),
    );
    await WallPostEntity.delete({ postId }).go();
    return c.json({ ok: true });
  },
);

const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

wallRoutes.post(
  "/posts/:postId/comments",
  zValidator("param", z.object({ postId: z.string().min(1) })),
  zValidator("json", createCommentSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { postId } = c.req.valid("param");
    const { body } = c.req.valid("json");
    const post = await WallPostEntity.get({ postId }).go();
    if (!post.data) return c.json({ error: "post_not_found" }, 404);

    const commentId = makeWallCommentId();
    const comment = await WallCommentEntity.create({
      postId,
      commentId,
      authorId: sub,
      body,
    }).go();

    try {
      await WallPostEntity.patch({ postId }).add({ commentCount: 1 }).go();
    } catch (err) {
      console.error("wall.comments: commentCount patch failed (non-fatal)", err);
    }

    return c.json(comment.data, 201);
  },
);

wallRoutes.delete(
  "/posts/:postId/comments/:commentId",
  zValidator("param", z.object({ postId: z.string().min(1), commentId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { postId, commentId } = c.req.valid("param");

    const comment = await WallCommentEntity.get({ postId, commentId }).go();
    if (!comment.data) return c.json({ error: "not_found" }, 404);

    const post = await WallPostEntity.get({ postId }).go();
    if (!post.data) return c.json({ error: "post_not_found" }, 404);

    const isAuthor = comment.data.authorId === sub;
    const isWallOwner = post.data.teacherId === sub;
    if (!isAuthor && !isWallOwner) return c.json({ error: "forbidden" }, 403);

    await WallCommentEntity.delete({ postId, commentId }).go();
    try {
      await WallPostEntity.patch({ postId }).add({ commentCount: -1 }).go();
    } catch (err) {
      console.error("wall.comments.delete: commentCount patch failed (non-fatal)", err);
    }
    return c.json({ ok: true });
  },
);
