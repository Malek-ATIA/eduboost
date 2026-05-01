"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { currentSession } from "@/lib/cognito";
import { Bell } from "lucide-react";

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
      className="relative inline-flex items-center gap-1.5 rounded-md border border-ink-faded/50 bg-parchment-dark/60 px-3 py-1.5 text-sm text-ink-soft transition hover:border-ink-faded hover:bg-parchment-shade hover:text-ink"
      aria-label={`Notifications (${count} unread)`}
    >
      <Bell size={16} />
      {count > 0 && (
        <span className="min-w-[1.25rem] rounded-full bg-seal px-1.5 text-center text-xs font-medium text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
