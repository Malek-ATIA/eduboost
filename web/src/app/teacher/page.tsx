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
          Bonjour, <span className="italic">{displayName}</span>.
        </h1>
        <p className="mt-3 text-base text-ink-soft">
          Here&apos;s your teaching overview for today.
        </p>

        {/* ── Public profile link ────────────────────────────── */}
        {sub && (
          <section className="mt-8">
            <Link
              href={`/teachers/${sub}` as never}
              className="card-interactive flex items-center gap-4 p-5"
            >
              <Avatar userId={sub} size="md" initial={displayName?.[0]} />
              <div className="flex-1">
                <div className="text-sm font-medium text-ink">View my public profile</div>
                <div className="text-xs text-ink-faded">See what students see when they find you</div>
              </div>
              <svg className="h-5 w-5 text-ink-mute" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 5l5 5-5 5" />
              </svg>
            </Link>
          </section>
        )}

        {/* ── Stats grid ─────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Link href="/teacher/bookings" className="card-interactive p-5 text-center">
            <div className="font-serif text-3xl text-ink">{upcomingBookings.length}</div>
            <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
              Upcoming
            </div>
          </Link>
          <Link href="/requests" className="card-interactive p-5 text-center">
            <div className="font-serif text-3xl text-ink">{pendingRequests.length}</div>
            <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
              Requests
            </div>
          </Link>
          <Link href="/mailbox" className="card-interactive p-5 text-center">
            <div className="font-serif text-3xl text-ink">{unreadCount}</div>
            <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
              Unread
            </div>
          </Link>
          <Link href="/teacher/students" className="card-interactive p-5 text-center">
            <div className="font-serif text-3xl text-ink">{recentStudents.length}</div>
            <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
              Students
            </div>
          </Link>
        </div>

        {/* ── Upcoming sessions ──────────────────────────────── */}
        {upcomingBookings.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-ink">Next sessions</h2>
              <Link href="/teacher/bookings" className="text-xs font-medium text-accent hover:text-accent-deep">
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
                        {b.studentName ?? "Student session"}
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

        {/* ── Pending lesson requests ────────────────────────── */}
        {pendingRequests.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-ink">Pending requests</h2>
              <Link href="/requests" className="text-xs font-medium text-accent hover:text-accent-deep">
                See all
              </Link>
            </div>
            <ul className="mt-4 space-y-3">
              {pendingRequests.map((lr) => (
                <li key={lr.requestId} className="card flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-pale">
                      <svg className="h-5 w-5 text-accent" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 4h12v12H4zM4 8h12M8 8v8" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-ink">
                        {lr.subject ?? "Lesson request"}
                      </div>
                      <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
                        {new Date(lr.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/requests/${lr.requestId}` as never}
                    className="btn-ghost text-xs text-accent"
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
          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-ink">Recent students</h2>
              <Link href="/teacher/students" className="text-xs font-medium text-accent hover:text-accent-deep">
                See all
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {recentStudents.map((st) => (
                <Link
                  key={st.studentId}
                  href={`/teacher/students/${st.studentId}` as never}
                  className="card-interactive flex items-center gap-4 p-4"
                >
                  <Avatar userId={st.studentId} size="md" initial={st.studentName?.[0]} />
                  <div className="truncate text-sm font-medium text-ink">
                    {st.studentName ?? "Student"}
                  </div>
                  <svg className="ml-auto h-4 w-4 shrink-0 text-ink-mute" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
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
            <Link href="/seller/listings/new" className="card-interactive group p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-pale text-accent">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-ink group-hover:text-accent">
                    Create a listing
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faded">
                    Sell study materials on the marketplace
                  </div>
                </div>
              </div>
            </Link>
            <Link href="/forum" className="card-interactive group p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-pale text-accent">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4h12v9H8l-3 3v-3H4z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-ink group-hover:text-accent">
                    Join the community
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faded">
                    Post articles and connect with students
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
