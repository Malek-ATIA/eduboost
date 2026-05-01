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
    return <main className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  const greeting = getGreeting();

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
      <h1 className="font-display text-3xl tracking-tight text-ink">
        {greeting}, {displayName}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
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

      {/* ── Quick stats ────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link href="/bookings" className="card-interactive p-4 text-center">
          <div className="font-display text-2xl text-ink">{upcomingBookings.length}</div>
          <div className="text-xs text-ink-faded">Upcoming sessions</div>
        </Link>
        <Link href="/mailbox" className="card-interactive p-4 text-center">
          <div className="font-display text-2xl text-ink">{unreadCount}</div>
          <div className="text-xs text-ink-faded">Unread messages</div>
        </Link>
      </div>

      {/* ── Upcoming sessions ──────────────────────────────── */}
      {upcomingBookings.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg text-ink">Next up</h2>
          <ul className="mt-3 space-y-2">
            {upcomingBookings.map((b) => (
              <li key={b.bookingId} className="card flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-medium text-ink">
                    {b.teacherName ?? "Session"}
                  </div>
                  <div className="text-xs text-ink-faded">
                    {new Date(b.date).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                    {b.startTime ? ` at ${b.startTime}` : ""}
                  </div>
                </div>
                <Link
                  href={`/bookings/${b.bookingId}` as never}
                  className="text-xs font-medium text-seal hover:underline"
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
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Saved teachers</h2>
            <Link href="/favorites" className="text-xs text-seal hover:underline">
              See all
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {savedTeachers.map((t) => (
              <Link
                key={t.favoriteId}
                href={`/teachers/${t.favoriteId}` as never}
                className="card-interactive flex items-center gap-3 p-4"
              >
                <Avatar userId={t.favoriteId} size="md" initial={t.displayName?.[0]} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">
                    {t.displayName ?? "Teacher"}
                  </div>
                  {t.hourlyRateCents != null && t.currency && (
                    <div className="text-xs text-ink-faded">
                      {formatMoney(t.hourlyRateCents, t.currency, { trim: true })}/hr
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Quick actions ──────────────────────────────────── */}
      <section className="mt-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/marketplace" className="card-interactive group p-4">
            <div className="font-display text-base text-ink group-hover:text-seal">
              Browse marketplace
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">
              Study materials, exam banks, and resources
            </div>
          </Link>
          <Link href="/requests/new" className="card-interactive group p-4">
            <div className="font-display text-base text-ink group-hover:text-seal">
              Create a lesson request
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">
              Let teachers come to you with proposals
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
