"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

const KINDS = ["exam", "notes", "answers", "other"] as const;
type Kind = (typeof KINDS)[number];

export default function NewMaterialPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState<Kind>("notes");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    currentSession().then((s) => {
      if (!s) return router.replace("/login");
      setReady(true);
    });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Attach a file.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      setProgress("Creating material...");
      const created = await api<{ materialId: string }>(`/study-materials`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          kind,
          description: description.trim() || undefined,
        }),
      });
      setProgress("Uploading file...");
      const upload = await api<{ uploadUrl: string; key: string }>(
        `/study-materials/${created.materialId}/upload-url`,
        {
          method: "POST",
          body: JSON.stringify({
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          }),
        },
      );
      const put = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed: ${put.status}`);
      router.replace(`/study-materials/${created.materialId}` as never);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  if (!ready) return <main className="mx-auto max-w-2xl px-6 py-12">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Share study material</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Title</span>
          <input
            required
            minLength={3}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Subject</span>
            <input
              required
              maxLength={100}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="Mathematics"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Kind</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="w-full rounded border px-3 py-2"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Description (optional)</span>
          <textarea
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">File</span>
          <input
            required
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {progress && <p className="text-sm text-gray-600">{progress}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-5 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? "Uploading..." : "Publish"}
        </button>
      </form>
      <p className="mt-8 text-sm">
        <Link href="/study-materials" className="text-gray-500 underline">
          ← All materials
        </Link>
      </p>
    </main>
  );
}
