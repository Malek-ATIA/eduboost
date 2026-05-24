"use client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { formatMoney, toMinorUnits } from "@/lib/money";
import { Avatar } from "@/components/Avatar";
import { RangeSlider } from "@/components/RangeSlider";
import { PriceHistogram } from "@/components/PriceHistogram";
import { useDebounce } from "@/lib/useDebounce";

type Teacher = {
  userId: string;
  displayName?: string;
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

const SUBJECTS = [
  "Mathematics",
  "Physics",
  "English",
  "French",
  "Arabic",
  "Biology",
  "Computer Science",
  "Economics",
  "Chemistry",
  "Philosophy",
  "History",
  "Geography",
];

const LANGUAGES = [
  "Arabic",
  "French",
  "English",
  "Italian",
  "German",
  "Spanish",
  "Turkish",
];

const CITIES = [
  "Tunis",
  "Sfax",
  "Sousse",
  "Monastir",
  "Bizerte",
  "Nabeul",
  "Kairouan",
  "Gabes",
];

type Filters = {
  subject: string;
  language: string;
  city: string;
  rateRange: [number, number];
  ratingRange: [number, number];
  experienceRange: [number, number];
  trial: boolean;
  individual: boolean;
  group: boolean;
  sort: string;
  search: string;
};

const EMPTY: Filters = {
  subject: "",
  language: "",
  city: "",
  rateRange: [0, 200],
  ratingRange: [0, 5],
  experienceRange: [0, 30],
  trial: false,
  individual: false,
  group: false,
  sort: "rating",
  search: "",
};

function countActive(f: Filters): number {
  let n = 0;
  if (f.subject) n++;
  if (f.language) n++;
  if (f.city) n++;
  if (f.rateRange[0] !== 0 || f.rateRange[1] !== 200) n++;
  if (f.ratingRange[0] !== 0 || f.ratingRange[1] !== 5) n++;
  if (f.experienceRange[0] !== 0 || f.experienceRange[1] !== 30) n++;
  if (f.trial) n++;
  if (f.individual) n++;
  if (f.group) n++;
  if (f.search) n++;
  return n;
}

function getActiveChips(f: Filters): { key: string; label: string; clear: () => Filters }[] {
  const chips: { key: string; label: string; clear: () => Filters }[] = [];
  if (f.search) chips.push({ key: "search", label: `"${f.search}"`, clear: () => ({ ...f, search: "" }) });
  if (f.subject) chips.push({ key: "subject", label: f.subject, clear: () => ({ ...f, subject: "" }) });
  if (f.language) chips.push({ key: "language", label: `Speaks ${f.language}`, clear: () => ({ ...f, language: "" }) });
  if (f.city) chips.push({ key: "city", label: f.city, clear: () => ({ ...f, city: "" }) });
  if (f.rateRange[0] !== 0 || f.rateRange[1] !== 200)
    chips.push({ key: "rate", label: `${f.rateRange[0]}--${f.rateRange[1]} DT/hr`, clear: () => ({ ...f, rateRange: EMPTY.rateRange }) });
  if (f.ratingRange[0] !== 0 || f.ratingRange[1] !== 5)
    chips.push({ key: "rating", label: `Rating ${f.ratingRange[0]}--${f.ratingRange[1]}`, clear: () => ({ ...f, ratingRange: EMPTY.ratingRange }) });
  if (f.experienceRange[0] !== 0 || f.experienceRange[1] !== 30)
    chips.push({ key: "exp", label: `${f.experienceRange[0]}--${f.experienceRange[1]} yrs exp`, clear: () => ({ ...f, experienceRange: EMPTY.experienceRange }) });
  if (f.trial) chips.push({ key: "trial", label: "Trial available", clear: () => ({ ...f, trial: false }) });
  if (f.individual) chips.push({ key: "individual", label: "1-on-1", clear: () => ({ ...f, individual: false }) });
  if (f.group) chips.push({ key: "group", label: "Group", clear: () => ({ ...f, group: false }) });
  return chips;
}

export default function TeachersPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const debounced = useDebounce(filters, 400);
  const [items, setItems] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [hoveredTeacherId, setHoveredTeacherId] = useState<string | null>(null);

  const activeCount = countActive(debounced);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (debounced.subject) p.set("subject", debounced.subject);
    if (debounced.city) p.set("city", debounced.city);
    if (debounced.ratingRange[0] !== EMPTY.ratingRange[0])
      p.set("minRating", String(debounced.ratingRange[0]));
    if (debounced.ratingRange[1] !== EMPTY.ratingRange[1])
      p.set("maxRating", String(debounced.ratingRange[1]));
    if (debounced.experienceRange[0] !== EMPTY.experienceRange[0])
      p.set("minExperience", String(debounced.experienceRange[0]));
    if (debounced.experienceRange[1] !== EMPTY.experienceRange[1])
      p.set("maxExperience", String(debounced.experienceRange[1]));
    if (debounced.rateRange[0] !== EMPTY.rateRange[0])
      p.set("minRateCents", String(toMinorUnits(debounced.rateRange[0], "TND")));
    if (debounced.rateRange[1] !== EMPTY.rateRange[1])
      p.set("maxRateCents", String(toMinorUnits(debounced.rateRange[1], "TND")));
    if (debounced.trial) p.set("trial", "true");
    if (debounced.individual) p.set("individual", "true");
    if (debounced.group) p.set("group", "true");
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }, [debounced]);

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

  const allPrices = useMemo(
    () => items.map((t) => t.hourlyRateCents / 1000),
    [items],
  );

  const sorted = useMemo(() => {
    let copy = [...items];

    // Client-side search filter
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      copy = copy.filter(
        (t) =>
          t.displayName?.toLowerCase().includes(q) ||
          t.subjects.some((s) => s.toLowerCase().includes(q)) ||
          t.city?.toLowerCase().includes(q),
      );
    }

    // Client-side language filter
    if (filters.language) {
      copy = copy.filter((t) => t.languages.includes(filters.language));
    }

    if (filters.sort === "price-low") copy.sort((a, b) => a.hourlyRateCents - b.hourlyRateCents);
    else if (filters.sort === "price-high") copy.sort((a, b) => b.hourlyRateCents - a.hourlyRateCents);
    else if (filters.sort === "experience") copy.sort((a, b) => b.yearsExperience - a.yearsExperience);
    else copy.sort((a, b) => b.ratingAvg - a.ratingAvg);
    return copy;
  }, [items, filters.sort, filters.search, filters.language]);

  const activeChips = getActiveChips(filters);

  const filterSidebar = (
    <div className="space-y-0">
      {/* Search */}
      <FilterGroup title="Search">
        <input
          className="input"
          placeholder="Name, subject, or city..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
      </FilterGroup>

      {/* Subjects */}
      <FilterGroup title="Subject">
        <div className="space-y-1.5">
          {SUBJECTS.map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={filters.subject === s}
                onChange={() => setFilters({ ...filters, subject: filters.subject === s ? "" : s })}
                className="h-4 w-4 rounded border-rule text-accent focus:ring-accent/20"
              />
              <span className="text-sm text-ink">{s}</span>
            </label>
          ))}
        </div>
      </FilterGroup>

      {/* Languages */}
      <FilterGroup title="Language">
        <div className="space-y-1.5">
          {LANGUAGES.map((l) => (
            <label key={l} className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={filters.language === l}
                onChange={() => setFilters({ ...filters, language: filters.language === l ? "" : l })}
                className="h-4 w-4 rounded border-rule text-accent focus:ring-accent/20"
              />
              <span className="text-sm text-ink">{l}</span>
            </label>
          ))}
        </div>
      </FilterGroup>

      {/* City */}
      <FilterGroup title="City">
        <div className="space-y-1.5">
          {CITIES.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={filters.city === c}
                onChange={() => setFilters({ ...filters, city: filters.city === c ? "" : c })}
                className="h-4 w-4 rounded border-rule text-accent focus:ring-accent/20"
              />
              <span className="text-sm text-ink">{c}</span>
            </label>
          ))}
        </div>
      </FilterGroup>

      {/* Rate range */}
      <FilterGroup title="Hourly Rate">
        <PriceHistogram
          prices={allPrices}
          min={0}
          max={200}
          range={filters.rateRange}
        />
        <RangeSlider
          min={0}
          max={200}
          step={5}
          value={filters.rateRange}
          onChange={(v) => setFilters({ ...filters, rateRange: v })}
          label=""
          formatValue={(v) => `${v} DT`}
        />
        <div className="mt-1 flex items-center justify-between text-xs text-ink-faded">
          <span>{filters.rateRange[0]} DT</span>
          <span>{filters.rateRange[1]} DT</span>
        </div>
      </FilterGroup>

      {/* Min rating */}
      <FilterGroup title="Min Rating">
        <div className="flex flex-wrap gap-1.5">
          {[3, 3.5, 4, 4.5].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() =>
                setFilters({
                  ...filters,
                  ratingRange:
                    filters.ratingRange[0] === r && filters.ratingRange[1] === 5
                      ? EMPTY.ratingRange
                      : [r, 5],
                })
              }
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filters.ratingRange[0] === r && filters.ratingRange[1] === 5
                  ? "bg-accent text-white"
                  : "bg-bg-soft text-ink-soft hover:bg-accent-pale hover:text-accent-deep"
              }`}
            >
              {r}+ stars
            </button>
          ))}
        </div>
      </FilterGroup>

      {/* Experience */}
      <FilterGroup title="Experience">
        <RangeSlider
          min={0}
          max={30}
          step={1}
          value={filters.experienceRange}
          onChange={(v) => setFilters({ ...filters, experienceRange: v })}
          label=""
          formatValue={(v) => `${v} yrs`}
        />
        <div className="mt-1 flex items-center justify-between text-xs text-ink-faded">
          <span>{filters.experienceRange[0]} yrs</span>
          <span>{filters.experienceRange[1]} yrs</span>
        </div>
      </FilterGroup>

      {/* Options */}
      <FilterGroup title="Options" last>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={filters.trial}
              onChange={(e) => setFilters({ ...filters, trial: e.target.checked })}
              className="h-4 w-4 rounded border-rule text-accent focus:ring-accent/20"
            />
            <span className="text-sm text-ink">Trial available</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={filters.individual}
              onChange={(e) => setFilters({ ...filters, individual: e.target.checked })}
              className="h-4 w-4 rounded border-rule text-accent focus:ring-accent/20"
            />
            <span className="text-sm text-ink">Verified teachers</span>
          </label>
        </div>
      </FilterGroup>

      {/* Clear all */}
      {activeCount > 0 && (
        <div className="px-1 pt-4">
          <button
            type="button"
            onClick={() => setFilters(EMPTY)}
            className="btn-ghost w-full text-center text-accent"
          >
            Clear all filters ({activeCount})
          </button>
        </div>
      )}
    </div>
  );

  return (
    <main className="pb-12">
      {/* ── PageHead ────────────────────────────────────────── */}
      <div className="border-b border-rule px-4 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
        <div className="eyebrow">Find a teacher</div>
        <h1 className="mt-2 text-[clamp(26px,3.5vw,40px)] font-bold tracking-[-0.022em]">
          Browse{" "}
          <em className="not-italic text-accent">
            {loading ? "..." : sorted.length}
          </em>{" "}
          verified teachers.
        </h1>
        <p className="mt-2 text-[14.5px] text-ink-soft">
          Filter, sort and compare. Every teacher has been reviewed by our team.
        </p>
      </div>
      <div className="px-4 pt-6 sm:px-8 sm:pt-7">

      {/* ── Mobile filter toggle ───────────────────────────────── */}
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
          className="btn-secondary w-full"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h12M4 8h8M6 12h4" />
          </svg>
          Filters {activeCount > 0 && `(${activeCount})`}
        </button>
        {mobileFiltersOpen && (
          <div className="mt-3 rounded-2xl border border-rule bg-white p-4">
            {filterSidebar}
          </div>
        )}
      </div>

      <div className="flex gap-8">
        {/* ── Left filter rail (desktop) ────────────────────────── */}
        <aside className="hidden w-[280px] shrink-0 lg:block">
          <div className="sticky top-20">
            {filterSidebar}
          </div>
        </aside>

        {/* ── Main results area ─────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          {/* Sort + active chips */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            {/* Active filter chips */}
            <div className="flex flex-wrap gap-2">
              {activeChips.map((chip) => (
                <span
                  key={chip.key}
                  className="chip chip-accent inline-flex items-center gap-1.5"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => setFilters(chip.clear())}
                    className="ml-0.5 text-accent/60 transition hover:text-accent-deep"
                    aria-label={`Remove ${chip.label} filter`}
                  >
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 3l6 6M9 3l-6 6" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>

            {/* Sort */}
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
              className="rounded-full border border-rule bg-white px-4 py-2 text-xs font-medium text-ink transition hover:border-rule"
            >
              <option value="rating">Top rated</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="experience">Most experienced</option>
            </select>
          </div>

          {/* Loading / error states */}
          {error && <p className="mb-4 text-sm text-warn">{error}</p>}

          {/* ── Teacher wide cards + hover preview ─────────────────── */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid grid-cols-1 gap-4">
            {sorted.map((t) => {
              const name = t.displayName ?? "Teacher";
              let h = 0;
              for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) & 0xffff;
              const hue = Math.abs(h) % 360;
              const isSponsored = t.sponsoredUntil && new Date(t.sponsoredUntil) > new Date();
              return (
                <Link
                  key={t.userId}
                  href={`/teachers/${t.userId}` as never}
                  onMouseEnter={() => setHoveredTeacherId(t.userId)}
                  className="card-interactive group flex flex-col overflow-hidden p-0 sm:flex-row"
                  style={{ borderRadius: 18 }}
                >
                  {/* Photo / video thumb — top on mobile, left on desktop */}
                  <div
                    className="relative shrink-0 sm:!w-[200px]"
                    style={{
                      width: "100%",
                      aspectRatio: "5 / 3",
                      background: `linear-gradient(135deg, oklch(0.88 0.06 ${hue}) 0%, oklch(0.94 0.04 ${(hue + 40) % 360}) 100%)`,
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Avatar userId={t.userId} size="xl" initial={name} className="!h-20 !w-20" />
                    </div>
                    <div className="absolute bottom-2.5 left-2.5">
                      <span className="play-pill">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M5 3l14 9-14 9V3z" />
                        </svg>
                        0:54
                      </span>
                    </div>
                    {t.ratingCount > 0 && (
                      <span
                        title="Verified"
                        className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white"
                        style={{ border: "2px solid #fff" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 8.5l3 3 7-7" />
                        </svg>
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex min-w-0 flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-[19px] font-bold tracking-tight">{name}</div>
                          {isSponsored && <span className="chip chip-accent text-[11.5px]">Sponsored</span>}
                          {t.trialSession && !isSponsored && (
                            <span className="chip chip-green text-[11.5px]">Free trial</span>
                          )}
                        </div>
                        <div className="mt-1 text-[13px] text-ink-soft">
                          Teaches <strong className="font-semibold text-ink">{t.subjects.join(", ")}</strong>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-ink-soft">
                          {t.ratingCount > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="#ffb547" stroke="#ffb547">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                              <strong className="font-bold text-ink">{t.ratingAvg.toFixed(1)}</strong>
                              <span className="text-ink-faded">({t.ratingCount})</span>
                            </span>
                          )}
                          {t.yearsExperience > 0 && (
                            <span className="inline-flex items-center gap-1">{t.yearsExperience} yrs experience</span>
                          )}
                          {t.languages.length > 0 && (
                            <span className="inline-flex items-center gap-1">
                              {t.languages.slice(0, 2).join(", ")}
                            </span>
                          )}
                          {t.city && (
                            <span className="inline-flex items-center gap-1">{t.city}</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-faded">
                          From
                        </div>
                        <div className="mt-0.5">
                          <span className="text-[26px] font-bold tracking-[-0.02em]">
                            {(t.hourlyRateCents / 1000).toFixed(0)}
                          </span>
                          <span className="text-[12.5px] text-ink-faded"> DT</span>
                        </div>
                        <div className="text-[11px] text-ink-faded">per 50-min</div>
                      </div>
                    </div>
                    {t.bio && (
                      <p className="mt-2.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink-soft">
                        {t.bio}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-end gap-2 pt-3.5">
                      <span className="btn-outline btn-sm">Message</span>
                      <span className="btn-accent btn-sm">Book a trial</span>
                    </div>
                  </div>
                </Link>
              );
            })}
            {!loading && sorted.length === 0 && (
              <div className="col-span-full flex flex-col items-center py-16 text-center">
                <div className="text-4xl text-ink-mute">No results</div>
                <p className="mt-2 text-sm text-ink-soft">
                  No teachers match your filters. Try broadening your search.
                </p>
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY)}
                  className="btn-secondary mt-4"
                >
                  Clear all filters
                </button>
              </div>
            )}
            </div>

            {/* Hover preview — desktop only */}
            <aside className="hidden lg:block">
              <HoverPreview teacher={sorted.find((t) => t.userId === hoveredTeacherId) ?? sorted[0]} />
            </aside>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-sm text-ink-faded">Loading teachers...</div>
            </div>
          )}
        </div>
      </div>
      </div>
    </main>
  );
}

/* ── Filter group component ───────────────────────────────────────────── */

function FilterGroup({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`py-4 ${last ? "" : "border-b border-rule"}`}>
      <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-faded">
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/* ── Hover preview panel: video + availability grid ──────────────────── */

const DAYS_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const TIME_BLOCKS = ["00 – 04", "04 – 08", "08 – 12", "12 – 16", "16 – 20", "20 – 24"];

function HoverPreview({ teacher }: { teacher?: Teacher }) {
  if (!teacher) {
    return (
      <div className="sticky top-20 card p-5 text-center text-sm text-ink-soft" style={{ borderRadius: 18 }}>
        Hover a teacher to preview their availability.
      </div>
    );
  }

  const name = teacher.displayName ?? "Teacher";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) & 0xffff;
  const hue = Math.abs(h) % 360;

  // Deterministic availability mask from teacher's id
  let seed = 0;
  for (let i = 0; i < teacher.userId.length; i++) seed = ((seed << 5) - seed + teacher.userId.charCodeAt(i)) & 0xffff;
  const cellAvailable = (day: number, slot: number): boolean => {
    return ((seed + day * 7 + slot * 3) % 5) < 2;
  };

  // Compute the current week starting Sunday
  const today = new Date();
  const dow = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dow);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  return (
    <div className="sticky top-20 space-y-4">
      {/* Video preview */}
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: "16 / 10",
          borderRadius: 18,
          background: `linear-gradient(135deg, oklch(0.75 0.12 ${hue}) 0%, oklch(0.55 0.15 ${(hue + 30) % 360}) 100%)`,
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 text-accent">
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
          </div>
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
            Intro · 0:54
          </span>
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink">
            {name}
          </span>
        </div>
      </div>

      {/* Availability grid */}
      <div className="card p-3" style={{ borderRadius: 18 }}>
        <div
          className="grid gap-px"
          style={{ gridTemplateColumns: "auto repeat(7, minmax(0, 1fr))" }}
        >
          {/* Header row */}
          <div />
          {weekDays.map((d, i) => (
            <div key={i} className="text-center text-[11px]">
              <div className="font-mono text-ink-faded">{DAYS_ABBR[i]}</div>
              <div className="font-bold">{d.getDate()}</div>
            </div>
          ))}
          {/* Time block rows */}
          {TIME_BLOCKS.map((tb, slot) => (
            <Fragment key={slot}>
              <div className="self-center pr-2 font-mono text-[10.5px] text-ink-faded">
                {tb}
              </div>
              {weekDays.map((_, day) => {
                const avail = cellAvailable(day, slot);
                return (
                  <div
                    key={`${slot}-${day}`}
                    className="h-6"
                    style={{
                      background: avail ? "var(--bg-mint)" : "var(--rule-soft)",
                      borderRadius: 3,
                    }}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
        <div className="mt-3 border-t border-rule-soft pt-2.5 text-center text-[11.5px] text-ink-faded">
          Based on your timezone: Africa/Tunis (UTC +01:00)
        </div>
        <Link
          href={`/teachers/${teacher.userId}#schedule` as never}
          className="btn-outline mt-2.5 block w-full text-center text-sm"
        >
          View full schedule
        </Link>
      </div>
    </div>
  );
}
