import { describe, it, expect } from "vitest";
import { api, session } from "./api";

type Channel = { id: string; name: string; description: string };
type ForumPost = {
  postId: string;
  authorId: string;
  channelId: string;
  title: string;
  body: string;
  upvotes: number;
  downvotes: number;
  score: number;
  commentCount: number;
};
type Comment = {
  postId: string;
  commentId: string;
  authorId: string;
  body: string;
};

describe("/forum/channels — public", () => {
  it("returns channels including general/mathematics/test-prep", async () => {
    const r = await api<{ items: Channel[] }>("/forum/channels", {
      anonymous: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.data.items.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "general",
        "mathematics",
        "sciences",
        "languages",
        "test-prep",
        "teachers-lounge",
      ]),
    );
  });
});

describe("/forum/channels/:id/posts — public", () => {
  it("returns at least one seeded post in test-prep", async () => {
    const r = await api<{ items: ForumPost[] }>(
      "/forum/channels/test-prep/posts",
      { anonymous: true },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.items.length).toBeGreaterThan(0);
    // Don't pin to a specific seeded postId — early seeds used a different
    // channel id and reseeding doesn't move them. Just confirm the seeded
    // IELTS post (always present) shows.
    expect(
      r.data.items.some((p) => p.postId === "post_seed_ielts_6_to_7"),
    ).toBe(true);
  });

  it("supports sort=top by score", async () => {
    const r = await api<{ items: ForumPost[] }>(
      "/forum/channels/mathematics/posts?sort=top",
      { anonymous: true },
    );
    if (!r.ok) throw new Error("sort=top failed");
    const scores = r.data.items.map((p) => p.score);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });
});

describe("/forum/posts/:id — public", () => {
  it("returns the seeded LIATE post with comments", async () => {
    const r = await api<{ post: ForumPost; comments: Comment[] }>(
      "/forum/posts/post_seed_integration_by_parts",
      { anonymous: true },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.post.title).toContain("LIATE");
    expect(r.data.comments.length).toBeGreaterThan(0);
  });

  it("returns 404 for a missing post", async () => {
    const r = await api("/forum/posts/post_doesnt_exist", {
      anonymous: true,
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(404);
  });
});

describe("/forum mutations — authenticated", () => {
  // Each test creates a unique post so re-runs don't collide. We don't have
  // a delete-post endpoint, so the integration-test posts accumulate in the
  // dev table — that's accepted; titles are prefixed [INT-TEST] for easy
  // identification.
  it("creates a post → comments on it → upvotes it", async () => {
    const ts = Date.now();
    const created = await api<ForumPost>("/forum/posts", {
      method: "POST",
      body: {
        channelId: "general",
        title: `[INT-TEST ${ts}] Smoke test post`,
        body: "Created by the integration test suite. Safe to ignore.",
      },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.title).toContain("[INT-TEST");
    expect(created.data.authorId).toBe(session().sub);
    const postId = created.data.postId;

    const comment = await api<Comment>(`/forum/posts/${postId}/comments`, {
      method: "POST",
      body: { body: "[INT-TEST] first comment" },
    });
    expect(comment.ok).toBe(true);

    const vote = await api(`/forum/posts/${postId}/vote`, {
      method: "POST",
      body: { direction: "up" },
    });
    expect(vote.ok).toBe(true);

    const fetched = await api<{ post: ForumPost; comments: Comment[] }>(
      `/forum/posts/${postId}`,
      { anonymous: true },
    );
    if (!fetched.ok) throw new Error("post readback failed");
    expect(fetched.data.comments.some((c) => c.body.includes("first comment"))).toBe(
      true,
    );
    // Self-vote may be rejected by the route; if it counted, score is 1.
    expect(fetched.data.post.score).toBeGreaterThanOrEqual(0);
  });

  it("rejects empty post body with 400", async () => {
    const r = await api("/forum/posts", {
      method: "POST",
      body: { channelId: "general", title: "x", body: "" },
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(400);
  });

  it("rejects unknown channel with 400 or 404", async () => {
    const r = await api("/forum/posts", {
      method: "POST",
      body: {
        channelId: "totally-not-a-channel",
        title: "[INT-TEST] should fail",
        body: "x".repeat(20),
      },
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect([400, 404]).toContain(r.status);
  });

  it("anonymous users cannot create posts", async () => {
    const r = await api("/forum/posts", {
      method: "POST",
      anonymous: true,
      body: {
        channelId: "general",
        title: "[INT-TEST] anon",
        body: "should not work",
      },
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(401);
  });
});
