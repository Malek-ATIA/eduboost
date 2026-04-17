"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Listing = {
  listingId: string;
  sellerId: string;
  title: string;
  description?: string;
  subjects: string[];
  priceCents: number;
  currency: string;
  status: string;
};

export default function MarketplacePage() {
  const [subject, setSubject] = useState("");
  const [applied, setApplied] = useState("");
  const [items, setItems] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (applied) p.set("subject", applied);
    return p.toString() ? `?${p.toString()}` : "";
  }, [applied]);

  useEffect(() => {
    setItems(null);
    setError(null);
    api<{ items: Listing[] }>(`/marketplace/listings${qs}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError((e as Error).message));
  }, [qs]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold">Marketplace</h1>
      <p className="mt-1 text-sm text-gray-500">Study materials from EduBoost teachers.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(subject.trim());
        }}
        className="mt-6 flex gap-2"
      >
        <input
          className="flex-1 rounded border px-3 py-2"
          placeholder="Subject (e.g. Mathematics)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <button className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
          Search
        </button>
      </form>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No listings match your search.</p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map((l) => (
          <Link
            key={l.listingId}
            href={`/marketplace/listings/${l.listingId}` as never}
            className="block rounded border p-4 transition hover:border-black dark:hover:border-white"
          >
            <div className="font-medium">{l.title}</div>
            <div className="mt-1 text-sm text-gray-600 line-clamp-2">{l.description ?? ""}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {l.subjects.slice(0, 3).map((s) => (
                <span key={s} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-3 font-medium">
              {l.currency} {(l.priceCents / 100).toFixed(2)}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
