"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Session = {
  sessionId: string;
  classroomId: string;
  teacherId: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "live" | "completed" | "cancelled" | "booked";
  title?: string;
  teacherName?: string;
  childName?: string;
  color?: string;
};

type Booking = {
  bookingId: string;
  teacherId: string;
  studentId: string;
  classroomId?: string;
  type: string;
  status: string;
  priceCents: number;
  currency: string;
  createdAt: string;
  childName?: string;
  teacherName?: string;
};

type FamilyCalendar = {
  sessions: (Session & { childName?: string })[];
  bookings: (Booking & { childName?: string })[];
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type View = "day" | "week" | "month";

const HOUR_HEIGHT = 50;
const START_HOUR = 7;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) =>
  String(START_HOUR + i).padStart(2, "0") + ":00",
);

export default function CalendarPage() {
  const router = useRouter();
  const [items, setItems] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("week");
  const [current, setCurrent] = useState(() => new Date());
  const [isParent, setIsParent] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      const role = currentRole(session);
      const parentMode = role === "parent";
      setIsParent(parentMode);

      try {
        if (parentMode) {
          const family = await api<FamilyCalendar>(`/family/calendar`);
          const sessions: Session[] = family.sessions.map((s) => ({ ...s, childName: s.childName }));
          const bookingItems: Session[] = family.bookings.map((b) => {
            const created = new Date(b.createdAt);
            const end = new Date(created.getTime() + 60 * 60_000);
            return {
              sessionId: b.bookingId,
              classroomId: b.classroomId ?? "",
              teacherId: b.teacherId,
              startsAt: created.toISOString(),
              endsAt: end.toISOString(),
              status: "booked" as const,
              childName: b.childName,
              teacherName: b.teacherName,
            };
          });
          setItems([...sessions, ...bookingItems]);
        } else {
          const [sessionsRes, bookingsRes] = await Promise.all([
            api<{ items: Session[] }>(`/sessions/upcoming`).catch(() => ({ items: [] as Session[] })),
            api<{ items: Booking[] }>(`/bookings/mine`).catch(() => ({ items: [] as Booking[] })),
          ]);
          const bookingItems: Session[] = bookingsRes.items
            .filter((b) => b.status === "confirmed" || b.status === "completed")
            .map((b) => {
              const created = new Date(b.createdAt);
              const end = new Date(created.getTime() + 60 * 60_000);
              return {
                sessionId: b.bookingId,
                classroomId: b.classroomId ?? "",
                teacherId: b.teacherId,
                startsAt: created.toISOString(),
                endsAt: end.toISOString(),
                status: "booked" as const,
                teacherName: b.teacherName,
              };
            });
          setItems([...sessionsRes.items, ...bookingItems]);
        }
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  // Compute the week of `current`
  const weekDays = useMemo(() => {
    const d = new Date(current);
    const dow = (d.getDay() + 6) % 7; // 0 = Mon
    d.setDate(d.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(d);
      day.setDate(d.getDate() + i);
      day.setHours(0, 0, 0, 0);
      return day;
    });
  }, [current]);

  const todayKey = useMemo(() => {
    const d = new Date();
    return d.toDateString();
  }, []);

  // Group sessions by day index in the current week
  const sessionsByDay = useMemo<Session[][]>(() => {
    const map: Session[][] = Array.from({ length: 7 }, () => []);
    for (const s of items ?? []) {
      const start = new Date(s.startsAt);
      const dayIdx = weekDays.findIndex((d) => d.toDateString() === start.toDateString());
      if (dayIdx >= 0) map[dayIdx].push(s);
    }
    return map;
  }, [items, weekDays]);

  function navigate(delta: number) {
    setCurrent((prev) => {
      const d = new Date(prev);
      if (view === "month") d.setMonth(d.getMonth() + delta);
      else if (view === "week") d.setDate(d.getDate() + 7 * delta);
      else d.setDate(d.getDate() + delta);
      return d;
    });
  }

  function colorFor(s: Session): string {
    if (s.status === "cancelled") return "#b2362c";
    if (s.status === "live") return "var(--accent-deep)";
    if (s.status === "booked") return "var(--accent)";
    return "var(--accent)";
  }

  return (
    <main className="pb-8">
      {/* PageHead */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-rule px-4 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
        <div>
          <div className="eyebrow">
            {MONTHS[current.getMonth()]} {current.getFullYear()}
          </div>
          <h1 className="mt-2 text-[clamp(28px,3vw,40px)] font-bold tracking-[-0.018em]">
            {isParent ? "Family calendar" : "Your schedule"}
          </h1>
          <p className="mt-2 max-w-[640px] text-[14.5px] text-ink-soft">
            All your tutoring sessions across teachers — at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-rule bg-white p-[3px]">
            {(["day", "week", "month"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium capitalize transition"
                style={{
                  background: view === v ? "var(--ink)" : "transparent",
                  color: view === v ? "#fff" : "var(--ink-soft)",
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <button className="btn-outline btn-sm">Sync to Google</button>
        </div>
      </div>

      <div className="px-4 pt-6 sm:px-8 sm:pt-7">
        {error && <p className="mb-4 text-sm text-warn">{error}</p>}

        {items === null && !error && (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
          </div>
        )}

        {items && view === "week" && (
          <div className="card overflow-hidden p-0">
            {/* Day headers */}
            <div
              className="grid border-b border-rule"
              style={{ gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))" }}
            >
              <div />
              {weekDays.map((d) => {
                const isToday = d.toDateString() === todayKey;
                return (
                  <div
                    key={d.toDateString()}
                    className="border-l border-rule-soft px-2 py-3 text-center"
                  >
                    <div className="font-mono text-[11px] tracking-[0.05em] text-ink-faded">
                      {WEEKDAYS[(d.getDay() + 6) % 7]}
                    </div>
                    <div
                      className="mt-1 text-[22px] font-bold leading-none"
                      style={{ color: isToday ? "var(--accent)" : "var(--ink)" }}
                    >
                      {d.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Hour grid + sessions */}
            <div
              className="relative grid"
              style={{ gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))" }}
            >
              {/* Hour gutter */}
              <div>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="border-t border-rule-soft px-2 py-0.5 font-mono text-[10.5px] text-ink-faded"
                    style={{ height: HOUR_HEIGHT }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((d, di) => (
                <div key={d.toDateString()} className="relative border-l border-rule-soft">
                  {HOURS.map((h) => (
                    <div key={h} className="border-t border-rule-soft" style={{ height: HOUR_HEIGHT }} />
                  ))}
                  {sessionsByDay[di]?.map((s) => {
                    const start = new Date(s.startsAt);
                    const end = new Date(s.endsAt);
                    const startHrs = start.getHours() + start.getMinutes() / 60;
                    const endHrs = end.getHours() + end.getMinutes() / 60;
                    const top = (startHrs - START_HOUR) * HOUR_HEIGHT;
                    const height = Math.max(28, (endHrs - startHrs) * HOUR_HEIGHT);
                    if (top + height < 0 || top > HOURS.length * HOUR_HEIGHT) return null;
                    return (
                      <Link
                        key={s.sessionId}
                        href={`/classroom/${s.sessionId}` as never}
                        className="absolute overflow-hidden rounded-md px-2 py-1.5 text-[11.5px] text-white"
                        style={{
                          left: 4,
                          right: 4,
                          top,
                          height,
                          background: colorFor(s),
                          cursor: "pointer",
                        }}
                      >
                        <div className="font-medium leading-tight">
                          {s.title ?? (s.childName ? `${s.childName}'s session` : "Session")}
                        </div>
                        <div className="mt-0.5 text-[10.5px] opacity-80">
                          {s.teacherName ?? s.teacherId.slice(0, 6)}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {items && view === "day" && (
          <div className="card overflow-hidden p-0">
            <div className="border-b border-rule px-5 py-3 text-center">
              <div className="font-mono text-[11px] uppercase text-ink-faded">
                {WEEKDAYS[(current.getDay() + 6) % 7]}
              </div>
              <div className="mt-1 text-[28px] font-bold leading-none">{current.getDate()}</div>
            </div>
            <div className="relative grid" style={{ gridTemplateColumns: "60px minmax(0, 1fr)" }}>
              <div>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="border-t border-rule-soft px-2 py-0.5 font-mono text-[10.5px] text-ink-faded"
                    style={{ height: HOUR_HEIGHT }}
                  >
                    {h}
                  </div>
                ))}
              </div>
              <div className="relative border-l border-rule-soft">
                {HOURS.map((h) => (
                  <div key={h} className="border-t border-rule-soft" style={{ height: HOUR_HEIGHT }} />
                ))}
                {(items ?? [])
                  .filter((s) => new Date(s.startsAt).toDateString() === current.toDateString())
                  .map((s) => {
                    const start = new Date(s.startsAt);
                    const end = new Date(s.endsAt);
                    const startHrs = start.getHours() + start.getMinutes() / 60;
                    const endHrs = end.getHours() + end.getMinutes() / 60;
                    const top = (startHrs - START_HOUR) * HOUR_HEIGHT;
                    const height = Math.max(32, (endHrs - startHrs) * HOUR_HEIGHT);
                    return (
                      <Link
                        key={s.sessionId}
                        href={`/classroom/${s.sessionId}` as never}
                        className="absolute overflow-hidden rounded-md px-3 py-2 text-[13px] text-white"
                        style={{
                          left: 4,
                          right: 4,
                          top,
                          height,
                          background: colorFor(s),
                        }}
                      >
                        <div className="font-medium leading-tight">
                          {s.title ?? "Session"}
                        </div>
                        <div className="mt-0.5 text-[11px] opacity-80">
                          {s.teacherName ?? s.teacherId.slice(0, 6)}
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {items && view === "month" && (
          <MonthGrid current={current} items={items} todayKey={todayKey} colorFor={colorFor} />
        )}
      </div>
    </main>
  );
}

function MonthGrid({
  current,
  items,
  todayKey,
  colorFor,
}: {
  current: Date;
  items: Session[];
  todayKey: string;
  colorFor: (s: Session) => string;
}) {
  const first = new Date(current.getFullYear(), current.getMonth(), 1);
  const firstDow = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - firstDow);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const grouped = new Map<string, Session[]>();
  for (const s of items) {
    const key = new Date(s.startsAt).toDateString();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }
  return (
    <div className="card overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b border-rule">
        {WEEKDAYS.map((w) => (
          <div key={w} className="border-l border-rule-soft px-2 py-2.5 text-center font-mono text-[11px] uppercase text-ink-faded">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const inMonth = d.getMonth() === current.getMonth();
          const isToday = d.toDateString() === todayKey;
          const dayItems = grouped.get(d.toDateString()) ?? [];
          return (
            <div
              key={d.toDateString()}
              className="min-h-[110px] border-l border-t border-rule-soft p-2"
              style={{ opacity: inMonth ? 1 : 0.45 }}
            >
              <div
                className="text-[13px] font-semibold"
                style={{ color: isToday ? "var(--accent)" : "var(--ink)" }}
              >
                {d.getDate()}
              </div>
              <div className="mt-1 space-y-1">
                {dayItems.slice(0, 3).map((s) => (
                  <Link
                    key={s.sessionId}
                    href={`/classroom/${s.sessionId}` as never}
                    className="block overflow-hidden truncate rounded px-1.5 py-0.5 text-[11px] text-white"
                    style={{ background: colorFor(s) }}
                  >
                    {s.title ?? "Session"}
                  </Link>
                ))}
                {dayItems.length > 3 && (
                  <div className="text-[11px] text-ink-faded">+{dayItems.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
