"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Listing = {
  listingId: string;
  title: string;
  priceCents: number;
  currency: string;
  status: "draft" | "active" | "archived";
  fileS3Key?: string;
  createdAt: string;
};

const STATUS_COLORS: Record<Listing["status"], string> = {
  draft: "text-ink-faded",
  active: "text-ink",
  archived: "text-ink-faded",
};

export default function SellerListingsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api<{ items: Listing[] }>(`/marketplace/listings/mine`);
      setItems(r.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (currentRole(session) !== "teacher") return router.replace("/dashboard");
      await load();
    })();
  }, [router]);

  async function toggleStatus(l: Listing) {
    const newStatus = l.status === "active" ? "archived" : "active";
    try {
      await api(`/marketplace/listings/${l.listingId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await load();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("file_not_uploaded")) {
        alert("Upload a file before publishing this listing.");
      } else {
        alert(msg);
      }
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Seller</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">My listings</h1>
        </div>
        <Link
          href="/seller/listings/new"
          className="btn-seal"
        >
          New listing
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Digital study materials you sell on the marketplace.
      </p>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No listings yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-ink-faded/30">
          {items.map((l) => (
            <li key={l.listingId} className="flex items-center justify-between p-4">
              <div>
                <div className="font-display text-base text-ink">{l.title}</div>
                <div className="mt-0.5 text-xs text-ink-faded">
                  {l.currency} {(l.priceCents / 100).toFixed(2)} · created{" "}
                  {new Date(l.createdAt).toLocaleDateString()}
                  {!l.fileS3Key && " · file not uploaded"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs uppercase tracking-widest ${STATUS_COLORS[l.status]}`}>
                  {l.status}
                </span>
                {l.status !== "archived" && (
                  <button
                    onClick={() => toggleStatus(l)}
                    className="btn-secondary"
                  >
                    {l.status === "active" ? "Archive" : "Publish"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
