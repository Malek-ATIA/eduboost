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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Upcoming events</h1>
        {role === "teacher" && (
          <Link
            href="/events/new"
            className="rounded border px-3 py-1 text-sm"
          >
            Host an event
          </Link>
        )}
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No upcoming events. Check back soon.</p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((e) => (
            <li key={e.eventId}>
              <Link
                href={`/events/${e.eventId}` as never}
                className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{e.title}</div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {new Date(e.startsAt).toLocaleString()} · {e.venue} · cap {e.capacity}
                    </div>
                  </div>
                  <span className="font-mono text-sm">
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
        <Link href="/dashboard" className="text-gray-500 underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
