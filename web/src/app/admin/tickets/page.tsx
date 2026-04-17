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

  if (!ready) return <main className="mx-auto max-w-4xl px-6 py-12">Loading...</main>;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Support tickets</h1>
        <Link href="/admin" className="text-sm text-gray-500 underline">
          ← Admin hub
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="block max-w-xs flex-1">
          <span className="mb-1 block text-sm font-medium">Status</span>
          <select
            className="w-full rounded border px-3 py-2 disabled:opacity-50"
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
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
          />
          SLA-overdue only
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && <p className="mt-6 text-sm text-gray-500">No tickets.</p>}
      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((t) => (
            <li key={t.ticketId}>
              <Link
                href={`/support/${t.ticketId}` as never}
                className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <div>
                  <div className="font-medium">{t.subject}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    #{t.ticketId} · {t.category.replace(/_/g, " ")} · priority {t.priority} · updated{" "}
                    {new Date(t.updatedAt).toLocaleString()}
                  </div>
                  {t.slaDeadline && new Date(t.slaDeadline) < new Date() && (
                    <div className="mt-0.5 text-xs font-medium text-red-600">
                      SLA overdue (deadline {new Date(t.slaDeadline).toLocaleString()})
                    </div>
                  )}
                </div>
                <span className="text-xs uppercase">{t.status.replace(/_/g, " ")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
