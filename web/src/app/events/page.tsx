"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { currentRole, currentSession, type Role } from "@/lib/cognito";

type EventRow = {
  eventId: string;
  title: string;
  venue: string;
  startsAt: string;
  priceCents: number;
  currency: string;
  capacity: number;
};

export default function EventsListPage() {
  const [items, setItems] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    api<{ items: EventRow[] }>(`/events`)
      .then((r) => setItems(r.items))
      .catch((e) => setError((e as Error).message));
    // Gate the "Host an event" CTA on role — only teachers can create events
    // server-side, so non-teachers would just bounce off the /events/new
    // endpoint. Hide the button client-side to avoid the broken-link UX.
    currentSession().then((s) => setRole(currentRole(s)));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Gatherings</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Upcoming events</h1>
        </div>
        {role === "teacher" && (
          <Link
            href="/events/new"
            className="btn-seal"
          >
            Host an event
          </Link>
        )}
      </div>
      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No upcoming events. Check back soon.</p>
      )}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-ink-faded/30">
          {items.map((e) => (
            <li key={e.eventId}>
              <Link
                href={`/events/${e.eventId}` as never}
                className="block p-4 transition hover:bg-parchment-shade"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-base text-ink">{e.title}</div>
                    <div className="mt-0.5 text-xs text-ink-faded">
                      {new Date(e.startsAt).toLocaleString()} · {e.venue} · cap {e.capacity}
                    </div>
                  </div>
                  <span className="font-mono text-sm text-ink">
                    {e.priceCents === 0
                      ? "Free"
                      : `${e.currency} ${(e.priceCents / 100).toFixed(2)}`}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-ink-soft underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
