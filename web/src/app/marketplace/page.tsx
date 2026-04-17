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
    <main className="mx-auto max-w-5xl px-6 pb-24 pt-16">
      <p className="eyebrow">Shop</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Marketplace</h1>
      <p className="mt-1 text-sm text-ink-soft">Study materials from EduBoost teachers.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(subject.trim());
        }}
        className="mt-6 flex gap-2"
      >
        <input
          className="input flex-1"
          placeholder="Subject (e.g. Mathematics)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <button className="btn-seal">
          Search
        </button>
      </form>

      {error && <p className="mt-6 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No listings match your search.</p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map((l) => (
          <Link
            key={l.listingId}
            href={`/marketplace/listings/${l.listingId}` as never}
            className="card-interactive block p-4"
          >
            <div className="font-display text-base text-ink">{l.title}</div>
            <div className="mt-1 text-sm text-ink-soft line-clamp-2">{l.description ?? ""}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {l.subjects.slice(0, 3).map((s) => (
                <span key={s} className="rounded-sm border border-ink-faded/50 bg-parchment/40 px-2 py-0.5 text-xs text-ink-soft">
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-3 font-display text-base text-ink">
              {l.currency} {(l.priceCents / 100).toFixed(2)}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
