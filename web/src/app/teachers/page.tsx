"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  return n;
}

type DropdownId = "subject" | "price" | "speaks" | "location" | "more" | null;

export default function TeachersPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const debounced = useDebounce(filters, 400);
  const [items, setItems] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<DropdownId>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const activeCount = countActive(debounced);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
    const copy = [...items];
    if (filters.sort === "price-low") copy.sort((a, b) => a.hourlyRateCents - b.hourlyRateCents);
    else if (filters.sort === "price-high") copy.sort((a, b) => b.hourlyRateCents - a.hourlyRateCents);
    else if (filters.sort === "experience") copy.sort((a, b) => b.yearsExperience - a.yearsExperience);
    else copy.sort((a, b) => b.ratingAvg - a.ratingAvg);
    return copy;
  }, [items, filters.sort]);

  function toggle(id: DropdownId) {
    setOpenDropdown((cur) => (cur === id ? null : id));
  }

  function filterLabel(id: DropdownId): string | null {
    switch (id) {
      case "subject": return filters.subject || null;
      case "price":
        return filters.rateRange[0] !== 0 || filters.rateRange[1] !== 200
          ? `${filters.rateRange[0]}–${filters.rateRange[1]} DT`
          : null;
      case "speaks": return filters.language || null;
      case "location": return filters.city || null;
      case "more": {
        const n = [filters.trial, filters.individual, filters.group,
          filters.ratingRange[0] !== 0 || filters.ratingRange[1] !== 5,
          filters.experienceRange[0] !== 0 || filters.experienceRange[1] !== 30,
        ].filter(Boolean).length;
        return n > 0 ? `${n}` : null;
      }
      default: return null;
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
      <h1 className="font-display text-4xl tracking-tight text-ink">Find a teacher</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Browse verified Tunisian tutors. Use the filters to narrow your search.
      </p>

      {/* ── Filter bar ──────────────────────────────────────────── */}
      <div ref={barRef} className="relative mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <FilterButton id="subject" label="Subject" active={filterLabel("subject")} open={openDropdown === "subject"} onClick={() => toggle("subject")} />
          <FilterButton id="price" label="Price" active={filterLabel("price")} open={openDropdown === "price"} onClick={() => toggle("price")} />
          <FilterButton id="speaks" label="Speaks" active={filterLabel("speaks")} open={openDropdown === "speaks"} onClick={() => toggle("speaks")} />
          <FilterButton id="location" label="Location" active={filterLabel("location")} open={openDropdown === "location"} onClick={() => toggle("location")} />
          <FilterButton id="more" label="More filters" active={filterLabel("more")} open={openDropdown === "more"} onClick={() => toggle("more")} />

          <div className="ml-auto flex items-center gap-3">
            {activeCount > 0 && (
              <button
                type="button"
                onClick={() => { setFilters(EMPTY); setOpenDropdown(null); }}
                className="text-xs text-seal hover:underline"
              >
                Clear all ({activeCount})
              </button>
            )}
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
              className="rounded-md border border-ink-faded/40 bg-white px-3 py-1.5 text-xs text-ink"
            >
              <option value="rating">Top rated</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="experience">Most experienced</option>
            </select>
          </div>
        </div>

        {/* ── Dropdown panels ──────────────────────────────────── */}
        {openDropdown === "subject" && (
          <DropdownPanel>
            <p className="text-sm font-medium text-ink">Lesson category</p>
            <p className="mt-0.5 text-xs text-ink-faded">What do you want to learn?</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <PillOption
                  key={s}
                  label={s}
                  selected={filters.subject === s}
                  onClick={() => {
                    setFilters({ ...filters, subject: filters.subject === s ? "" : s });
                  }}
                />
              ))}
            </div>
          </DropdownPanel>
        )}

        {openDropdown === "price" && (
          <DropdownPanel>
            <p className="text-sm font-medium text-ink">Hourly lesson price</p>
            <div className="mt-4">
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
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-ink-faded">
              <span>{filters.rateRange[0]} DT</span>
              <span className="font-medium text-ink">
                {filters.rateRange[0]} DT – {filters.rateRange[1]} DT
              </span>
              <span>{filters.rateRange[1]} DT</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                [0, 30],
                [30, 60],
                [60, 100],
                [100, 200],
              ].map(([lo, hi]) => (
                <button
                  key={`${lo}-${hi}`}
                  type="button"
                  onClick={() => setFilters({ ...filters, rateRange: [lo, hi] })}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    filters.rateRange[0] === lo && filters.rateRange[1] === hi
                      ? "border-ink bg-ink text-parchment"
                      : "border-ink-faded/40 text-ink-soft hover:border-ink-faded/70"
                  }`}
                >
                  {lo}–{hi} DT
                </button>
              ))}
            </div>
          </DropdownPanel>
        )}

        {openDropdown === "speaks" && (
          <DropdownPanel>
            <p className="text-sm font-medium text-ink">Teacher speaks</p>
            <p className="mt-0.5 text-xs text-ink-faded">
              Find teachers who speak your language
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <PillOption
                  key={l}
                  label={l}
                  selected={filters.language === l}
                  onClick={() => {
                    setFilters({ ...filters, language: filters.language === l ? "" : l });
                  }}
                />
              ))}
            </div>
          </DropdownPanel>
        )}

        {openDropdown === "location" && (
          <DropdownPanel>
            <p className="text-sm font-medium text-ink">Teachers from</p>
            <input
              className="input mt-3"
              placeholder="I want my teacher to be from..."
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              autoFocus
            />
            <p className="mb-2 mt-4 text-xs font-medium text-ink-faded">
              Popular cities
            </p>
            <div className="flex flex-wrap gap-2">
              {["Tunis", "Sfax", "Sousse", "Monastir", "Bizerte", "Nabeul", "Kairouan", "Gabès"].map(
                (c) => (
                  <PillOption
                    key={c}
                    label={c}
                    selected={filters.city === c}
                    onClick={() =>
                      setFilters({ ...filters, city: filters.city === c ? "" : c })
                    }
                  />
                ),
              )}
            </div>
          </DropdownPanel>
        )}

        {openDropdown === "more" && (
          <DropdownPanel wide>
            <p className="text-sm font-medium text-ink">More filters</p>
            <p className="mt-0.5 text-xs text-ink-faded">
              Refine by rating, experience, and session type
            </p>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <RangeSlider
                  min={0}
                  max={5}
                  step={0.5}
                  value={filters.ratingRange}
                  onChange={(v) => setFilters({ ...filters, ratingRange: v })}
                  label="Minimum rating"
                  formatValue={(v) => `★ ${v}`}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[3, 3.5, 4, 4.5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() =>
                        setFilters({ ...filters, ratingRange: [r, 5] })
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${
                        filters.ratingRange[0] === r && filters.ratingRange[1] === 5
                          ? "border-ink bg-ink text-parchment"
                          : "border-ink-faded/40 text-ink-soft hover:border-ink-faded/70"
                      }`}
                    >
                      ★ {r}+
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <RangeSlider
                  min={0}
                  max={30}
                  step={1}
                  value={filters.experienceRange}
                  onChange={(v) => setFilters({ ...filters, experienceRange: v })}
                  label="Experience"
                  formatValue={(v) => `${v} yrs`}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    { label: "1+ yrs", range: [1, 30] as [number, number] },
                    { label: "3+ yrs", range: [3, 30] as [number, number] },
                    { label: "5+ yrs", range: [5, 30] as [number, number] },
                    { label: "10+ yrs", range: [10, 30] as [number, number] },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() =>
                        setFilters({ ...filters, experienceRange: opt.range })
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${
                        filters.experienceRange[0] === opt.range[0] &&
                        filters.experienceRange[1] === opt.range[1]
                          ? "border-ink bg-ink text-parchment"
                          : "border-ink-faded/40 text-ink-soft hover:border-ink-faded/70"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <p className="mb-2 text-xs font-medium text-ink-faded">Session type</p>
                <div className="flex flex-wrap gap-2">
                  <ToggleChip
                    label="Trial available"
                    checked={filters.trial}
                    onChange={(v) => setFilters({ ...filters, trial: v })}
                  />
                  <ToggleChip
                    label="1-on-1 sessions"
                    checked={filters.individual}
                    onChange={(v) => setFilters({ ...filters, individual: v })}
                  />
                  <ToggleChip
                    label="Group sessions"
                    checked={filters.group}
                    onChange={(v) => setFilters({ ...filters, group: v })}
                  />
                </div>
              </div>
            </div>
          </DropdownPanel>
        )}
      </div>

      {/* ── Active filter chips ─────────────────────────────────── */}
      {activeCount > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.subject && (
            <Chip label={filters.subject} onRemove={() => setFilters({ ...filters, subject: "" })} />
          )}
          {filters.language && (
            <Chip label={`Speaks ${filters.language}`} onRemove={() => setFilters({ ...filters, language: "" })} />
          )}
          {filters.city && (
            <Chip label={filters.city} onRemove={() => setFilters({ ...filters, city: "" })} />
          )}
          {(filters.rateRange[0] !== 0 || filters.rateRange[1] !== 200) && (
            <Chip
              label={`${filters.rateRange[0]}–${filters.rateRange[1]} DT/hr`}
              onRemove={() => setFilters({ ...filters, rateRange: EMPTY.rateRange })}
            />
          )}
          {(filters.ratingRange[0] !== 0 || filters.ratingRange[1] !== 5) && (
            <Chip
              label={`Rating ${filters.ratingRange[0]}–${filters.ratingRange[1]}`}
              onRemove={() => setFilters({ ...filters, ratingRange: EMPTY.ratingRange })}
            />
          )}
          {(filters.experienceRange[0] !== 0 || filters.experienceRange[1] !== 30) && (
            <Chip
              label={`${filters.experienceRange[0]}–${filters.experienceRange[1]} yrs exp`}
              onRemove={() => setFilters({ ...filters, experienceRange: EMPTY.experienceRange })}
            />
          )}
          {filters.trial && (
            <Chip label="Trial" onRemove={() => setFilters({ ...filters, trial: false })} />
          )}
          {filters.individual && (
            <Chip label="1-on-1" onRemove={() => setFilters({ ...filters, individual: false })} />
          )}
          {filters.group && (
            <Chip label="Group" onRemove={() => setFilters({ ...filters, group: false })} />
          )}
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────── */}
      <div className="mt-4 text-sm text-ink-soft">
        {loading
          ? "Loading teachers..."
          : `${sorted.length} teacher${sorted.length === 1 ? "" : "s"} found`}
      </div>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((t) => {
          const isSponsored =
            t.sponsoredUntil && new Date(t.sponsoredUntil) > new Date();
          return (
            <Link
              key={t.userId}
              href={`/teachers/${t.userId}` as never}
              className="card-interactive group overflow-hidden"
            >
              <div className="relative flex h-44 items-center justify-center bg-parchment-dark">
                <Avatar userId={t.userId} size="xl" initial={t.displayName?.[0]} />
                {t.ratingCount > 0 && (
                  <span className="absolute left-2 top-2 rounded-sm bg-seal/90 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    ★ {t.ratingAvg.toFixed(1)}
                  </span>
                )}
                {isSponsored && (
                  <span className="absolute right-2 top-2 rounded-sm bg-ink/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                    Sponsored
                  </span>
                )}
                {t.trialSession && !isSponsored && (
                  <span className="absolute right-2 top-2 rounded-sm bg-seal/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Trial
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="font-display text-base text-ink group-hover:text-seal">
                  {t.displayName ?? "Teacher"}
                </div>
                <div className="mt-0.5 text-xs text-ink-faded">
                  {t.subjects.slice(0, 2).join(" · ")}
                  {t.city ? ` · ${t.city}` : ""}
                </div>
                {t.languages.length > 0 && (
                  <div className="mt-0.5 text-xs text-ink-faded">
                    Speaks: {t.languages.slice(0, 3).join(", ")}
                  </div>
                )}
                {t.bio && (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-soft">
                    {t.bio}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-ink-faded/20 pt-3">
                  <div>
                    <div className="text-[11px] text-ink-faded">Lessons from</div>
                    <div className="font-display text-base text-ink">
                      {formatMoney(t.hourlyRateCents, t.currency, { trim: true })}
                    </div>
                  </div>
                  <span className="rounded-md bg-seal px-3 py-1.5 text-xs font-medium text-white transition group-hover:bg-seal/80">
                    Book now
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
        {!loading && sorted.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-ink-soft">
            No teachers match your filters. Try broadening your search.
          </p>
        )}
      </div>
    </main>
  );
}

/* ── UI primitives ──────────────────────────────────────────────────── */

function FilterButton({
  label,
  active,
  open,
  onClick,
}: {
  id: string;
  label: string;
  active: string | null;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition ${
        open
          ? "border-ink bg-ink text-parchment"
          : active
            ? "border-seal/50 bg-seal/5 text-seal"
            : "border-ink-faded/40 bg-white text-ink hover:border-ink-faded/70"
      }`}
    >
      <span>{label}</span>
      {active && !open && (
        <span className="rounded-full bg-seal/15 px-1.5 text-[11px] font-semibold text-seal">
          {active}
        </span>
      )}
      <svg
        className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`}
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M3 4.5 L6 7.5 L9 4.5" />
      </svg>
    </button>
  );
}

function DropdownPanel({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`absolute left-0 z-50 mt-2 rounded-xl border border-ink-faded/30 bg-white p-5 shadow-lg ${
        wide ? "w-full max-w-xl" : "w-80"
      }`}
    >
      {children}
    </div>
  );
}

function PillOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm transition ${
        selected
          ? "bg-ink text-parchment"
          : "bg-parchment-dark text-ink-soft hover:bg-ink/10 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function ToggleChip({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
        checked
          ? "bg-ink text-parchment"
          : "bg-parchment-dark text-ink-soft hover:bg-ink/10"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-sm border text-center text-[10px] leading-[13px] ${
          checked ? "border-parchment bg-parchment text-ink" : "border-ink-faded/60"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}

function Chip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-seal/10 px-3 py-1 text-xs font-medium text-seal">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-seal/60 transition hover:text-seal"
        aria-label={`Remove ${label} filter`}
      >
        ×
      </button>
    </span>
  );
}
