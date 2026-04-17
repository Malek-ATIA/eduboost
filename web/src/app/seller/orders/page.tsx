"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Order = {
  orderId: string;
  listingId: string;
  buyerId: string;
  priceCents: number;
  platformFeeCents: number;
  currency: string;
  status: "pending" | "paid" | "refunded" | "cancelled";
  createdAt: string;
};

const STATUS_COLORS: Record<Order["status"], string> = {
  pending: "text-ink-faded",
  paid: "text-ink",
  refunded: "text-ink-faded",
  cancelled: "text-seal",
};

export default function SellerOrdersPage() {
  const router = useRouter();
  const [items, setItems] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (currentRole(session) !== "teacher") return router.replace("/dashboard");
      try {
        const r = await api<{ items: Order[] }>(`/marketplace/orders/as-seller`);
        setItems(r.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Seller</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Marketplace orders</h1>
      <p className="mt-1 text-sm text-ink-soft">Sales on your listings.</p>
      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No sales yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-ink-faded/30">
          {items.map((o) => (
            <li key={o.orderId} className="flex items-center justify-between p-4">
              <div>
                <div className="font-display text-base text-ink">
                  <Link href={`/marketplace/listings/${o.listingId}` as never} className="font-mono underline">
                    {o.listingId}
                  </Link>
                </div>
                <div className="mt-0.5 text-xs text-ink-faded">
                  {new Date(o.createdAt).toLocaleString()} · fee{" "}
                  {(o.platformFeeCents / 100).toFixed(2)} · net{" "}
                  {((o.priceCents - o.platformFeeCents) / 100).toFixed(2)} {o.currency}
                </div>
              </div>
              <span className={`text-xs uppercase tracking-widest ${STATUS_COLORS[o.status]}`}>{o.status}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
