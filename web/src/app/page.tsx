"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { currentRole, currentSession, isAdmin } from "@/lib/cognito";
import {
  Search,
  BookOpen,
  User,
  MapPin,
  Star,
  Check,
  Play,
  ArrowRight,
  Shield,
  Monitor,
  Lock,
  Plus,
} from "lucide-react";

type TeacherPreview = {
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
  city?: string;
  country?: string;
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
];

const LEVELS = [
  "Bac · terminale",
  "1ère année",
  "2ème année",
  "3ème année",
  "Université",
  "Adult learner",
];

const CITIES = ["Online", "Tunis", "Sfax", "Sousse", "Monastir", "Bizerte", "Nabeul"];

const POPULAR = [
  "Bac maths",
  "English speaking",
  "IELTS",
  "Physics",
  "French dissertation",
  "Programming",
];

const TESTIMONIALS = [
  {
    quote:
      "My teacher explains things so clearly — I went from 11 to 16 in three months. Worth every dinar.",
    name: "Yasmine M.",
    role: "Bac student, Tunis",
  },
  {
    quote:
      "I earn a fair rate and the platform handles everything — payments, reminders, the classroom. I just teach.",
    name: "Karim H.",
    role: "Physics teacher, Sfax",
  },
  {
    quote:
      "I can track my daughter's grades and attendance from one place. Very reassuring.",
    name: "Amina R.",
    role: "Parent of 2 bac students",
  },
];

const FAQ_ITEMS = [
  {
    q: "How are teachers verified?",
    a: "Every teacher submits ID, qualifications, and a short intro video. We interview them by video and check references before they can take students. The badge on their profile shows the verification date.",
  },
  {
    q: "What does a trial lesson cost?",
    a: "Trial lessons are free with any teacher who offers them — usually 25 to 30 minutes. You'll see a 'Free trial' badge on their card. You only pay after the trial if you book a real session.",
  },
  {
    q: "Can my parent pay for me?",
    a: "Yes. Parents can create a linked account, add their card, and approve sessions for one or more children. They also see attendance and grades from a shared dashboard.",
  },
  {
    q: "What if a lesson is cancelled?",
    a: "If you cancel more than 12 hours ahead, the lesson is rescheduled for free. Within 12 hours, the teacher decides — most rebook for free anyway. If the teacher cancels, you're refunded automatically.",
  },
  {
    q: "Where do you operate?",
    a: "Anywhere in Tunisia, online. Many teachers also offer in-person lessons in Tunis, Sfax, Sousse, Monastir, Bizerte, Nabeul and Kairouan — use the city filter to find them.",
  },
];

export default function Home() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [teachers, setTeachers] = useState<TeacherPreview[] | null>(null);
  const [activeSubject, setActiveSubject] = useState(SUBJECTS[0]);
  const [audience, setAudience] = useState<"student" | "teacher">("student");
  const [openFaq, setOpenFaq] = useState(0);
  const [subject, setSubject] = useState("Mathematics");
  const [level, setLevel] = useState("Bac · terminale");
  const [city, setCity] = useState("Online");

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
  }, [checked]);

  const teachersBySubject = (subj: string) =>
    (teachers ?? []).filter((t) => t.subjects.includes(subj)).slice(0, 4);

  const visible = teachersBySubject(activeSubject);

  if (!checked) {
    return (
      <main className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
      </main>
    );
  }

  return (
    <main>
      {/* ════ HERO ════ */}
      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, #eaf1ff 0%, #ffffff 70%)" }}
      >
        <div className="relative mx-auto max-w-container-wide px-4 pb-14 pt-16 sm:px-8">
          {/* Decorative dots */}
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50">
            <div className="absolute left-[6%] top-10 h-3.5 w-3.5 rounded-full bg-accent" />
            <div className="absolute right-[8%] top-[120px] h-[22px] w-[22px] rounded-full border-2 border-gold bg-bg-sun" />
            <div className="absolute left-[2%] top-[320px] h-2.5 w-2.5 rounded-full bg-warn" />
            <div className="absolute right-[3%] top-[220px] h-3 w-3 rounded-full bg-green" />
          </div>

          <div className="relative mx-auto max-w-[820px] text-center">
            <span className="chip chip-sun font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Free trial · cancel anytime
            </span>
            <h1 className="mt-[18px] text-[clamp(44px,6vw,76px)] font-bold leading-[1.02] tracking-[-0.03em]">
              Learn from a real <span className="text-accent">teacher.</span>
              <br />
              Anywhere in Tunisia.
            </h1>
            <p className="mx-auto mt-[18px] max-w-[620px] text-lg leading-relaxed text-ink-soft">
              Pick a subject. Pick a teacher you actually click with. Pay only after the lesson.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative mx-auto mt-8 max-w-[780px]">
            <div
              className="card flex flex-wrap items-center gap-1 p-2 sm:flex-nowrap"
              style={{
                borderRadius: 999,
                borderWidth: "1.5px",
                boxShadow:
                  "0 22px 60px -30px rgba(20,18,8,0.35), 0 6px 16px -10px rgba(44,91,255,0.18)",
              }}
            >
              <SearchField icon={<BookOpen size={16} />} label="Subject" value={subject} options={SUBJECTS} onChange={setSubject} />
              <div className="hidden h-8 w-px bg-rule sm:block" />
              <SearchField icon={<User size={16} />} label="Level" value={level} options={LEVELS} onChange={setLevel} />
              <div className="hidden h-8 w-px bg-rule sm:block" />
              <SearchField icon={<MapPin size={16} />} label="City" value={city} options={CITIES} onChange={setCity} />
              <Link
                href={`/teachers?subject=${encodeURIComponent(subject)}`}
                className="btn-accent ml-auto flex items-center gap-2 px-[22px] py-[13px] w-full sm:w-auto"
              >
                <Search size={16} /> Search
              </Link>
            </div>
            <div className="mt-3.5 flex flex-wrap justify-center gap-1.5">
              <span className="mr-1 self-center text-[13px] text-ink-faded">Popular:</span>
              {POPULAR.map((p) => (
                <Link
                  key={p}
                  href={`/teachers?subject=${encodeURIComponent(p)}`}
                  className="chip chip-outline cursor-pointer font-medium"
                >
                  {p}
                </Link>
              ))}
            </div>
          </div>

          {/* Trust strip */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-12 gap-y-5 text-center">
            <TrustStat big={`${teachers?.length ?? "380"}+`} label="Verified teachers" />
            <TrustStat big="14k" label="Students learning" />
            <TrustStat big="4.9 ★" label="2,400+ reviews" />
            <TrustStat big="48" label="Subjects taught" />
          </div>
        </div>
      </section>

      {/* ════ VALUE STRIP ════ */}
      <section className="mx-auto mt-6 max-w-container-wide px-8">
        <div className="card grid overflow-hidden p-0 sm:grid-cols-3">
          {[
            { icon: <Shield size={20} />, title: "Verified teachers", body: "Every teacher is reviewed by our team before they can take students." },
            { icon: <Monitor size={20} />, title: "Classroom built-in", body: "Video, whiteboard, notes and quizzes — no Zoom, no plugins, no setup." },
            { icon: <Lock size={20} />, title: "Paid in TND", body: "Pay on the platform, teachers get paid after each lesson. Refunds covered." },
          ].map((it, i) => (
            <div
              key={i}
              className={`flex items-start gap-4 p-6 ${i < 2 ? "border-b border-rule sm:border-b-0 sm:border-r" : ""}`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-pale text-accent-deep">
                {it.icon}
              </div>
              <div>
                <div className="text-[14.5px] font-semibold">{it.title}</div>
                <div className="mt-1 text-[13px] leading-snug text-ink-soft">{it.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ SUBJECT BROWSER ════ */}
      <section className="mx-auto mt-24 max-w-container-wide px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="eyebrow">Browse by subject</div>
            <h2 className="mt-3 text-[clamp(34px,4.5vw,52px)] font-bold tracking-[-0.02em]">
              Find your <span className="text-accent">subject</span>, find your teacher.
            </h2>
          </div>
          <Link href="/teachers" className="btn-outline flex items-center gap-2 text-sm">
            See all teachers <ArrowRight size={14} />
          </Link>
        </div>

        <div className="mt-7 flex flex-wrap gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSubject(s)}
              className={`rounded-full border px-3.5 py-2 text-[13.5px] transition ${
                activeSubject === s
                  ? "border-ink bg-ink text-white"
                  : "border-rule bg-bg-card text-ink-soft hover:border-ink/30 hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-7 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {visible.length === 0 ? (
            <p className="col-span-full py-12 text-center text-ink-faded">
              No teachers listed for {activeSubject} yet.
            </p>
          ) : (
            visible.map((t) => <TeacherCard key={t.userId} t={t} />)
          )}
        </div>
      </section>

      {/* ════ REQUEST BANNER ════ */}
      <section className="mx-auto mt-16 max-w-container-wide px-8">
        <div
          className="card flex flex-wrap items-center justify-between gap-8 border-ink p-11"
          style={{ background: "var(--ink)", color: "#ffffff" }}
        >
          <div className="max-w-[560px]">
            <div className="text-xs font-bold uppercase tracking-[0.05em] text-white/55">
              Don&apos;t have time to browse?
            </div>
            <h3 className="mt-2 text-[30px] font-bold leading-tight tracking-tight">
              Tell us what you need. Teachers will come to <span className="text-accent" style={{ color: "var(--accent)" }}>you</span>.
            </h3>
            <p className="mt-2.5 text-[14.5px] text-white/70">
              Answer five quick questions about your subject, level and schedule. You&apos;ll get matched proposals within 24 hours — pick the one you like.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/requests/new"
              className="inline-flex items-center gap-2 rounded-full bg-white px-[26px] py-3.5 text-[15px] font-semibold text-ink"
            >
              Post a lesson request <ArrowRight size={16} />
            </Link>
            <span className="text-[12.5px] text-white/55">
              Takes ~2 minutes · No payment until you accept
            </span>
          </div>
        </div>
      </section>

      {/* ════ HOW IT WORKS ════ */}
      <section className="mx-auto mt-24 max-w-container-wide px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="eyebrow">How it works</div>
            <h2 className="mt-3 text-[clamp(34px,4.5vw,52px)] font-bold tracking-[-0.02em]">
              Two flows. <span className="text-accent">Same platform.</span>
            </h2>
          </div>
          <div className="inline-flex rounded-full border border-rule bg-white p-1">
            {[
              { k: "student" as const, label: "I'm a student / parent" },
              { k: "teacher" as const, label: "I'm a teacher" },
            ].map((o) => (
              <button
                key={o.k}
                onClick={() => setAudience(o.k)}
                className={`rounded-full px-[18px] py-2.5 text-[13.5px] font-medium transition ${
                  audience === o.k ? "bg-ink text-white" : "text-ink-soft"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {(audience === "student"
            ? [
                { n: "01", title: "Browse verified teachers", body: "Filter by subject, city, rate, and language. Read reviews from students who actually booked." },
                { n: "02", title: "Book a free trial", body: "Most teachers offer a 30-minute trial. No payment until both of you confirm the match." },
                { n: "03", title: "Learn in our classroom", body: "Video, whiteboard, shared notes, recordings, and homework — all in one place." },
                { n: "04", title: "Pay only after the lesson", body: "Pay safely in TND. If something goes wrong, we cover refunds." },
              ]
            : [
                { n: "01", title: "Apply to teach", body: "Submit your profile and credentials. Our team reviews every application within 2–3 days." },
                { n: "02", title: "Set your rate and schedule", body: "You own your calendar and your rate. Offer trials, group sessions, or in-person lessons." },
                { n: "03", title: "Use our classroom + tools", body: "Whiteboard, recordings, attendance, grading and parent messaging — all built in." },
                { n: "04", title: "Get paid after each lesson", body: "Stripe payouts in TND, weekly. We handle invoicing. You keep 85% of your rate." },
              ]
          ).map((s, i) => (
            <div
              key={s.n}
              className={`border-t border-rule p-7 ${i < 3 ? "lg:border-r" : ""}`}
            >
              <div className="font-mono text-[13px] text-accent">{s.n}</div>
              <div className="mt-[18px] text-[22px] font-bold tracking-tight">{s.title}</div>
              <p className="mt-2.5 text-[13.5px] leading-snug text-ink-soft">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-7 flex gap-2.5">
          {audience === "student" ? (
            <Link href="/teachers" className="btn-accent flex items-center gap-2">
              Find your teacher <ArrowRight size={14} />
            </Link>
          ) : (
            <Link href="/signup?role=teacher" className="btn-accent flex items-center gap-2">
              Apply to teach <ArrowRight size={14} />
            </Link>
          )}
          <Link href="/blog" className="btn-ghost">Read the guide</Link>
        </div>
      </section>

      {/* ════ TESTIMONIALS ════ */}
      <section className="mx-auto mt-24 max-w-container-wide px-8">
        <div className="eyebrow">Voices</div>
        <h2 className="mt-3 text-[clamp(34px,4.5vw,52px)] font-bold tracking-[-0.02em]">
          What people say.
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="card flex flex-col p-6">
              <div className="text-4xl leading-none text-ink-faded">&ldquo;</div>
              <p className="mt-2.5 text-[19px] leading-snug">
                {t.quote}
              </p>
              <div className="mt-auto flex items-center gap-2.5 pt-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-pale font-semibold text-accent-deep">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold">{t.name}</div>
                  <div className="text-xs text-ink-faded">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ FAQ ════ */}
      <section className="mx-auto mt-24 max-w-container-wide px-8 pb-16">
        <div className="grid items-start gap-14 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="lg:sticky lg:top-24">
            <div className="eyebrow">Questions</div>
            <h2 className="mt-3 text-[clamp(34px,4.5vw,52px)] font-bold tracking-[-0.02em]">
              Common <span className="text-accent">questions</span>.
            </h2>
            <p className="mt-4 max-w-[360px] text-[14.5px] text-ink-soft">
              Can&apos;t find what you&apos;re looking for? Our support team replies in under 4 hours, every day of the week.
            </p>
            <Link href="/support" className="btn-outline mt-5 inline-block">Visit help center</Link>
          </div>
          <div>
            {FAQ_ITEMS.map((f, i) => {
              const isOpen = i === openFaq;
              return (
                <div
                  key={f.q}
                  className={`border-b border-rule ${i === 0 ? "border-t-[1px] border-t-ink" : ""}`}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? -1 : i)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  >
                    <span className="text-[22px] font-semibold tracking-tight">{f.q}</span>
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rule transition-transform ${isOpen ? "rotate-45" : ""}`}
                    >
                      <Plus size={14} />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="max-w-[620px] pb-6 text-[15px] leading-relaxed text-ink-soft">
                      {f.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function SearchField({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative min-w-0 flex-1" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 rounded-full px-3.5 py-2 text-left transition ${
          open ? "bg-bg-soft" : "hover:bg-bg-soft"
        }`}
      >
        <span className="inline-flex text-accent">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-[0.04em] text-ink-faded">
            {label}
          </span>
          <span className="block truncate text-sm font-semibold">{value}</span>
        </span>
      </button>
      {open && (
        <div className="card absolute left-0 right-0 top-[calc(100%+8px)] z-10 max-h-72 overflow-y-auto p-1.5 shadow-lift">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                o === value ? "bg-accent-pale font-semibold text-accent-deep" : "hover:bg-bg-soft"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TrustStat({ big, label }: { big: string; label: string }) {
  return (
    <div>
      <div className="text-[28px] font-bold tracking-[-0.02em]">{big}</div>
      <div className="mt-0.5 text-[12.5px] text-ink-faded">{label}</div>
    </div>
  );
}

function TeacherCard({ t }: { t: TeacherPreview }) {
  // Deterministic hue from name for gradient backdrop
  const name = t.displayName ?? "Teacher";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) & 0xffff;
  const hue = Math.abs(h) % 360;

  return (
    <Link
      href={`/teachers/${t.userId}`}
      className="card-interactive flex flex-col overflow-hidden"
      style={{ borderRadius: 18 }}
    >
      {/* Photo / video thumb */}
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: "5 / 4",
          background: `linear-gradient(135deg, oklch(0.88 0.06 ${hue}) 0%, oklch(0.94 0.04 ${(hue + 40) % 360}) 100%)`,
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <Avatar userId={t.userId} size="xl" initial={name} className="!h-[88px] !w-[88px]" />
        </div>
        {/* Play pill */}
        <div className="absolute bottom-3 left-3">
          <span className="play-pill"><Play size={10} fill="currentColor" /> Intro · 0:54</span>
        </div>
        {/* Free trial badge */}
        {t.trialSession && (
          <div className="absolute left-3 top-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[11.5px] font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-green" />
              Free trial
            </span>
          </div>
        )}
        {/* Verified */}
        {t.ratingCount > 0 && (
          <span
            title="Verified"
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white"
            style={{ border: "2px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,0.18)" }}
          >
            <Check size={14} />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 truncate text-[17px] font-bold tracking-tight">{name}</div>
          <div className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold">
            <Star size={13} fill="#ffb547" className="text-gold" />
            {t.ratingAvg > 0 ? t.ratingAvg.toFixed(1) : "—"}
            <span className="font-normal text-ink-faded"> ({t.ratingCount})</span>
          </div>
        </div>
        <div className="text-[13px] text-ink-soft">
          Teaches <strong className="font-semibold text-ink">{t.subjects[0] ?? "various"}</strong>
          {t.subjects.length > 1 && (
            <span className="text-ink-faded"> · +{t.subjects.length - 1} more</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-1.5">
          {t.languages.slice(0, 3).map((l) => (
            <span key={l} className="chip px-2.5 py-1 text-[11.5px]">{l}</span>
          ))}
        </div>
        <div className="mt-auto flex items-baseline justify-between gap-2 border-t border-rule-soft pt-3">
          <div>
            <span className="text-[22px] font-bold">{(t.hourlyRateCents / 1000).toFixed(0)}</span>
            <span className="text-[12.5px] text-ink-faded"> DT / 50-min</span>
          </div>
          <span className="text-[13px] font-semibold text-accent">Book →</span>
        </div>
      </div>
    </Link>
  );
}
