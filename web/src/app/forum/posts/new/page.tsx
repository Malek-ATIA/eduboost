"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Channel = { id: string; name: string };

function NewPostForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialChannel = searchParams.get("channelId") ?? "";

  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [channelId, setChannelId] = useState(initialChannel);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      try {
        const r = await api<{ items: Channel[] }>(`/forum/channels`);
        setChannels(r.items);
        if (!initialChannel && r.items[0]) setChannelId(r.items[0].id);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router, initialChannel]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const r = await api<{ postId: string }>(`/forum/posts`, {
        method: "POST",
        body: JSON.stringify({ channelId, title, body }),
      });
      router.replace(`/forum/posts/${r.postId}` as never);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/forum" className="text-sm text-gray-500 underline">
        ← Forum
      </Link>
      <h1 className="mt-4 text-2xl font-bold">New post</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Channel</span>
          <select
            required
            className="w-full rounded border px-3 py-2"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
          >
            {channels?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Title</span>
          <input
            required
            minLength={3}
            maxLength={200}
            className="w-full rounded border px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Body</span>
          <textarea
            required
            minLength={1}
            maxLength={10_000}
            rows={8}
            className="w-full rounded border px-3 py-2"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !channelId || !title.trim() || !body.trim()}
          className="rounded bg-black px-5 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? "Posting..." : "Post"}
        </button>
      </form>
    </main>
  );
}

export default function NewPostPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl px-6 py-12">
          <h1 className="text-2xl font-bold">New post</h1>
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </main>
      }
    >
      <NewPostForm />
    </Suspense>
  );
}
