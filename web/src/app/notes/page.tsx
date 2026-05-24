"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { useDialog } from "@/components/Dialog";

type Note = {
  sessionId: string;
  userId: string;
  body: string;
  updatedAt?: string;
};

export default function MyNotesPage() {
  const router = useRouter();
  const { confirm: showConfirm } = useDialog();
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
    const ok = await showConfirm({ title: "Delete note", message: "Delete this note? This cannot be undone.", destructive: true });
    if (!ok) return;
    try {
      await api(`/notes/sessions/${sessionId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="pb-8">
      <div className="eyebrow">Notebook</div>
      <h1 className="mt-3 text-[clamp(28px,3vw,40px)] font-bold tracking-[-0.018em]">My session notes</h1>
      <p className="mt-3 text-sm text-ink-soft">
        Personal notes you wrote during classroom sessions.
      </p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">
          No notes yet. Join a classroom to start taking notes.
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-rule">
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
                  className="shrink-0 rounded-md border border-rule px-2.5 py-1 text-xs text-red-500 transition hover:border-accent/20 hover:bg-accent/5"
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
