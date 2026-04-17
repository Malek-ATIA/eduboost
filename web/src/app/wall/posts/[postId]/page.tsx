"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { currentSession } from "@/lib/cognito";

type WallPost = {
  postId: string;
  teacherId: string;
  authorName?: string;
  body: string;
  commentCount: number;
  createdAt: string;
};

type WallComment = {
  postId: string;
  commentId: string;
  authorId: string;
  authorName?: string;
  body: string;
  createdAt: string;
};

type Hydrated = { post: WallPost; comments: WallComment[] };

export default function WallPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const [data, setData] = useState<Hydrated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [viewerSub, setViewerSub] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<Hydrated>(`/wall/posts/${postId}`);
      setData(r);
      const session = await currentSession();
      if (session) setViewerSub((session.getIdToken().payload.sub as string) ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    if (!viewerSub) {
      window.location.assign(`/login`);
      return;
    }
    setSubmitting(true);
    try {
      await api(`/wall/posts/${postId}/comments`, {
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

  async function deleteComment(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    try {
      await api(`/wall/posts/${postId}/comments/${commentId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function deletePost() {
    if (!confirm("Delete this post? Comments will remain orphaned.")) return;
    try {
      await api(`/wall/posts/${postId}`, { method: "DELETE" });
      if (data?.post.teacherId) window.location.assign(`/teachers/${data.post.teacherId}`);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  if (error) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-seal">{error}</main>;
  if (!data) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  const isOwner = viewerSub !== null && viewerSub === data.post.teacherId;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <Link href={`/teachers/${data.post.teacherId}` as never} className="btn-ghost -ml-3">
        ← {data.post.authorName ?? "Teacher"}
      </Link>

      <article className="card mt-4 p-4">
        <div className="flex items-center justify-between text-xs text-ink-faded">
          <span>{data.post.authorName} · {new Date(data.post.createdAt).toLocaleString()}</span>
          {isOwner && (
            <button onClick={deletePost} className="btn-ghost text-seal">
              Delete
            </button>
          )}
        </div>
        <p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink">{data.post.body}</p>
      </article>

      <section className="mt-8">
        <h2 className="eyebrow">Comments ({data.comments.length})</h2>

        <form onSubmit={addComment} className="mt-3 space-y-2">
          <textarea
            rows={3}
            maxLength={2000}
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a comment..."
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
          {data.comments.map((cm) => {
            const canDelete = viewerSub !== null && (viewerSub === cm.authorId || isOwner);
            return (
              <li key={cm.commentId} className="card p-3">
                <div className="flex items-center justify-between text-xs text-ink-faded">
                  <span>{cm.authorName} · {new Date(cm.createdAt).toLocaleString()}</span>
                  {canDelete && (
                    <button
                      onClick={() => deleteComment(cm.commentId)}
                      className="btn-ghost text-seal"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{cm.body}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
