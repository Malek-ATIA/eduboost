"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { currentRole, currentSession, type Role } from "@/lib/cognito";
import { formatMoney } from "@/lib/money";
import { Avatar } from "@/components/Avatar";

type EventRow = {
  eventId: string;
  organizerId: string;
  title: string;
  description?: string;
  venue: string;
  startsAt: string;
  endsAt?: string;
  priceCents: number;
  currency: string;
  capacity: number;
  status?: string;
};

type ViewMode = "grid" | "list";
type TimeFilter = "upcoming" | "past" | "all";

function eventDateRange(startsAt: string, endsAt?: string): string {
  const start = new Date(startsAt);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  if (!endsAt) return start.toLocaleDateString(undefined, opts);
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function relativeDate(dateStr: string): string {
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  const diff = target - now;
  const absDiff = Math.abs(diff);
  const days = Math.floor(absDiff / 86_400_000);
  if (diff > 0) {
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days < 7) return `In ${days} days`;
    if (days < 30) return `In ${Math.floor(days / 7)} weeks`;
    return `In ${Math.floor(days / 30)} months`;
  }
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function isUpcoming(startsAt: string): boolean {
  return new Date(startsAt).getTime() > Date.now() - 3_600_000;
}

export default function EventsListPage() {
  const [items, setItems] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("upcoming");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<{ items: EventRow[] }>(`/events`)
      .then((r) => setItems(r.items))
      .catch((e) => setError((e as Error).message));
    currentSession().then((s) => setRole(currentRole(s)));
  }, []);

  const filtered = (items ?? [])
    .filter((e) => {
      if (timeFilter === "upcoming" && !isUpcoming(e.startsAt)) return false;
      if (timeFilter === "past" && isUpcoming(e.startsAt)) return false;
      return true;
    })
    .filter((e) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const upcomingCount = (items ?? []).filter((e) => isUpcoming(e.startsAt)).length;
  const freeCount = (items ?? []).filter((e) => e.priceCents === 0 && isUpcoming(e.startsAt)).length;

  return (
    <main className="mx-auto max-w-5xl px-6 pb-24 pt-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Gatherings</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Events</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Workshops, study sessions, and community meetups
          </p>
        </div>
        {role === "teacher" && (
          <Link href="/events/new" className="btn-seal shrink-0">
            Host an event
          </Link>
        )}
      </div>

      {/* Stats bar */}
      {items && items.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-ink">{upcomingCount}</div>
            <div className="text-xs text-ink-faded">Upcoming</div>
          </div>
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-ink">{freeCount}</div>
            <div className="text-xs text-ink-faded">Free events</div>
          </div>
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-ink">{items.length}</div>
            <div className="text-xs text-ink-faded">Total events</div>
          </div>
        </div>
      )}

      {/* Filters & search */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 border-b border-ink-faded/20 sm:border-0">
          {(["upcoming", "past", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={`border-b-2 px-4 py-2 text-xs font-medium capitalize transition sm:rounded-md sm:border ${
                timeFilter === f
                  ? "border-seal text-seal sm:border-seal sm:bg-seal/10"
                  : "border-transparent text-ink-faded hover:text-ink sm:border-ink-faded/30"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="input w-full sm:w-64"
          />
          <div className="flex rounded-md border border-ink-faded/30">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-2.5 py-1.5 text-xs transition ${viewMode === "grid" ? "bg-parchment-dark text-ink" : "text-ink-faded"}`}
              title="Grid view"
            >
              ▦
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`border-l border-ink-faded/30 px-2.5 py-1.5 text-xs transition ${viewMode === "list" ? "bg-parchment-dark text-ink" : "text-ink-faded"}`}
              title="List view"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && <p className="mt-4 text-sm text-seal">{error}</p>}

      {/* Loading */}
      {items === null && !error && (
        <div className="mt-8 flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
        </div>
      )}

      {/* Empty state */}
      {items && filtered.length === 0 && (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parchment-dark">
            <span className="text-2xl">📅</span>
          </div>
          <p className="mt-4 font-display text-lg text-ink">
            {search ? "No events match your search" : timeFilter === "past" ? "No past events" : "No upcoming events"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {search
              ? "Try different keywords"
              : role === "teacher"
                ? "Host an event to bring the community together!"
                : "Check back soon for new events."}
          </p>
          {role === "teacher" && !search && (
            <Link href="/events/new" className="btn-seal mt-4 inline-block">
              Host an event
            </Link>
          )}
        </div>
      )}

      {/* Grid view */}
      {filtered.length > 0 && viewMode === "grid" && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <EventCard key={e.eventId} event={e} />
          ))}
        </div>
      )}

      {/* List view */}
      {filtered.length > 0 && viewMode === "list" && (
        <ul className="mt-6 space-y-3">
          {filtered.map((e) => (
            <EventListRow key={e.eventId} event={e} />
          ))}
        </ul>
      )}

      {/* Results count */}
      {filtered.length > 0 && (
        <p className="mt-6 text-center text-xs text-ink-faded">
          Showing {filtered.length} event{filtered.length !== 1 ? "s" : ""}
        </p>
      )}
    </main>
  );
}

function EventCard({ event: e }: { event: EventRow }) {
  const upcoming = isUpcoming(e.startsAt);
  const isFree = e.priceCents === 0;

  return (
    <Link
      href={`/events/${e.eventId}` as never}
      className="card group block overflow-hidden transition hover:shadow-md"
    >
      {/* Color header strip */}
      <div className={`flex items-center justify-between px-4 py-2.5 ${upcoming ? "bg-seal/10" : "bg-parchment-dark"}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">📅</span>
          <span className={`text-xs font-medium ${upcoming ? "text-seal" : "text-ink-faded"}`}>
            {relativeDate(e.startsAt)}
          </span>
        </div>
        {isFree ? (
          <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-green-700">
            Free
          </span>
        ) : (
          <span className="font-display text-sm text-ink">
            {formatMoney(e.priceCents, e.currency, { trim: true })}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-display text-base text-ink group-hover:text-seal transition-colors">
          {e.title}
        </h3>

        {e.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">
            {e.description}
          </p>
        )}

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-ink-faded">
            <span>🕐</span>
            <span>{eventDateRange(e.startsAt, e.endsAt)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-faded">
            <span>📍</span>
            <span>{e.venue}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-faded">
            <span>👥</span>
            <span>{e.capacity} spots</span>
          </div>
        </div>

        {/* Organizer */}
        <div className="mt-3 flex items-center gap-2 border-t border-ink-faded/15 pt-3">
          <Avatar userId={e.organizerId} size="sm" />
          <span className="text-xs text-ink-faded">Organizer</span>
        </div>
      </div>
    </Link>
  );
}

function EventListRow({ event: e }: { event: EventRow }) {
  const upcoming = isUpcoming(e.startsAt);
  const isFree = e.priceCents === 0;

  return (
    <Link
      href={`/events/${e.eventId}` as never}
      className="card group flex items-center gap-4 p-4 transition hover:shadow-md"
    >
      {/* Date block */}
      <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg ${upcoming ? "bg-seal/10 text-seal" : "bg-parchment-dark text-ink-faded"}`}>
        <span className="text-[10px] font-semibold uppercase">
          {new Date(e.startsAt).toLocaleDateString(undefined, { month: "short" })}
        </span>
        <span className="font-display text-xl leading-none">
          {new Date(e.startsAt).getDate()}
        </span>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-base text-ink group-hover:text-seal transition-colors">
          {e.title}
        </h3>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-faded">
          <span className="flex items-center gap-1">
            <span>🕐</span>
            {new Date(e.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </span>
          <span className="flex items-center gap-1">
            <span>📍</span>
            {e.venue}
          </span>
          <span className="flex items-center gap-1">
            <span>👥</span>
            {e.capacity} spots
          </span>
        </div>
      </div>

      {/* Price */}
      <div className="shrink-0 text-right">
        {isFree ? (
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
            Free
          </span>
        ) : (
          <span className="font-display text-sm text-ink">
            {formatMoney(e.priceCents, e.currency, { trim: true })}
          </span>
        )}
      </div>

      <span className="text-ink-faded">›</span>
    </Link>
  );
}
