"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { formatAmount } from "@/lib/money";
import { useToast } from "@/components/Toast";

type ShippingAddress = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
};

type Order = {
  orderId: string;
  listingId: string;
  buyerId: string;
  priceCents: number;
  platformFeeCents: number;
  currency: string;
  status: "pending" | "paid" | "refunded" | "cancelled";
  kind?: "digital" | "physical";
  shippingStatus?: "awaiting_ship" | "shipped" | "delivered" | "cancelled";
  shippingAddress?: ShippingAddress;
  shippingCarrier?: string;
  trackingNumber?: string;
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
  const { toast } = useToast();
  const [items, setItems] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shipOrderId, setShipOrderId] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [shipping, setShipping] = useState(false);

  async function load() {
    try {
      const r = await api<{ items: Order[] }>(`/marketplace/orders/as-seller`);
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

  async function ship(e: React.FormEvent) {
    e.preventDefault();
    if (!shipOrderId) return;
    setShipping(true);
    try {
      await api(`/marketplace/orders/${shipOrderId}/ship`, {
        method: "POST",
        body: JSON.stringify({
          shippingCarrier: carrier.trim(),
          trackingNumber: tracking.trim(),
        }),
      });
      setShipOrderId(null);
      setCarrier("");
      setTracking("");
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setShipping(false);
    }
  }

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
          {items.map((o) => {
            const needsShip =
              o.status === "paid" &&
              o.kind === "physical" &&
              o.shippingStatus === "awaiting_ship";
            return (
              <li key={o.orderId} className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-base text-ink">
                      <Link href={`/marketplace/listings/${o.listingId}` as never} className="font-mono underline">
                        {o.listingId}
                      </Link>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-faded">
                      {new Date(o.createdAt).toLocaleString()} · fee{" "}
                      {formatAmount(o.platformFeeCents, o.currency)} · net{" "}
                      {formatAmount(o.priceCents - o.platformFeeCents, o.currency)} {o.currency}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs uppercase tracking-widest ${STATUS_COLORS[o.status]}`}>{o.status}</span>
                    {o.kind === "physical" && o.shippingStatus && (
                      <span className="rounded-sm border border-ink-faded/50 bg-parchment/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-ink-soft">
                        {o.shippingStatus.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                </div>
                {o.kind === "physical" && o.shippingAddress && (
                  <div className="rounded-md border border-ink-faded/30 bg-parchment/40 p-3 text-xs text-ink">
                    <div className="eyebrow mb-1">Ship to</div>
                    <div>{o.shippingAddress.name}</div>
                    <div>{o.shippingAddress.line1}</div>
                    {o.shippingAddress.line2 && <div>{o.shippingAddress.line2}</div>}
                    <div>
                      {o.shippingAddress.city}
                      {o.shippingAddress.state && `, ${o.shippingAddress.state}`}{" "}
                      {o.shippingAddress.postalCode}
                    </div>
                    <div className="font-mono">{o.shippingAddress.country}</div>
                    {o.shippingAddress.phone && <div>{o.shippingAddress.phone}</div>}
                    {o.trackingNumber && (
                      <div className="mt-2 text-ink-soft">
                        Tracking: {o.shippingCarrier ?? "—"} · {o.trackingNumber}
                      </div>
                    )}
                  </div>
                )}
                {needsShip && shipOrderId !== o.orderId && (
                  <button
                    onClick={() => {
                      setShipOrderId(o.orderId);
                      setCarrier("");
                      setTracking("");
                    }}
                    className="btn-seal"
                  >
                    Mark shipped
                  </button>
                )}
                {shipOrderId === o.orderId && (
                  <form onSubmit={ship} className="space-y-2 border-t border-ink-faded/30 pt-3">
                    <label className="block">
                      <span className="label">Carrier</span>
                      <input
                        required
                        maxLength={60}
                        value={carrier}
                        onChange={(e) => setCarrier(e.target.value)}
                        className="input"
                        placeholder="An Post, DHL…"
                      />
                    </label>
                    <label className="block">
                      <span className="label">Tracking number</span>
                      <input
                        required
                        maxLength={120}
                        value={tracking}
                        onChange={(e) => setTracking(e.target.value)}
                        className="input font-mono"
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={shipping || !carrier.trim() || !tracking.trim()}
                        className="btn-seal"
                      >
                        {shipping ? "Saving..." : "Confirm shipment"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShipOrderId(null)}
                        className="btn-ghost"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
