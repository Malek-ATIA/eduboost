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
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold">Find a teacher</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(filters);
        }}
        className="mt-6 grid grid-cols-1 gap-3 rounded border p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Input label="Subject" placeholder="Mathematics" value={filters.subject} onChange={(v) => setFilters({ ...filters, subject: v })} />
        <Input label="City" placeholder="Dublin" value={filters.city} onChange={(v) => setFilters({ ...filters, city: v })} />
        <Input label="Country" placeholder="IE" maxLength={2} value={filters.country} onChange={(v) => setFilters({ ...filters, country: v.toUpperCase() })} />
        <Input label="Min rating" type="number" min="0" max="5" step="0.5" placeholder="4" value={filters.minRating} onChange={(v) => setFilters({ ...filters, minRating: v })} />
        <Input label="Min years exp" type="number" min="0" placeholder="2" value={filters.minExperience} onChange={(v) => setFilters({ ...filters, minExperience: v })} />
        <Input label="Min rate (€/hr)" type="number" min="0" placeholder="10" value={filters.minRateEur} onChange={(v) => setFilters({ ...filters, minRateEur: v })} />
        <Input label="Max rate (€/hr)" type="number" min="0" placeholder="100" value={filters.maxRateEur} onChange={(v) => setFilters({ ...filters, maxRateEur: v })} />
        <label className="flex items-end gap-2 text-sm">
          <input type="checkbox" checked={filters.trial} onChange={(e) => setFilters({ ...filters, trial: e.target.checked })} />
          Trial session
        </label>
        <label className="flex items-end gap-2 text-sm">
          <input type="checkbox" checked={filters.individual} onChange={(e) => setFilters({ ...filters, individual: e.target.checked })} />
          Individual sessions
        </label>
        <label className="flex items-end gap-2 text-sm">
          <input type="checkbox" checked={filters.group} onChange={(e) => setFilters({ ...filters, group: e.target.checked })} />
          Group sessions
        </label>
        <div className="sm:col-span-2 lg:col-span-4 flex gap-2 pt-2">
          <button className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black" type="submit">
            Search
          </button>
          <button
            type="button"
            className="rounded border px-4 py-2 text-sm"
            onClick={() => {
              setFilters(EMPTY);
              setApplied(EMPTY);
            }}
          >
            Reset
          </button>
        </div>
      </form>

      {loading && <p className="mt-6 text-sm text-gray-500">Loading...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {items.map((t) => (
          <Link
            key={t.userId}
            href={`/teachers/${t.userId}` as never}
            className="block rounded border p-4 transition hover:border-black dark:hover:border-white"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="font-medium">{t.city ?? t.country ?? "—"}</div>
                {t.sponsoredUntil && new Date(t.sponsoredUntil) > new Date() && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    Sponsored
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {t.ratingCount > 0 ? `★ ${t.ratingAvg.toFixed(1)} (${t.ratingCount})` : "New"}
              </div>
            </div>
            <div className="mt-1 text-sm text-gray-600 line-clamp-2">{t.bio ?? ""}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {t.subjects.slice(0, 4).map((s) => (
                <span key={s} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="font-medium">€{Math.round(t.hourlyRateCents / 100)}/hr</span>
              {t.trialSession && <span className="text-xs text-green-700">Trial</span>}
              {t.groupSessions && <span className="text-xs text-blue-700">Group</span>}
              <span className="text-xs text-gray-500">· {t.yearsExperience} yrs</span>
            </div>
          </Link>
        ))}
        {!loading && items.length === 0 && <p className="text-sm text-gray-500">No teachers match your filters.</p>}
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
    <label className="block text-sm">
      <span className="mb-1 block text-gray-600">{props.label}</span>
      <input
        className="w-full rounded border px-3 py-1.5"
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
