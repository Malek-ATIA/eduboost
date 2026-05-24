"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Notification = {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  linkPath?: string;
  readAt?: string;
  createdAt: string;
};

type FilterKey = "all" | "session" | "message" | "grade" | "payment" | "booking";

const TYPE_ICONS: Record<string, string> = {
  booking: "📅",
  session: "🎓",
  message: "✉️",
  grade: "📊",
  payment: "💳",
  review: "⭐",
  system: "🔔",
};

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "session", label: "Sessions" },
  { key: "message", label: "Messages" },
  { key: "grade", label: "Achievements" },
  { key: "payment", label: "Payments" },
  { key: "booking", label: "Bookings" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupByDate(items: Notification[]): { label: string; items: Notification[] }[] {
  const groups: Record<string, Notification[]> = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const weekAgo = Date.now() - 7 * 86_400_000;

  for (const n of items) {
    const d = new Date(n.createdAt);
    const ds = d.toDateString();
    let label: string;
    if (ds === today) label = "Today";
    else if (ds === yesterday) label = "Yesterday";
    else if (d.getTime() > weekAgo) label = "This week";
    else label = "Earlier";
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }

  const order = ["Today", "Yesterday", "This week", "Earlier"];
  return order
    .filter((l) => groups[l])
    .map((label) => ({ label, items: groups[label] }));
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: Notification[] }>(`/notifications`);
      setItems(r.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      load();
    })();
  }, [router, load]);

  async function markOne(n: Notification) {
    if (n.readAt) return;
    try {
      await api(`/notifications/${encodeURIComponent(n.notificationId)}/read`, { method: "POST" });
      setItems((prev) =>
        prev?.map((x) =>
          x.notificationId === n.notificationId ? { ...x, readAt: new Date().toISOString() } : x,
        ) ?? null,
      );
    } catch {}
  }

  async function markAll() {
    try {
      await api(`/notifications/read-all`, { method: "POST" });
      const now = new Date().toISOString();
      setItems((prev) => prev?.map((x) => (x.readAt ? x : { ...x, readAt: now })) ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const unreadCount = (items ?? []).filter((n) => !n.readAt).length;

  const filtered = (items ?? [])
    .filter((n) => filter === "all" || n.type === filter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const groups = groupByDate(filtered);

  const countByType = (type: FilterKey) => {
    if (type === "all") return (items ?? []).length;
    return (items ?? []).filter((n) => n.type === type).length;
  };

  return (
    <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
      {/* Page head */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Notifications</div>
          <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl lg:text-7xl">
            What&apos;s <span className="italic">new</span>.
          </h1>
          <p className="mt-3 text-base text-ink-soft">
            {unreadCount > 0
              ? `${unreadCount} unread. Everything older than 30 days is archived automatically.`
              : "You're all caught up. Everything older than 30 days is archived automatically."}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAll} className="btn-ghost text-sm">
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {items === null && !error && (
        <div className="mt-10 flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
        </div>
      )}

      {items && items.length === 0 && (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-bg-soft">
            <span className="text-2xl">🔔</span>
          </div>
          <p className="mt-4 font-serif text-lg text-ink">No notifications yet</p>
          <p className="mt-3 text-sm text-ink-soft">
            We&apos;ll notify you about bookings, messages, grades, and more.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="notif-grid mt-8 grid gap-8" style={{ gridTemplateColumns: "240px 1fr" }}>
          {/* Filter rail */}
          <aside>
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faded">
              Filter
            </div>
            <div className="mt-2.5 flex flex-col gap-1">
              {FILTER_OPTIONS.map((f) => {
                const count = countByType(f.key);
                const isActive = filter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[13.5px] transition ${
                      isActive
                        ? "border border-rule bg-bg-soft font-medium text-ink"
                        : "border border-transparent text-ink-soft hover:text-ink"
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className="font-mono text-[11px] text-ink-faded">{count}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Notification groups */}
          <div>
            {groups.length === 0 && (
              <div className="py-8 text-center text-sm text-ink-faded">
                No notifications match this filter.
              </div>
            )}
            {groups.map((g) => (
              <div key={g.label} className="mb-6">
                <div className="mb-2.5 px-1 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faded">
                  {g.label}
                </div>
                <div className="card divide-y divide-rule-soft overflow-hidden p-0">
                  {g.items.map((n) => {
                    const icon = TYPE_ICONS[n.type] ?? TYPE_ICONS.system;
                    const inner = (
                      <div
                        className={`flex items-center gap-3.5 px-[18px] py-4 transition ${
                          n.readAt ? "bg-white" : "bg-bg-soft"
                        } hover:bg-bg-soft`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            n.readAt
                              ? "bg-bg-soft text-ink-soft"
                              : "bg-accent text-white"
                          }`}
                        >
                          <span className="text-sm">{icon}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm ${n.readAt ? "" : "font-medium"}`}>
                            {n.title}
                          </div>
                          <div className="mt-0.5 text-[12.5px] text-ink-faded">{n.body}</div>
                        </div>
                        <span className="shrink-0 font-mono text-[11.5px] text-ink-faded">
                          {timeAgo(n.createdAt)}
                        </span>
                        {!n.readAt && (
                          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
                        )}
                      </div>
                    );

                    return (
                      <div
                        key={n.notificationId}
                        onClick={() => markOne(n)}
                        className="cursor-pointer"
                      >
                        {n.linkPath ? (
                          <Link href={n.linkPath as never} className="block">
                            {inner}
                          </Link>
                        ) : (
                          inner
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
