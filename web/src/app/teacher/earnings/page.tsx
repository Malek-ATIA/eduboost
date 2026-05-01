"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { env } from "@/lib/env";
import { formatMoney, formatAmount } from "@/lib/money";
import { useToast } from "@/components/Toast";

type Totals = { gross: number; fee: number; net: number; count: number };
type Breakdown = { booking: Totals; marketplace: Totals };
type Summary = {
  currency: string;
  paymentCount: number;
  generatedAt: string;
  buckets: {
    allTime: Breakdown;
    ytd: Breakdown;
    thisMonth: Breakdown;
    prevMonth: Breakdown;
  };
};

export default function EarningsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (currentRole(session) !== "teacher") return router.replace("/dashboard");
      try {
        const r = await api<Summary>(`/reports/teacher/summary`);
        setData(r);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  async function downloadCsv() {
    setDownloading(true);
    try {
      const session = await currentSession();
      if (!session) throw new Error("Not authenticated");
      const token = session.getAccessToken().getJwtToken();
      const res = await fetch(`${env.apiUrl}/reports/teacher/export.csv`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`CSV export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eduboost-earnings-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Teacher</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Earnings</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Session and marketplace income, net of the 15% platform fee.
          </p>
        </div>
        <button
          onClick={downloadCsv}
          disabled={downloading || !data}
          className="btn-secondary"
        >
          {downloading ? "..." : "Download CSV"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {data === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}

      {data && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Bucket label="This month" breakdown={data.buckets.thisMonth} currency={data.currency} />
          <Bucket label="Previous month" breakdown={data.buckets.prevMonth} currency={data.currency} />
          <Bucket label="Year to date" breakdown={data.buckets.ytd} currency={data.currency} />
          <Bucket label="All time" breakdown={data.buckets.allTime} currency={data.currency} />
        </div>
      )}
</main>
  );
}

function Bucket({
  label,
  breakdown,
  currency,
}: {
  label: string;
  breakdown: Breakdown;
  currency: string;
}) {
  const total = {
    gross: breakdown.booking.gross + breakdown.marketplace.gross,
    fee: breakdown.booking.fee + breakdown.marketplace.fee,
    net: breakdown.booking.net + breakdown.marketplace.net,
    count: breakdown.booking.count + breakdown.marketplace.count,
  };
  return (
    <div className="card p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 font-display text-3xl text-ink">
        {formatMoney(total.net, currency, { trim: true })}
      </div>
      <div className="mt-1 text-xs text-ink-faded">
        {total.count} payment{total.count === 1 ? "" : "s"} · gross{" "}
        {formatAmount(total.gross, currency, { trim: true })} · fee {formatAmount(total.fee, currency, { trim: true })}
      </div>
      <dl className="mt-4 space-y-1 text-sm">
        <Row label="Sessions" t={breakdown.booking} currency={currency} />
        <Row label="Marketplace" t={breakdown.marketplace} currency={currency} />
      </dl>
    </div>
  );
}

function Row({ label, t, currency }: { label: string; t: Totals; currency: string }) {
  return (
    <div className="flex items-center justify-between text-ink-soft">
      <dt>{label}</dt>
      <dd>
        {formatMoney(t.net, currency, { trim: true })}{" "}
        <span className="text-xs text-ink-faded">({t.count})</span>
      </dd>
    </div>
  );
}
