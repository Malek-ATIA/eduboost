"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

function NewSessionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") ?? "";
  const classroomId = searchParams.get("classroomId") ?? "";

  const defaultDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setMinutes(0, 0, 0);
    return d;
  }, []);

  const [date, setDate] = useState(toLocalInput(defaultDate));
  const [durationMin, setDurationMin] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    currentSession().then((s) => {
      if (!s) router.replace("/login");
    });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const startsAt = new Date(date).toISOString();
      const endsAt = new Date(new Date(date).getTime() + durationMin * 60_000).toISOString();
      await api<unknown>(`/sessions`, {
        method: "POST",
        body: JSON.stringify({
          bookingId: bookingId || undefined,
          classroomId: classroomId || undefined,
          startsAt,
          endsAt,
        }),
      });
      router.replace(`/calendar` as never);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("booking_not_paid")) {
        setError("Booking must be paid (confirmed) before scheduling.");
      } else if (msg.includes("not_your_booking")) {
        setError("That booking doesn't belong to you.");
      } else if (msg.includes("not_your_classroom")) {
        setError("That classroom doesn't belong to you.");
      } else if (msg.includes("booking_not_found") || msg.includes("classroom_not_found")) {
        setError("Target not found.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!bookingId && !classroomId) {
    return (
      <main className="mx-auto max-w-md px-6 pb-24 pt-16">
        <p className="eyebrow">Session</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Schedule a session</h1>
        <p className="mt-4 text-sm text-seal">
          Missing bookingId or classroomId in the URL.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 pb-24 pt-16">
      <Link
        href={bookingId ? "/teacher/bookings" : "/dashboard"}
        className="btn-ghost -ml-3"
      >
        ← Back
      </Link>
      <p className="eyebrow mt-4">Session</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Schedule a session</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {bookingId ? (
          <>For booking <span className="font-mono">{bookingId}</span></>
        ) : (
          <>For classroom <span className="font-mono">{classroomId}</span></>
        )}
      </p>

      <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
        <label className="block">
          <span className="label">Start</span>
          <input
            required
            type="datetime-local"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Duration (minutes)</span>
          <input
            required
            type="number"
            min={15}
            max={480}
            step={15}
            className="input"
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
          />
        </label>

        {error && <p className="text-sm text-seal">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="btn-seal"
        >
          {submitting ? "Scheduling..." : "Schedule"}
        </button>
      </form>
    </main>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewSessionPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-6 pb-24 pt-16">
          <p className="eyebrow">Session</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Schedule a session</h1>
          <p className="mt-4 text-sm text-ink-soft">Loading...</p>
        </main>
      }
    >
      <NewSessionForm />
    </Suspense>
  );
}
