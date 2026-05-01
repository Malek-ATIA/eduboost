"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { currentSession } from "@/lib/cognito";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import {
  ThumbsUp,
  MessageCircle,
  Share2,
  Trash2,
  Heart,
  Laugh,
  Lightbulb,
  PartyPopper,
  SmilePlus,
  ArrowLeft,
  PenSquare,
  Clock,
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

type Channel = { id: string; name: string; description: string };

const REACTION_EMOJI: Record<string, { icon: React.ReactNode; label: string }> = {
  like: { icon: <ThumbsUp size={16} />, label: "Like" },
  love: { icon: <Heart size={16} />, label: "Love" },
  laugh: { icon: <Laugh size={16} />, label: "Haha" },
  insightful: { icon: <Lightbulb size={16} />, label: "Insightful" },
  celebrate: { icon: <PartyPopper size={16} />, label: "Celebrate" },
};

export default function ChannelPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = use(params);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [sort, setSort] = useState<"new" | "top">("new");
  const [items, setItems] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);
  const [viewerSub, setViewerSub] = useState<string | null>(null);
  const { toast } = useToast();
  const { confirm: showConfirm } = useDialog();
  const [reactions, setReactions] = useState<
    Record<string, { counts: Record<string, number>; mine: string[] }>
  >({});

  const qs = useMemo(() => `?sort=${sort}`, [sort]);

  const loadChannel = useCallback(async () => {
    try {
      const all = await api<{ items: Channel[] }>(`/forum/channels`);
      setChannel(all.items.find((c) => c.id === channelId) ?? null);
    } catch {
      /* ignore */
    }
  }, [channelId]);

  useEffect(() => {
    loadChannel();
    currentSession().then((s) => {
      if (s) setViewerSub((s.getIdToken().payload.sub as string) ?? null);
    });
  }, [loadChannel]);

  const loadPosts = useCallback(async () => {
    try {
      const r = await api<{ items: Post[] }>(`/forum/channels/${channelId}/posts${qs}`);
      setItems(r.items);
      if (r.items.length > 0) {
        try {
          const ids = r.items.map((p) => p.postId).join(",");
          const rx = await api<
            Record<string, { counts: Record<string, number>; mine: string[] }>
          >(`/forum/reactions?ids=${encodeURIComponent(ids)}`);
          setReactions(rx);
        } catch {
          /* not logged in or no reactions yet */
        }
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [channelId, qs]);

  useEffect(() => {
    setItems(null);
    setError(null);
    loadPosts();
  }, [loadPosts]);

  function timeSince(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  async function deletePost(postId: string) {
    const yes = await showConfirm({ title: "Delete post", message: "Delete this post and all its comments? This cannot be undone.", destructive: true, confirmLabel: "Delete" });
    if (!yes) return;
    try {
      await api(`/forum/posts/${postId}/delete`, { method: "POST" });
      await loadPosts();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function toggleReaction(postId: string, reaction: string) {
    try {
      const r = await api<{ added: boolean; counts: Record<string, number> }>(
        `/forum/posts/${postId}/reactions`,
        { method: "POST", body: JSON.stringify({ reaction }) },
      );
      setReactions((prev) => ({
        ...prev,
        [postId]: {
          counts: r.counts,
          mine: r.added
            ? [...(prev[postId]?.mine ?? []), reaction]
            : (prev[postId]?.mine ?? []).filter((m) => m !== reaction),
        },
      }));
    } catch {
      window.location.assign("/login");
    }
  }

  function totalReactions(postId: string): number {
    const rx = reactions[postId];
    if (!rx) return 0;
    return Object.values(rx.counts).reduce((a, b) => a + b, 0);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <Link href="/forum" className="btn-ghost -ml-3 inline-flex items-center gap-1.5">
        <ArrowLeft size={16} />
        Forum
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <p className="eyebrow">Channel</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">{channel?.name ?? channelId}</h1>
          {channel && <p className="mt-1 text-sm text-ink-soft">{channel.description}</p>}
        </div>
        <Link
          href={`/forum/posts/new?channelId=${channelId}` as never}
          className="btn-seal inline-flex items-center gap-2"
        >
          <PenSquare size={16} />
          New post
        </Link>
      </div>

      <div className="mt-6 flex gap-2">
        {(["new", "top"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              sort === s
                ? "bg-ink text-white"
                : "bg-gray-100 text-ink-soft hover:bg-gray-200"
            }`}
          >
            {s === "new" ? (
              <>
                <Clock size={14} />
                Latest
              </>
            ) : (
              <>
                <ThumbsUp size={14} />
                Top
              </>
            )}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No posts yet. Be the first!</p>
      )}

      <div className="mt-6 space-y-4">
        {items?.map((p) => {
          const rx = reactions[p.postId];
          const reactionEntries = Object.entries(rx?.counts ?? {}).filter(
            ([, count]) => count > 0,
          );
          const total = totalReactions(p.postId);
          const hasLiked = rx?.mine?.includes("like");

          return (
            <article key={p.postId} className="card overflow-hidden">
              {/* Post header + body */}
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <Avatar userId={p.authorId} size="md" initial={p.authorName?.charAt(0)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {p.authorName ?? p.authorId.slice(0, 12)}
                        </span>
                        <span className="text-xs text-ink-faded">{timeSince(p.createdAt)}</span>
                      </div>
                      {viewerSub === p.authorId && (
                        <button
                          onClick={() => deletePost(p.postId)}
                          className="rounded-md p-1.5 text-ink-faded transition hover:bg-red-50 hover:text-red-600"
                          title="Delete post"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <Link
                      href={`/forum/posts/${p.postId}` as never}
                      className="mt-1 block text-lg font-bold text-ink hover:text-seal"
                    >
                      {p.title}
                    </Link>
                    <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-ink-soft">
                      {p.body}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reaction summary row */}
              {(total > 0 || p.commentCount > 0) && (
                <div className="flex items-center justify-between border-t border-ink-faded/15 px-5 py-2">
                  <div className="flex items-center gap-1.5">
                    {reactionEntries.length > 0 && (
                      <div className="flex -space-x-1">
                        {reactionEntries.slice(0, 3).map(([key]) => (
                          <span
                            key={key}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-seal/10 text-seal"
                          >
                            {REACTION_EMOJI[key]?.icon}
                          </span>
                        ))}
                      </div>
                    )}
                    {total > 0 && (
                      <span className="text-xs text-ink-faded">{total}</span>
                    )}
                  </div>
                  {p.commentCount > 0 && (
                    <Link
                      href={`/forum/posts/${p.postId}` as never}
                      className="text-xs text-ink-faded hover:text-ink-soft hover:underline"
                    >
                      {p.commentCount} comment{p.commentCount === 1 ? "" : "s"}
                    </Link>
                  )}
                </div>
              )}

              {/* Facebook-style action buttons */}
              <div className="flex border-t border-ink-faded/15">
                <button
                  onClick={() => toggleReaction(p.postId, "like")}
                  className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition hover:bg-gray-50 ${
                    hasLiked ? "text-seal" : "text-ink-soft"
                  }`}
                >
                  <ThumbsUp size={18} fill={hasLiked ? "currentColor" : "none"} />
                  Like
                </button>
                <Link
                  href={`/forum/posts/${p.postId}` as never}
                  className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-gray-50"
                >
                  <MessageCircle size={18} />
                  Comment
                </Link>
                <ReactionPicker
                  onSelect={(r) => toggleReaction(p.postId, r)}
                  existing={rx?.mine ?? []}
                />
                <button
                  onClick={async () => {
                    const url = `${window.location.origin}/forum/posts/${p.postId}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      setSharedPostId(p.postId);
                      setTimeout(() => setSharedPostId(null), 2000);
                    } catch {
                      if (navigator.share) {
                        try { await navigator.share({ title: p.title, url }); } catch { /* cancelled */ }
                      }
                    }
                  }}
                  className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-gray-50"
                >
                  <Share2 size={18} />
                  {sharedPostId === p.postId ? "Copied!" : "Share"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

function ReactionPicker({
  onSelect,
  existing,
}: {
  onSelect: (reaction: string) => void;
  existing: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center px-3 py-2.5 text-ink-faded transition hover:bg-gray-50 hover:text-ink-soft"
        aria-label="Add reaction"
      >
        <SmilePlus size={18} />
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 z-20 mb-1 flex -translate-x-1/2 gap-1 rounded-full border border-ink-faded/20 bg-white px-2 py-1.5 shadow-lg">
          {Object.entries(REACTION_EMOJI).map(([key, { icon, label }]) => (
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
              {icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
