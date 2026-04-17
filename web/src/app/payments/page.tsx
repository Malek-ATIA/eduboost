"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, type Role } from "@/lib/cognito";
import { api } from "@/lib/api";
import { env } from "@/lib/env";

type Payment = {
  paymentId: string;
  bookingId: string;
  amountCents: number;
  platformFeeCents: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  provider: string;
  createdAt: string;
};

const STATUS_COLORS: Record<Payment["status"], string> = {
  pending: "text-yellow-700",
  succeeded: "text-green-700",
  failed: "text-red-700",
  refunded: "text-gray-500",
};

export default function PaymentsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      const r = currentRole(session);
      setRole(r);
      const endpoint = r === "teacher" ? "/payments/received" : "/payments/mine";
      try {
        const res = await api<{ items: Payment[] }>(endpoint);
        setItems(res.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  async function downloadInvoice(paymentId: string) {
    setDownloadingId(paymentId);
    try {
      const session = await currentSession();
      if (!session) throw new Error("Not authenticated");
      const token = session.getAccessToken().getJwtToken();
      const res = await fetch(`${env.apiUrl}/payments/${paymentId}/invoice`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Invoice download failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eduboost-invoice-${paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  }

  const isTeacher = role === "teacher";
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">
        {isTeacher ? "Payments received" : "Payment history"}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {isTeacher
          ? "Session payouts paid to you. Download invoices for your records."
          : "All payments you\u2019ve made. Download invoices for your records."}
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No payments yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((p) => (
            <li key={p.paymentId} className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">
                  {p.currency} {(p.amountCents / 100).toFixed(2)}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {new Date(p.createdAt).toLocaleString()} · booking{" "}
                  <Link href={`/bookings`} className="font-mono underline">
                    {p.bookingId}
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs uppercase ${STATUS_COLORS[p.status]}`}>
                  {p.status}
                </span>
                {p.status === "succeeded" && (
                  <button
                    onClick={() => downloadInvoice(p.paymentId)}
                    disabled={downloadingId === p.paymentId}
                    className="rounded border px-3 py-1 text-xs disabled:opacity-50"
                  >
                    {downloadingId === p.paymentId ? "..." : "Invoice"}
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
