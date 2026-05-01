import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  ForumPostEntity,
  ForumCommentEntity,
  ForumVoteEntity,
  ForumReactionEntity,
  FORUM_VOTE_DIRECTIONS,
  FORUM_REACTIONS,
  UserEntity,
  makePostId,
  makeCommentId,
  type ForumVoteDirection,
  type ForumReaction,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { FORUM_CHANNELS, getChannel } from "../lib/forum-channels.js";

export const forumRoutes = new Hono();

// Public: channels list.
forumRoutes.get("/channels", (c) => {
  return c.json({ items: FORUM_CHANNELS });
});

// Public: posts in a channel.
const listPostsQuery = z.object({
  sort: z.enum(["new", "top"]).default("new"),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

forumRoutes.get(
  "/channels/:channelId/posts",
  zValidator("param", z.object({ channelId: z.string().min(1) })),
  zValidator("query", listPostsQuery),
  async (c) => {
    const { channelId } = c.req.valid("param");
    const { sort, limit } = c.req.valid("query");
    if (!getChannel(channelId)) return c.json({ error: "unknown_channel" }, 404);

    const result = await ForumPostEntity.query
      .byChannel({ channelId })
      .go({ limit: sort === "top" ? 500 : limit, order: "desc" });
    let items = result.data;
    if (sort === "top") {
      items = items
        .slice()
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, limit);
    }
    return c.json({ items });
  },
);

// Public: single post + comments.
forumRoutes.get(
  "/posts/:postId",
  zValidator("param", z.object({ postId: z.string().min(1) })),
  async (c) => {
    const { postId } = c.req.valid("param");
    const post = await ForumPostEntity.get({ postId }).go();
    if (!post.data) return c.json({ error: "not_found" }, 404);
    const comments = await ForumCommentEntity.query.primary({ postId }).go({ limit: 200 });
    return c.json({ post: post.data, comments: comments.data });
  },
);

// Authenticated: create post.
forumRoutes.use("/posts", requireAuth);
forumRoutes.use("/posts/:postId/comments", requireAuth);
forumRoutes.use("/posts/:postId/vote", requireAuth);
forumRoutes.use("/posts/:postId/reactions", requireAuth);
forumRoutes.use("/posts/:postId/delete", requireAuth);
forumRoutes.use("/comments/:commentId/vote", requireAuth);
forumRoutes.use("/comments/:commentId/reactions", requireAuth);
forumRoutes.use("/comments/:commentId/delete", requireAuth);

const createPostSchema = z.object({
  channelId: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(10_000),
});

forumRoutes.post("/posts", zValidator("json", createPostSchema), async (c) => {
  const { sub } = c.get("auth");
  const { channelId, title, body } = c.req.valid("json");
  if (!getChannel(channelId)) return c.json({ error: "unknown_channel" }, 400);

  const postId = makePostId();
  const result = await ForumPostEntity.create({
    postId,
    channelId,
    authorId: sub,
    title,
    body,
  }).go();
  return c.json(result.data, 201);
});

// Authenticated: add comment.
const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

forumRoutes.post(
  "/posts/:postId/comments",
  zValidator("param", z.object({ postId: z.string().min(1) })),
  zValidator("json", createCommentSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { postId } = c.req.valid("param");
    const { body } = c.req.valid("json");
    const post = await ForumPostEntity.get({ postId }).go();
    if (!post.data) return c.json({ error: "post_not_found" }, 404);

    const commentId = makeCommentId();
    const comment = await ForumCommentEntity.create({
      postId,
      commentId,
      authorId: sub,
      body,
    }).go();

    // Increment cached count on the post (best-effort).
    try {
      await ForumPostEntity.patch({ postId })
        .add({ commentCount: 1 })
        .go();
    } catch (err) {
      console.error("forum.comments: commentCount patch failed (non-fatal)", err);
    }

    return c.json(comment.data, 201);
  },
);

// Authenticated: vote. Handles toggle/switch to maintain one-vote-per-user-per-target.
const voteSchema = z.object({
  direction: z.enum(FORUM_VOTE_DIRECTIONS),
});

async function castVote(
  targetId: string,
  targetType: "post" | "comment",
  userId: string,
  direction: ForumVoteDirection,
  postIdForComment?: string,
): Promise<{ delta: number; up: number; down: number }> {
  const existing = await ForumVoteEntity.get({ targetId, userId }).go();

  let upDelta = 0;
  let downDelta = 0;

  if (!existing.data) {
    // New vote. Guard against concurrent double-submit: create() uses an
    // attribute_not_exists condition and will throw if another request beat
    // us to it. On conflict, re-read the vote row and route through the
    // retract/switch branches so the user sees a sensible final state.
    try {
      await ForumVoteEntity.create({ targetId, userId, targetType, direction }).go();
      if (direction === "up") upDelta = 1;
      else downDelta = 1;
    } catch (err) {
      const recheck = await ForumVoteEntity.get({ targetId, userId }).go();
      if (!recheck.data) {
        // Not a duplicate-key race — genuine failure.
        throw err;
      }
      if (recheck.data.direction === direction) {
        // Another request already recorded the same vote — idempotent no-op,
        // no delta to apply.
        upDelta = 0;
        downDelta = 0;
      } else {
        // Another request recorded the opposite vote; treat this call as a
        // switch to the requested direction.
        await ForumVoteEntity.patch({ targetId, userId }).set({ direction }).go();
        if (direction === "up") {
          upDelta = 1;
          downDelta = -1;
        } else {
          upDelta = -1;
          downDelta = 1;
        }
      }
    }
  } else if (existing.data.direction === direction) {
    // Clicking same direction retracts the vote.
    await ForumVoteEntity.delete({ targetId, userId }).go();
    if (direction === "up") upDelta = -1;
    else downDelta = -1;
  } else {
    // Switching direction.
    await ForumVoteEntity.patch({ targetId, userId }).set({ direction }).go();
    if (direction === "up") {
      upDelta = 1;
      downDelta = -1;
    } else {
      upDelta = -1;
      downDelta = 1;
    }
  }

  // Apply the delta to the target's cached counts + score.
  if (targetType === "post") {
    const result = await ForumPostEntity.patch({ postId: targetId })
      .add({ upvotes: upDelta, downvotes: downDelta, score: upDelta - downDelta })
      .go({ response: "all_new" });
    return {
      delta: upDelta - downDelta,
      up: result.data?.upvotes ?? 0,
      down: result.data?.downvotes ?? 0,
    };
  } else {
    if (!postIdForComment) return { delta: 0, up: 0, down: 0 };
    const result = await ForumCommentEntity.patch({ postId: postIdForComment, commentId: targetId })
      .add({ upvotes: upDelta, downvotes: downDelta, score: upDelta - downDelta })
      .go({ response: "all_new" });
    return {
      delta: upDelta - downDelta,
      up: result.data?.upvotes ?? 0,
      down: result.data?.downvotes ?? 0,
    };
  }
}

forumRoutes.post(
  "/posts/:postId/vote",
  zValidator("param", z.object({ postId: z.string().min(1) })),
  zValidator("json", voteSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { postId } = c.req.valid("param");
    const { direction } = c.req.valid("json");
    const post = await ForumPostEntity.get({ postId }).go();
    if (!post.data) return c.json({ error: "post_not_found" }, 404);
    const out = await castVote(postId, "post", sub, direction);
    return c.json(out);
  },
);

const commentVoteParamSchema = z.object({ commentId: z.string().min(1) });
const commentVoteQuerySchema = z.object({ postId: z.string().min(1) });

forumRoutes.post(
  "/comments/:commentId/vote",
  zValidator("param", commentVoteParamSchema),
  zValidator("query", commentVoteQuerySchema),
  zValidator("json", voteSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { commentId } = c.req.valid("param");
    const { postId } = c.req.valid("query");
    const { direction } = c.req.valid("json");
    const comment = await ForumCommentEntity.get({ postId, commentId }).go();
    if (!comment.data) return c.json({ error: "comment_not_found" }, 404);
    const out = await castVote(commentId, "comment", sub, direction, postId);
    return c.json(out);
  },
);

// Authenticated: get own vote state for a set of target IDs (for hydrating UI).
forumRoutes.use("/my-votes", requireAuth);
forumRoutes.get(
  "/my-votes",
  zValidator("query", z.object({ ids: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { ids } = c.req.valid("query");
    const targetIds = ids.split(",").filter(Boolean).slice(0, 100);
    const results = await Promise.all(
      targetIds.map(async (tid) => {
        try {
          const v = await ForumVoteEntity.get({ targetId: tid, userId: sub }).go();
          return v.data ? { targetId: tid, direction: v.data.direction } : null;
        } catch {
          return null;
        }
      }),
    );
    return c.json({ items: results.filter(Boolean) });
  },
);

// Toggle a reaction on a post or comment. Idempotent: adding the same
// reaction twice removes it; adding a different one is additive (a user
// can leave multiple distinct reactions on the same target).
const reactionSchema = z.object({
  reaction: z.enum(FORUM_REACTIONS),
});

forumRoutes.post(
  "/posts/:postId/reactions",
  zValidator("param", z.object({ postId: z.string().min(1) })),
  zValidator("json", reactionSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { postId } = c.req.valid("param");
    const { reaction } = c.req.valid("json");
    const post = await ForumPostEntity.get({ postId }).go();
    if (!post.data) return c.json({ error: "post_not_found" }, 404);
    return c.json(await toggleReaction(postId, "post", sub, reaction));
  },
);

forumRoutes.post(
  "/comments/:commentId/reactions",
  zValidator("param", z.object({ commentId: z.string().min(1) })),
  zValidator("query", z.object({ postId: z.string().min(1) })),
  zValidator("json", reactionSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { commentId } = c.req.valid("param");
    const { reaction } = c.req.valid("json");
    return c.json(await toggleReaction(commentId, "comment", sub, reaction));
  },
);

async function toggleReaction(
  targetId: string,
  targetType: "post" | "comment",
  userId: string,
  reaction: ForumReaction,
): Promise<{ added: boolean; counts: Record<string, number> }> {
  const existing = await ForumReactionEntity.query
    .primary({ targetId })
    .go({ limit: 500 });
  const mine = existing.data.find(
    (r) => r.userId === userId && r.reaction === reaction,
  );
  if (mine) {
    await ForumReactionEntity.delete({
      targetId,
      userId,
      reaction,
    }).go();
  } else {
    try {
      await ForumReactionEntity.create({
        targetId,
        userId,
        targetType,
        reaction,
      }).go();
    } catch {
      // duplicate — ignore
    }
  }
  const updated = await ForumReactionEntity.query
    .primary({ targetId })
    .go({ limit: 500 });
  const counts: Record<string, number> = {};
  for (const r of updated.data) {
    counts[r.reaction] = (counts[r.reaction] ?? 0) + 1;
  }
  return { added: !mine, counts };
}

// Bulk-fetch reactions for a set of target IDs.
forumRoutes.use("/reactions", requireAuth);
forumRoutes.get(
  "/reactions",
  zValidator("query", z.object({ ids: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { ids } = c.req.valid("query");
    const targetIds = ids.split(",").filter(Boolean).slice(0, 100);
    const allReactions: Record<
      string,
      { counts: Record<string, number>; mine: string[] }
    > = {};
    await Promise.all(
      targetIds.map(async (tid) => {
        try {
          const res = await ForumReactionEntity.query
            .primary({ targetId: tid })
            .go({ limit: 500 });
          const counts: Record<string, number> = {};
          const mine: string[] = [];
          for (const r of res.data) {
            counts[r.reaction] = (counts[r.reaction] ?? 0) + 1;
            if (r.userId === sub) mine.push(r.reaction);
          }
          allReactions[tid] = { counts, mine };
        } catch {
          // ignore
        }
      }),
    );
    return c.json(allReactions);
  },
);

// Delete own post.
forumRoutes.post(
  "/posts/:postId/delete",
  zValidator("param", z.object({ postId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { postId } = c.req.valid("param");
    const post = await ForumPostEntity.get({ postId }).go();
    if (!post.data) return c.json({ error: "not_found" }, 404);
    if (post.data.authorId !== sub) return c.json({ error: "forbidden" }, 403);
    const comments = await ForumCommentEntity.query.primary({ postId }).go({ limit: 500 });
    await Promise.all(
      comments.data.map((cm) => ForumCommentEntity.delete({ postId, commentId: cm.commentId }).go()),
    );
    await ForumPostEntity.delete({ postId }).go();
    return c.json({ ok: true });
  },
);

// Delete own comment.
forumRoutes.post(
  "/comments/:commentId/delete",
  zValidator("param", z.object({ commentId: z.string().min(1) })),
  zValidator("query", z.object({ postId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { commentId } = c.req.valid("param");
    const { postId } = c.req.valid("query");
    const comment = await ForumCommentEntity.get({ postId, commentId }).go();
    if (!comment.data) return c.json({ error: "not_found" }, 404);
    if (comment.data.authorId !== sub) return c.json({ error: "forbidden" }, 403);
    await ForumCommentEntity.delete({ postId, commentId }).go();
    try {
      await ForumPostEntity.patch({ postId }).add({ commentCount: -1 }).go();
    } catch { /* non-fatal */ }
    return c.json({ ok: true });
  },
);

// Attach author display names to posts list (hydration helper).
forumRoutes.get(
  "/posts/:postId/hydrated",
  zValidator("param", z.object({ postId: z.string().min(1) })),
  async (c) => {
    const { postId } = c.req.valid("param");
    const post = await ForumPostEntity.get({ postId }).go();
    if (!post.data) return c.json({ error: "not_found" }, 404);
    const [author, comments] = await Promise.all([
      UserEntity.get({ userId: post.data.authorId }).go(),
      ForumCommentEntity.query.primary({ postId }).go({ limit: 200 }),
    ]);
    const commenterIds = Array.from(new Set(comments.data.map((c) => c.authorId)));
    const commenterMap = new Map<string, string>();
    await Promise.all(
      commenterIds.map(async (uid) => {
        try {
          const u = await UserEntity.get({ userId: uid }).go();
          if (u.data) commenterMap.set(uid, u.data.displayName);
        } catch {
          // ignore
        }
      }),
    );
    return c.json({
      post: {
        ...post.data,
        authorName: author.data?.displayName ?? "Unknown",
      },
      comments: comments.data.map((cm) => ({
        ...cm,
        authorName: commenterMap.get(cm.authorId) ?? "Unknown",
      })),
    });
  },
);
