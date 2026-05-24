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
  type?: string;
};

type LessonRequest = {
  requestId: string;
  studentId: string;
  subject?: string;
  status: string;
  createdAt: string;
};

export default function TeacherSpacePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState("there");
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LessonRequest[]>([]);
  const [unreadMsg, setUnreadMsg] = useState(0);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      const role = currentRole(s);
      if (role !== "teacher" && !isAdmin(s)) return router.replace("/dashboard");
      const payload = s.getIdToken().payload;
      setDisplayName(
        (payload.name as string) ?? (payload.email as string)?.split("@")[0] ?? "there"
      );
      setReady(true);

      api<{ items: Booking[] }>("/bookings/as-teacher")
        .then((r) => {
          const today = new Date().toDateString();
          const todays = r.items
            .filter((b) => new Date(b.date).toDateString() === today && b.status !== "cancelled")
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          setTodayBookings(todays.length > 0 ? todays : r.items.slice(0, 5));
        })
        .catch(() => {});

      api<{ items: LessonRequest[] }>("/requests/teacher")
        .then((r) => setPendingRequests(r.items.filter((x) => x.status === "pending").slice(0, 4)))
        .catch(() => {});

      api<{ count: number }>("/notifications/unread-count")
        .then((r) => setUnreadMsg(r.count))
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

  return (
    <main>
      {/* PageHead */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-rule px-4 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
        <div>
          <div className="eyebrow">{todayStr}</div>
          <h1 className="mt-2 text-[clamp(28px,3vw,40px)] font-bold tracking-[-0.018em]">
            Bonjour, <span className="text-accent">{displayName}</span>.
          </h1>
          <p className="mt-2 max-w-[640px] text-[14.5px] text-ink-soft">
            {todayBookings.length} session{todayBookings.length === 1 ? "" : "s"} today.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/profile" className="btn-outline btn-sm">Edit profile</Link>
          {todayBookings[0] && (
            <Link href={`/bookings/${todayBookings[0].bookingId}`} className="btn-accent btn-sm">
              Start next session
            </Link>
          )}
        </div>
      </div>

      {/* Today at a glance — 4 stat cards */}
      <Section title="Today at a glance">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Sessions today" value={String(todayBookings.length)} sub={`${todayBookings.length} booked`} />
          <Stat label="Hours booked" value={String(todayBookings.length * 1)} sub={todayBookings.length > 0 ? "Stay sharp" : "Free time"} />
          <Stat label="Pending requests" value={String(pendingRequests.length)} sub={pendingRequests.length > 0 ? "Awaiting reply" : "All clear"} accent />
          <Stat label="Unread messages" value={String(unreadMsg)} sub={unreadMsg > 0 ? "Reply soon" : "Inbox clear"} />
        </div>
      </Section>

      {/* Schedule */}
      <Section title="Schedule">
        {todayBookings.length === 0 ? (
          <div className="card p-6 text-center">
            <div className="text-sm text-ink-soft">No sessions today.</div>
            <Link href="/calendar" className="btn-outline mt-3 inline-block text-sm">View calendar</Link>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            {todayBookings.map((b, i) => {
              const isNow =
                new Date(b.date).getTime() - Date.now() < 15 * 60 * 1000 &&
                new Date(b.date).getTime() > Date.now() - 60 * 60 * 1000;
              return (
                <div
                  key={b.bookingId}
                  className="flex items-center gap-4 px-5 py-3.5"
                  style={{
                    borderTop: i === 0 ? "none" : "1px solid var(--rule)",
                    background: isNow ? "var(--bg-soft)" : "transparent",
                  }}
                >
                  <div className="w-14 font-mono text-[13px] text-ink">
                    {b.startTime ||
                      new Date(b.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <Avatar userId={b.studentId} size="sm" initial={b.studentName} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px]">{b.studentName || "Student"}</div>
                    <div className="text-[12.5px] text-ink-faded">{b.type || b.status}</div>
                  </div>
                  {b.type === "trial" && <span className="chip chip-accent">Free trial</span>}
                  {isNow && (
                    <span className="chip chip-accent">
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-accent" /> Starting now
                    </span>
                  )}
                  <Link href={`/bookings/${b.bookingId}`} className="btn-ghost text-sm">Notes</Link>
                  <Link href={`/bookings/${b.bookingId}`} className="btn-accent btn-sm">Open</Link>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Needs your attention — 4 pickup tiles */}
      <Section title="Needs your attention">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <PickupTile
            tag="Bookings"
            title={`${pendingRequests.length} pending request${pendingRequests.length === 1 ? "" : "s"}`}
            sub={pendingRequests.length > 0 ? "Propose times or decline" : "Nothing waiting"}
            href="/requests"
          />
          <PickupTile
            tag="Messages"
            title={unreadMsg > 0 ? `${unreadMsg} unread message${unreadMsg === 1 ? "" : "s"}` : "Inbox clear"}
            sub="Reply to students"
            href="/mailbox"
          />
          <PickupTile
            tag="Earnings"
            title="View payouts"
            sub="Weekly Stripe payout"
            href="/teacher/earnings"
          />
          <PickupTile
            tag="Profile"
            title="Add a profile video"
            sub="Improves listing rank"
            href="/profile"
          />
        </div>
      </Section>

      {/* Your students — 5-col table */}
      <Section
        title="Your students"
        action={<Link href="/teacher/students" className="btn-ghost text-sm">All students</Link>}
      >
        <div className="card overflow-hidden p-0">
          {todayBookings.slice(0, 5).map((b, i) => (
            <div
              key={`student-${b.bookingId}`}
              className="grid items-center gap-3 px-5 py-3.5"
              style={{
                borderTop: i === 0 ? "none" : "1px solid var(--rule)",
                gridTemplateColumns: "2fr 1.5fr 1fr 1fr auto",
              }}
            >
              <div className="flex items-center gap-2.5">
                <Avatar userId={b.studentId} size="sm" initial={b.studentName} />
                <div>
                  <div className="text-sm">{b.studentName || "Student"}</div>
                  <div className="text-xs text-ink-faded">{b.type || "Regular"}</div>
                </div>
              </div>
              <div className="text-[12.5px] text-ink-soft">
                Next: {b.startTime || new Date(b.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
              <div className="text-[12.5px] text-accent-deep">+— grade</div>
              <div className="text-[12.5px] text-ink-soft">— attended</div>
              <Link href={`/bookings/${b.bookingId}`} className="btn-outline btn-sm">View</Link>
            </div>
          ))}
          {todayBookings.length === 0 && (
            <div className="px-5 py-6 text-center text-sm text-ink-soft">
              No students yet. Bookings will appear here as students book you.
            </div>
          )}
        </div>
      </Section>

      <div className="h-16" />
    </main>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 pt-6 sm:px-8 sm:pt-7">
      <div className="flex items-end justify-between gap-2 pb-3.5">
        <h2 className="text-[22px] font-bold tracking-[-0.01em]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-[18px]">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">{label}</div>
      <div className="mt-1.5 text-[34px] font-bold leading-none tracking-[-0.02em]">{value}</div>
      {sub && <div className={`mt-1.5 text-[12.5px] ${accent ? "text-accent-deep" : "text-ink-soft"}`}>{sub}</div>}
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
    <Link href={href as never} className="card-interactive block p-[18px]">
      <div className="font-mono text-[10.5px] uppercase text-accent">{tag}</div>
      <div className="mt-2 text-lg font-bold leading-tight tracking-[-0.005em]">{title}</div>
      <div className="mt-2 text-[12.5px] text-ink-faded">{sub}</div>
    </Link>
  );
}
