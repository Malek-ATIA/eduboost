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

  if (error) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-seal">{error}</main>;
  if (!data) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <Link href="/marketplace" className="btn-ghost -ml-3">
        ← Marketplace
      </Link>
      <p className="eyebrow mt-4">Listing</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">{data.title}</h1>
      <div className="mt-2 flex flex-wrap gap-1">
        {data.subjects.map((s) => (
          <span key={s} className="rounded-sm border border-ink-faded/50 bg-parchment/40 px-2 py-0.5 text-xs text-ink-soft">
            {s}
          </span>
        ))}
      </div>
      {data.description && (
        <p className="mt-6 whitespace-pre-wrap leading-relaxed text-ink">{data.description}</p>
      )}
      <div className="card mt-8 p-4">
        <div className="font-display text-xl text-ink">
          {data.currency} {(data.priceCents / 100).toFixed(2)}
        </div>
        {data.fileMimeType && (
          <div className="mt-1 text-xs text-ink-faded">
            {data.fileMimeType}
            {data.fileSizeBytes
              ? ` · ${(data.fileSizeBytes / 1024 / 1024).toFixed(1)} MB`
              : ""}
          </div>
        )}
        <Link
          href={`/marketplace/buy/${data.listingId}`}
          className="btn-seal mt-4"
        >
          Buy
        </Link>
      </div>
    </main>
  );
}
