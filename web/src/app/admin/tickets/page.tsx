"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";

type Ticket = {
  ticketId: string;
  userId: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  slaDeadline?: string;
  createdAt: string;
  updatedAt: string;
};

const STATUSES = ["open", "in_review", "awaiting_user", "resolved", "closed"] as const;

export default function AdminTicketsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<(typeof STATUSES)[number] | "">("open");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [items, setItems] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (!isAdmin(session)) return router.replace("/dashboard");
      setReady(true);
    })();
  }, [router]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }, [status]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setItems(null);
    setError(null);
    const path = overdueOnly
      ? `/admin/disputes/overdue`
      : `/admin/tickets${queryString}`;
    api<{ items: Ticket[] }>(path)
      .then((r) => !cancelled && setItems(r.items))
      .catch((err) => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
    };
  }, [ready, queryString, overdueOnly]);

  if (!ready) {
    return (
      <main className="pb-8">
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
        </div>
      </main>
    );
  }

  return (
    <main className="pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="mt-3 text-[clamp(28px,3vw,40px)] font-bold tracking-[-0.018em]">
            Support tickets
          </h1>
        </div>
        <Link href="/admin" className="btn-ghost">
          ← Back to admin
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="block max-w-xs flex-1">
          <span className="label">Status</span>
          <select
            className="input disabled:opacity-50"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            disabled={overdueOnly}
          >
            <option value="">(all — scan)</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="accent-[#1f4a3a]"
          />
          SLA-overdue only
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && <p className="mt-6 text-sm text-ink-soft">No tickets.</p>}
      {items && items.length > 0 && (
        <div className="card mt-6 overflow-hidden p-0">
          {items.map((t, i) => (
            <Link
              key={t.ticketId}
              href={`/support/${t.ticketId}` as never}
              className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-bg-soft"
              style={i > 0 ? { borderTop: "1px solid var(--rule-soft)" } : undefined}
            >
              <span className="shrink-0 font-mono text-[11.5px] text-ink-faded">
                #{t.ticketId.slice(0, 8)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] text-ink">{t.subject}</div>
                {t.slaDeadline && new Date(t.slaDeadline) < new Date() && (
                  <div className="text-xs font-medium text-red-600">SLA overdue</div>
                )}
              </div>
              <span className="text-[12.5px] text-ink-soft">{t.userId.slice(0, 10)}…</span>
              <span
                className="chip text-xs"
                style={{
                  background:
                    t.priority === "high"
                      ? "#fae9e7"
                      : t.priority === "medium"
                        ? "#fff5d4"
                        : "var(--bg-soft)",
                  color: t.priority === "high" ? "#7a201a" : "var(--ink)",
                }}
              >
                {t.priority}
              </span>
              <span className="font-mono text-xs text-ink-faded">
                {new Date(t.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
