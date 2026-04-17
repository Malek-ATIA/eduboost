"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Order = {
  orderId: string;
  listingId: string;
  sellerId: string;
  priceCents: number;
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

export default function OrdersPage() {
  const router = useRouter();
  const [items, setItems] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api<{ items: Order[] }>(`/marketplace/orders/mine`);
      setItems(r.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      await load();
    })();
  }, [router]);

  async function requestRefund(orderId: string) {
    const reason = prompt(
      "Request a refund. Within 1 hour of purchase AND before you download, refunds are automatic. Otherwise this opens a support ticket.",
    );
    if (!reason || reason.trim().length < 10) {
      if (reason !== null) alert("Please provide a reason of at least 10 characters.");
      return;
    }
    setRefundingId(orderId);
    setError(null);
    try {
      const r = await api<{ outcome: "auto_refunded" | "dispute_created"; ticketId?: string }>(
        `/marketplace/orders/${orderId}/refund-request`,
        { method: "POST", body: JSON.stringify({ reason: reason.trim() }) },
      );
      if (r.outcome === "auto_refunded") {
        alert("Refund issued.");
      } else {
        alert(`A dispute ticket was opened: ${r.ticketId}.`);
        if (r.ticketId) router.push(`/support/${r.ticketId}` as never);
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefundingId(null);
    }
  }

  async function downloadFile(listingId: string) {
    setDownloadingId(listingId);
    try {
      const r = await api<{ downloadUrl: string }>(
        `/marketplace/listings/${listingId}/download-url`,
      );
      window.open(r.downloadUrl, "_blank");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Library</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">My orders</h1>
      <p className="mt-1 text-sm text-ink-soft">Marketplace purchases. Download links expire after 15 minutes.</p>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">
          No purchases yet. <Link className="underline" href="/marketplace">Browse the marketplace</Link>.
        </p>
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
                  {new Date(o.createdAt).toLocaleString()} · {o.currency}{" "}
                  {(o.priceCents / 100).toFixed(2)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs uppercase tracking-widest ${STATUS_COLORS[o.status]}`}>{o.status}</span>
                {o.status === "paid" && (
                  <>
                    <button
                      onClick={() => downloadFile(o.listingId)}
                      disabled={downloadingId === o.listingId}
                      className="btn-secondary"
                    >
                      {downloadingId === o.listingId ? "..." : "Download"}
                    </button>
                    <button
                      onClick={() => requestRefund(o.orderId)}
                      disabled={refundingId === o.orderId}
                      className="btn-secondary text-seal"
                    >
                      {refundingId === o.orderId ? "..." : "Refund"}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
