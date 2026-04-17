"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Teacher = {
  userId: string;
  bio?: string;
  subjects: string[];
  languages: string[];
  yearsExperience: number;
  hourlyRateCents: number;
  currency: string;
  ratingAvg: number;
  ratingCount: number;
  trialSession: boolean;
  groupSessions: boolean;
  city?: string;
  country?: string;
  sponsoredUntil?: string;
};

type Filters = {
  subject: string;
  city: string;
  country: string;
  minRating: string;
  minExperience: string;
  minRateEur: string;
  maxRateEur: string;
  trial: boolean;
  individual: boolean;
  group: boolean;
};

const EMPTY: Filters = {
  subject: "",
  city: "",
  country: "",
  minRating: "",
  minExperience: "",
  minRateEur: "",
  maxRateEur: "",
  trial: false,
  individual: false,
  group: false,
};

export default function TeachersPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [items, setItems] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (applied.subject) p.set("subject", applied.subject);
    if (applied.city) p.set("city", applied.city);
    if (applied.country) p.set("country", applied.country.toUpperCase());
    if (applied.minRating) p.set("minRating", applied.minRating);
    if (applied.minExperience) p.set("minExperience", applied.minExperience);
    if (applied.minRateEur) p.set("minRateCents", String(Number(applied.minRateEur) * 100));
    if (applied.maxRateEur) p.set("maxRateCents", String(Number(applied.maxRateEur) * 100));
    if (applied.trial) p.set("trial", "true");
    if (applied.individual) p.set("individual", "true");
    if (applied.group) p.set("group", "true");
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }, [applied]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api<{ items: Teacher[] }>(`/teachers${queryString}`, { signal: controller.signal })
      .then((r) => setItems(r.items))
      .catch((e) => {
        if (!controller.signal.aborted) setError((e as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [queryString]);

  return (
    <main className="mx-auto max-w-5xl px-6 pb-20 pt-16">
      <div>
        <p className="eyebrow">Directory</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight text-ink sm:text-5xl">
          Find a teacher
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-soft">
          Every tutor below has been verified by our team. Filter by subject,
          location, rating, or price band.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(filters);
        }}
        className="card mt-8 grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Input label="Subject" placeholder="Mathematics" value={filters.subject} onChange={(v) => setFilters({ ...filters, subject: v })} />
        <Input label="City" placeholder="Dublin" value={filters.city} onChange={(v) => setFilters({ ...filters, city: v })} />
        <Input label="Country" placeholder="IE" maxLength={2} value={filters.country} onChange={(v) => setFilters({ ...filters, country: v.toUpperCase() })} />
        <Input label="Min rating" type="number" min="0" max="5" step="0.5" placeholder="4" value={filters.minRating} onChange={(v) => setFilters({ ...filters, minRating: v })} />
        <Input label="Min years exp" type="number" min="0" placeholder="2" value={filters.minExperience} onChange={(v) => setFilters({ ...filters, minExperience: v })} />
        <Input label="Min rate (€/hr)" type="number" min="0" placeholder="10" value={filters.minRateEur} onChange={(v) => setFilters({ ...filters, minRateEur: v })} />
        <Input label="Max rate (€/hr)" type="number" min="0" placeholder="100" value={filters.maxRateEur} onChange={(v) => setFilters({ ...filters, maxRateEur: v })} />
        <label className="flex items-end gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={filters.trial} onChange={(e) => setFilters({ ...filters, trial: e.target.checked })} className="accent-seal" />
          Trial session
        </label>
        <label className="flex items-end gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={filters.individual} onChange={(e) => setFilters({ ...filters, individual: e.target.checked })} className="accent-seal" />
          Individual sessions
        </label>
        <label className="flex items-end gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={filters.group} onChange={(e) => setFilters({ ...filters, group: e.target.checked })} className="accent-seal" />
          Group sessions
        </label>
        <div className="sm:col-span-2 lg:col-span-4 flex gap-2 pt-2">
          <button className="btn-seal" type="submit">
            Search
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setFilters(EMPTY);
              setApplied(EMPTY);
            }}
          >
            Reset
          </button>
        </div>
      </form>

      {loading && <p className="mt-6 text-sm text-ink-soft">Loading...</p>}
      {error && <p className="mt-6 text-sm text-seal">{error}</p>}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {items.map((t) => {
          const isSponsored =
            t.sponsoredUntil && new Date(t.sponsoredUntil) > new Date();
          return (
            <Link
              key={t.userId}
              href={`/teachers/${t.userId}` as never}
              className="card-interactive group block p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="font-display text-lg text-ink group-hover:text-seal">
                    {t.city ?? t.country ?? "Unlisted"}
                  </div>
                  {isSponsored && (
                    <span className="rounded-sm bg-seal/10 px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-widest text-seal">
                      Sponsored
                    </span>
                  )}
                </div>
                <div className="text-sm text-ink-soft">
                  {t.ratingCount > 0
                    ? `★ ${t.ratingAvg.toFixed(1)} (${t.ratingCount})`
                    : "New"}
                </div>
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm italic text-ink-soft">
                {t.bio ?? "No biography yet."}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.subjects.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded-sm border border-ink-faded/50 bg-parchment/40 px-1.5 py-0.5 text-xs text-ink-soft"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 border-t border-ink-faded/30 pt-3 text-sm">
                <span className="font-display font-semibold text-ink">
                  €{Math.round(t.hourlyRateCents / 100)}/hr
                </span>
                {t.trialSession && (
                  <span className="text-xs uppercase tracking-wider text-seal">Trial</span>
                )}
                {t.groupSessions && (
                  <span className="text-xs uppercase tracking-wider text-ink-faded">Group</span>
                )}
                <span className="ml-auto text-xs text-ink-faded">{t.yearsExperience} yrs</span>
              </div>
            </Link>
          );
        })}
        {!loading && items.length === 0 && (
          <p className="text-sm text-ink-soft">No teachers match your filters.</p>
        )}
      </div>
    </main>
  );
}

function Input(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="label">{props.label}</span>
      <input
        className="input"
        type={props.type ?? "text"}
        placeholder={props.placeholder}
        min={props.min}
        max={props.max}
        step={props.step}
        maxLength={props.maxLength}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}
