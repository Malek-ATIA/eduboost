"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";

type Order = {
  orderId: string;
  listingId: string;
  sellerId: string;
  priceCents: number;
  currency: string;
  status: "pending" | "paid" | "refunded" | "cancelled";
  kind?: "digital" | "physical";
  shippingStatus?: "awaiting_ship" | "shipped" | "delivered" | "cancelled";
  shippingCarrier?: string;
  trackingNumber?: string;
  createdAt: string;
  listingTitle?: string;
};

type StatusFilter = "all" | "paid" | "pending" | "refunded" | "cancelled";

const STATUS_STYLES: Record<Order["status"], { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  paid: { label: "Paid", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  refunded: { label: "Refunded", color: "text-ink-faded", bg: "bg-parchment-dark border-ink-faded/30" },
  cancelled: { label: "Cancelled", color: "text-red-600", bg: "bg-red-50 border-red-200" },
};

const SHIPPING_STYLES: Record<string, { label: string; color: string }> = {
  awaiting_ship: { label: "Awaiting shipment", color: "text-amber-600" },
  shipped: { label: "Shipped", color: "text-blue-600" },
  delivered: { label: "Delivered", color: "text-green-700" },
  cancelled: { label: "Cancelled", color: "text-red-600" },
};

export default function OrdersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { prompt: showPrompt } = useDialog();
  const [items, setItems] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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
    const reason = await showPrompt({
      title: "Request refund",
      message: "Within 1 hour of purchase AND before you download, refunds are automatic. Otherwise this opens a support ticket.",
      inputLabel: "Reason",
      inputPlaceholder: "Why are you requesting a refund?",
      inputMinLength: 10,
    });
    if (!reason) return;
    setRefundingId(orderId);
    setError(null);
    try {
      const r = await api<{ outcome: "auto_refunded" | "dispute_created"; ticketId?: string }>(
        `/marketplace/orders/${orderId}/refund-request`,
        { method: "POST", body: JSON.stringify({ reason: reason.trim() }) },
      );
      if (r.outcome === "auto_refunded") {
        toast("Refund issued.", "success");
      } else {
        toast(`A dispute ticket was opened: ${r.ticketId}.`, "info");
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
      toast((err as Error).message, "error");
    } finally {
      setDownloadingId(null);
    }
  }

  async function markDelivered(orderId: string) {
    try {
      await api(`/marketplace/orders/${orderId}/mark-delivered`, { method: "POST" });
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  const filtered = (items ?? [])
    .filter((o) => statusFilter === "all" || o.status === statusFilter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalSpent = (items ?? [])
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + o.priceCents, 0);
  const paidCount = (items ?? []).filter((o) => o.status === "paid").length;

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Library</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">My orders</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Marketplace purchases and downloads
          </p>
        </div>
        <Link href="/marketplace" className="btn-ghost shrink-0">
          Browse marketplace
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {items === null && !error && (
        <div className="mt-8 flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
        </div>
      )}

      {/* Stats */}
      {items && items.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-ink">{items.length}</div>
            <div className="text-xs text-ink-faded">Total orders</div>
          </div>
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-green-700">{paidCount}</div>
            <div className="text-xs text-ink-faded">Completed</div>
          </div>
          <div className="card p-3 text-center">
            <div className="font-display text-lg text-ink">
              {formatMoney(totalSpent, items[0]?.currency ?? "TND", { trim: true })}
            </div>
            <div className="text-xs text-ink-faded">Total spent</div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {items && items.length > 0 && (
        <div className="mt-6 flex gap-1 border-b border-ink-faded/20">
          {(["all", "paid", "pending", "refunded", "cancelled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`border-b-2 px-3 py-2 text-xs font-medium capitalize transition ${
                statusFilter === f
                  ? "border-seal text-seal"
                  : "border-transparent text-ink-faded hover:text-ink"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {items && items.length === 0 && (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parchment-dark">
            <span className="text-2xl">🛒</span>
          </div>
          <p className="mt-4 font-display text-lg text-ink">No orders yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            Browse the marketplace to find study materials and resources.
          </p>
          <Link href="/marketplace" className="btn-seal mt-4 inline-block">
            Browse marketplace
          </Link>
        </div>
      )}

      {/* Order list */}
      {filtered.length > 0 && (
        <ul className="mt-4 space-y-3">
          {filtered.map((o) => {
            const st = STATUS_STYLES[o.status];
            const ship = o.shippingStatus ? SHIPPING_STYLES[o.shippingStatus] : null;
            return (
              <li key={o.orderId} className="card overflow-hidden">
                <div className="flex items-start gap-4 p-4">
                  {/* Kind icon */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-parchment-dark">
                    <span className="text-xl">
                      {o.kind === "physical" ? "📦" : "📄"}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/marketplace/listings/${o.listingId}` as never}
                        className="font-display text-base text-ink hover:text-seal transition"
                      >
                        {o.listingTitle || o.listingId}
                      </Link>
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${st.bg} ${st.color}`}>
                        {st.label}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-faded">
                      <span className="font-medium text-ink">
                        {formatMoney(o.priceCents, o.currency, { trim: true })}
                      </span>
                      <span>
                        {new Date(o.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="capitalize">{o.kind ?? "digital"}</span>
                    </div>

                    {/* Shipping info */}
                    {o.kind === "physical" && ship && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`rounded-full border border-ink-faded/20 bg-parchment-dark px-2.5 py-0.5 text-[10px] font-medium ${ship.color}`}>
                          {ship.label}
                        </span>
                        {o.trackingNumber && (
                          <span className="text-xs text-ink-faded">
                            {o.shippingCarrier ?? "Tracking"}: <span className="font-mono">{o.trackingNumber}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {o.status === "paid" && o.kind !== "physical" && (
                      <button
                        onClick={() => downloadFile(o.listingId)}
                        disabled={downloadingId === o.listingId}
                        className="rounded-md border border-seal/40 bg-seal/10 px-3 py-1.5 text-xs font-medium text-seal transition hover:bg-seal/20"
                      >
                        {downloadingId === o.listingId ? "Preparing..." : "Download"}
                      </button>
                    )}
                    {o.status === "paid" && o.kind === "physical" && o.shippingStatus === "shipped" && (
                      <button
                        onClick={() => markDelivered(o.orderId)}
                        className="rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-100"
                      >
                        Mark delivered
                      </button>
                    )}
                    {o.status === "paid" && (
                      <button
                        onClick={() => requestRefund(o.orderId)}
                        disabled={refundingId === o.orderId}
                        className="rounded-md border border-ink-faded/30 px-3 py-1.5 text-xs text-ink-faded transition hover:border-red-200 hover:text-red-600"
                      >
                        {refundingId === o.orderId ? "Processing..." : "Request refund"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Download link expiry notice */}
                {o.status === "paid" && o.kind !== "physical" && (
                  <div className="border-t border-ink-faded/15 bg-parchment-dark px-4 py-2 text-xs text-ink-faded">
                    Download links expire after 15 minutes. You can generate a new link anytime.
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Count */}
      {filtered.length > 0 && (
        <p className="mt-4 text-center text-xs text-ink-faded">
          Showing {filtered.length} order{filtered.length !== 1 ? "s" : ""}
        </p>
      )}
    </main>
  );
}
