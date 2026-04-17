"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Note = {
  sessionId: string;
  userId: string;
  body: string;
  updatedAt?: string;
};

export default function MyNotesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      try {
        const r = await api<{ items: Note[] }>(`/notes/mine`);
        setItems(r.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Notebook</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">My session notes</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Personal notes you wrote during classroom sessions.
      </p>
      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">
          No notes yet. Join a classroom to start taking notes.
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-ink-faded/30">
          {items.map((n) => (
            <li key={n.sessionId} className="p-4">
              <Link
                href={`/classroom/${n.sessionId}` as never}
                className="text-sm font-mono underline"
              >
                {n.sessionId}
              </Link>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-ink">
                {n.body || "(empty)"}
              </p>
              {n.updatedAt && (
                <p className="mt-1 text-xs text-ink-faded">
                  Updated {new Date(n.updatedAt).toLocaleString()}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-ink-soft underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
