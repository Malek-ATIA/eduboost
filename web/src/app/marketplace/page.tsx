"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useDebounce } from "@/lib/useDebounce";
import { RangeSlider } from "@/components/RangeSlider";
import { PriceHistogram } from "@/components/PriceHistogram";

type Listing = {
  listingId: string;
  sellerId: string;
  title: string;
  description?: string;
  subjects: string[];
  priceCents: number;
  currency: string;
  status: string;
  kind?: string;
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
];

type Filters = {
  subject: string;
  productType: string;
  priceRange: [number, number];
  sort: string;
};

const EMPTY: Filters = {
  subject: "",
  productType: "all",
  priceRange: [0, 200],
  sort: "newest",
};

function countActive(f: Filters): number {
  let n = 0;
  if (f.subject) n++;
  if (f.productType !== "all") n++;
  if (f.priceRange[0] !== 0 || f.priceRange[1] !== 200) n++;
  return n;
}

type DropdownId = "subject" | "type" | "price" | null;

export default function MarketplacePage() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const debounced = useDebounce(filters, 400);
  const [items, setItems] = useState<Listing[] | null>(null);
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

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (debounced.subject) p.set("subject", debounced.subject);
    if (debounced.priceRange[0] > 0) p.set("minPriceCents", String(debounced.priceRange[0] * 1000));
    if (debounced.priceRange[1] < 200) p.set("maxPriceCents", String(debounced.priceRange[1] * 1000));
    return p.toString() ? `?${p.toString()}` : "";
  }, [debounced]);

  useEffect(() => {
    setItems(null);
    setError(null);
    api<{ items: Listing[] }>(`/marketplace/listings${qs}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError((e as Error).message));
  }, [qs]);

  const filtered = useMemo(() => {
    if (!items) return null;
    if (debounced.productType === "all") return items;
    return items.filter((l) => {
      if (debounced.productType === "physical") return l.kind === "physical";
      return l.kind !== "physical";
    });
  }, [items, debounced.productType]);

  const allPrices = useMemo(
    () => (items ?? []).map((l) => l.priceCents / 1000),
    [items],
  );

  function toggle(id: DropdownId) {
    setOpenDropdown((cur) => (cur === id ? null : id));
  }

  function filterLabel(id: DropdownId): string | null {
    switch (id) {
      case "subject": return filters.subject || null;
      case "type": return filters.productType !== "all" ? filters.productType : null;
      case "price":
        return filters.priceRange[0] !== 0 || filters.priceRange[1] !== 200
          ? `${filters.priceRange[0]}–${filters.priceRange[1]} DT`
          : null;
      default: return null;
    }
  }

  return (
    <main className="mx-auto max-w-container-wide px-4 pb-24 pt-12 sm:px-8">
      <div className="eyebrow">Marketplace</div>
      <h1 className="mt-3 text-[clamp(40px,5vw,64px)] font-bold tracking-[-0.022em]">
        Notes, exams, and <span className="text-accent">workshop</span> tickets.
      </h1>
      <p className="mt-3 max-w-[560px] text-base leading-relaxed text-ink-soft">
        From verified sellers only. Every listing reviewed before going live.
      </p>

      {/* ── Filter bar ──────────────────────────────────────────── */}
      <div ref={barRef} className="relative mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <FilterButton id="subject" label="Subject" active={filterLabel("subject")} open={openDropdown === "subject"} onClick={() => toggle("subject")} />
          <FilterButton id="type" label="Product type" active={filterLabel("type")} open={openDropdown === "type"} onClick={() => toggle("type")} />
          <FilterButton id="price" label="Price" active={filterLabel("price")} open={openDropdown === "price"} onClick={() => toggle("price")} />

          <div className="ml-auto flex items-center gap-3">
            {activeCount > 0 && (
              <button
                type="button"
                onClick={() => { setFilters(EMPTY); setOpenDropdown(null); }}
                className="text-xs text-accent hover:underline"
              >
                Clear all ({activeCount})
              </button>
            )}
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
              className="rounded-full border border-rule bg-white px-3 py-1.5 text-xs text-ink"
            >
              <option value="newest">Newest</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </div>
        </div>

        {/* ── Dropdown panels ──────────────────────────────────── */}
        {openDropdown === "subject" && (
          <DropdownPanel>
            <p className="text-sm font-medium text-ink">Subject</p>
            <p className="mt-0.5 text-xs text-ink-faded">Filter by topic</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <PillOption
                  key={s}
                  label={s}
                  selected={filters.subject === s}
                  onClick={() =>
                    setFilters({ ...filters, subject: filters.subject === s ? "" : s })
                  }
                />
              ))}
            </div>
          </DropdownPanel>
        )}

        {openDropdown === "type" && (
          <DropdownPanel>
            <p className="text-sm font-medium text-ink">Product type</p>
            <p className="mt-0.5 text-xs text-ink-faded">Digital or physical products</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { value: "all", label: "All types" },
                { value: "digital", label: "Digital" },
                { value: "physical", label: "Physical" },
              ].map((opt) => (
                <PillOption
                  key={opt.value}
                  label={opt.label}
                  selected={filters.productType === opt.value}
                  onClick={() => setFilters({ ...filters, productType: opt.value })}
                />
              ))}
            </div>
          </DropdownPanel>
        )}

        {openDropdown === "price" && (
          <DropdownPanel>
            <p className="text-sm font-medium text-ink">Price range</p>
            <div className="mt-4">
              <PriceHistogram
                prices={allPrices}
                min={0}
                max={200}
                range={filters.priceRange}
              />
              <RangeSlider
                min={0}
                max={200}
                step={5}
                value={filters.priceRange}
                onChange={(v) => setFilters({ ...filters, priceRange: v })}
                label=""
                formatValue={(v) => `${v} DT`}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-ink-faded">
              <span>{filters.priceRange[0]} DT</span>
              <span className="font-medium text-ink">
                {filters.priceRange[0]} DT – {filters.priceRange[1]} DT
              </span>
              <span>{filters.priceRange[1]} DT</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                [0, 10],
                [10, 30],
                [30, 60],
                [60, 200],
              ].map(([lo, hi]) => (
                <button
                  key={`${lo}-${hi}`}
                  type="button"
                  onClick={() => setFilters({ ...filters, priceRange: [lo, hi] })}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    filters.priceRange[0] === lo && filters.priceRange[1] === hi
                      ? "border-ink bg-ink text-white"
                      : "border-rule text-ink-soft hover:border-rule"
                  }`}
                >
                  {lo}–{hi} DT
                </button>
              ))}
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
          {filters.productType !== "all" && (
            <Chip
              label={filters.productType}
              onRemove={() => setFilters({ ...filters, productType: "all" })}
            />
          )}
          {(filters.priceRange[0] !== 0 || filters.priceRange[1] !== 200) && (
            <Chip
              label={`${filters.priceRange[0]}–${filters.priceRange[1]} DT`}
              onRemove={() => setFilters({ ...filters, priceRange: EMPTY.priceRange })}
            />
          )}
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────── */}
      <div className="mt-4 text-sm text-ink-soft">
        {filtered === null
          ? "Loading listings..."
          : `${filtered.length} listing${filtered.length === 1 ? "" : "s"}`}
      </div>

      {error && <p className="mt-4 text-sm text-accent">{error}</p>}

      <div className="mt-4 grid gap-[18px] sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {filtered?.map((l) => (
          <Link
            key={l.listingId}
            href={`/marketplace/listings/${l.listingId}` as never}
            className="card-interactive group flex flex-col overflow-hidden p-0"
          >
            <div className="flex h-[140px] items-center justify-center bg-bg-soft">
              <span className="font-bold text-[22px] text-ink-faded/30">
                {l.subjects[0] ?? "Item"}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-[18px]">
              <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-ink-faded">
                {l.subjects[0]?.toUpperCase() ?? "GENERAL"}
              </div>
              <div className="mt-2 font-bold text-[17px] leading-[1.2] tracking-tight">
                {l.title}
              </div>
              {l.description && (
                <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-ink-soft">{l.description}</p>
              )}
              <div className="mt-auto flex items-baseline justify-between pt-3">
                <div>
                  <span className="font-bold text-[22px]">
                    {formatMoney(l.priceCents, l.currency, { trim: true })}
                  </span>
                </div>
                <div className="text-xs text-ink-faded">
                  by {l.sellerId.slice(0, 8)}
                </div>
              </div>
            </div>
          </Link>
        ))}
        {filtered && filtered.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-ink-soft">
            No listings match your filters. Try broadening your search.
          </p>
        )}
      </div>
    </main>
  );
}

/* ── Shared UI primitives ───────────────────────────────────────────── */

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
          ? "border-ink bg-ink text-white"
          : active
            ? "border-accent/50 bg-accent/5 text-accent"
            : "border-rule bg-white text-ink hover:border-rule"
      }`}
    >
      <span>{label}</span>
      {active && !open && (
        <span className="rounded-full bg-accent-pale px-1.5 text-[11px] font-semibold text-accent">
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

function DropdownPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-0 z-50 mt-2 w-80 rounded-2xl border border-rule bg-white p-5 shadow-lg">
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
          ? "bg-ink text-white"
          : "bg-bg-soft text-ink-soft hover:bg-ink/10 hover:text-ink"
      }`}
    >
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
    <span className="chip-accent inline-flex items-center gap-1">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-accent/60 transition hover:text-accent"
        aria-label={`Remove ${label} filter`}
      >
        ×
      </button>
    </span>
  );
}
