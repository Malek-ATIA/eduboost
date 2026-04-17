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
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <Link href="/forum" className="btn-ghost -ml-3">
        ← Forum
      </Link>
      <p className="eyebrow mt-4">Forum</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">New post</h1>

      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6">
        <label className="block">
          <span className="label">Channel</span>
          <select
            required
            className="input"
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
          <span className="label">Title</span>
          <input
            required
            minLength={3}
            maxLength={200}
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Body</span>
          <textarea
            required
            minLength={1}
            maxLength={10_000}
            rows={8}
            className="input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-seal">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !channelId || !title.trim() || !body.trim()}
          className="btn-seal"
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
        <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
          <p className="eyebrow">Forum</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">New post</h1>
          <p className="mt-4 text-sm text-ink-soft">Loading...</p>
        </main>
      }
    >
      <NewPostForm />
    </Suspense>
  );
}
