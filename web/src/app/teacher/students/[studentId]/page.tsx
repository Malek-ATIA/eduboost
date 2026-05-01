"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { formatMoney } from "@/lib/money";

type Detail = {
  user: {
    userId: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
    role: string;
  };
  bookings: {
    bookingId: string;
    type: "trial" | "single" | "package";
    status: string;
    amountCents: number;
    currency: string;
    createdAt: string;
  }[];
  classrooms: {
    classroomId: string;
    title: string;
    subject: string;
    status: string;
    joinedAt?: string;
  }[];
  grades: {
    gradeId: string;
    subject: string;
    score: number;
    maxScore: number;
    createdAt: string;
  }[];
  gradeSummary: { count: number; avg: number };
  payments: {
    paymentId: string;
    status: string;
    amountCents: number;
    platformFeeCents: number;
    currency: string;
    createdAt: string;
  }[];
  paymentsNetTotalCents: number;
  paymentsCurrency: string;
};

export default function TeacherStudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      if (currentRole(s) !== "teacher" && !isAdmin(s)) return router.replace("/dashboard");
      setReady(true);
      try {
        const r = await api<Detail>(`/teachers/me/students/${studentId}`);
        setData(r);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes("no_relation")) {
          setError("You haven't taught this student. Only your own students are visible here.");
        } else if (msg.includes("user_not_found")) {
          setError("Student not found.");
        } else {
          setError(msg);
        }
      }
    })();
  }, [router, studentId]);

  if (!ready)
    return <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-ink-soft">Loading…</main>;

  if (error)
    return (
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
        <Link href={"/teacher/students" as never} className="btn-ghost -ml-3">
          ← All students
        </Link>
        <p className="mt-6 text-sm text-seal">{error}</p>
      </main>
    );

  if (!data)
    return <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-ink-soft">Loading…</main>;

  const { user, bookings, classrooms, grades, gradeSummary, payments, paymentsNetTotalCents, paymentsCurrency } = data;

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <Link href={"/teacher/students" as never} className="btn-ghost -ml-3">
        ← All students
      </Link>

      <div className="mt-4 flex items-center gap-4">
        <Avatar userId={user.userId} size="lg" initial={user.displayName} />
        <div>
          <p className="eyebrow">Student</p>
          <h1 className="mt-1 font-display text-3xl text-ink">{user.displayName}</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            {user.email} · <span className="capitalize">{user.role}</span>
          </p>
        </div>
        <Link
          href={`/chat/${user.userId}` as never}
          className="btn-seal ml-auto"
        >
          Message
        </Link>
      </div>

      <section className="card mt-8 grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Stat label="Bookings" value={String(bookings.length)} />
        <Stat label="Classrooms" value={String(classrooms.length)} />
        <Stat
          label="Avg grade"
          value={gradeSummary.count > 0 ? `${gradeSummary.avg}%` : "—"}
          note={gradeSummary.count > 0 ? `${gradeSummary.count} graded` : undefined}
        />
        <Stat
          label="Net paid"
          value={formatMoney(paymentsNetTotalCents, paymentsCurrency)}
          note={`${payments.filter((p) => p.status === "succeeded").length} succ.`}
        />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">Classrooms we share</h2>
        {classrooms.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Not enrolled in any of your classrooms.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {classrooms.map((c) => (
              <li key={c.classroomId} className="card flex items-center justify-between p-3 text-sm">
                <div>
                  <div className="font-display text-base text-ink">{c.title}</div>
                  <div className="text-xs text-ink-faded">
                    {c.subject} · status {c.status}
                    {c.joinedAt ? ` · joined ${new Date(c.joinedAt).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <Link href={`/classrooms/${c.classroomId}` as never} className="btn-ghost">
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">Bookings</h2>
        {bookings.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No bookings with you yet.</p>
        ) : (
          <ul className="card mt-3 divide-y divide-ink-faded/30">
            {bookings.map((b) => (
              <li key={b.bookingId} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <div className="font-display text-sm capitalize text-ink">
                    {b.type} · <span className="text-ink-soft">{b.status}</span>
                  </div>
                  <div className="text-xs text-ink-faded">
                    {new Date(b.createdAt).toLocaleString()} · <span className="font-mono">{b.bookingId}</span>
                  </div>
                </div>
                <span className="font-display text-sm text-ink">
                  {formatMoney(b.amountCents, b.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">Grades I&apos;ve given</h2>
        {grades.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            No AI-graded submissions yet.{" "}
            <Link href="/teacher/grader" className="underline">
              Grade one now →
            </Link>
          </p>
        ) : (
          <ul className="card mt-3 divide-y divide-ink-faded/30">
            {grades.map((g) => (
              <li key={g.gradeId} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <div className="font-display text-sm text-ink">{g.subject}</div>
                  <div className="text-xs text-ink-faded">
                    {new Date(g.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="font-display text-sm text-ink">
                  {g.score} / {g.maxScore}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">Payments from this student</h2>
        {payments.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No payments yet.</p>
        ) : (
          <ul className="card mt-3 divide-y divide-ink-faded/30">
            {payments.map((p) => (
              <li key={p.paymentId} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <div className="font-display text-sm text-ink">
                    {formatMoney(p.amountCents - (p.platformFeeCents ?? 0), p.currency)} net
                  </div>
                  <div className="text-xs text-ink-faded">
                    gross {formatMoney(p.amountCents, p.currency)} · fee{" "}
                    {formatMoney(p.platformFeeCents ?? 0, p.currency)} ·{" "}
                    {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span
                  className={`rounded-sm border px-2 py-0.5 text-xs uppercase tracking-widest ${
                    p.status === "succeeded"
                      ? "border-seal/30 bg-seal/10 text-seal"
                      : "border-ink-faded/40 bg-parchment-dark text-ink-soft"
                  }`}
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-ink-faded">{label}</div>
      <div className="mt-1 font-display text-2xl text-ink">{value}</div>
      {note && <div className="mt-0.5 text-xs text-ink-faded">{note}</div>}
    </div>
  );
}
