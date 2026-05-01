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

type FilterTab = "all" | "unread";

const TYPE_META: Record<string, { icon: string; color: string }> = {
  booking: { icon: "📅", color: "bg-blue-50 text-blue-700" },
  session: { icon: "🎓", color: "bg-green-50 text-green-700" },
  message: { icon: "✉️", color: "bg-purple-50 text-purple-700" },
  grade: { icon: "📊", color: "bg-amber-50 text-amber-700" },
  payment: { icon: "💳", color: "bg-emerald-50 text-emerald-700" },
  review: { icon: "⭐", color: "bg-yellow-50 text-yellow-700" },
  system: { icon: "🔔", color: "bg-parchment-dark text-ink-soft" },
};

function getTypeMeta(type: string) {
  return TYPE_META[type] ?? TYPE_META.system;
}

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

  for (const n of items) {
    const d = new Date(n.createdAt).toDateString();
    let label: string;
    if (d === today) label = "Today";
    else if (d === yesterday) label = "Yesterday";
    else label = new Date(n.createdAt).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }

  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");

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
    } catch {
      // swallow
    }
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
    .filter((n) => filter === "all" || !n.readAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const groups = groupByDate(filtered);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Inbox</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Notifications</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAll} className="btn-ghost shrink-0">
            Mark all read
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}

      {/* Loading */}
      {items === null && !error && (
        <div className="mt-8 flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
        </div>
      )}

      {/* Stats bar */}
      {items && items.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-ink">{items.length}</div>
            <div className="text-xs text-ink-faded">Total</div>
          </div>
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-seal">{unreadCount}</div>
            <div className="text-xs text-ink-faded">Unread</div>
          </div>
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-green-700">{items.length - unreadCount}</div>
            <div className="text-xs text-ink-faded">Read</div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {items && items.length > 0 && (
        <div className="mt-6 flex gap-1 border-b border-ink-faded/20">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`border-b-2 px-4 py-2 text-xs font-medium capitalize transition ${
                filter === f
                  ? "border-seal text-seal"
                  : "border-transparent text-ink-faded hover:text-ink"
              }`}
            >
              {f}
              {f === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 rounded-full bg-seal/15 px-1.5 py-0.5 text-[10px] text-seal">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {items && items.length === 0 && (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parchment-dark">
            <span className="text-2xl">🔔</span>
          </div>
          <p className="mt-4 font-display text-lg text-ink">No notifications yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            We'll notify you about bookings, messages, grades, and more.
          </p>
        </div>
      )}

      {/* Empty filtered state */}
      {items && items.length > 0 && filtered.length === 0 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-ink-soft">No unread notifications</p>
          <button
            onClick={() => setFilter("all")}
            className="mt-2 text-sm text-seal hover:underline"
          >
            Show all notifications
          </button>
        </div>
      )}

      {/* Grouped notification list */}
      {groups.map((group) => (
        <div key={group.label} className="mt-6">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-widest text-ink-faded">
            {group.label}
          </h3>
          <ul className="space-y-2">
            {group.items.map((n) => {
              const meta = getTypeMeta(n.type);
              const inner = (
                <div
                  className={`flex items-start gap-3 rounded-lg border p-4 transition ${
                    n.readAt
                      ? "border-ink-faded/15 bg-parchment opacity-70"
                      : "border-ink-faded/25 bg-parchment shadow-sm"
                  } hover:shadow-md`}
                >
                  {/* Type icon */}
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
                    <span className="text-sm">{meta.icon}</span>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-sm ${n.readAt ? "text-ink-soft" : "font-medium text-ink"}`}>
                        {n.title}
                      </h4>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-ink-faded">{timeAgo(n.createdAt)}</span>
                        {!n.readAt && (
                          <span className="h-2 w-2 rounded-full bg-seal" />
                        )}
                      </div>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-soft">{n.body}</p>
                    {n.linkPath && (
                      <span className="mt-1 inline-block text-xs text-seal">
                        View details →
                      </span>
                    )}
                  </div>
                </div>
              );

              return (
                <li key={n.notificationId} onClick={() => markOne(n)} className="cursor-pointer">
                  {n.linkPath ? (
                    <Link href={n.linkPath as never} className="block">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </main>
  );
}
