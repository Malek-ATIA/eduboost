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
  premium?: boolean;
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
    <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Library</div>
          <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">Study materials portal</h1>
        </div>
        <Link
          href="/study-materials/new"
          className="btn-seal"
        >
          Share material
        </Link>
      </div>
      <p className="mt-3 text-sm text-ink-soft">
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

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No matching materials.</p>
      )}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-rule">
          {items.map((m) => (
            <li key={m.materialId}>
              <Link
                href={`/study-materials/${m.materialId}` as never}
                className="block p-4 transition hover:bg-bg-soft"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-base text-ink">{m.title}</span>
                      {m.premium && (
                        <span className="rounded-md border border-accent/30 bg-accent-pale px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
                          Premium
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-faded">
                      {m.kind} · {m.subject} · {new Date(m.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="rounded-md border border-rule bg-bg-soft px-2 py-0.5 text-xs uppercase tracking-widest text-ink-soft">
                    {m.kind}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
</main>
  );
}
