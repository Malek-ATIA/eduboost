"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { currentSession } from "@/lib/cognito";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import {
  ThumbsUp,
  MessageCircle,
  Share2,
  Heart,
  Laugh,
  Lightbulb,
  PartyPopper,
  SmilePlus,
  ArrowLeft,
  Send,
  Trash2,
  MoreHorizontal,
  Link2,
} from "lucide-react";

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

const REACTION_META: Record<string, { label: string }> = {
  like: { label: "Like" },
  love: { label: "Love" },
  laugh: { label: "Haha" },
  insightful: { label: "Insightful" },
  celebrate: { label: "Celebrate" },
};

const REACTION_ICONS: Record<string, typeof ThumbsUp> = {
  like: ThumbsUp,
  love: Heart,
  laugh: Laugh,
  insightful: Lightbulb,
  celebrate: PartyPopper,
};

function ReactionIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = REACTION_ICONS[name];
  return Icon ? <Icon size={size} /> : null;
}

export default function ForumPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Hydrated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shared, setShared] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewerSub, setViewerSub] = useState<string | null>(null);
  const { toast } = useToast();
  const { confirm: showConfirm } = useDialog();
  const [reactions, setReactions] = useState<
    Record<string, { counts: Record<string, number>; mine: string[] }>
  >({});

  useEffect(() => {
    currentSession().then((s) => {
      if (s) setViewerSub((s.getIdToken().payload.sub as string) ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api<Hydrated>(`/forum/posts/${postId}/hydrated`);
      setData(r);
      const ids = [r.post.postId, ...r.comments.map((c) => c.commentId)].join(",");
      try {
        const rx = await api<
          Record<string, { counts: Record<string, number>; mine: string[] }>
        >(`/forum/reactions?ids=${encodeURIComponent(ids)}`);
        setReactions(rx);
      } catch {
        /* not logged in or no reactions yet */
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleReaction(targetId: string, targetType: "post" | "comment", reaction: string) {
    if (!viewerSub) {
      window.location.assign("/login");
      return;
    }
    try {
      const url =
        targetType === "post"
          ? `/forum/posts/${targetId}/reactions`
          : `/forum/comments/${encodeURIComponent(targetId)}/reactions?postId=${encodeURIComponent(postId)}`;
      const r = await api<{ added: boolean; counts: Record<string, number> }>(url, {
        method: "POST",
        body: JSON.stringify({ reaction }),
      });
      setReactions((prev) => ({
        ...prev,
        [targetId]: {
          counts: r.counts,
          mine: r.added
            ? [...(prev[targetId]?.mine ?? []), reaction]
            : (prev[targetId]?.mine ?? []).filter((m) => m !== reaction),
        },
      }));
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    if (!viewerSub) {
      window.location.assign("/login");
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
      toast((err as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePost() {
    const yes = await showConfirm({ title: "Delete post", message: "Delete this post and all its comments? This cannot be undone.", destructive: true, confirmLabel: "Delete" });
    if (!yes) return;
    setDeleting(true);
    try {
      await api(`/forum/posts/${postId}/delete`, { method: "POST" });
      router.push(`/forum/${data?.post.channelId}` as never);
    } catch (err) {
      toast((err as Error).message, "error");
      setDeleting(false);
    }
  }

  async function deleteComment(commentId: string) {
    const yes = await showConfirm({ title: "Delete comment", message: "Delete this comment? This cannot be undone.", destructive: true, confirmLabel: "Delete" });
    if (!yes) return;
    try {
      await api(`/forum/comments/${encodeURIComponent(commentId)}/delete?postId=${encodeURIComponent(postId)}`, { method: "POST" });
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  function timeSince(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function totalReactions(targetId: string): number {
    const rx = reactions[targetId];
    if (!rx) return 0;
    return Object.values(rx.counts).reduce((a, b) => a + b, 0);
  }

  if (error) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-seal">{error}</main>;
  if (!data) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  const postRx = reactions[data.post.postId];
  const postTotal = totalReactions(data.post.postId);
  const postReactionEntries = Object.entries(postRx?.counts ?? {}).filter(([, c]) => c > 0);
  const hasLikedPost = postRx?.mine?.includes("like");

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <Link href={`/forum/${data.post.channelId}` as never} className="btn-ghost -ml-3 inline-flex items-center gap-1.5">
        <ArrowLeft size={16} />
        Back to channel
      </Link>

      {/* Post card */}
      <article className="card mt-4 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Avatar userId={data.post.authorId} size="md" initial={data.post.authorName?.charAt(0)} />
              <div>
                <span className="text-sm font-semibold text-ink">{data.post.authorName}</span>
                <span className="ml-2 text-xs text-ink-faded">{timeSince(data.post.createdAt)}</span>
              </div>
            </div>
            {viewerSub === data.post.authorId && (
              <button
                onClick={deletePost}
                disabled={deleting}
                className="rounded-md p-1.5 text-ink-faded transition hover:bg-red-50 hover:text-red-600"
                title="Delete post"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <h1 className="mt-4 text-2xl font-bold text-ink">{data.post.title}</h1>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{data.post.body}</p>
        </div>

        {/* Reaction summary */}
        {(postTotal > 0 || data.comments.length > 0) && (
          <div className="flex items-center justify-between border-t border-ink-faded/15 px-6 py-2">
            <div className="flex items-center gap-1.5">
              {postReactionEntries.length > 0 && (
                <div className="flex -space-x-1">
                  {postReactionEntries.slice(0, 3).map(([key]) => (
                    <span
                      key={key}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-seal/10 text-seal"
                    >
                      <ReactionIcon name={key} size={16} />
                    </span>
                  ))}
                </div>
              )}
              {postTotal > 0 && (
                <span className="text-xs text-ink-faded">{postTotal}</span>
              )}
            </div>
            {data.comments.length > 0 && (
              <span className="text-xs text-ink-faded">
                {data.comments.length} comment{data.comments.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}

        {/* Facebook-style action buttons */}
        <div className="flex border-t border-ink-faded/15">
          <button
            onClick={() => toggleReaction(data.post.postId, "post", "like")}
            className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition hover:bg-gray-50 ${
              hasLikedPost ? "text-seal" : "text-ink-soft"
            }`}
          >
            <ThumbsUp size={18} fill={hasLikedPost ? "currentColor" : "none"} />
            Like
          </button>
          <button
            onClick={() => document.getElementById("comment-box")?.focus()}
            className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-gray-50"
          >
            <MessageCircle size={18} />
            Comment
          </button>
          <ReactionPicker
            onSelect={(r) => toggleReaction(data.post.postId, "post", r)}
            existing={postRx?.mine ?? []}
          />
          <button
            onClick={async () => {
              const url = window.location.href;
              try {
                await navigator.clipboard.writeText(url);
                setShared("post");
                setTimeout(() => setShared(null), 2000);
              } catch {
                if (navigator.share) {
                  try { await navigator.share({ title: data.post.title, url }); } catch { /* cancelled */ }
                }
              }
            }}
            className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-gray-50"
          >
            <Share2 size={18} />
            {shared === "post" ? "Copied!" : "Share"}
          </button>
        </div>
      </article>

      {/* Comments */}
      <section className="mt-6">
        <h2 className="text-lg font-bold text-ink">
          {data.comments.length} comment{data.comments.length === 1 ? "" : "s"}
        </h2>

        {/* Comment input */}
        <form onSubmit={addComment} className="mt-4 flex items-start gap-3">
          {viewerSub && <Avatar userId={viewerSub} size="sm" />}
          <div className="flex-1 overflow-hidden rounded-2xl border border-ink-faded/30 bg-gray-50 focus-within:border-seal/40 focus-within:bg-white">
            <textarea
              id="comment-box"
              rows={2}
              maxLength={4000}
              className="block w-full resize-none bg-transparent px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faded/60"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a comment..."
            />
            <div className="flex items-center justify-end border-t border-ink-faded/10 px-3 py-1.5">
              <button
                type="submit"
                disabled={submitting || !draft.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-seal px-4 py-1.5 text-xs font-medium text-white transition hover:bg-seal-dark disabled:opacity-40"
              >
                <Send size={14} />
                {submitting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </form>

        {/* Comment list */}
        <div className="mt-5 space-y-4">
          {data.comments.map((cm) => {
            const cmRx = reactions[cm.commentId];
            const cmTotal = totalReactions(cm.commentId);
            const cmEntries = Object.entries(cmRx?.counts ?? {}).filter(([, c]) => c > 0);
            const hasLikedComment = cmRx?.mine?.includes("like");
            return (
              <div key={cm.commentId} id={`comment-${cm.commentId}`} className="flex items-start gap-3">
                <Avatar userId={cm.authorId} size="sm" initial={cm.authorName?.charAt(0)} />
                <div className="min-w-0 flex-1">
                  <div className="group/comment rounded-2xl bg-gray-50 px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{cm.authorName}</span>
                        <span className="text-xs text-ink-faded">{timeSince(cm.createdAt)}</span>
                      </div>
                      {viewerSub === cm.authorId && (
                        <button
                          onClick={() => deleteComment(cm.commentId)}
                          className="rounded p-1 text-ink-faded opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover/comment:opacity-100"
                          title="Delete comment"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                      {cm.body}
                    </p>
                  </div>
                  {/* Comment action row */}
                  <div className="mt-1 flex items-center gap-4 pl-4">
                    <button
                      onClick={() => toggleReaction(cm.commentId, "comment", "like")}
                      className={`flex items-center gap-1 text-xs font-semibold transition hover:text-seal ${
                        hasLikedComment ? "text-seal" : "text-ink-faded"
                      }`}
                    >
                      <ThumbsUp size={13} fill={hasLikedComment ? "currentColor" : "none"} />
                      Like
                    </button>
                    <ReactionPicker
                      onSelect={(r) => toggleReaction(cm.commentId, "comment", r)}
                      existing={cmRx?.mine ?? []}
                      small
                    />
                    <button
                      onClick={async () => {
                        const url = `${window.location.origin}/forum/posts/${postId}#comment-${cm.commentId}`;
                        try {
                          await navigator.clipboard.writeText(url);
                          setShared(cm.commentId);
                          setTimeout(() => setShared(null), 2000);
                        } catch {
                          if (navigator.share) {
                            try { await navigator.share({ url }); } catch { /* cancelled */ }
                          }
                        }
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-ink-faded transition hover:text-seal"
                    >
                      <Link2 size={13} />
                      {shared === cm.commentId ? "Copied!" : "Share"}
                    </button>
                    {cmTotal > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="flex -space-x-1">
                          {cmEntries.slice(0, 3).map(([key]) => (
                            <span
                              key={key}
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-seal/10 text-seal"
                            >
                              <ReactionIcon name={key} size={10} />
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-ink-faded">{cmTotal}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function ReactionPicker({
  onSelect,
  existing,
  small,
}: {
  onSelect: (reaction: string) => void;
  existing: string[];
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-center text-ink-faded transition hover:text-ink-soft ${
          small ? "gap-1 text-xs font-semibold" : "px-3 py-2.5 hover:bg-gray-50"
        }`}
        aria-label="Add reaction"
      >
        <SmilePlus size={small ? 13 : 18} />
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 z-20 mb-1 flex -translate-x-1/2 gap-1 rounded-full border border-ink-faded/20 bg-white px-2 py-1.5 shadow-lg">
          {Object.entries(REACTION_META).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => {
                onSelect(key);
                setOpen(false);
              }}
              className={`rounded-full p-2 transition hover:scale-125 hover:bg-gray-100 ${
                existing.includes(key) ? "bg-seal/10 text-seal" : "text-ink-soft"
              }`}
              title={label}
            >
              <ReactionIcon name={key} size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
