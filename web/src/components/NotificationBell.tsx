"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { currentSession } from "@/lib/cognito";

export function NotificationBell() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function refresh() {
      try {
        const session = await currentSession();
        if (!session) {
          if (!stopped) setCount(null);
          return;
        }
        const r = await api<{ count: number }>(`/notifications/unread-count`);
        if (!stopped) setCount(r.count);
      } catch {
        // silent
      }
    }

    refresh();
    timer = setInterval(refresh, 30_000);
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  if (count === null) return null;

  return (
    <Link
      href="/notifications"
      className="relative inline-flex items-center rounded-md border border-ink-faded/50 bg-parchment-dark/60 px-3 py-1 text-sm text-ink transition hover:border-ink-faded hover:bg-parchment-shade"
      aria-label={`Notifications (${count} unread)`}
    >
      <span>Notifications</span>
      {count > 0 && (
        <span className="ml-2 min-w-[1.25rem] rounded-full bg-seal px-1.5 text-center text-xs text-parchment">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
