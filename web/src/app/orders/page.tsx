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
  pending: "text-yellow-700",
  paid: "text-green-700",
  refunded: "text-gray-500",
  cancelled: "text-red-700",
};

export default function OrdersPage() {
  const router = useRouter();
  const [items, setItems] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      try {
        const r = await api<{ items: Order[] }>(`/marketplace/orders/mine`);
        setItems(r.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">My orders</h1>
      <p className="mt-1 text-sm text-gray-500">Marketplace purchases. Download links expire after 15 minutes.</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">
          No purchases yet. <Link className="underline" href="/marketplace">Browse the marketplace</Link>.
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((o) => (
            <li key={o.orderId} className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">
                  <Link href={`/marketplace/listings/${o.listingId}` as never} className="underline">
                    {o.listingId}
                  </Link>
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {new Date(o.createdAt).toLocaleString()} · {o.currency}{" "}
                  {(o.priceCents / 100).toFixed(2)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs uppercase ${STATUS_COLORS[o.status]}`}>{o.status}</span>
                {o.status === "paid" && (
                  <button
                    onClick={() => downloadFile(o.listingId)}
                    disabled={downloadingId === o.listingId}
                    className="rounded border px-3 py-1 text-xs disabled:opacity-50"
                  >
                    {downloadingId === o.listingId ? "..." : "Download"}
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
