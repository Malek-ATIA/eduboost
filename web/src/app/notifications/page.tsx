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

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Inbox</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Notifications</h1>
        </div>
        <button onClick={markAll} className="btn-ghost">
          Mark all read
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">You're all caught up.</p>
      )}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-ink-faded/30">
          {items.map((n) => {
            const content = (
              <div className={`flex items-start justify-between gap-3 p-4 ${n.readAt ? "opacity-60" : ""}`}>
                <div>
                  <div className="font-display text-base text-ink">{n.title}</div>
                  <div className="mt-0.5 text-sm text-ink-soft">{n.body}</div>
                  <div className="mt-1 text-xs text-ink-faded">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
                {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-seal" />}
              </div>
            );
            return (
              <li key={n.notificationId} onClick={() => markOne(n)}>
                {n.linkPath ? (
                  <Link href={n.linkPath as never} className="block transition hover:bg-parchment-shade">
                    {content}
                  </Link>
                ) : (
                  <div className="block">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
