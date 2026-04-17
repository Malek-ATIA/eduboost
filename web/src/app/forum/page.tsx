"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Channel = { id: string; name: string; description: string };

export default function ForumPage() {
  const [items, setItems] = useState<Channel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Channel[] }>(`/forum/channels`)
      .then((r) => setItems(r.items))
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Community</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Forum</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Community Q&amp;A, tips, and discussion.
      </p>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}

      <ul className="card mt-6 divide-y divide-ink-faded/30">
        {items?.map((c) => (
          <li key={c.id}>
            <Link
              href={`/forum/${c.id}` as never}
              className="block p-4 transition hover:bg-parchment-shade"
            >
              <div className="font-display text-base text-ink">{c.name}</div>
              <div className="mt-0.5 text-sm text-ink-soft">{c.description}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
