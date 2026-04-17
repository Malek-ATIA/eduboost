"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { currentSession } from "@/lib/cognito";

type Post = {
  postId: string;
  channelId: string;
  authorId: string;
  authorName?: string;
  title: string;
  body: string;
  score: number;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  createdAt: string;
};

type Comment = {
  postId: string;
  commentId: string;
  authorId: string;
  authorName?: string;
  body: string;
  score: number;
  upvotes: number;
  downvotes: number;
  createdAt: string;
};

type Hydrated = { post: Post; comments: Comment[] };

type VoteState = { targetId: string; direction: "up" | "down" };

export default function ForumPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const [data, setData] = useState<Hydrated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [viewerSub, setViewerSub] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, "up" | "down" | undefined>>({});

  const load = useCallback(async () => {
    try {
      const r = await api<Hydrated>(`/forum/posts/${postId}/hydrated`);
      setData(r);
      const session = await currentSession();
      if (session) {
        const sub = (session.getIdToken().payload.sub as string) ?? null;
        setViewerSub(sub);
        const ids = [r.post.postId, ...r.comments.map((c) => c.commentId)].join(",");
        try {
          const v = await api<{ items: VoteState[] }>(
            `/forum/my-votes?ids=${encodeURIComponent(ids)}`,
          );
          const map: Record<string, "up" | "down" | undefined> = {};
          for (const item of v.items) map[item.targetId] = item.direction;
          setVotes(map);
        } catch {
          /* ignore vote hydration failures */
        }
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  async function votePost(direction: "up" | "down") {
    if (!viewerSub) {
      window.location.assign(`/login`);
      return;
    }
    try {
      const out = await api<{ up: number; down: number }>(`/forum/posts/${postId}/vote`, {
        method: "POST",
        body: JSON.stringify({ direction }),
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              post: {
                ...prev.post,
                upvotes: out.up,
                downvotes: out.down,
                score: out.up - out.down,
              },
            }
          : prev,
      );
      setVotes((prev) => ({
        ...prev,
        [postId]: prev[postId] === direction ? undefined : direction,
      }));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function voteComment(commentId: string, direction: "up" | "down") {
    if (!viewerSub) {
      window.location.assign(`/login`);
      return;
    }
    try {
      const out = await api<{ up: number; down: number }>(
        `/forum/comments/${commentId}/vote?postId=${encodeURIComponent(postId)}`,
        {
          method: "POST",
          body: JSON.stringify({ direction }),
        },
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              comments: prev.comments.map((c) =>
                c.commentId === commentId
                  ? { ...c, upvotes: out.up, downvotes: out.down, score: out.up - out.down }
                  : c,
              ),
            }
          : prev,
      );
      setVotes((prev) => ({
        ...prev,
        [commentId]: prev[commentId] === direction ? undefined : direction,
      }));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    if (!viewerSub) {
      window.location.assign(`/login`);
      return;
    }
    setSubmitting(true);
    try {
      await api(`/forum/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: draft.trim() }),
      });
      setDraft("");
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-seal">{error}</main>;
  if (!data) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <Link href={`/forum/${data.post.channelId}` as never} className="btn-ghost -ml-3">
        ← Channel
      </Link>

      <article className="card mt-4 flex gap-4 p-4">
        <VoteCol
          score={data.post.score}
          myVote={votes[data.post.postId]}
          onVote={votePost}
        />
        <div className="flex-1">
          <h1 className="font-display text-2xl text-ink">{data.post.title}</h1>
          <div className="mt-1 text-xs text-ink-faded">
            {data.post.authorName} · {new Date(data.post.createdAt).toLocaleString()}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{data.post.body}</p>
        </div>
      </article>

      <section className="mt-8">
        <h2 className="eyebrow">Comments ({data.comments.length})</h2>

        <form onSubmit={addComment} className="mt-3 space-y-2">
          <textarea
            rows={3}
            maxLength={4000}
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment..."
          />
          <button
            type="submit"
            disabled={submitting || !draft.trim()}
            className="btn-seal"
          >
            {submitting ? "Posting..." : "Post"}
          </button>
        </form>

        <ul className="mt-6 space-y-3">
          {data.comments.map((cm) => (
            <li key={cm.commentId} className="card flex gap-3 p-3">
              <VoteCol
                score={cm.score}
                myVote={votes[cm.commentId]}
                onVote={(d) => voteComment(cm.commentId, d)}
              />
              <div className="flex-1">
                <div className="text-xs text-ink-faded">
                  {cm.authorName} · {new Date(cm.createdAt).toLocaleString()}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{cm.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function VoteCol({
  score,
  myVote,
  onVote,
}: {
  score: number;
  myVote: "up" | "down" | undefined;
  onVote: (direction: "up" | "down") => void;
}) {
  return (
    <div className="flex min-w-[2.5rem] flex-col items-center text-sm">
      <button
        onClick={() => onVote("up")}
        className={`text-lg ${myVote === "up" ? "text-ink" : "text-ink-faded hover:text-ink"}`}
        aria-label="Upvote"
      >
        ▲
      </button>
      <span className="font-display text-base text-ink">{score}</span>
      <button
        onClick={() => onVote("down")}
        className={`text-lg ${myVote === "down" ? "text-seal" : "text-ink-faded hover:text-ink"}`}
        aria-label="Downvote"
      >
        ▼
      </button>
    </div>
  );
}
