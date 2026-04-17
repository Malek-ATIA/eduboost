"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Post = {
  postId: string;
  channelId: string;
  authorId: string;
  title: string;
  body: string;
  score: number;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  createdAt: string;
};

type Channel = { id: string; name: string; description: string };

export default function ChannelPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = use(params);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [sort, setSort] = useState<"new" | "top">("new");
  const [items, setItems] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [loadChannel]);

  useEffect(() => {
    setItems(null);
    setError(null);
    api<{ items: Post[] }>(`/forum/channels/${channelId}/posts${qs}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError((e as Error).message));
  }, [channelId, qs]);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <Link href="/forum" className="btn-ghost -ml-3">
        ← Forum
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <p className="eyebrow">Channel</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">{channel?.name ?? channelId}</h1>
          {channel && <p className="mt-1 text-sm text-ink-soft">{channel.description}</p>}
        </div>
        <Link
          href={`/forum/posts/new?channelId=${channelId}` as never}
          className="btn-seal"
        >
          New post
        </Link>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setSort("new")}
          className={sort === "new" ? "btn-primary" : "btn-secondary"}
        >
          New
        </button>
        <button
          onClick={() => setSort("top")}
          className={sort === "top" ? "btn-primary" : "btn-secondary"}
        >
          Top
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No posts yet. Be the first!</p>
      )}

      <ul className="card mt-6 divide-y divide-ink-faded/30">
        {items?.map((p) => (
          <li key={p.postId}>
            <Link
              href={`/forum/posts/${p.postId}` as never}
              className="flex gap-4 p-4 transition hover:bg-parchment-shade"
            >
              <div className="flex min-w-[3rem] flex-col items-center text-sm">
                <span className="font-display text-lg text-ink">{p.score}</span>
                <span className="text-xs uppercase tracking-widest text-ink-faded">score</span>
              </div>
              <div className="flex-1">
                <div className="font-display text-base text-ink">{p.title}</div>
                <div className="mt-1 line-clamp-2 text-sm text-ink-soft">{p.body}</div>
                <div className="mt-1 text-xs text-ink-faded">
                  {new Date(p.createdAt).toLocaleString()} · {p.commentCount} comment
                  {p.commentCount === 1 ? "" : "s"}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
