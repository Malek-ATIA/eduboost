"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Resource = {
  url: string;
  label: string;
  kind: "drive" | "docs" | "slides" | "sheets" | "video" | "other";
};

type Classroom = {
  classroomId: string;
  teacherId: string;
  title: string;
  subject: string;
  description?: string;
  status: string;
  resources?: Resource[];
};

const KIND_LABELS: Record<Resource["kind"], string> = {
  drive: "Drive",
  docs: "Docs",
  slides: "Slides",
  sheets: "Sheets",
  video: "Video",
  other: "Link",
};

export default function ClassroomInfoPage({
  params,
}: {
  params: Promise<{ classroomId: string }>;
}) {
  const { classroomId } = use(params);
  const router = useRouter();
  const [sub, setSub] = useState<string | null>(null);
  const [data, setData] = useState<Classroom | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<Classroom>(`/classrooms/${classroomId}`);
      setData(r);
      setResources(r.resources ?? []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [classroomId]);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      setSub((s.getIdToken().payload.sub as string) ?? null);
      await load();
    })();
  }, [router, load]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/classrooms/${classroomId}/resources`, {
        method: "PUT",
        body: JSON.stringify({ resources }),
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function addRow() {
    if (resources.length >= 25) return;
    setResources([...resources, { url: "", label: "", kind: "other" }]);
  }

  function updateRow(i: number, patch: Partial<Resource>) {
    setResources(resources.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRow(i: number) {
    setResources(resources.filter((_, idx) => idx !== i));
  }

  if (error && !data) {
    return <main className="mx-auto max-w-2xl px-6 py-12 text-sm text-red-600">{error}</main>;
  }
  if (!data) return <main className="mx-auto max-w-2xl px-6 py-12">Loading...</main>;

  const isTeacher = sub !== null && sub === data.teacherId;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{data.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data.subject} · status {data.status} ·{" "}
            <span className="font-mono">{data.classroomId}</span>
          </p>
        </div>
        <Link
          href={`/whiteboard/${data.classroomId}` as never}
          className="text-sm text-gray-500 underline"
        >
          Whiteboard →
        </Link>
      </div>
      {data.description && (
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">{data.description}</p>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Resources</h2>
        <p className="mt-1 text-xs text-gray-500">
          Links to external materials the teacher has shared for this classroom.
        </p>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {!isTeacher && resources.length === 0 && (
          <p className="mt-4 text-sm text-gray-500">No resources shared yet.</p>
        )}

        {!isTeacher && resources.length > 0 && (
          <ul className="mt-4 space-y-2">
            {resources.map((r, i) => (
              <li key={i} className="flex items-center justify-between rounded border p-3 text-sm">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {r.label}
                </a>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
                  {KIND_LABELS[r.kind]}
                </span>
              </li>
            ))}
          </ul>
        )}

        {isTeacher && (
          <div className="mt-4 space-y-2">
            {resources.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr_auto_auto] gap-2">
                <input
                  value={r.label}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                  placeholder="Label"
                  className="rounded border px-2 py-1 text-sm"
                />
                <input
                  value={r.url}
                  onChange={(e) => updateRow(i, { url: e.target.value })}
                  placeholder="https://..."
                  className="rounded border px-2 py-1 font-mono text-xs"
                />
                <select
                  value={r.kind}
                  onChange={(e) => updateRow(i, { kind: e.target.value as Resource["kind"] })}
                  className="rounded border px-2 py-1 text-sm"
                >
                  {Object.entries(KIND_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeRow(i)}
                  className="rounded text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={addRow}
                disabled={resources.length >= 25}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                + Add resource
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded bg-black px-4 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
