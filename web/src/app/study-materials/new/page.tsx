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
  const [premium, setPremium] = useState(false);
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
          premium,
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

  if (!ready) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <p className="eyebrow">Library</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Share study material</h1>
      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6">
        <label className="block">
          <span className="label">Title</span>
          <input
            required
            minLength={3}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="label">Subject</span>
            <input
              required
              maxLength={100}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input"
              placeholder="Mathematics"
            />
          </label>
          <label className="block">
            <span className="label">Kind</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="input"
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
          <span className="label">Description (optional)</span>
          <textarea
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={premium}
            onChange={(e) => setPremium(e.target.checked)}
            className="mt-0.5 accent-seal"
          />
          <span>
            <strong className="text-ink">Premium</strong> — only students with
            an active premium membership can download. Authors and admins
            always have access.
          </span>
        </label>
        <label className="block">
          <span className="label">File</span>
          <input
            required
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-ink"
          />
        </label>
        {progress && <p className="text-sm text-ink-soft">{progress}</p>}
        {error && <p className="text-sm text-seal">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="btn-seal"
        >
          {submitting ? "Uploading..." : "Publish"}
        </button>
      </form>
      <p className="mt-8 text-sm">
        <Link href="/study-materials" className="text-ink-soft underline">
          ← All materials
        </Link>
      </p>
    </main>
  );
}
