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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/forum" className="text-sm text-gray-500 underline">
        ← Forum
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{channel?.name ?? channelId}</h1>
          {channel && <p className="mt-1 text-sm text-gray-500">{channel.description}</p>}
        </div>
        <Link
          href={`/forum/posts/new?channelId=${channelId}` as never}
          className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          New post
        </Link>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setSort("new")}
          className={`rounded border px-3 py-1 text-xs ${sort === "new" ? "bg-gray-100 dark:bg-gray-800" : ""}`}
        >
          New
        </button>
        <button
          onClick={() => setSort("top")}
          className={`rounded border px-3 py-1 text-xs ${sort === "top" ? "bg-gray-100 dark:bg-gray-800" : ""}`}
        >
          Top
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No posts yet. Be the first!</p>
      )}

      <ul className="mt-6 divide-y rounded border">
        {items?.map((p) => (
          <li key={p.postId}>
            <Link
              href={`/forum/posts/${p.postId}` as never}
              className="flex gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-900"
            >
              <div className="flex min-w-[3rem] flex-col items-center text-sm">
                <span className="font-bold">{p.score}</span>
                <span className="text-xs text-gray-500">score</span>
              </div>
              <div className="flex-1">
                <div className="font-medium">{p.title}</div>
                <div className="mt-1 line-clamp-2 text-sm text-gray-600">{p.body}</div>
                <div className="mt-1 text-xs text-gray-500">
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
