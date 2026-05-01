"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { Avatar } from "@/components/Avatar";

type Listing = {
  listingId: string;
  sellerId: string;
  kind: "digital" | "physical";
  title: string;
  description?: string;
  subjects: string[];
  priceCents: number;
  currency: string;
  fileMimeType?: string;
  fileSizeBytes?: number;
  inStockCount?: number;
  shippingCostCents?: number;
  shipsFrom?: string;
  status: string;
  createdAt?: string;
};

type SellerInfo = {
  displayName?: string;
  userId: string;
};

const KIND_ICON: Record<string, { icon: string; label: string; color: string }> = {
  digital: { icon: "📄", label: "Digital download", color: "bg-blue-50 text-blue-700 border-blue-200" },
  physical: { icon: "📦", label: "Physical product", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF Document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word Document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "application/zip": "ZIP Archive",
};

export default function ListingDetailPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = use(params);
  const [data, setData] = useState<Listing | null>(null);
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [relatedListings, setRelatedListings] = useState<Listing[]>([]);

  useEffect(() => {
    api<Listing>(`/marketplace/listings/${listingId}`)
      .then((d) => {
        setData(d);
        api<SellerInfo>(`/users/${d.sellerId}/public`)
          .then(setSeller)
          .catch(() => setSeller({ userId: d.sellerId }));
        if (d.subjects.length > 0) {
          api<{ items: Listing[] }>(`/marketplace/listings?subject=${encodeURIComponent(d.subjects[0])}&limit=5`)
            .then((r) => setRelatedListings(r.items.filter((l) => l.listingId !== listingId).slice(0, 3)))
            .catch(() => {});
        }
      })
      .catch((e) => setError((e as Error).message));
  }, [listingId]);

  if (error) return <main className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-seal">{error}</main>;
  if (!data) {
    return (
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
        </div>
      </main>
    );
  }

  const kInfo = KIND_ICON[data.kind] ?? KIND_ICON.digital;
  const fileLabel = data.fileMimeType ? MIME_LABELS[data.fileMimeType] ?? data.fileMimeType : null;
  const fileSize = data.fileSizeBytes
    ? data.fileSizeBytes > 1_048_576
      ? `${(data.fileSizeBytes / 1_048_576).toFixed(1)} MB`
      : `${Math.round(data.fileSizeBytes / 1024)} KB`
    : null;

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
      {/* Breadcrumb */}
      <nav className="text-sm text-ink-faded">
        <Link href="/marketplace" className="hover:text-ink">
          Marketplace
        </Link>
        <span className="mx-2">›</span>
        <span className="text-ink">{data.title}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Main content */}
        <div>
          {/* Product type badge */}
          <div className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${kInfo.color}`}>
            <span>{kInfo.icon}</span>
            <span>{kInfo.label}</span>
          </div>

          <h1 className="mt-3 font-display text-3xl tracking-tight text-ink lg:text-4xl">
            {data.title}
          </h1>

          {/* Subject tags */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.subjects.map((s) => (
              <span
                key={s}
                className="rounded-full border border-ink-faded/40 bg-parchment-dark px-3 py-0.5 text-xs text-ink-soft"
              >
                {s}
              </span>
            ))}
          </div>

          {/* Description */}
          {data.description ? (
            <div className="mt-6">
              <h2 className="eyebrow mb-2">Description</h2>
              <div className="prose prose-sm whitespace-pre-wrap leading-relaxed text-ink">
                {data.description}
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm italic text-ink-faded">No description provided.</p>
          )}

          {/* File / product info */}
          <div className="mt-8">
            <h2 className="eyebrow mb-3">Product details</h2>
            <div className="card divide-y divide-ink-faded/20">
              <div className="flex items-center justify-between p-3">
                <span className="text-sm text-ink-soft">Type</span>
                <span className="text-sm font-medium text-ink capitalize">{data.kind}</span>
              </div>
              {fileLabel && (
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-ink-soft">Format</span>
                  <span className="text-sm font-medium text-ink">{fileLabel}</span>
                </div>
              )}
              {fileSize && (
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-ink-soft">File size</span>
                  <span className="text-sm font-medium text-ink">{fileSize}</span>
                </div>
              )}
              {data.kind === "physical" && data.shipsFrom && (
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-ink-soft">Ships from</span>
                  <span className="text-sm font-medium text-ink">{data.shipsFrom}</span>
                </div>
              )}
              {data.kind === "physical" && data.inStockCount != null && (
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-ink-soft">Availability</span>
                  <span className={`text-sm font-medium ${data.inStockCount > 0 ? "text-green-700" : "text-seal"}`}>
                    {data.inStockCount > 0 ? `${data.inStockCount} in stock` : "Out of stock"}
                  </span>
                </div>
              )}
              {data.createdAt && (
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-ink-soft">Listed</span>
                  <span className="text-sm text-ink">
                    {new Date(data.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Price card */}
          <div className="card sticky top-24 space-y-4 p-5">
            <div>
              <div className="font-display text-3xl text-ink">
                {formatMoney(data.priceCents, data.currency, { trim: true })}
              </div>
              {data.kind === "physical" && data.shippingCostCents != null && data.shippingCostCents > 0 && (
                <div className="mt-1 text-xs text-ink-faded">
                  + {formatMoney(data.shippingCostCents, data.currency, { trim: true })} shipping
                </div>
              )}
            </div>

            {data.kind === "digital" && (
              <div className="flex items-center gap-2 rounded-md bg-blue-50 p-2.5 text-xs text-blue-700">
                <span>⚡</span>
                <span>Instant download after purchase</span>
              </div>
            )}

            <Link
              href={`/marketplace/buy/${data.listingId}`}
              className="btn-seal block w-full text-center"
            >
              {data.kind === "digital" ? "Buy & download" : "Buy now"}
            </Link>

            <div className="border-t border-ink-faded/20 pt-3">
              <div className="flex items-center gap-2 text-xs text-ink-faded">
                <span>✓</span>
                <span>Secure payment via Stripe</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-ink-faded">
                <span>✓</span>
                <span>Money-back guarantee</span>
              </div>
              {data.kind === "digital" && (
                <div className="mt-1 flex items-center gap-2 text-xs text-ink-faded">
                  <span>✓</span>
                  <span>Download link valid 15 minutes</span>
                </div>
              )}
            </div>
          </div>

          {/* Seller card */}
          <div className="card p-4">
            <h3 className="eyebrow mb-3">Seller</h3>
            <div className="flex items-center gap-3">
              <Avatar userId={data.sellerId} size="md" initial={seller?.displayName?.charAt(0)} />
              <div>
                <div className="font-display text-sm text-ink">
                  {seller?.displayName || "EduBoost Seller"}
                </div>
                <Link
                  href={`/teachers/${data.sellerId}` as never}
                  className="text-xs text-seal hover:underline"
                >
                  View profile →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related listings */}
      {relatedListings.length > 0 && (
        <section className="mt-12">
          <h2 className="eyebrow mb-4">You might also like</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {relatedListings.map((l) => (
              <Link
                key={l.listingId}
                href={`/marketplace/listings/${l.listingId}` as never}
                className="card block p-4 transition hover:shadow-md"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{KIND_ICON[l.kind]?.icon ?? "📄"}</span>
                  <span className="text-[10px] uppercase tracking-widest text-ink-faded">{l.kind}</span>
                </div>
                <h3 className="mt-2 font-display text-sm text-ink">{l.title}</h3>
                <div className="mt-1 flex flex-wrap gap-1">
                  {l.subjects.slice(0, 2).map((s) => (
                    <span key={s} className="rounded-full bg-parchment-dark px-2 py-0.5 text-[10px] text-ink-faded">
                      {s}
                    </span>
                  ))}
                </div>
                <div className="mt-3 font-display text-base text-ink">
                  {formatMoney(l.priceCents, l.currency, { trim: true })}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
