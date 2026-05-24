"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";

type ChildLink = {
  parentId: string;
  childId: string;
  status: "pending" | "accepted" | "rejected";
  child: { userId: string; displayName: string; email: string } | null;
};

type Booking = {
  bookingId: string;
  studentId: string;
  teacherId: string;
  teacherName?: string;
  date: string;
  startTime?: string;
  status: string;
  amountCents?: number;
  currency?: string;
};

export default function ParentDashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [children, setChildren] = useState<ChildLink[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      const role = currentRole(s);
      if (role !== "parent" && !isAdmin(s)) return router.replace("/dashboard");
      setReady(true);

      api<{ items: ChildLink[] }>("/parent/children")
        .then((r) => {
          const accepted = r.items.filter((c) => c.status === "accepted" && c.child);
          setChildren(accepted);
          if (accepted[0]) setActiveChildId(accepted[0].childId);
        })
        .catch(() => {});

      api<{ items: Booking[] }>("/bookings/mine")
        .then((r) => setBookings(r.items.slice(0, 3)))
        .catch(() => {});
    })();
  }, [router]);

  if (!ready)
    return (
      <main className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
      </main>
    );

  const activeChild = children.find((c) => c.childId === activeChildId) ?? children[0];
  const firstName = activeChild?.child?.displayName.split(" ")[0] ?? "your child";

  return (
    <main>
      {/* PageHead with child switcher */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-rule px-4 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
        <div>
          <div className="eyebrow">Family view</div>
          <h1 className="mt-2 text-[clamp(28px,3vw,40px)] font-bold tracking-[-0.018em]">
            How <span className="text-accent">{firstName}</span> is doing.
          </h1>
          <p className="mt-2 max-w-[640px] text-[14.5px] text-ink-soft">
            Attendance, grades, and what&apos;s coming up — all in one place. No micromanaging.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-rule bg-white p-1">
          {children.map((c) => (
            <button
              key={c.childId}
              onClick={() => setActiveChildId(c.childId)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                activeChildId === c.childId ? "bg-ink text-white" : "text-ink-soft"
              }`}
            >
              {c.child?.displayName.split(" ")[0]}
            </button>
          ))}
          <Link href="/parent/children" className="px-3 py-1.5 text-[13px] text-ink-faded">
            +
          </Link>
        </div>
      </div>

      {/* This month — 4 stat cards */}
      <Section title="This month">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Sessions attended" value="—" sub="No data yet" />
          <Stat label="Hours studied" value="—" sub="Will track soon" />
          <Stat label="Average grade" value="—" sub="Awaiting grades" accent />
          <Stat label="Spent" value="—" sub="No payments yet" />
        </div>
      </Section>

      {/* Upcoming sessions */}
      <Section title="Upcoming sessions">
        {bookings.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-soft">
            No upcoming sessions for {firstName} yet.
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            {bookings.map((b, i) => {
              const d = new Date(b.date);
              return (
                <div
                  key={b.bookingId}
                  className="flex items-center gap-4 px-5 py-3.5"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--rule)" }}
                >
                  <div className="w-16">
                    <div className="text-[12.5px] text-ink-soft">
                      {d.toLocaleDateString(undefined, { weekday: "short" })}
                    </div>
                    <div className="font-mono text-[13px]">
                      {b.startTime || d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <Avatar userId={b.teacherId} size="sm" initial={b.teacherName} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px]">Session with {b.teacherName || "teacher"}</div>
                    <div className="text-[12.5px] text-ink-faded">{b.status}</div>
                  </div>
                  {b.amountCents != null && (
                    <div className="text-[13px] text-ink-soft">
                      {(b.amountCents / 1000).toFixed(0)} DT
                    </div>
                  )}
                  <Link href={`/bookings/${b.bookingId}`} className="btn-ghost text-sm">Reschedule</Link>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Grade trajectory chart */}
      <Section title={`Grade trajectory · ${firstName}`}>
        <div className="card p-6">
          <div className="mb-3.5 flex items-end justify-between">
            <div>
              <div className="text-4xl font-bold tracking-[-0.02em]">—</div>
              <div className="text-[12.5px] text-accent-deep">No grade data yet</div>
            </div>
            <div className="flex gap-3.5 text-xs text-ink-faded">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {firstName}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-ink-mute" /> Class avg
              </span>
            </div>
          </div>
          <svg viewBox="0 0 600 140" className="w-full">
            <line x1="0" y1="120" x2="600" y2="120" stroke="var(--rule)" strokeWidth="1" />
            <line x1="0" y1="80" x2="600" y2="80" stroke="var(--rule)" strokeWidth="1" strokeDasharray="3 4" />
            <line x1="0" y1="40" x2="600" y2="40" stroke="var(--rule)" strokeWidth="1" strokeDasharray="3 4" />
            <polyline
              points="0,110 60,108 120,100 180,92 240,80 300,72 360,62 420,48 480,42 540,32 600,28"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
            />
            <polyline
              points="0,95 60,93 120,90 180,88 240,85 300,82 360,80 420,78 480,76 540,74 600,72"
              fill="none"
              stroke="var(--ink-mute)"
              strokeWidth="1.5"
              strokeDasharray="2 3"
            />
          </svg>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-ink-faded">
            <span>FEB</span>
            <span>MAR</span>
            <span>APR</span>
            <span>MAY</span>
          </div>
        </div>
      </Section>

      {/* Teachers */}
      <Section
        title="Teachers"
        action={<Link href="/teachers" className="btn-ghost text-sm">Find another teacher</Link>}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {Array.from(new Set(bookings.map((b) => b.teacherId)))
            .slice(0, 3)
            .map((teacherId) => {
              const b = bookings.find((x) => x.teacherId === teacherId);
              return (
                <div key={teacherId} className="card flex gap-3 p-[18px]">
                  <Avatar userId={teacherId} size="md" initial={b?.teacherName} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[17px] font-bold">{b?.teacherName || "Teacher"}</div>
                    <div className="text-xs text-ink-faded">Since recently</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[13px] text-ink-soft">
                        {b?.amountCents != null ? `${(b.amountCents / 1000).toFixed(0)} DT/hr` : "—"}
                      </span>
                      <Link href={`/chat/${teacherId}` as never} className="btn-ghost text-sm">
                        Message
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          {bookings.length === 0 && (
            <div className="card col-span-full p-6 text-center text-sm text-ink-soft">
              No teachers yet. Browse and book to see them here.
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
