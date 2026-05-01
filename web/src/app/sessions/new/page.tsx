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
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    currentSession().then((s) => {
      if (!s) router.replace("/login");
    });
  }, [router]);

  const selectedDate = new Date(date);
  const endTime = new Date(selectedDate.getTime() + durationMin * 60_000);
  const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
  const isPast = selectedDate.getTime() < Date.now();

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
      setSuccess(true);
      setTimeout(() => router.replace(`/calendar` as never), 1500);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("booking_not_paid")) {
        setError("Booking must be paid (confirmed) before scheduling.");
      } else if (msg.includes("not_your_booking")) {
        setError("That booking doesn't belong to you.");
      } else if (msg.includes("not_your_classroom")) {
        setError("That classroom doesn't belong to you.");
      } else if (msg.includes("booking_not_found") || msg.includes("classroom_not_found")) {
        setError("Target not found. Please check the link and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!bookingId && !classroomId) {
    return (
      <main className="mx-auto max-w-lg px-6 pb-24 pt-16">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parchment-dark">
            <span className="text-2xl">📅</span>
          </div>
          <h1 className="mt-4 font-display text-2xl tracking-tight text-ink">
            Schedule a session
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            To schedule a session, navigate to a booking or classroom and use the "Schedule" action.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/teacher/bookings" className="btn-seal">
              My bookings
            </Link>
            <Link href="/classrooms" className="btn-ghost">
              My classrooms
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="mx-auto max-w-lg px-6 pb-24 pt-16">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
            <span className="text-2xl">✅</span>
          </div>
          <h1 className="mt-4 font-display text-2xl text-ink">Session scheduled!</h1>
          <p className="mt-2 text-sm text-ink-soft">Redirecting to your calendar...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 pb-24 pt-16">
      {/* Back link */}
      <Link
        href={bookingId ? "/teacher/bookings" : "/classrooms"}
        className="inline-flex items-center gap-1 text-sm text-ink-faded transition hover:text-ink"
      >
        ← {bookingId ? "Back to bookings" : "Back to classrooms"}
      </Link>

      {/* Header */}
      <div className="mt-4">
        <p className="eyebrow">Session</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">
          Schedule a session
        </h1>
      </div>

      {/* Context card */}
      <div className="card mt-6 flex items-center gap-3 bg-parchment-dark p-4">
        <span className="text-2xl">{bookingId ? "📋" : "🏫"}</span>
        <div>
          <div className="text-sm font-medium text-ink">
            {bookingId ? "Booking session" : "Classroom session"}
          </div>
          <div className="font-mono text-xs text-ink-faded">
            {bookingId || classroomId}
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="card mt-6 overflow-hidden">
        <div className="border-b border-ink-faded/20 bg-parchment-dark px-5 py-3">
          <h2 className="font-display text-base text-ink">Session details</h2>
        </div>

        <div className="space-y-5 p-5">
          {/* Date & time */}
          <div>
            <label className="label">Date & time</label>
            <input
              required
              type="datetime-local"
              min={toLocalInput(new Date())}
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {isPast && (
              <p className="mt-1 text-xs text-seal">Selected time is in the past</p>
            )}
            {isWeekend && !isPast && (
              <p className="mt-1 text-xs text-amber-600">This is a weekend day</p>
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="label">Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {[30, 45, 60, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationMin(d)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                    durationMin === d
                      ? "border-seal bg-seal/10 text-seal"
                      : "border-ink-faded/30 text-ink-soft hover:border-ink-faded"
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
            <div className="mt-2">
              <label className="flex items-center gap-2 text-xs text-ink-faded">
                Custom:
                <input
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  className="input w-20 text-sm"
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                />
                minutes
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-md bg-parchment-dark p-4">
            <h4 className="eyebrow mb-2">Session preview</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-ink">
                <span>📅</span>
                <span>
                  {selectedDate.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-ink">
                <span>🕐</span>
                <span>
                  {selectedDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  {" – "}
                  {endTime.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-ink">
                <span>⏱️</span>
                <span>{durationMin} minutes</span>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href={bookingId ? "/teacher/bookings" : "/classrooms"}
              className="btn-ghost flex-1 text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || isPast}
              className="btn-seal flex-1"
            >
              {submitting ? "Scheduling..." : "Schedule session"}
            </button>
          </div>
        </div>
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
        <main className="mx-auto max-w-lg px-6 pb-24 pt-16">
          <p className="eyebrow">Session</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">Schedule a session</h1>
          <div className="mt-8 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
          </div>
        </main>
      }
    >
      <NewSessionForm />
    </Suspense>
  );
}
