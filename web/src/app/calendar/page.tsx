"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Session = {
  sessionId: string;
  classroomId: string;
  teacherId: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "live" | "completed" | "cancelled";
};

const STATUS_COLORS: Record<Session["status"], string> = {
  scheduled: "text-ink",
  live: "text-seal",
  completed: "text-ink-faded",
  cancelled: "text-seal",
};

export default function CalendarPage() {
  const router = useRouter();
  const [items, setItems] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      try {
        const r = await api<{ items: Session[] }>(`/sessions/upcoming`);
        setItems(r.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  const grouped = groupByDay(items ?? []);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Schedule</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Upcoming sessions</h1>
      <p className="mt-1 text-sm text-ink-soft">Everything scheduled from now forward.</p>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No upcoming sessions.</p>
      )}

      {grouped.map((day) => (
        <section key={day.date} className="mt-8">
          <h2 className="eyebrow">{day.label}</h2>
          <ul className="card mt-2 divide-y divide-ink-faded/30">
            {day.items.map((s) => {
              const starts = new Date(s.startsAt);
              const ends = new Date(s.endsAt);
              const joinable =
                s.status === "scheduled" || s.status === "live" ? true : false;
              return (
                <li key={s.sessionId} className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-display text-base text-ink">
                      {starts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} —{" "}
                      {ends.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-faded">
                      Classroom{" "}
                      <span className="font-mono">{s.classroomId.slice(0, 12)}...</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs uppercase tracking-widest ${STATUS_COLORS[s.status]}`}>
                      {s.status}
                    </span>
                    {joinable && (
                      <Link
                        href={`/classroom/${s.sessionId}` as never}
                        className="btn-seal"
                      >
                        Join
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}

function groupByDay(items: Session[]): { date: string; label: string; items: Session[] }[] {
  const map = new Map<string, Session[]>();
  for (const s of items) {
    const d = new Date(s.startsAt);
    const key = d.toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, items]) => ({
      date,
      label:
        date === today
          ? "Today"
          : date === tomorrow
            ? "Tomorrow"
            : new Date(date).toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              }),
      items,
    }));
}
