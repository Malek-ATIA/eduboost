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

export default function AnalyticsPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [student, setStudent] = useState<UserMetrics | null>(null);
  const [parent, setParent] = useState<ParentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      const r = currentRole(session);
      if (r !== "student" && r !== "parent") {
        return router.replace("/dashboard");
      }
      setRole(r);
      try {
        if (r === "parent") {
          const p = await api<ParentResponse>(`/analytics/parent`);
          setParent(p);
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
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {role === "parent" ? "Family analytics" : "My learning analytics"}
        </h1>
        <Link href="/dashboard" className="text-sm text-gray-500 underline">
          ← Dashboard
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {!error && !student && !parent && (
        <p className="mt-6 text-sm text-gray-500">Loading...</p>
      )}

      {student && <MetricsGrid title="Totals" m={student} />}

      {parent && (
        <>
          <section className="mt-8 rounded border p-5">
            <h2 className="text-lg font-semibold">Household summary</h2>
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
            <p className="mt-6 text-sm text-gray-500">
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
    <section className="mt-8 rounded border p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
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
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
