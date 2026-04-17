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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button onClick={markAll} className="rounded border px-3 py-1 text-sm">
          Mark all read
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">You're all caught up.</p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((n) => {
            const content = (
              <div className={`flex items-start justify-between gap-3 p-4 ${n.readAt ? "opacity-60" : ""}`}>
                <div>
                  <div className="font-medium">{n.title}</div>
                  <div className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{n.body}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
                {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
              </div>
            );
            return (
              <li key={n.notificationId} onClick={() => markOne(n)}>
                {n.linkPath ? (
                  <Link href={n.linkPath as never} className="block hover:bg-gray-50 dark:hover:bg-gray-900">
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
