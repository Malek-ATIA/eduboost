"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Session = {
  sessionId: string;
  classroomId: string;
  teacherId: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "live" | "completed" | "cancelled" | "booked";
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
};

const STATUS_STYLE: Record<Session["status"], { dot: string; text: string; bg: string }> = {
  scheduled: { dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  live: { dot: "bg-seal", text: "text-seal", bg: "bg-seal/10 border-seal/30" },
  completed: { dot: "bg-ink-faded", text: "text-ink-faded", bg: "bg-parchment-dark border-ink-faded/30" },
  cancelled: { dot: "bg-red-400", text: "text-red-500", bg: "bg-red-50 border-red-200" },
  booked: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type View = "month" | "week" | "agenda";

export default function CalendarPage() {
  const router = useRouter();
  const [items, setItems] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("month");
  const [current, setCurrent] = useState(() => new Date());

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      try {
        const [sessionsRes, bookingsRes] = await Promise.all([
          api<{ items: Session[] }>(`/sessions/upcoming`).catch(() => ({ items: [] as Session[] })),
          api<{ items: Booking[] }>(`/bookings/mine`).catch(() => ({ items: [] as Booking[] })),
        ]);

        const sessionBookingIds = new Set<string>();
        for (const s of sessionsRes.items) {
          if (s.classroomId) sessionBookingIds.add(s.classroomId);
        }

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
            };
          });

        setItems([...sessionsRes.items, ...bookingItems]);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of items ?? []) {
      const d = new Date(s.startsAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [items]);

  function navigate(delta: number) {
    setCurrent((prev) => {
      const d = new Date(prev);
      if (view === "month") d.setMonth(d.getMonth() + delta);
      else if (view === "week") d.setDate(d.getDate() + 7 * delta);
      else d.setDate(d.getDate() + delta);
      return d;
    });
  }

  function goToday() {
    setCurrent(new Date());
  }

  const upcomingToday = (items ?? []).filter((s) => {
    const d = new Date(s.startsAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return key === today && (s.status === "scheduled" || s.status === "live" || s.status === "booked");
  });

  const upcomingCount = (items ?? []).filter(
    (s) => s.status === "scheduled" || s.status === "live" || s.status === "booked",
  ).length;

  return (
    <main className="mx-auto max-w-5xl px-6 pb-24 pt-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Schedule</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">My calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-ink-faded/40">
            {(["month", "week", "agenda"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition ${
                  view === v
                    ? "bg-seal text-white"
                    : "text-ink-soft hover:bg-parchment-dark"
                } ${v === "month" ? "rounded-l-md" : v === "agenda" ? "rounded-r-md" : ""}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="card flex flex-col items-center p-4">
          <span className="font-display text-2xl text-ink">{upcomingCount}</span>
          <span className="mt-1 text-xs text-ink-soft">Upcoming</span>
        </div>
        <div className="card flex flex-col items-center p-4">
          <span className="font-display text-2xl text-ink">{upcomingToday.length}</span>
          <span className="mt-1 text-xs text-ink-soft">Today</span>
        </div>
        <div className="card flex flex-col items-center p-4">
          <span className="font-display text-2xl text-ink">
            {(items ?? []).filter((s) => s.status === "live").length}
          </span>
          <span className="mt-1 text-xs text-ink-soft">Live now</span>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && (
        <div className="mt-8 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
        </div>
      )}

      {items !== null && (
        <>
          {/* Navigation bar */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-faded/40 text-ink-soft transition hover:bg-parchment-dark"
              >
                ‹
              </button>
              <button
                onClick={() => navigate(1)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-faded/40 text-ink-soft transition hover:bg-parchment-dark"
              >
                ›
              </button>
              <button
                onClick={goToday}
                className="rounded-md border border-ink-faded/40 px-3 py-1 text-xs text-ink-soft transition hover:bg-parchment-dark"
              >
                Today
              </button>
            </div>
            <h2 className="font-display text-xl text-ink">
              {view === "week"
                ? `Week of ${current.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                : `${MONTHS[current.getMonth()]} ${current.getFullYear()}`}
            </h2>
          </div>

          {/* Calendar views */}
          {view === "month" && (
            <MonthGrid
              year={current.getFullYear()}
              month={current.getMonth()}
              today={today}
              sessionsByDate={sessionsByDate}
            />
          )}
          {view === "week" && (
            <WeekView
              anchor={current}
              today={today}
              sessionsByDate={sessionsByDate}
            />
          )}
          {view === "agenda" && (
            <AgendaView items={items} today={today} />
          )}
        </>
      )}

      {/* Today's sessions detail */}
      {upcomingToday.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow">Happening today</h2>
          <div className="mt-3 space-y-2">
            {upcomingToday.map((s) => (
              <SessionCard key={s.sessionId} session={s} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

/* ── Month grid ─────────────────────────────────────────── */

function MonthGrid({
  year,
  month,
  today,
  sessionsByDate,
}: {
  year: number;
  month: number;
  today: string;
  sessionsByDate: Map<string, Session[]>;
}) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0

  const cells: { date: string; day: number; inMonth: boolean }[] = [];
  // Leading days from previous month
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    cells.push({
      date: fmtDate(d),
      day: d.getDate(),
      inMonth: false,
    });
  }
  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
      inMonth: true,
    });
  }
  // Trailing days
  const trailing = 7 - (cells.length % 7);
  if (trailing < 7) {
    for (let i = 1; i <= trailing; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({ date: fmtDate(d), day: d.getDate(), inMonth: false });
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-ink-faded/30">
      <div className="grid grid-cols-7 border-b border-ink-faded/30 bg-parchment-dark">
        {WEEKDAYS.map((w) => (
          <div key={w} className="p-2 text-center text-[11px] font-semibold uppercase tracking-widest text-ink-faded">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const isToday = cell.date === today;
          const sessions = sessionsByDate.get(cell.date) ?? [];
          const hasLive = sessions.some((s) => s.status === "live");
          return (
            <div
              key={i}
              className={`min-h-[80px] border-b border-r border-ink-faded/15 p-1.5 transition ${
                !cell.inMonth ? "bg-parchment-dark/50" : "bg-parchment"
              } ${isToday ? "ring-2 ring-inset ring-seal/40" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? "bg-seal font-bold text-white"
                      : cell.inMonth
                        ? "text-ink"
                        : "text-ink-faded/50"
                  }`}
                >
                  {cell.day}
                </span>
                {hasLive && (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-seal" />
                )}
              </div>
              <div className="mt-0.5 space-y-0.5">
                {sessions.slice(0, 3).map((s) => {
                  const st = STATUS_STYLE[s.status];
                  const time = new Date(s.startsAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <SessionPeek key={s.sessionId} session={s}>
                      <div
                        className={`block cursor-pointer truncate rounded border px-1 py-0.5 text-[10px] leading-tight transition hover:opacity-80 ${st.bg} ${st.text}`}
                      >
                        {time}
                      </div>
                    </SessionPeek>
                  );
                })}
                {sessions.length > 3 && (
                  <span className="block text-[10px] text-ink-faded">
                    +{sessions.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Week view ──────────────────────────────────────────── */

function WeekView({
  anchor,
  today,
  sessionsByDate,
}: {
  anchor: Date;
  today: string;
  sessionsByDate: Map<string, Session[]>;
}) {
  const weekStart = new Date(anchor);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return { date: fmtDate(d), day: d, dayNum: d.getDate(), dow: WEEKDAYS[i] };
  });

  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7am to 8pm

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-ink-faded/30">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-ink-faded/30 bg-parchment-dark">
        <div className="p-2" />
        {days.map((d) => {
          const isToday = d.date === today;
          return (
            <div key={d.date} className="p-2 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-ink-faded">
                {d.dow}
              </div>
              <div
                className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                  isToday ? "bg-seal font-bold text-white" : "text-ink"
                }`}
              >
                {d.dayNum}
              </div>
            </div>
          );
        })}
      </div>
      {/* Hour rows */}
      <div className="max-h-[500px] overflow-y-auto">
        {hours.map((hour) => (
          <div
            key={hour}
            className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-ink-faded/10"
          >
            <div className="flex items-start justify-end pr-2 pt-1 text-[10px] text-ink-faded">
              {String(hour).padStart(2, "0")}:00
            </div>
            {days.map((d) => {
              const sessions = (sessionsByDate.get(d.date) ?? []).filter((s) => {
                const h = new Date(s.startsAt).getHours();
                return h === hour;
              });
              return (
                <div
                  key={d.date}
                  className="min-h-[48px] border-l border-ink-faded/10 p-0.5"
                >
                  {sessions.map((s) => {
                    const st = STATUS_STYLE[s.status];
                    const time = new Date(s.startsAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <SessionPeek key={s.sessionId} session={s}>
                        <div
                          className={`block cursor-pointer truncate rounded border px-1 py-0.5 text-[10px] leading-tight transition hover:opacity-80 ${st.bg} ${st.text}`}
                        >
                          {time}
                        </div>
                      </SessionPeek>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Agenda view ────────────────────────────────────────── */

function AgendaView({ items, today }: { items: Session[]; today: string }) {
  const grouped = groupByDay(items);

  if (grouped.length === 0) {
    return (
      <div className="mt-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parchment-dark">
          <span className="text-2xl text-ink-faded">📅</span>
        </div>
        <p className="mt-4 font-display text-lg text-ink">No upcoming sessions</p>
        <p className="mt-1 text-sm text-ink-soft">
          Book a session with a teacher to see it here.
        </p>
        <Link href="/teachers" className="btn-seal mt-4 inline-block">
          Find a teacher
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-6">
      {grouped.map((day) => (
        <section key={day.date}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span
              className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-1 text-xs ${
                day.date === today ? "bg-seal text-white" : "bg-parchment-dark text-ink-soft"
              }`}
            >
              {new Date(day.date).getDate()}
            </span>
            {day.label}
          </h3>
          <div className="mt-2 space-y-2">
            {day.items.map((s) => (
              <SessionCard key={s.sessionId} session={s} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ── Session card ───────────────────────────────────────── */

function SessionCard({ session: s }: { session: Session }) {
  const st = STATUS_STYLE[s.status];
  const starts = new Date(s.startsAt);
  const ends = new Date(s.endsAt);
  const durationMin = Math.round((ends.getTime() - starts.getTime()) / 60_000);
  const joinable = s.status === "scheduled" || s.status === "live";
  const isBooked = s.status === "booked";

  return (
    <div className={`rounded-lg border p-4 transition ${st.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center rounded-md bg-white/60 px-3 py-1.5">
            <span className="text-xs font-semibold uppercase text-ink-faded">
              {starts.toLocaleDateString(undefined, { weekday: "short" })}
            </span>
            <span className="text-lg font-bold text-ink">
              {starts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${st.dot} ${s.status === "live" ? "animate-pulse" : ""}`} />
              <span className={`text-xs font-semibold uppercase tracking-widest ${st.text}`}>
                {isBooked ? "Booked" : s.status}
              </span>
            </div>
            {isBooked ? (
              <div className="mt-1 text-sm text-ink">
                Booked session — awaiting schedule
              </div>
            ) : (
              <>
                <div className="mt-1 text-sm text-ink">
                  {starts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                  {ends.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  <span className="ml-2 text-ink-faded">({durationMin} min)</span>
                </div>
                {s.classroomId && (
                  <div className="mt-0.5 text-xs text-ink-faded">
                    Classroom {s.classroomId.slice(0, 16)}…
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {joinable && (
          <Link href={`/classroom/${s.sessionId}` as never} className="btn-seal">
            {s.status === "live" ? "Join now" : "Join"}
          </Link>
        )}
        {isBooked && (
          <Link href={"/bookings" as never} className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700">
            View
          </Link>
        )}
      </div>
    </div>
  );
}

/* ── Session peek popover ──────────────────────────────── */

function SessionPeek({ session, children }: { session: Session; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const st = STATUS_STYLE[session.status];
  const starts = new Date(session.startsAt);
  const ends = new Date(session.endsAt);
  const durationMin = Math.round((ends.getTime() - starts.getTime()) / 60_000);
  const joinable = session.status === "scheduled" || session.status === "live";
  const isBooked = session.status === "booked";

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative cursor-pointer"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen((v) => !v);
      }}
    >
      {children}
      {open && (
        <div className="absolute left-0 top-full z-30 w-52 pt-1">
        <div className="rounded-lg border border-ink-faded/30 bg-white p-3 shadow-manuscript">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${st.dot} ${session.status === "live" ? "animate-pulse" : ""}`} />
            <span className={`text-xs font-semibold uppercase tracking-widest ${st.text}`}>
              {isBooked ? "Booked" : session.status}
            </span>
          </div>
          {isBooked ? (
            <>
              <div className="mt-2 text-sm font-medium text-ink">
                Booked on {starts.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
              <div className="mt-0.5 text-xs text-ink-faded">Awaiting teacher to schedule</div>
              <Link
                href={`/bookings/${session.sessionId}` as never}
                className="mt-3 flex items-center justify-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
                onClick={(e) => e.stopPropagation()}
              >
                View booking
              </Link>
            </>
          ) : (
            <>
              <div className="mt-2 text-sm font-medium text-ink">
                {starts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                {ends.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="mt-0.5 text-xs text-ink-faded">{durationMin} min session</div>
              {session.classroomId && (
                <div className="mt-1 truncate text-xs text-ink-faded">
                  Room {session.classroomId.slice(0, 12)}…
                </div>
              )}
              {joinable && (
                <Link
                  href={`/classroom/${session.sessionId}` as never}
                  className="mt-3 flex items-center justify-center rounded-md bg-seal px-3 py-1.5 text-xs font-medium text-white transition hover:bg-seal-dark"
                  onClick={(e) => e.stopPropagation()}
                >
                  {session.status === "live" ? "Join now" : "Join session"}
                </Link>
              )}
              {!joinable && (
                <div className="mt-2 text-center text-[10px] text-ink-faded">
                  {session.status === "completed" ? "Session ended" : "Cancelled"}
                </div>
              )}
            </>
          )}
        </div>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────── */

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function groupByDay(items: Session[]): { date: string; label: string; items: Session[] }[] {
  const map = new Map<string, Session[]>();
  for (const s of items) {
    const d = new Date(s.startsAt);
    const key = fmtDate(d);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  const todayStr = fmtDate(new Date());
  const tomorrowStr = fmtDate(new Date(Date.now() + 86_400_000));
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, items]) => ({
      date,
      label:
        date === todayStr
          ? "Today"
          : date === tomorrowStr
            ? "Tomorrow"
            : new Date(date).toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              }),
      items,
    }));
}
