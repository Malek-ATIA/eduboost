"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

type Post = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  date: string;
  reading: string;
};

const POSTS: Post[] = [
  {
    slug: "bac-maths-revision-plan",
    title: "A six-week revision plan for the bac maths — that actually works.",
    excerpt:
      "Most plans are too ambitious. This one is built around what students realistically have time for in the final stretch — past papers, weak chapters, and rest.",
    category: "Study guides",
    author: "Amira Ben Salem",
    date: "May 22, 2026",
    reading: "8 min read",
  },
  {
    slug: "why-trial-lessons-matter",
    title: "Why we make trial lessons free — and how to get the most from them.",
    excerpt:
      "Trial lessons aren't sales calls. Here's how to use the 30 minutes to figure out whether a teacher actually fits how you learn.",
    category: "For students",
    author: "Karim Hamdi",
    date: "May 18, 2026",
    reading: "5 min read",
  },
  {
    slug: "supporting-a-bac-year",
    title: "Supporting a child through their bac year — without taking over.",
    excerpt:
      "Real talk from parents who've been through it. What helps, what doesn't, and the line between supportive and suffocating.",
    category: "For parents",
    author: "Rim Cherif",
    date: "May 12, 2026",
    reading: "7 min read",
  },
  {
    slug: "teaching-rates-tunisia",
    title: "Setting your hourly rate as a private teacher in Tunisia.",
    excerpt:
      "A practical guide to pricing your time fairly — based on what 200+ EduBoost teachers actually charge, broken down by subject and experience.",
    category: "For teachers",
    author: "Mehdi Jallouli",
    date: "May 5, 2026",
    reading: "6 min read",
  },
  {
    slug: "ielts-speaking-prep",
    title: "IELTS speaking — the 4 mistakes that cost you a band.",
    excerpt:
      "After grading hundreds of mock tests, the same four issues keep coming up. Fix these and you'll see your speaking score jump.",
    category: "Study guides",
    author: "Rim Cherif",
    date: "April 28, 2026",
    reading: "5 min read",
  },
  {
    slug: "online-vs-in-person",
    title: "Online vs. in-person tutoring: which actually works better?",
    excerpt:
      "We looked at outcomes across 12,000 sessions. The answer is more interesting than 'it depends.'",
    category: "Research",
    author: "EduBoost team",
    date: "April 22, 2026",
    reading: "9 min read",
  },
  {
    slug: "math-anxiety",
    title: "Math anxiety is real — and it's not about ability.",
    excerpt:
      "Why so many capable students freeze on tests, and the small classroom changes teachers can make to break the cycle.",
    category: "For teachers",
    author: "Amira Ben Salem",
    date: "April 14, 2026",
    reading: "6 min read",
  },
];

const CATEGORIES = ["All", ...Array.from(new Set(POSTS.map((p) => p.category)))];

export default function BlogPage() {
  const [category, setCategory] = useState("All");
  const featured = POSTS[0];
  const rest = POSTS.slice(1);
  const filtered = category === "All" ? rest : rest.filter((p) => p.category === category);

  return (
    <main className="mx-auto max-w-container-wide px-4 pb-16 pt-12 sm:px-8">
      {/* ── Editorial header ── */}
      <div className="grid items-end gap-14 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="eyebrow">The folio</div>
          <h1 className="mt-3 font-bold text-[clamp(40px,5vw,64px)] leading-[1.05] tracking-tight">
            Writing on learning,<br />teaching, and the <span className="text-accent">bac</span>.
          </h1>
        </div>
        <p className="max-w-[460px] text-base leading-relaxed text-ink-soft">
          Honest guides from teachers, parents, and students who use EduBoost every week. No fluff, no SEO tricks.
        </p>
      </div>

      {/* ── Categories ── */}
      <div className="mt-10 flex flex-wrap gap-1.5 border-b border-rule pb-4">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-3.5 py-2 text-[13.5px] transition ${
              category === c
                ? "border border-ink bg-ink text-white"
                : "border border-rule text-ink-soft hover:border-ink/30 hover:text-ink"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* ── Featured post ── */}
      <article className="card mt-8 grid overflow-hidden p-0 transition hover:shadow-md lg:grid-cols-[1.1fr_1fr]">
        <div className="aspect-[5/4] bg-gradient-to-br from-accent-pale via-bg-soft to-accent-soft" />
        <div className="flex flex-col p-9">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
            {featured.category} · Featured
          </div>
          <h2 className="mt-4 font-bold text-[clamp(28px,3vw,40px)] leading-[1.05] tracking-tight">
            {featured.title}
          </h2>
          <p className="mt-3.5 text-[15px] leading-relaxed text-ink-soft">{featured.excerpt}</p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-pale font-semibold text-[13.5px] text-accent-deep">
                {featured.author.charAt(0)}
              </div>
              <div>
                <div className="text-[13px] font-medium">{featured.author}</div>
                <div className="text-xs text-ink-faded">{featured.date} · {featured.reading}</div>
              </div>
            </div>
            <Link
              href={`/blog/${featured.slug}` as never}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              Read article <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </article>

      {/* ── Post grid ── */}
      <div className="mt-7 grid gap-4.5 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 18 }}>
        {filtered.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}` as never}
            className="card flex flex-col overflow-hidden p-0 transition hover:shadow-md"
          >
            <div className="h-[180px] bg-gradient-to-br from-bg-soft via-accent-pale to-accent-soft/50" />
            <div className="flex flex-1 flex-col p-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faded">
                {p.category}
              </div>
              <h3 className="mt-2.5 font-bold text-[22px] leading-[1.15] tracking-tight">{p.title}</h3>
              <p className="mt-2.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink-soft">{p.excerpt}</p>
              <div className="mt-auto flex items-center justify-between pt-4 text-[12.5px] text-ink-faded">
                <span>{p.author}</span>
                <span>{p.date}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Newsletter ── */}
      <div className="card mt-10 flex flex-wrap items-center justify-between gap-8 bg-bg-soft p-9">
        <div className="max-w-[480px]">
          <div className="eyebrow">Newsletter</div>
          <h3 className="mt-2 font-bold text-[28px] tracking-tight">One letter, every two weeks.</h3>
          <p className="mt-1.5 text-sm text-ink-soft">
            Study guides, teacher interviews, and the rare new feature announcement. Unsubscribe in one click.
          </p>
        </div>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex min-w-[320px] gap-2"
        >
          <input className="input min-w-[220px]" placeholder="you@example.com" type="email" />
          <button className="btn-seal">Subscribe</button>
        </form>
      </div>
    </main>
  );
}
