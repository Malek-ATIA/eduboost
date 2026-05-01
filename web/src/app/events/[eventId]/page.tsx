"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { Avatar } from "@/components/Avatar";

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

type OrganizerInfo = {
  displayName?: string;
  userId: string;
};

type RelatedEvent = {
  eventId: string;
  title: string;
  venue: string;
  startsAt: string;
  priceCents: number;
  currency: string;
  capacity: number;
};

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  published: { label: "Open", color: "bg-green-50 text-green-700 border-green-200" },
  draft: { label: "Draft", color: "bg-parchment-dark text-ink-faded border-ink-faded/30" },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200" },
  completed: { label: "Completed", color: "bg-blue-50 text-blue-700 border-blue-200" },
};

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
  const [organizer, setOrganizer] = useState<OrganizerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [viewerSub, setViewerSub] = useState<string | null>(null);
  const [related, setRelated] = useState<RelatedEvent[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await api<EventData>(`/events/${eventId}`);
      setEvent(r);
      api<OrganizerInfo>(`/users/${r.organizerId}/public`)
        .then(setOrganizer)
        .catch(() => setOrganizer({ userId: r.organizerId }));
      api<{ items: RelatedEvent[] }>(`/events`)
        .then((res) =>
          setRelated(
            res.items
              .filter((e) => e.eventId !== eventId)
              .filter((e) => new Date(e.startsAt).getTime() > Date.now() - 3_600_000)
              .slice(0, 3),
          ),
        )
        .catch(() => {});
    } catch (err) {
      setError((err as Error).message);
    }
  }, [eventId]);

  useEffect(() => {
    load();
    currentSession().then((s) => {
      if (s) setViewerSub((s.getIdToken().payload.sub as string) ?? null);
    });
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

  async function cancelEvent() {
    if (!confirm("Cancel this event? All ticket holders will be refunded and notified. This cannot be undone.")) return;
    try {
      const r = await api<{ ok: boolean; ticketsRefunded?: number; ticketsFailed?: number }>(`/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (r.ticketsRefunded && r.ticketsRefunded > 0) {
        alert(`Event cancelled. ${r.ticketsRefunded} ticket(s) refunded.${r.ticketsFailed ? ` ${r.ticketsFailed} refund(s) failed — check support.` : ""}`);
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const isOrganizer = viewerSub === event?.organizerId;

  if (error && !event) {
    return (
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-sm text-seal">{error}</main>
    );
  }
  if (!event) {
    return (
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
        </div>
      </main>
    );
  }

  const isFree = event.priceCents === 0;
  const isUpcoming = new Date(event.startsAt).getTime() > Date.now();
  const statusInfo = STATUS_STYLES[event.status] ?? STATUS_STYLES.draft;

  const startDate = new Date(event.startsAt);
  const endDate = new Date(event.endsAt);
  const durationMs = endDate.getTime() - startDate.getTime();
  const durationHrs = Math.round(durationMs / 3_600_000 * 10) / 10;
  const durationLabel =
    durationHrs < 1
      ? `${Math.round(durationMs / 60_000)} min`
      : durationHrs === 1
        ? "1 hour"
        : `${durationHrs} hours`;

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
      {/* Breadcrumb */}
      <nav className="text-sm text-ink-faded">
        <Link href="/events" className="hover:text-ink">
          Events
        </Link>
        <span className="mx-2">›</span>
        <span className="text-ink">{event.title}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main content */}
        <div>
          {/* Status + date badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {isFree && (
              <span className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                Free event
              </span>
            )}
            {isUpcoming && event.status === "published" && (
              <span className="rounded-md border border-seal/40 bg-seal/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-seal">
                Upcoming
              </span>
            )}
          </div>

          <h1 className="mt-3 font-display text-3xl tracking-tight text-ink lg:text-4xl">
            {event.title}
          </h1>

          {/* Quick info */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span className="flex items-center gap-1.5">
              <span>📅</span>
              {startDate.toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1.5">
              <span>🕐</span>
              {startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              {" – "}
              {endDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>

          {/* Description */}
          {event.description ? (
            <div className="mt-6">
              <h2 className="eyebrow mb-2">About this event</h2>
              <div className="whitespace-pre-wrap leading-relaxed text-ink">
                {event.description}
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm italic text-ink-faded">No description provided.</p>
          )}

          {/* Event details table */}
          <div className="mt-8">
            <h2 className="eyebrow mb-3">Event details</h2>
            <div className="card divide-y divide-ink-faded/20">
              <div className="flex items-center justify-between p-3">
                <span className="text-sm text-ink-soft">Date</span>
                <span className="text-sm font-medium text-ink">
                  {startDate.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-sm text-ink-soft">Time</span>
                <span className="text-sm font-medium text-ink">
                  {startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  {" – "}
                  {endDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-sm text-ink-soft">Duration</span>
                <span className="text-sm font-medium text-ink">{durationLabel}</span>
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-sm text-ink-soft">Venue</span>
                <span className="text-sm font-medium text-ink">{event.venue}</span>
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-sm text-ink-soft">Capacity</span>
                <span className="text-sm font-medium text-ink">{event.capacity} attendees</span>
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-sm text-ink-soft">Status</span>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Ticket card */}
          <div className="card sticky top-24 space-y-4 p-5">
            <div className="flex items-center gap-3 rounded-md bg-parchment-dark p-3">
              <span className="text-3xl">🎟️</span>
              <div>
                <div className="text-sm font-medium text-ink">Event ticket</div>
                <div className="text-xs text-ink-faded">
                  {isUpcoming ? "Available now" : "Event has passed"}
                </div>
              </div>
            </div>

            <div>
              <div className="font-display text-3xl text-ink">
                {isFree ? "Free" : formatMoney(event.priceCents, event.currency, { trim: true })}
              </div>
              {!isFree && (
                <div className="mt-0.5 text-xs text-ink-faded">per ticket</div>
              )}
            </div>

            <button
              onClick={buyTicket}
              disabled={buying || event.status !== "published"}
              className="btn-seal w-full"
            >
              {buying
                ? "Reserving..."
                : event.status !== "published"
                  ? `Event ${event.status}`
                  : isFree
                    ? "Reserve a free ticket"
                    : "Buy ticket"}
            </button>

            {message && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {message}
              </div>
            )}
            {error && event && <p className="text-sm text-seal">{error}</p>}

            <div className="border-t border-ink-faded/20 pt-3">
              <div className="flex items-center gap-2 text-xs text-ink-faded">
                <span>✓</span>
                <span>{isFree ? "No payment required" : "Secure payment via Stripe"}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-ink-faded">
                <span>✓</span>
                <span>Confirmation sent by email</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-ink-faded">
                <span>✓</span>
                <span>{event.capacity} spots total</span>
              </div>
            </div>
          </div>

          {/* Organizer actions */}
          {isOrganizer && event.status !== "cancelled" && event.status !== "completed" && (
            <div className="card p-4">
              <h3 className="eyebrow mb-3">Manage event</h3>
              <button
                onClick={cancelEvent}
                className="w-full rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
              >
                Cancel event
              </button>
            </div>
          )}

          {/* Organizer card */}
          <div className="card p-4">
            <h3 className="eyebrow mb-3">Organized by</h3>
            <div className="flex items-center gap-3">
              <Avatar userId={event.organizerId} size="md" initial={organizer?.displayName?.charAt(0)} />
              <div>
                <div className="font-display text-sm text-ink">
                  {organizer?.displayName || "EduBoost Organizer"}
                </div>
                <Link
                  href={`/teachers/${event.organizerId}` as never}
                  className="text-xs text-seal hover:underline"
                >
                  View profile →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related events */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="eyebrow mb-4">More upcoming events</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.eventId}
                href={`/events/${r.eventId}` as never}
                className="card block p-4 transition hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">📅</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-ink-faded">
                    {new Date(r.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                  {r.priceCents === 0 && (
                    <span className="ml-auto rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-semibold uppercase text-green-700">
                      Free
                    </span>
                  )}
                </div>
                <h3 className="mt-2 font-display text-sm text-ink">{r.title}</h3>
                <div className="mt-1 text-xs text-ink-faded">
                  {r.venue} · {r.capacity} spots
                </div>
                {r.priceCents > 0 && (
                  <div className="mt-2 font-display text-sm text-ink">
                    {formatMoney(r.priceCents, r.currency, { trim: true })}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
