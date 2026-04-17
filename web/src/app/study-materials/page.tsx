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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Study materials portal</h1>
        <Link
          href="/study-materials/new"
          className="rounded border px-3 py-1 text-sm"
        >
          Share material
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Free peer-shared exams, notes, and answer keys.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-xs">
          <span className="mb-1 text-gray-500">Kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="rounded border px-2 py-1 text-sm"
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
          <span className="mb-1 text-gray-500">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
            placeholder="e.g. Mathematics"
          />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No matching materials.</p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((m) => (
            <li key={m.materialId}>
              <Link
                href={`/study-materials/${m.materialId}` as never}
                className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{m.title}</div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {m.kind} · {m.subject} · {new Date(m.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
                    {m.kind}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-gray-500 underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
