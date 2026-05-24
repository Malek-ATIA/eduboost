"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { Avatar } from "@/components/Avatar";

type Booking = {
  bookingId: string;
  teacherId: string;
  teacherName?: string;
  date: string;
  startTime: string;
  status: string;
};

type TeacherPreview = {
  favoriteId: string;
  kind: string;
  userId?: string;
  displayName?: string;
  hourlyRateCents?: number;
  currency?: string;
};

export default function StudentSpacePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState("there");
  const [unreadCount, setUnreadCount] = useState(0);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [savedTeachers, setSavedTeachers] = useState<TeacherPreview[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      const role = currentRole(s);
      if (role !== "student" && !isAdmin(s)) return router.replace("/dashboard");
      const payload = s.getIdToken().payload;
      setDisplayName(
        (payload.name as string) ??
          (payload.email as string)?.split("@")[0] ??
          "there",
      );
      setReady(true);

      api<{ count: number }>("/notifications/unread-count")
        .then((r) => setUnreadCount(r.count))
        .catch(() => {});

      api<{ items: Booking[] }>("/bookings/mine")
        .then((r) => {
          const now = new Date();
          const upcoming = r.items
            .filter((b) => new Date(b.date) >= now && b.status !== "cancelled")
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 3);
          setUpcomingBookings(upcoming);
        })
        .catch(() => {});

      api<{ items: TeacherPreview[] }>("/favorites")
        .then((r) => setSavedTeachers(r.items.filter((f) => f.kind === "teacher").slice(0, 4)))
        .catch(() => {});
    })();
  }, [router]);

  if (!ready)
    return (
      <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12 text-ink-soft">
        Loading...
      </main>
    );

  const greeting = getGreeting();

  return (
    <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
      <div className="max-w-container-wide">
        {/* ── Page header ────────────────────────────────────── */}
        <div className="eyebrow">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
          Welcome back, <span className="italic">{displayName}</span>.
        </h1>
        <p className="mt-3 text-base text-ink-soft">
          Here&apos;s what&apos;s happening with your studies.
        </p>

        {/* ── Teacher search ─────────────────────────────────── */}
        <section className="mt-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchQuery.trim();
              router.push(q ? `/teachers?subject=${encodeURIComponent(q)}` : "/teachers");
            }}
            className="flex gap-2"
          >
            <input
              className="input flex-1"
              placeholder="Search for a teacher by subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn-seal shrink-0">
              Find a teacher
            </button>
          </form>
        </section>

        {/* ── Stats grid ─────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Link href="/bookings" className="card-interactive p-5 text-center">
            <div className="font-serif text-3xl text-ink">{upcomingBookings.length}</div>
            <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
              Upcoming
            </div>
          </Link>
          <Link href="/mailbox" className="card-interactive p-5 text-center">
            <div className="font-serif text-3xl text-ink">{unreadCount}</div>
            <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
              Unread
            </div>
          </Link>
          <Link href="/favorites" className="card-interactive p-5 text-center">
            <div className="font-serif text-3xl text-ink">{savedTeachers.length}</div>
            <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
              Saved
            </div>
          </Link>
          <Link href="/teachers" className="card-interactive p-5 text-center">
            <div className="flex items-center justify-center text-3xl text-accent">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M16.5 16.5L21 21" />
              </svg>
            </div>
            <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
              Browse
            </div>
          </Link>
        </div>

        {/* ── Upcoming sessions ──────────────────────────────── */}
        {upcomingBookings.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-ink">Upcoming sessions</h2>
              <Link href="/bookings" className="text-xs font-medium text-accent hover:text-accent-deep">
                View all
              </Link>
            </div>
            <ul className="mt-4 space-y-3">
              {upcomingBookings.map((b) => (
                <li key={b.bookingId} className="card flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-pale">
                      <svg className="h-5 w-5 text-accent" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="4" width="14" height="14" rx="2" />
                        <path d="M3 8h14M7 2v4M13 2v4" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-ink">
                        {b.teacherName ?? "Session"}
                      </div>
                      <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
                        {new Date(b.date).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        {b.startTime ? ` at ${b.startTime}` : ""}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/bookings/${b.bookingId}` as never}
                    className="btn-ghost text-xs text-accent"
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Saved teachers ─────────────────────────────────── */}
        {savedTeachers.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-ink">Saved teachers</h2>
              <Link href="/favorites" className="text-xs font-medium text-accent hover:text-accent-deep">
                See all
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {savedTeachers.map((t) => (
                <Link
                  key={t.favoriteId}
                  href={`/teachers/${t.favoriteId}` as never}
                  className="card-interactive flex items-center gap-4 p-4"
                >
                  <Avatar userId={t.favoriteId} size="md" initial={t.displayName?.[0]} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      {t.displayName ?? "Teacher"}
                    </div>
                    {t.hourlyRateCents != null && t.currency && (
                      <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
                        {formatMoney(t.hourlyRateCents, t.currency, { trim: true })}/hr
                      </div>
                    )}
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-ink-mute" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Quick actions ──────────────────────────────────── */}
        <section className="mt-10">
          <h2 className="font-serif text-xl text-ink">Quick actions</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link href="/marketplace" className="card-interactive group p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-pale text-accent">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3h2l1.5 9h9L17 5H6" />
                    <circle cx="8" cy="15" r="1.5" />
                    <circle cx="14" cy="15" r="1.5" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-ink group-hover:text-accent">
                    Browse marketplace
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faded">
                    Study materials and resources
                  </div>
                </div>
              </div>
            </Link>
            <Link href="/requests/new" className="card-interactive group p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-pale text-accent">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-ink group-hover:text-accent">
                    Create a lesson request
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faded">
                    Let teachers come to you
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
