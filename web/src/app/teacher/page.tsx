"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";

type Booking = {
  bookingId: string;
  studentId: string;
  studentName?: string;
  date: string;
  startTime: string;
  status: string;
};

type LessonRequest = {
  requestId: string;
  studentId: string;
  subject?: string;
  status: string;
  createdAt: string;
};

type RecentStudent = {
  studentId: string;
  studentName?: string;
};

export default function TeacherSpacePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState("there");
  const [sub, setSub] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LessonRequest[]>([]);
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([]);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      const role = currentRole(s);
      if (role !== "teacher" && !isAdmin(s)) return router.replace("/dashboard");
      const payload = s.getIdToken().payload;
      const userId = (payload.sub as string) ?? null;
      setSub(userId);
      setDisplayName(
        (payload.name as string) ??
          (payload.email as string)?.split("@")[0] ??
          "there",
      );
      setReady(true);

      api<{ count: number }>("/notifications/unread-count")
        .then((r) => setUnreadCount(r.count))
        .catch(() => {});

      api<{ items: Booking[] }>("/bookings/as-teacher")
        .then((r) => {
          const now = new Date();
          const upcoming = r.items
            .filter((b) => new Date(b.date) >= now && b.status !== "cancelled")
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          setUpcomingBookings(upcoming.slice(0, 3));

          const seen = new Set<string>();
          const students: RecentStudent[] = [];
          for (const b of r.items) {
            if (!seen.has(b.studentId)) {
              seen.add(b.studentId);
              students.push({ studentId: b.studentId, studentName: b.studentName });
            }
            if (students.length >= 4) break;
          }
          setRecentStudents(students);
        })
        .catch(() => {});

      api<{ items: LessonRequest[] }>("/lesson-requests/received")
        .then((r) => {
          setPendingRequests(
            r.items.filter((lr) => lr.status === "pending").slice(0, 5),
          );
        })
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
        Here&apos;s your teaching overview for today.
      </p>

      {/* ── Public profile link ────────────────────────────── */}
      {sub && (
        <section className="mt-8">
          <Link
            href={`/teachers/${sub}` as never}
            className="card-interactive flex items-center gap-4 p-4"
          >
            <Avatar userId={sub} size="md" initial={displayName?.[0]} />
            <div className="flex-1">
              <div className="text-sm font-medium text-ink">View my public profile</div>
              <div className="text-xs text-ink-faded">See what students see when they find you</div>
            </div>
            <span className="text-ink-faded">&rarr;</span>
          </Link>
        </section>
      )}

      {/* ── Quick stats ────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Link href="/teacher/bookings" className="card-interactive p-4 text-center">
          <div className="font-display text-2xl text-ink">{upcomingBookings.length}</div>
          <div className="text-xs text-ink-faded">Upcoming</div>
        </Link>
        <Link href="/requests" className="card-interactive p-4 text-center">
          <div className="font-display text-2xl text-ink">{pendingRequests.length}</div>
          <div className="text-xs text-ink-faded">Pending requests</div>
        </Link>
        <Link href="/mailbox" className="card-interactive p-4 text-center">
          <div className="font-display text-2xl text-ink">{unreadCount}</div>
          <div className="text-xs text-ink-faded">Unread</div>
        </Link>
      </div>

      {/* ── Upcoming sessions ──────────────────────────────── */}
      {upcomingBookings.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg text-ink">Next sessions</h2>
          <ul className="mt-3 space-y-2">
            {upcomingBookings.map((b) => (
              <li key={b.bookingId} className="card flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-medium text-ink">
                    {b.studentName ?? "Student session"}
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

      {/* ── Pending lesson requests ────────────────────────── */}
      {pendingRequests.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Pending requests</h2>
            <Link href="/requests" className="text-xs text-seal hover:underline">
              See all
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {pendingRequests.map((lr) => (
              <li key={lr.requestId} className="card flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-medium text-ink">
                    {lr.subject ?? "Lesson request"}
                  </div>
                  <div className="text-xs text-ink-faded">
                    {new Date(lr.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <Link
                  href={`/requests/${lr.requestId}` as never}
                  className="text-xs font-medium text-seal hover:underline"
                >
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Recent students ────────────────────────────────── */}
      {recentStudents.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Recent students</h2>
            <Link href="/teacher/students" className="text-xs text-seal hover:underline">
              See all
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {recentStudents.map((st) => (
              <Link
                key={st.studentId}
                href={`/teacher/students/${st.studentId}` as never}
                className="card-interactive flex items-center gap-3 p-4"
              >
                <Avatar userId={st.studentId} size="md" initial={st.studentName?.[0]} />
                <div className="truncate text-sm font-medium text-ink">
                  {st.studentName ?? "Student"}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Quick actions ──────────────────────────────────── */}
      <section className="mt-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/seller/listings/new" className="card-interactive group p-4">
            <div className="font-display text-base text-ink group-hover:text-seal">
              Create a listing
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">
              Sell study materials on the marketplace
            </div>
          </Link>
          <Link href="/forum" className="card-interactive group p-4">
            <div className="font-display text-base text-ink group-hover:text-seal">
              Join the community
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">
              Post articles and connect with students
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
