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

  async function load() {
    try {
      const r = await api<{ items: Note[] }>(`/notes/mine`);
      setItems(r.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      await load();
    })();
  }, [router]);

  async function deleteNote(sessionId: string) {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    try {
      await api(`/notes/sessions/${sessionId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

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
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/classroom/${n.sessionId}` as never}
                  className="text-sm font-mono underline"
                >
                  {n.sessionId}
                </Link>
                <button
                  onClick={() => deleteNote(n.sessionId)}
                  className="shrink-0 rounded-md border border-ink-faded/30 px-2.5 py-1 text-xs text-red-500 transition hover:border-red-200 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
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
</main>
  );
}
