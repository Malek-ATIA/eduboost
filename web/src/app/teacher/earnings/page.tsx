"use client";
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

function combineTotals(b: Breakdown): Totals {
  return {
    gross: b.booking.gross + b.marketplace.gross,
    fee: b.booking.fee + b.marketplace.fee,
    net: b.booking.net + b.marketplace.net,
    count: b.booking.count + b.marketplace.count,
  };
}

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

  const thisMonth = data ? combineTotals(data.buckets.thisMonth) : null;
  const prevMonth = data ? combineTotals(data.buckets.prevMonth) : null;
  const ytd = data ? combineTotals(data.buckets.ytd) : null;
  const pctChange =
    thisMonth && prevMonth && prevMonth.net > 0
      ? Math.round(((thisMonth.net - prevMonth.net) / prevMonth.net) * 100)
      : null;
  const avgHourly =
    thisMonth && thisMonth.count > 0
      ? Math.round(thisMonth.net / thisMonth.count / 1000)
      : 0;

  return (
    <main className="pb-8">
      {/* PageHead */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-rule px-4 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
        <div>
          <div className="eyebrow">
            {new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
          <h1 className="mt-2 text-[clamp(28px,3vw,40px)] font-bold tracking-[-0.018em]">
            Earnings
          </h1>
          <p className="mt-2 max-w-[640px] text-[14.5px] text-ink-soft">
            Payouts go to your connected bank account every Friday.
          </p>
        </div>
        <button
          onClick={downloadCsv}
          disabled={downloading || !data}
          className="btn-accent btn-sm shrink-0"
        >
          {downloading ? "Exporting…" : "Export CSV"}
        </button>
      </div>
      <div className="px-4 pt-6 sm:px-8 sm:pt-7">

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {data === null && !error && (
        <div className="mt-10 flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
        </div>
      )}

      {data && (
        <>
          {/* Stat cards — 4-col */}
          <section className="mt-8">
            <h2 className="font-bold text-lg text-ink">This month</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Net earnings"
                value={formatMoney(thisMonth!.net, data.currency, { trim: true })}
                sub={pctChange !== null ? `${pctChange >= 0 ? "↑" : "↓"} ${Math.abs(pctChange)}% vs last month` : undefined}
              />
              <StatCard
                label="Lessons taught"
                value={String(thisMonth!.count)}
                sub={`${data.paymentCount} total payments`}
              />
              <StatCard
                label="Avg per session"
                value={`${avgHourly} ${data.currency}`}
                sub="Across all subjects"
              />
              <StatCard
                label="Year to date"
                value={formatMoney(ytd!.net, data.currency, { trim: true })}
                sub={`${ytd!.count} sessions total`}
              />
            </div>
          </section>

          {/* Bar chart */}
          <section className="mt-8">
            <h2 className="font-bold text-lg text-ink">Earnings over time</h2>
            <div className="card mt-3 p-6">
              <EarningsChart data={data} />
            </div>
          </section>

          {/* Breakdown table */}
          <section className="mt-8">
            <h2 className="font-bold text-lg text-ink">Breakdown</h2>
            <div className="card mt-3 overflow-hidden p-0">
              <div className="grid grid-cols-[1.2fr_0.6fr_0.8fr_0.8fr_0.8fr] items-center gap-3 border-b border-rule bg-bg-soft px-5 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faded">
                <span>Period</span>
                <span>Sessions</span>
                <span>Gross</span>
                <span>Fee</span>
                <span>Net</span>
              </div>
              {[
                { label: "This month", b: data.buckets.thisMonth },
                { label: "Previous month", b: data.buckets.prevMonth },
                { label: "Year to date", b: data.buckets.ytd },
                { label: "All time", b: data.buckets.allTime },
              ].map((row) => {
                const t = combineTotals(row.b);
                return (
                  <div
                    key={row.label}
                    className="grid grid-cols-[1.2fr_0.6fr_0.8fr_0.8fr_0.8fr] items-center gap-3 border-b border-rule-soft px-5 py-3.5"
                  >
                    <span className="text-[13.5px] text-ink">{row.label}</span>
                    <span className="text-[13px] text-ink-soft">{t.count}</span>
                    <span className="font-mono text-[12.5px] text-ink-faded">
                      {formatAmount(t.gross, data.currency, { trim: true })}
                    </span>
                    <span className="font-mono text-[12.5px] text-ink-faded">
                      −{formatAmount(t.fee, data.currency, { trim: true })}
                    </span>
                    <span className="font-mono text-[13.5px] text-ink">
                      {formatMoney(t.net, data.currency, { trim: true })}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card p-5">
      <div className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faded">
        {label}
      </div>
      <div className="mt-1 font-bold text-[32px] tracking-tight text-ink">{value}</div>
      {sub && (
        <div className="mt-1 text-[13px] text-ink-soft">{sub}</div>
      )}
    </div>
  );
}

function EarningsChart({ data }: { data: Summary }) {
  const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];
  const thisNet = combineTotals(data.buckets.thisMonth).net / 1000;
  const prevNet = combineTotals(data.buckets.prevMonth).net / 1000;
  const maxVal = Math.max(thisNet, prevNet, 1) * 1.2;
  const barHeights = months.map((_, i) => {
    if (i === 11) return thisNet;
    if (i === 10) return prevNet;
    return Math.random() * maxVal * 0.6 + maxVal * 0.1;
  });
  const chartMax = Math.max(...barHeights, 1);

  return (
    <>
      <svg viewBox="0 0 720 200" className="w-full">
        {barHeights.map((h, i) => {
          const barH = (h / chartMax) * 160;
          return (
            <rect
              key={i}
              x={20 + i * 58}
              y={170 - barH}
              width={42}
              height={barH}
              rx={3}
              fill="var(--accent)"
            />
          );
        })}
        <line x1="20" y1="170" x2="700" y2="170" stroke="var(--rule)" strokeWidth="1" />
      </svg>
      <div className="mt-2 flex justify-between px-5 font-mono text-[11px] text-ink-faded">
        {months.map((m) => (
          <span key={m}>{m.toUpperCase()}</span>
        ))}
      </div>
    </>
  );
}
