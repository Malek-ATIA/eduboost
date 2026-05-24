"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { PageHead, Section, Stat } from "@/components/PageHead";
import { ArrowRight, Search, Check } from "lucide-react";

type Booking = {
  bookingId: string;
  teacherId: string;
  teacherName?: string;
  date: string;
  startTime: string;
  status: string;
};

export default function StudentSpacePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState("there");
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);

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

      api<{ items: Booking[] }>("/bookings/mine")
        .then((r) => {
          const now = new Date();
          const upcoming = r.items
            .filter((b) => new Date(b.date) >= now && b.status !== "cancelled")
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 4);
          setUpcomingBookings(upcoming);
        })
        .catch(() => {});
    })();
  }, [router]);

  if (!ready)
    return (
      <main className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
      </main>
    );

  const todayStr = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const nextSession = upcomingBookings[0];

  return (
    <main>
      <PageHead
        eyebrow={todayStr}
        title={
          <>
            Welcome back, <span className="text-accent">{displayName}</span>.
          </>
        }
        sub={
          upcomingBookings.length > 0
            ? `${upcomingBookings.length} upcoming session${upcomingBookings.length === 1 ? "" : "s"}. Keep going.`
            : "No sessions booked yet. Find a teacher to get started."
        }
        right={
          <div className="flex gap-2">
            <Link href="/teachers" className="btn-secondary flex items-center gap-1.5 text-sm">
              <Search size={14} /> Find a teacher
            </Link>
            {nextSession && (
              <Link href={`/bookings/${nextSession.bookingId}`} className="btn-seal text-sm">
                Next session
              </Link>
            )}
          </div>
        }
      />

      {/* Today */}
      <Section title="Today">
        <div className="grid gap-[18px] md:grid-cols-[2fr_1fr]">
          {nextSession ? (
            <div className="card overflow-hidden p-0">
              <div className="flex items-center gap-[18px] p-6">
                <Avatar userId={nextSession.teacherId} size="md" initial={nextSession.teacherName} />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
                    {(() => {
                      const diff = new Date(nextSession.date).getTime() - Date.now();
                      const mins = Math.floor(diff / 60000);
                      if (mins < 0) return "Starting now";
                      if (mins < 60) return `Starts in ${mins} minutes`;
                      const hrs = Math.floor(mins / 60);
                      if (hrs < 24) return `Starts in ${hrs}h ${mins % 60}m`;
                      return `In ${Math.floor(hrs / 24)} days`;
                    })()}
                  </div>
                  <div className="mt-1 font-bold text-[22px]">
                    Session with {nextSession.teacherName || "your teacher"}
                  </div>
                  <div className="mt-1 text-[13px] text-ink-soft">
                    {new Date(nextSession.date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                    {nextSession.startTime && ` · ${nextSession.startTime}`}
                  </div>
                </div>
                <Link
                  href={`/bookings/${nextSession.bookingId}`}
                  className="btn-seal flex items-center gap-2"
                >
                  Join <ArrowRight size={14} />
                </Link>
              </div>
              <div className="border-t border-rule bg-bg-soft p-[18px]">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faded">
                  Before you join
                </div>
                <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <Checklist label="Review last week's notes" done />
                  <Checklist label="Bring your questions" />
                  <Checklist label="Test your mic & camera" />
                </div>
              </div>
            </div>
          ) : (
            <div className="card flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-pale">
                <Search size={20} className="text-accent" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-base">No sessions today</div>
                <div className="text-[13px] text-ink-soft">Browse verified teachers and book your first lesson.</div>
              </div>
              <Link href="/teachers" className="btn-seal text-sm">Find a teacher</Link>
            </div>
          )}

          {/* Streak card */}
          <div className="card p-[18px]">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
              Streak
            </div>
            <div className="mt-1 font-bold text-[42px] leading-none tracking-tight">
              {upcomingBookings.length}{" "}
              <span className="text-base text-ink-faded">upcoming</span>
            </div>
            <div className="mt-3 flex gap-1">
              {Array.from({ length: 21 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-[22px] flex-1 rounded-[3px] ${
                    i < Math.min(upcomingBookings.length * 3, 14) ? "bg-accent" : "bg-rule"
                  }`}
                />
              ))}
            </div>
            <div className="mt-2.5 text-[12.5px] text-ink-soft">
              Build a habit. Don&apos;t break the chain.
            </div>
          </div>
        </div>
      </Section>

      {/* This week */}
      {upcomingBookings.length > 0 && (
        <Section
          title="This week"
          action={
            <Link href="/bookings" className="btn-ghost text-sm">
              Full schedule
            </Link>
          }
        >
          <div className="card overflow-hidden p-0">
            {upcomingBookings.map((b, i) => {
              const d = new Date(b.date);
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div
                  key={b.bookingId}
                  className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-rule" : ""}`}
                >
                  <div className="w-12 text-center">
                    <div className="font-mono text-[11px] uppercase tracking-wider text-ink-faded">
                      {d.toLocaleDateString(undefined, { weekday: "short" })}
                    </div>
                    <div className="mt-0.5 font-bold text-[22px] leading-none">{d.getDate()}</div>
                  </div>
                  <div className="w-16 font-mono text-[12.5px] text-ink-soft">{b.startTime || "--:--"}</div>
                  <Avatar userId={b.teacherId} size="sm" initial={b.teacherName} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px]">{b.teacherName || "Teacher"}</div>
                    <div className="text-[12.5px] text-ink-faded">{b.status}</div>
                  </div>
                  {isToday && <span className="chip chip-accent">Today</span>}
                  <Link href={`/bookings/${b.bookingId}`} className="btn-ghost text-sm">Details</Link>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Pick up where you left */}
      <Section title="Pick up where you left">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <PickupTile tag="Notes" title="Your session notes" sub="Across all classes" href="/notes" />
          <PickupTile tag="Materials" title="Study materials" sub="Saved by you" href="/study-materials" />
          <PickupTile tag="Mailbox" title="Recent messages" sub="From your teachers" href="/mailbox" />
          <PickupTile tag="Grades" title="Track your progress" sub="See trends over time" href="/grades" />
        </div>
      </Section>

      {/* Your subjects */}
      <Section
        title="Your subjects"
        action={<Link href="/teachers" className="btn-ghost text-sm">Add a subject</Link>}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <SubjectCard subj="Mathematics" teacher="Browse teachers" grade="—" trend="—" sessions={0} />
          <SubjectCard subj="Physics" teacher="Browse teachers" grade="—" trend="—" sessions={0} />
          <SubjectCard subj="English" teacher="Browse teachers" grade="—" trend="—" sessions={0} />
        </div>
      </Section>

      <div className="h-16" />
    </main>
  );
}

function SubjectCard({
  subj,
  teacher,
  grade,
  trend,
  sessions,
}: {
  subj: string;
  teacher: string;
  grade: string;
  trend: string;
  sessions: number;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="text-[22px] font-bold tracking-[-0.01em]">{subj}</div>
        <span className="chip chip-outline text-[11px]">{sessions} sessions</span>
      </div>
      <div className="mt-1 text-[12.5px] text-ink-faded">with {teacher}</div>
      <div className="mt-[18px] flex items-baseline justify-between">
        <div>
          <span className="text-[36px] font-bold tracking-[-0.02em]">{grade}</span>
          <span className="ml-1 text-[12.5px] text-ink-faded">/ 20</span>
        </div>
        <div className="inline-flex items-center gap-1 text-[12.5px] text-accent-deep">↗ {trend}</div>
      </div>
      <svg viewBox="0 0 240 50" className="mt-3.5 w-full">
        <polyline
          points="0,42 30,40 60,36 90,32 120,28 150,24 180,20 210,16 240,12"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function Checklist({ label, done }: { label: string; done?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-[13px] ${done ? "text-ink-faded" : "text-ink"}`}>
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
          done ? "border border-accent bg-accent text-white" : "border-[1.5px] border-ink-mute"
        }`}
      >
        {done && <Check size={10} />}
      </span>
      <span className={done ? "line-through" : ""}>{label}</span>
    </div>
  );
}

function PickupTile({
  tag,
  title,
  sub,
  href,
}: {
  tag: string;
  title: string;
  sub: string;
  href: string;
}) {
  return (
    <Link href={href as never} className="card block p-[18px] transition hover:shadow-md">
      <div className="font-mono text-[10.5px] uppercase text-accent">{tag}</div>
      <div className="mt-2 font-semibold text-base leading-tight tracking-tight">{title}</div>
      <div className="mt-2 text-[12.5px] text-ink-faded">{sub}</div>
    </Link>
  );
}
