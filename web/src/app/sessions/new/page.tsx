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
      <main className="mx-auto max-w-md px-6 py-12">
        <h1 className="text-2xl font-bold">Schedule a session</h1>
        <p className="mt-4 text-sm text-red-600">
          Missing bookingId or classroomId in the URL.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Link
        href={bookingId ? "/teacher/bookings" : "/dashboard"}
        className="text-sm text-gray-500 underline"
      >
        ← Back
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Schedule a session</h1>
      <p className="mt-1 text-sm text-gray-500">
        {bookingId ? `For booking ${bookingId}` : `For classroom ${classroomId}`}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Start</span>
          <input
            required
            type="datetime-local"
            className="w-full rounded border px-3 py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Duration (minutes)</span>
          <input
            required
            type="number"
            min={15}
            max={480}
            step={15}
            className="w-full rounded border px-3 py-2"
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-5 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
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
        <main className="mx-auto max-w-md px-6 py-12">
          <h1 className="text-2xl font-bold">Schedule a session</h1>
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </main>
      }
    >
      <NewSessionForm />
    </Suspense>
  );
}
