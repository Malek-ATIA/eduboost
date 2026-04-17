"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Material = {
  materialId: string;
  authorId: string;
  kind: "exam" | "notes" | "answers" | "other";
  title: string;
  subject: string;
  description?: string;
  fileS3Key?: string;
  createdAt: string;
};

const KINDS: Material["kind"][] = ["exam", "notes", "answers", "other"];

export default function StudyMaterialsPage() {
  const [items, setItems] = useState<Material[] | null>(null);
  const [kind, setKind] = useState<Material["kind"] | "">("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams();
    if (kind) p.set("kind", kind);
    if (subject) p.set("subject", subject);
    const qs = p.toString();
    api<{ items: Material[] }>(`/study-materials${qs ? `?${qs}` : ""}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError((e as Error).message));
  }, [kind, subject]);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Library</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Study materials portal</h1>
        </div>
        <Link
          href="/study-materials/new"
          className="btn-seal"
        >
          Share material
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Free peer-shared exams, notes, and answer keys.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-xs">
          <span className="label">Kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="input"
          >
            <option value="">All</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs">
          <span className="label">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="input"
            placeholder="e.g. Mathematics"
          />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No matching materials.</p>
      )}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-ink-faded/30">
          {items.map((m) => (
            <li key={m.materialId}>
              <Link
                href={`/study-materials/${m.materialId}` as never}
                className="block p-4 transition hover:bg-parchment-shade"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-base text-ink">{m.title}</div>
                    <div className="mt-0.5 text-xs text-ink-faded">
                      {m.kind} · {m.subject} · {new Date(m.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="rounded-sm border border-ink-faded/50 bg-parchment/40 px-2 py-0.5 text-xs uppercase tracking-widest text-ink-soft">
                    {m.kind}
                  </span>
                </div>
              </Link>
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
