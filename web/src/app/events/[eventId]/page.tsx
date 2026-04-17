"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type EventData = {
  eventId: string;
  organizerId: string;
  title: string;
  description?: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  priceCents: number;
  currency: string;
  status: "draft" | "published" | "cancelled" | "completed";
};

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<EventData>(`/events/${eventId}`);
      setEvent(r);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function buyTicket() {
    setBuying(true);
    setError(null);
    setMessage(null);
    try {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      const r = await api<{ outcome?: string; clientSecret?: string }>(
        `/events/${eventId}/tickets`,
        { method: "POST" },
      );
      if (r.outcome === "free_ticket_issued") {
        setMessage("Ticket reserved! See you there.");
      } else if (r.clientSecret) {
        // MVP: redirect the buyer to a hosted Stripe-style confirm page.
        // A full Elements integration is out of scope for this phase — we
        // surface the client secret so the tester can complete checkout.
        setMessage(
          `Stripe checkout started. Complete payment with client secret: ${r.clientSecret.slice(0, 16)}...`,
        );
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBuying(false);
    }
  }

  if (error && !event) {
    return <main className="mx-auto max-w-2xl px-6 py-12 text-sm text-red-600">{error}</main>;
  }
  if (!event) return <main className="mx-auto max-w-2xl px-6 py-12">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">{event.title}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {new Date(event.startsAt).toLocaleString()} –{" "}
        {new Date(event.endsAt).toLocaleTimeString()} · {event.venue}
      </p>

      {event.description && (
        <p className="mt-6 whitespace-pre-wrap text-sm">{event.description}</p>
      )}

      <div className="mt-8 rounded border p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">Ticket</div>
            <div className="font-mono text-lg font-bold">
              {event.priceCents === 0
                ? "Free"
                : `${event.currency} ${(event.priceCents / 100).toFixed(2)}`}
            </div>
          </div>
          <button
            onClick={buyTicket}
            disabled={buying || event.status !== "published"}
            className="rounded bg-black px-5 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {buying
              ? "Reserving..."
              : event.priceCents === 0
                ? "Reserve a ticket"
                : "Buy ticket"}
          </button>
        </div>
        {event.status !== "published" && (
          <p className="mt-2 text-xs text-gray-500">
            This event is not currently accepting tickets ({event.status}).
          </p>
        )}
        {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <p className="mt-8 text-sm">
        <Link href="/events" className="text-gray-500 underline">
          ← All events
        </Link>
      </p>
    </main>
  );
}
