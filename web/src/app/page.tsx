"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { Avatar } from "@/components/Avatar";
import { FAQ_GENERAL } from "@/lib/faq-data";
import { currentRole, currentSession, isAdmin } from "@/lib/cognito";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TeacherPreview = {
  userId: string;
  displayName?: string;
  bio?: string;
  subjects: string[];
  yearsExperience: number;
  hourlyRateCents: number;
  currency: string;
  ratingAvg: number;
  ratingCount: number;
  trialSession: boolean;
  city?: string;
  country?: string;
};

type ForumChannel = {
  channelId: string;
  name: string;
  description?: string;
};

type MarketplaceListing = {
  listingId: string;
  title: string;
  subjects: string[];
  priceCents: number;
  currency: string;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

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

const TESTIMONIALS = [
  {
    quote:
      "EduBoost helped me prepare for the bac in just 3 months. My teacher was amazing.",
    name: "Yasmine",
    role: "Student",
  },
  {
    quote:
      "I earn a fair rate and the platform handles everything — payments, reminders, the classroom. I just teach.",
    name: "Karim",
    role: "Teacher",
  },
  {
    quote:
      "I can track my daughter's grades and attendance from one place. Very reassuring.",
    name: "Amina",
    role: "Parent",
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function Home() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [teachers, setTeachers] = useState<TeacherPreview[] | null>(null);
  const [channels, setChannels] = useState<ForumChannel[] | null>(null);
  const [listings, setListings] = useState<MarketplaceListing[] | null>(null);
  const [activeSubject, setActiveSubject] = useState(SUBJECTS[0]);

  useEffect(() => {
    currentSession().then((s) => {
      if (s) {
        const role = currentRole(s);
        if (isAdmin(s)) return router.replace("/admin");
        if (role === "teacher") return router.replace("/teacher");
        if (role === "parent") return router.replace("/parent");
        return router.replace("/student");
      }
      setChecked(true);
    });
  }, [router]);

  useEffect(() => {
    if (!checked) return;
    api<{ items: TeacherPreview[] }>(`/teachers`)
      .then((r) => setTeachers(r.items))
      .catch(() => setTeachers([]));

    api<{ items: ForumChannel[] }>(`/forum/channels`)
      .then((r) => setChannels(r.items.slice(0, 3)))
      .catch(() => setChannels([]));

    api<{ items: MarketplaceListing[] }>(`/marketplace/listings?limit=4`)
      .then((r) => setListings(r.items.slice(0, 4)))
      .catch(() => setListings([]));
  }, [checked]);

  const teachersBySubject: Record<string, TeacherPreview[]> = {};
  if (teachers) {
    for (const t of teachers) {
      for (const subj of t.subjects) {
        if (!teachersBySubject[subj]) teachersBySubject[subj] = [];
        teachersBySubject[subj].push(t);
      }
    }
  }
  const visibleTeachers = (teachersBySubject[activeSubject] ?? []).slice(0, 4);

  if (!checked) {
    return <main className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;
  }

  return (
    <main>
      {/* ── 1. Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-6 pb-16 pt-20 text-center">
          <p className="eyebrow">Anno 2026 · Tunisian tutoring, online</p>
          <h1 className="mx-auto mt-4 max-w-4xl font-display text-5xl leading-[1.05] tracking-tight text-ink sm:text-6xl md:text-7xl">
            A place for
            <span className="italic"> learned </span>
            teachers and
            <span className="italic"> diligent </span>
            students.
          </h1>

          {/* Service highlights */}
          <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-ink-faded/20 bg-white/50 px-5 py-4">
              <div className="text-2xl">&#x2714;</div>
              <div className="mt-1 font-display text-sm text-ink">Verified profiles</div>
              <p className="mt-0.5 text-xs text-ink-soft">
                Every teacher is reviewed and approved by the EduBoost team.
              </p>
            </div>
            <div className="rounded-lg border border-ink-faded/20 bg-white/50 px-5 py-4">
              <div className="text-2xl">&#x1F3AC;</div>
              <div className="mt-1 font-display text-sm text-ink">Built-in classroom</div>
              <p className="mt-0.5 text-xs text-ink-soft">
                Video, whiteboard, notes, and quizzes — no external tools needed.
              </p>
            </div>
            <div className="rounded-lg border border-ink-faded/20 bg-white/50 px-5 py-4">
              <div className="text-2xl">&#x1F4B3;</div>
              <div className="mt-1 font-display text-sm text-ink">Secure payments in TND</div>
              <p className="mt-0.5 text-xs text-ink-soft">
                Pay safely on the platform. Teachers get paid after each lesson.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/teachers" className="btn-seal">
              Find a teacher
            </Link>
            <Link href="/signup" className="btn-secondary">
              Create an account
            </Link>
          </div>
        </div>
      </section>

      {/* ── 3. Subject-based teacher browsing ───────────────────── */}
      <section className="mx-auto mt-16 max-w-6xl px-6">
        <h2 className="text-center font-display text-3xl tracking-tight text-ink sm:text-4xl">
          Find your teacher by subject
        </h2>

        {/* Subject filter tabs */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {SUBJECTS.map((subj) => (
            <button
              key={subj}
              type="button"
              onClick={() => setActiveSubject(subj)}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                activeSubject === subj
                  ? "bg-ink text-parchment"
                  : "bg-parchment-dark text-ink-soft hover:bg-ink/10 hover:text-ink"
              }`}
            >
              {subj}
            </button>
          ))}
          <Link
            href="/teachers"
            className="rounded-full px-4 py-1.5 text-sm text-ink-faded transition hover:bg-ink/10 hover:text-ink"
          >
            More →
          </Link>
        </div>

        {/* Teacher cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {teachers === null
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card h-64 animate-pulse opacity-60" />
              ))
            : visibleTeachers.length > 0
              ? visibleTeachers.map((t) => (
                  <Link
                    key={t.userId}
                    href={`/teachers/${t.userId}` as never}
                    className="card-interactive group overflow-hidden"
                  >
                    <div className="relative flex h-40 items-center justify-center bg-parchment-dark">
                      <Avatar
                        userId={t.userId}
                        size="lg"
                        initial={t.displayName?.[0]}
                      />
                      {t.ratingCount > 0 && (
                        <span className="absolute left-2 top-2 rounded-sm bg-seal/90 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          ★ {t.ratingAvg.toFixed(1)}
                        </span>
                      )}
                      {t.trialSession && (
                        <span className="absolute right-2 top-2 rounded-sm bg-ink/80 px-1.5 py-0.5 text-[11px] font-semibold text-white">
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
                      </div>
                      <div className="mt-2 text-xs text-ink-soft">
                        Lessons start from
                      </div>
                      <div className="font-display text-base text-ink">
                        {formatMoney(t.hourlyRateCents, t.currency, { trim: true })}
                      </div>
                    </div>
                  </Link>
                ))
              : (
                <p className="col-span-full py-12 text-center text-sm text-ink-soft">
                  No teachers listed for {activeSubject} yet.
                </p>
              )}
        </div>

        <div className="mt-6 flex justify-center">
          <Link href="/teachers" className="btn-ghost">
            See all teachers →
          </Link>
        </div>
      </section>

      {/* ── Lesson request CTA ──────────────────────────────────── */}
      <section className="mx-auto mt-16 max-w-4xl px-6">
        <div className="card flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
          <div className="flex-1">
            <h3 className="font-display text-lg text-ink">
              Don&rsquo;t have time to browse?
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              Answer a few questions about what you need and let teachers come to
              you with lesson proposals.
            </p>
          </div>
          <Link href="/requests/new" className="btn-secondary shrink-0">
            Create a lesson request
          </Link>
        </div>
      </section>

      {/* ── 4. Community preview ────────────────────────────────── */}
      <div className="rule mx-auto mt-24 max-w-xl">
        <span className="font-display italic">· community ·</span>
      </div>

      <section className="mx-auto mt-10 max-w-5xl px-6">
        <h2 className="font-display text-3xl tracking-tight text-ink">
          Join the conversation
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Ask questions, share experiences, and compare notes with fellow
          students and teachers.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {channels === null
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card h-24 animate-pulse p-5 opacity-60" />
              ))
            : channels.map((ch) => (
                <div key={ch.channelId} className="card p-5">
                  <h3 className="font-display text-lg text-ink">{ch.name}</h3>
                  {ch.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
                      {ch.description}
                    </p>
                  )}
                </div>
              ))}
          {channels?.length === 0 && (
            <p className="col-span-full text-sm text-ink-soft">
              Community channels coming soon.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <Link href="/forum" className="btn-ghost">
            Join the community →
          </Link>
        </div>
      </section>

      {/* ── 5. Marketplace preview ──────────────────────────────── */}
      <div className="rule mx-auto mt-24 max-w-xl">
        <span className="font-display italic">· marketplace ·</span>
      </div>

      <section className="mx-auto mt-10 max-w-5xl px-6">
        <h2 className="font-display text-3xl tracking-tight text-ink">
          Study materials & resources
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Digital notes, exam banks, and workshop tickets — all from verified
          sellers.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {listings === null
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card h-32 animate-pulse p-5 opacity-60" />
              ))
            : listings.map((l) => (
                <div key={l.listingId} className="card p-5">
                  <h3 className="font-display text-base text-ink line-clamp-2">
                    {l.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {l.subjects.map((s) => (
                      <span
                        key={s}
                        className="rounded-sm border border-ink-faded/40 bg-white/60 px-1.5 py-0.5 text-xs text-ink-soft"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 font-display text-sm font-semibold text-ink">
                    {formatMoney(l.priceCents, l.currency, { trim: true })}
                  </div>
                </div>
              ))}
          {listings?.length === 0 && (
            <p className="col-span-full text-sm text-ink-soft">
              Marketplace listings coming soon.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <Link href="/marketplace" className="btn-ghost">
            Browse marketplace →
          </Link>
        </div>
      </section>

      {/* ── 6. Testimonials ─────────────────────────────────────── */}
      <div className="rule mx-auto mt-24 max-w-xl">
        <span className="font-display italic">· voices ·</span>
      </div>

      <section className="mx-auto mt-10 max-w-5xl px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <article key={t.name} className="card p-6">
              <p className="text-sm leading-relaxed italic text-ink-soft">
                &ldquo;{t.quote}&rdquo;
              </p>
              <p className="mt-4 text-sm font-medium text-ink">
                — {t.name},{" "}
                <span className="text-ink-faded">{t.role}</span>
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ── 7. FAQ preview ──────────────────────────────────────── */}
      <div className="rule mx-auto mt-24 max-w-xl">
        <span className="font-display italic">· questions ·</span>
      </div>

      <section className="mx-auto mt-10 max-w-3xl px-6">
        <h2 className="font-display text-3xl tracking-tight text-ink">
          Frequently asked questions
        </h2>
        <div className="card mt-6 divide-y divide-ink-faded/30">
          {FAQ_GENERAL.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer items-center justify-between gap-2 p-4 text-sm font-medium text-ink">
                <span>{f.q}</span>
                <span className="text-ink-faded transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="px-4 pb-4 text-sm leading-relaxed text-ink-soft">
                {f.a}
              </p>
            </details>
          ))}
        </div>
        <div className="mt-6 flex justify-center">
          <Link href="/faq" className="btn-ghost">
            See all FAQs →
          </Link>
        </div>
      </section>

      <div className="pb-16" />
    </main>
  );
}
