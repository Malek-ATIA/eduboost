"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { toMinorUnits } from "@/lib/money";

// Format a Date as the local `datetime-local` input value (YYYY-MM-DDTHH:mm).
// Must NOT include a timezone suffix — browsers reject anything else.
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewEventPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  // Default to tomorrow 18:00 local, end at 20:00. The defaults reduce the
  // number of clicks for the common case (weekend evening workshop).
  const defaults = (() => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(18, 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 3600 * 1000);
    return { start: toLocalInput(start), end: toLocalInput(end) };
  })();
  const [startsAt, setStartsAt] = useState(defaults.start);
  const [endsAt, setEndsAt] = useState(defaults.end);
  const [capacity, setCapacity] = useState(20);
  const [priceTnd, setPriceTnd] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `min` on the datetime picker — blocks past dates in the UI. Backend also
  // rejects past startsAt via zod; this is belt-and-braces UX only.
  const minStart = toLocalInput(new Date());

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      if (currentRole(s) !== "teacher") return router.replace("/dashboard");
      setReady(true);
    })();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);
    if (endDate <= startDate) {
      setError("End time must be after the start time.");
      return;
    }
    if (startDate.getTime() < Date.now()) {
      setError("Start time can't be in the past.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const priceCents = toMinorUnits(Number(priceTnd), "TND");
      const evt = await api<{ eventId: string }>(`/events`, {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || undefined,
          venue,
          startsAt: startDate.toISOString(),
          endsAt: endDate.toISOString(),
          capacity,
          priceCents,
          currency: "TND",
        }),
      });
      // Publish immediately so it shows on /events. Draft → published via patch.
      await api(`/events/${evt.eventId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "published" }),
      });
      router.replace(`/events/${evt.eventId}` as never);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <p className="eyebrow">Events</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Host an event</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Workshops, group classes, online meetups — anything ticketed.
      </p>

      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6">
        <label className="block">
          <span className="label">Title</span>
          <input
            required
            minLength={3}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
          />
        </label>
        <label className="block">
          <span className="label">Venue</span>
          <input
            required
            minLength={1}
            maxLength={200}
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className="input"
            placeholder="Online / physical address"
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Starts</span>
            <input
              type="datetime-local"
              required
              min={minStart}
              value={startsAt}
              onChange={(e) => {
                setStartsAt(e.target.value);
                // Keep the end picker at least 1 minute after the new start
                // so the two controls can't cross each other.
                const newStart = new Date(e.target.value);
                const curEnd = new Date(endsAt);
                if (!isNaN(newStart.getTime()) && (isNaN(curEnd.getTime()) || curEnd <= newStart)) {
                  setEndsAt(toLocalInput(new Date(newStart.getTime() + 2 * 3600 * 1000)));
                }
              }}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Ends</span>
            <input
              type="datetime-local"
              required
              min={startsAt || minStart}
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="input"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="label">Capacity</span>
            <input
              type="number"
              required
              min={1}
              max={10000}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Ticket price (TND, 0 for free)</span>
            <input
              type="number"
              min={0}
              step="0.001"
              value={priceTnd}
              onChange={(e) => setPriceTnd(e.target.value)}
              className="input"
            />
          </label>
        </div>
        <label className="block">
          <span className="label">Description (optional)</span>
          <textarea
            rows={4}
            maxLength={4000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
          />
        </label>
        {error && <p className="text-sm text-seal">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="btn-seal"
        >
          {submitting ? "Creating..." : "Publish event"}
        </button>
      </form>

      <p className="mt-8 text-sm">
        <Link href="/events" className="text-ink-soft underline">
          ← All events
        </Link>
      </p>
    </main>
  );
}
