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
    <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
      <div className="eyebrow">Community</div>
      <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl lg:text-7xl">
        Where the <span className="italic">conversation</span> happens.
      </h1>
      <p className="mt-3 max-w-[560px] text-base leading-relaxed text-ink-soft">
        Ask questions, share past exams, find study partners. Moderated by
        teachers and the EduBoost team.
      </p>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {items === null && !error && (
        <div className="mt-10 flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
        </div>
      )}

      {items && items.length === 0 && (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-bg-soft">
            <span className="text-2xl">💬</span>
          </div>
          <p className="mt-4 font-serif text-lg text-ink">No channels yet</p>
          <p className="mt-3 text-sm text-ink-soft">
            Community channels are coming soon.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Link
              key={c.id}
              href={`/forum/${c.id}` as never}
              className="card-interactive p-6"
            >
              <h2 className="font-serif text-2xl">{c.name}</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                {c.description}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
