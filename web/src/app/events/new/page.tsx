"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

export default function NewEventPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [capacity, setCapacity] = useState(20);
  const [priceEur, setPriceEur] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setSubmitting(true);
    setError(null);
    try {
      const priceCents = Math.round(Number(priceEur) * 100);
      const evt = await api<{ eventId: string }>(`/events`, {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || undefined,
          venue,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          capacity,
          priceCents,
          currency: "EUR",
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
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="label">Starts</span>
            <input
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Ends</span>
            <input
              type="datetime-local"
              required
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
            <span className="label">Ticket price (EUR, 0 for free)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={priceEur}
              onChange={(e) => setPriceEur(e.target.value)}
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
