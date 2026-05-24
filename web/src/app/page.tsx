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

const HOW_IT_WORKS_STUDENT = [
  {
    step: "01",
    title: "Browse teachers",
    desc: "Filter by subject, price, and availability. Read reviews from real students.",
  },
  {
    step: "02",
    title: "Book a session",
    desc: "Pick a time slot that works for you. Pay securely on the platform.",
  },
  {
    step: "03",
    title: "Join the classroom",
    desc: "Video, whiteboard, and chat — all in your browser. No installs needed.",
  },
  {
    step: "04",
    title: "Track your progress",
    desc: "Review recordings, check grades, and book your next session.",
  },
];

const HOW_IT_WORKS_TEACHER = [
  {
    step: "01",
    title: "Create your profile",
    desc: "Set your subjects, hourly rate, and availability. We verify every profile.",
  },
  {
    step: "02",
    title: "Accept bookings",
    desc: "Students find you and book sessions. You approve and confirm the time.",
  },
  {
    step: "03",
    title: "Teach in our classroom",
    desc: "Video, whiteboard, screen share, and quizzes — all built in.",
  },
  {
    step: "04",
    title: "Get paid",
    desc: "Funds are released after each completed session. Track earnings on your dashboard.",
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
  const [howItWorksRole, setHowItWorksRole] = useState<"student" | "teacher">(
    "student"
  );

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

  const howItWorksSteps =
    howItWorksRole === "student" ? HOW_IT_WORKS_STUDENT : HOW_IT_WORKS_TEACHER;

  if (!checked) {
    return (
      <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12 text-ink-soft">
        Loading...
      </main>
    );
  }

  return (
    <main>
      {/* ── 1. Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-bg pt-20 pb-20 sm:pt-28 sm:pb-24">
        <div className="mx-auto max-w-container-wide px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left — text */}
            <div>
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-faded">
                Tunisian tutoring, online
              </div>
              <h1 className="mt-5 font-serif text-5xl leading-[1.08] tracking-tight text-ink sm:text-6xl md:text-7xl">
                Tutoring,{" "}
                <span className="italic text-accent">thoughtfully</span> done.
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft">
                Find verified teachers, book sessions, and learn in a built-in
                classroom — all in one place. Pay securely in TND.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/teachers" className="btn-seal">
                  Find a teacher
                </Link>
                <Link href="/signup" className="btn-secondary">
                  Create an account
                </Link>
              </div>

              {/* Stacked avatars + rating */}
              {teachers && teachers.length > 0 && (
                <div className="mt-10 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {teachers.slice(0, 5).map((t) => (
                      <Avatar
                        key={t.userId}
                        userId={t.userId}
                        size="sm"
                        initial={t.displayName?.[0]}
                        className="ring-2 ring-white"
                      />
                    ))}
                  </div>
                  <div className="text-sm text-ink-soft">
                    <span className="font-medium text-ink">
                      {teachers.length}+ teachers
                    </span>{" "}
                    ready to help
                  </div>
                </div>
              )}
            </div>

            {/* Right — composed visual card */}
            <div className="hidden lg:block">
              <div className="relative mx-auto max-w-sm">
                {/* Main card */}
                <div className="card overflow-hidden p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-2.5 w-2.5 items-center justify-center">
                      <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-green-400 opacity-75" />
                      <span className="relative h-2 w-2 rounded-full bg-green-500" />
                    </div>
                    <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
                      Live now
                    </span>
                  </div>
                  <div className="mt-5 flex items-center gap-4">
                    {teachers && teachers[0] ? (
                      <Avatar
                        userId={teachers[0].userId}
                        size="lg"
                        initial={teachers[0].displayName?.[0]}
                      />
                    ) : (
                      <div className="h-24 w-24 rounded-full bg-bg-soft" />
                    )}
                    <div>
                      <div className="font-serif text-xl text-ink">
                        {teachers?.[0]?.displayName ?? "Expert Teacher"}
                      </div>
                      <div className="mt-3 text-sm text-ink-soft">
                        {teachers?.[0]?.subjects?.slice(0, 2).join(", ") ??
                          "Mathematics, Physics"}
                      </div>
                      {teachers?.[0]?.ratingCount ? (
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className="text-sm text-gold">
                            {"★".repeat(
                              Math.round(teachers[0].ratingAvg)
                            )}
                          </span>
                          <span className="text-xs text-ink-faded">
                            ({teachers[0].ratingCount} reviews)
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between rounded-xl bg-accent-pale px-4 py-3">
                    <span className="text-sm text-accent-deep">
                      Next available slot
                    </span>
                    <span className="font-mono text-sm font-medium text-accent">
                      Today
                    </span>
                  </div>
                </div>

                {/* Floating accent badge */}
                <div className="absolute -right-4 -top-3 rounded-full bg-accent px-4 py-2 text-xs font-medium text-white shadow-seal">
                  Verified
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Value strip ──────────────────────────────────────── */}
      <section className="border-y border-rule bg-bg-soft">
        <div className="mx-auto max-w-container-wide px-8">
          <div className="grid divide-y divide-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {/* Verified teachers */}
            <div className="flex items-start gap-4 py-8 sm:pr-8">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-pale">
                <svg
                  className="h-5 w-5 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
                  />
                </svg>
              </div>
              <div>
                <div className="font-serif text-base font-medium text-ink">
                  Verified teachers
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  Every profile is reviewed and approved by our team.
                </p>
              </div>
            </div>
            {/* Built-in classroom */}
            <div className="flex items-start gap-4 py-8 sm:px-8">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-pale">
                <svg
                  className="h-5 w-5 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
              </div>
              <div>
                <div className="font-serif text-base font-medium text-ink">
                  Classroom built-in
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  Video, whiteboard, and chat. No external tools needed.
                </p>
              </div>
            </div>
            {/* Paid in TND */}
            <div className="flex items-start gap-4 py-8 sm:pl-8">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-pale">
                <svg
                  className="h-5 w-5 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
                  />
                </svg>
              </div>
              <div>
                <div className="font-serif text-base font-medium text-ink">
                  Paid in TND
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  Pay securely. Teachers get paid after each lesson.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Subject browser ──────────────────────────────────── */}
      <section className="mt-24">
        <div className="mx-auto max-w-container-wide px-8">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-faded">
            Browse by subject
          </div>
          <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
            Find your subject, find your{" "}
            <span className="italic">teacher</span>.
          </h2>

          {/* Subject chip tabs */}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {SUBJECTS.map((subj) => (
              <button
                key={subj}
                type="button"
                onClick={() => setActiveSubject(subj)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeSubject === subj
                    ? "bg-accent text-white"
                    : "chip chip-outline hover:border-ink/30 hover:text-ink"
                }`}
              >
                {subj}
              </button>
            ))}
            <Link
              href="/teachers"
              className="rounded-full px-4 py-2 text-sm font-medium text-ink-faded transition hover:text-ink"
            >
              All subjects →
            </Link>
          </div>

          {/* Teacher cards — 4 col */}
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {teachers === null
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="card h-72 animate-pulse opacity-60"
                  />
                ))
              : visibleTeachers.length > 0
                ? visibleTeachers.map((t) => (
                    <Link
                      key={t.userId}
                      href={`/teachers/${t.userId}` as never}
                      className="card-interactive group overflow-hidden"
                    >
                      <div className="relative flex h-44 items-center justify-center bg-bg-soft">
                        <Avatar
                          userId={t.userId}
                          size="lg"
                          initial={t.displayName?.[0]}
                        />
                        {t.ratingCount > 0 && (
                          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                            ★ {t.ratingAvg.toFixed(1)}
                          </span>
                        )}
                        {t.trialSession && (
                          <span className="absolute right-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-semibold text-white">
                            Trial
                          </span>
                        )}
                      </div>
                      <div className="p-5">
                        <div className="font-serif text-lg text-ink group-hover:text-accent transition">
                          {t.displayName ?? "Teacher"}
                        </div>
                        <div className="mt-1 text-xs text-ink-faded">
                          {t.subjects.slice(0, 2).join(" · ")}
                        </div>
                        <div className="mt-3 flex items-baseline justify-between">
                          <span className="text-xs text-ink-soft">
                            From
                          </span>
                          <span className="font-serif text-lg font-medium text-ink">
                            {formatMoney(t.hourlyRateCents, t.currency, {
                              trim: true,
                            })}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))
                : (
                  <p className="col-span-full py-16 text-center text-sm text-ink-soft">
                    No teachers listed for {activeSubject} yet.
                  </p>
                )}
          </div>

          <div className="mt-8 flex justify-center">
            <Link href="/teachers" className="btn-ghost">
              See all teachers →
            </Link>
          </div>
        </div>
      </section>

      {/* ── 4. Request banner ───────────────────────────────────── */}
      <section className="mt-24">
        <div className="mx-auto max-w-container-wide px-8">
          <div className="rounded-2xl bg-ink px-8 py-10 sm:flex sm:items-center sm:justify-between sm:px-12 sm:py-12">
            <div>
              <h3 className="font-serif text-2xl text-white sm:text-3xl">
                Don&rsquo;t have time to browse?
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">
                Describe what you need and let teachers come to you with lesson
                proposals.
              </p>
            </div>
            <div className="mt-6 sm:mt-0 sm:ml-8">
              <Link
                href="/requests/new"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-ink shadow-vellum transition hover:bg-bg-soft"
              >
                Post a lesson request
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. How it works ─────────────────────────────────────── */}
      <section className="mt-24">
        <div className="mx-auto max-w-container-wide px-8">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-faded">
            How it works
          </div>
          <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
            Simple for <span className="italic">everyone</span>.
          </h2>

          {/* Student / Teacher toggle */}
          <div className="mt-8 inline-flex rounded-full border border-rule bg-bg-soft p-1">
            <button
              type="button"
              onClick={() => setHowItWorksRole("student")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                howItWorksRole === "student"
                  ? "bg-white text-ink shadow-vellum"
                  : "text-ink-faded hover:text-ink"
              }`}
            >
              I&rsquo;m a student
            </button>
            <button
              type="button"
              onClick={() => setHowItWorksRole("teacher")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                howItWorksRole === "teacher"
                  ? "bg-white text-ink shadow-vellum"
                  : "text-ink-faded hover:text-ink"
              }`}
            >
              I&rsquo;m a teacher
            </button>
          </div>

          {/* 4-step cards */}
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorksSteps.map((s) => (
              <div key={s.step} className="card p-6">
                <div className="font-mono text-3xl font-semibold text-accent/30">
                  {s.step}
                </div>
                <h3 className="mt-3 font-serif text-lg text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Community preview ───────────────────────────────────── */}
      <section className="mt-24">
        <div className="mx-auto max-w-container-wide px-8">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-faded">
            Community
          </div>
          <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
            Join the <span className="italic">conversation</span>.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-soft">
            Ask questions, share experiences, and compare notes with fellow
            students and teachers.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {channels === null
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="card h-28 animate-pulse p-6 opacity-60"
                  />
                ))
              : channels.length === 0
                ? (
                  <p className="col-span-full text-sm text-ink-soft">
                    Community channels coming soon.
                  </p>
                )
                : channels.map((ch) => (
                  <div key={ch.channelId} className="card-interactive p-6">
                    <h3 className="font-serif text-lg text-ink">{ch.name}</h3>
                    {ch.description && (
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">
                        {ch.description}
                      </p>
                    )}
                  </div>
                ))}
          </div>

          <div className="mt-8 flex justify-center">
            <Link href="/forum" className="btn-ghost">
              Join the community →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Marketplace preview ─────────────────────────────────── */}
      <section className="mt-24">
        <div className="mx-auto max-w-container-wide px-8">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-faded">
            Marketplace
          </div>
          <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
            Study materials &amp; <span className="italic">resources</span>.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-soft">
            Digital notes, exam banks, and workshop tickets — all from verified
            sellers.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {listings === null
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="card h-36 animate-pulse p-6 opacity-60"
                  />
                ))
              : listings.length === 0
                ? (
                  <p className="col-span-full text-sm text-ink-soft">
                    Marketplace listings coming soon.
                  </p>
                )
                : listings.map((l) => (
                  <div key={l.listingId} className="card-interactive p-6">
                    <h3 className="font-serif text-base text-ink line-clamp-2">
                      {l.title}
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {l.subjects.map((s) => (
                        <span key={s} className="chip text-[11px]">
                          {s}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 font-serif text-lg font-medium text-ink">
                      {formatMoney(l.priceCents, l.currency, { trim: true })}
                    </div>
                  </div>
                ))}
          </div>

          <div className="mt-8 flex justify-center">
            <Link href="/marketplace" className="btn-ghost">
              Browse marketplace →
            </Link>
          </div>
        </div>
      </section>

      {/* ── 6. Testimonials ─────────────────────────────────────── */}
      <section className="mt-24 bg-bg-soft py-20">
        <div className="mx-auto max-w-container-wide px-8">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-faded">
            Testimonials
          </div>
          <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
            What people <span className="italic">say</span>.
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <article key={t.name} className="card bg-white p-8">
                {/* Serif quote mark */}
                <div className="font-serif text-5xl leading-none text-accent/20">
                  &ldquo;
                </div>
                <p className="mt-2 font-serif text-lg italic leading-relaxed text-ink-soft">
                  {t.quote}
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-pale font-serif text-sm font-medium text-accent">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-ink">{t.name}</div>
                    <div className="text-xs text-ink-faded">{t.role}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. FAQ ──────────────────────────────────────────────── */}
      <section className="mt-24">
        <div className="mx-auto max-w-container-wide px-8">
          <div className="grid gap-12 lg:grid-cols-5 lg:gap-16">
            {/* Left — sticky heading */}
            <div className="lg:col-span-2 lg:sticky lg:top-24 lg:self-start">
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-faded">
                FAQ
              </div>
              <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
                Common <span className="italic">questions</span>.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                Everything you need to know about getting started with EduBoost.
              </p>
              <div className="mt-6">
                <Link href="/faq" className="btn-secondary">
                  See all FAQs
                </Link>
              </div>
            </div>

            {/* Right — accordion */}
            <div className="lg:col-span-3">
              <div className="card divide-y divide-rule">
                {FAQ_GENERAL.map((f) => (
                  <details key={f.q} className="group">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5">
                      <span className="font-serif text-base text-ink">
                        {f.q}
                      </span>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-rule text-ink-faded transition-transform duration-200 group-open:rotate-45">
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 4.5v15m7.5-7.5h-15"
                          />
                        </svg>
                      </span>
                    </summary>
                    <p className="px-6 pb-5 text-sm leading-relaxed text-ink-soft">
                      {f.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="pb-24" />
    </main>
  );
}
