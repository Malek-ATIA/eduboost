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
    return <main className="mx-auto max-w-2xl px-6 py-12 text-sm text-red-600">{error}</main>;
  }
  if (!item) return <main className="mx-auto max-w-2xl px-6 py-12">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">{item.title}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {item.kind} · {item.subject} · shared{" "}
        {new Date(item.createdAt).toLocaleDateString()}
      </p>
      {item.description && (
        <p className="mt-6 whitespace-pre-wrap text-sm">{item.description}</p>
      )}
      <button
        onClick={download}
        disabled={downloading || !item.fileS3Key}
        className="mt-8 rounded bg-black px-5 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {downloading ? "Preparing..." : item.fileS3Key ? "Download" : "No file attached"}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <p className="mt-8 text-sm">
        <Link href="/study-materials" className="text-gray-500 underline">
          ← All materials
        </Link>
      </p>
    </main>
  );
}
