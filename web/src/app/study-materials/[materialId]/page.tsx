"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Material = {
  materialId: string;
  authorId: string;
  kind: string;
  title: string;
  subject: string;
  description?: string;
  fileS3Key?: string;
  createdAt: string;
};

export default function MaterialDetailPage({
  params,
}: {
  params: Promise<{ materialId: string }>;
}) {
  const { materialId } = use(params);
  const [item, setItem] = useState<Material | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api<Material>(`/study-materials/${materialId}`)
      .then(setItem)
      .catch((e) => setError((e as Error).message));
  }, [materialId]);

  async function download() {
    setDownloading(true);
    try {
      const r = await api<{ downloadUrl: string }>(
        `/study-materials/${materialId}/download-url`,
      );
      window.open(r.downloadUrl, "_blank");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  if (error && !item) {
    return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-sm text-seal">{error}</main>;
  }
  if (!item) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <p className="eyebrow">Material</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">{item.title}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {item.kind} · {item.subject} · shared{" "}
        {new Date(item.createdAt).toLocaleDateString()}
      </p>
      {item.description && (
        <p className="mt-6 whitespace-pre-wrap text-sm text-ink">{item.description}</p>
      )}
      <button
        onClick={download}
        disabled={downloading || !item.fileS3Key}
        className="btn-seal mt-8"
      >
        {downloading ? "Preparing..." : item.fileS3Key ? "Download" : "No file attached"}
      </button>
      {error && <p className="mt-3 text-sm text-seal">{error}</p>}
      <p className="mt-8 text-sm">
        <Link href="/study-materials" className="text-ink-soft underline">
          ← All materials
        </Link>
      </p>
    </main>
  );
}
