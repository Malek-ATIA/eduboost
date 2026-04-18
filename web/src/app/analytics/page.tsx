"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, type Role } from "@/lib/cognito";
import { api } from "@/lib/api";

type UserMetrics = {
  userId: string;
  displayName: string;
  sessionsAttended: number;
  attendanceRate: number | null;
  totalHoursAttended: number;
  totalSpentCents: number;
  currency: string;
  bookingCount: number;
  reviewsLeft: number;
  aiGradeAvg: number | null;
  aiGradeCount: number;
};

type ParentResponse = {
  self: UserMetrics;
  children: UserMetrics[];
  summary: {
    totalSpentCents: number;
    sessionsAttended: number;
    currency: string;
    childCount: number;
  };
};

type TeacherMetrics = {
  userId: string;
  displayName: string;
  sessionsHeld: number;
  upcomingSessions: number;
  hoursTaught: number;
  uniqueStudents: number;
  totalBookings: number;
  totalEarningsCents: number;
  currency: string;
  ratingAvg: number | null;
  ratingCount: number;
  gradesGiven: number;
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [student, setStudent] = useState<UserMetrics | null>(null);
  const [parent, setParent] = useState<ParentResponse | null>(null);
  const [teacher, setTeacher] = useState<TeacherMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      const r = currentRole(session);
      if (r !== "student" && r !== "parent" && r !== "teacher") {
        return router.replace("/dashboard");
      }
      setRole(r);
      try {
        if (r === "parent") {
          const p = await api<ParentResponse>(`/analytics/parent`);
          setParent(p);
        } else if (r === "teacher") {
          const t = await api<TeacherMetrics>(`/analytics/teacher`);
          setTeacher(t);
        } else {
          const s = await api<UserMetrics>(`/analytics/student`);
          setStudent(s);
        }
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Insights</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">
            {role === "parent"
              ? "Family analytics"
              : role === "teacher"
                ? "Teaching analytics"
                : "My learning analytics"}
          </h1>
        </div>
        <Link href="/dashboard" className="btn-ghost">
          ← Dashboard
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {!error && !student && !parent && !teacher && (
        <p className="mt-6 text-sm text-ink-soft">Loading...</p>
      )}

      {student && <MetricsGrid title="Totals" m={student} />}

      {teacher && (
        <section className="card mt-8 p-5">
          <h2 className="font-display text-xl text-ink">Totals</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Stat
              label="Earnings (net)"
              value={`${teacher.currency} ${(teacher.totalEarningsCents / 100).toFixed(2)}`}
            />
            <Stat label="Sessions held" value={String(teacher.sessionsHeld)} />
            <Stat label="Hours taught" value={String(teacher.hoursTaught)} />
            <Stat label="Upcoming sessions" value={String(teacher.upcomingSessions)} />
            <Stat label="Unique students" value={String(teacher.uniqueStudents)} />
            <Stat label="Total bookings" value={String(teacher.totalBookings)} />
            <Stat
              label="Rating"
              value={
                teacher.ratingAvg === null || teacher.ratingCount === 0
                  ? "—"
                  : `★ ${teacher.ratingAvg.toFixed(1)} (${teacher.ratingCount})`
              }
            />
            <Stat label="AI grades given" value={String(teacher.gradesGiven)} />
          </div>
        </section>
      )}

      {parent && (
        <>
          <section className="card mt-8 p-5">
            <h2 className="font-display text-xl text-ink">Household summary</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Total spent"
                value={`${parent.summary.currency} ${(
                  parent.summary.totalSpentCents / 100
                ).toFixed(2)}`}
              />
              <Stat
                label="Sessions attended"
                value={String(parent.summary.sessionsAttended)}
              />
              <Stat label="Linked children" value={String(parent.summary.childCount)} />
              <Stat label="Your bookings" value={String(parent.self.bookingCount)} />
            </div>
          </section>

          <MetricsGrid title="Yours" m={parent.self} />

          {parent.children.map((c) => (
            <MetricsGrid key={c.userId} title={c.displayName} m={c} />
          ))}

          {parent.children.length === 0 && (
            <p className="mt-6 text-sm text-ink-soft">
              Link a child from{" "}
              <Link href="/parent/children" className="underline">
                My children
              </Link>{" "}
              to see their activity here.
            </p>
          )}
        </>
      )}
    </main>
  );
}

function MetricsGrid({ title, m }: { title: string; m: UserMetrics }) {
  return (
    <section className="card mt-8 p-5">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Stat
          label="Total spent"
          value={`${m.currency} ${(m.totalSpentCents / 100).toFixed(2)}`}
        />
        <Stat label="Sessions attended" value={String(m.sessionsAttended)} />
        <Stat
          label="Attendance rate"
          value={
            m.attendanceRate === null
              ? "—"
              : `${Math.round(m.attendanceRate * 100)}%`
          }
        />
        <Stat label="Total bookings" value={String(m.bookingCount)} />
        <Stat label="Reviews left" value={String(m.reviewsLeft)} />
        <Stat
          label="AI grade avg"
          value={
            m.aiGradeAvg === null
              ? "—"
              : `${Math.round(m.aiGradeAvg)}% (${m.aiGradeCount})`
          }
        />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mt-1 font-display text-lg text-ink">{value}</div>
    </div>
  );
}
