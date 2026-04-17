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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Forum</h1>
      <p className="mt-1 text-sm text-gray-500">
        Community Q&amp;A, tips, and discussion.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}

      <ul className="mt-6 divide-y rounded border">
        {items?.map((c) => (
          <li key={c.id}>
            <Link
              href={`/forum/${c.id}` as never}
              className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-900"
            >
              <div className="font-medium">{c.name}</div>
              <div className="mt-0.5 text-sm text-gray-500">{c.description}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
