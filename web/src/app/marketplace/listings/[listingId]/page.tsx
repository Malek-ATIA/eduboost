"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Listing = {
  listingId: string;
  sellerId: string;
  title: string;
  description?: string;
  subjects: string[];
  priceCents: number;
  currency: string;
  fileMimeType?: string;
  fileSizeBytes?: number;
};

export default function ListingDetailPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = use(params);
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Listing>(`/marketplace/listings/${listingId}`)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [listingId]);

  if (error) return <main className="mx-auto max-w-2xl px-6 py-12 text-red-600">{error}</main>;
  if (!data) return <main className="mx-auto max-w-2xl px-6 py-12">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/marketplace" className="text-sm text-gray-500 underline">
        ← Marketplace
      </Link>
      <h1 className="mt-4 text-3xl font-bold">{data.title}</h1>
      <div className="mt-2 flex flex-wrap gap-1">
        {data.subjects.map((s) => (
          <span key={s} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
            {s}
          </span>
        ))}
      </div>
      {data.description && (
        <p className="mt-6 whitespace-pre-wrap leading-relaxed">{data.description}</p>
      )}
      <div className="mt-8 rounded border p-4">
        <div className="text-xl font-bold">
          {data.currency} {(data.priceCents / 100).toFixed(2)}
        </div>
        {data.fileMimeType && (
          <div className="mt-1 text-xs text-gray-500">
            {data.fileMimeType}
            {data.fileSizeBytes
              ? ` · ${(data.fileSizeBytes / 1024 / 1024).toFixed(1)} MB`
              : ""}
          </div>
        )}
        <Link
          href={`/marketplace/buy/${data.listingId}`}
          className="mt-4 inline-block rounded bg-black px-5 py-2 text-white dark:bg-white dark:text-black"
        >
          Buy
        </Link>
      </div>
    </main>
  );
}
