"use client";
import Link from "next/link";
import { useState } from "react";
import { FAQ_GENERAL, FAQ_STUDENTS, FAQ_TEACHERS, FAQ_REFUNDS } from "@/lib/faq-data";
import type { FAQ } from "@/lib/faq-data";

const BLOG_POSTS = [
  {
    id: "1",
    category: "Bac prep",
    title: "How to build a 3-month study plan for the bac",
    excerpt: "A step-by-step breakdown of how to allocate subjects, rest days, and mock exams across a single trimester.",
    author: "Amira Ben Salem",
    date: "May 20",
    reading: "8 min read",
    featured: true,
  },
  {
    id: "2",
    category: "Teaching",
    title: "What I learned teaching 200 students online",
    excerpt: "Whiteboard tricks, engagement hacks, and when to just let the student struggle.",
    author: "Karim Hamdi",
    date: "May 15",
    reading: "6 min read",
  },
  {
    id: "3",
    category: "Parents",
    title: "When to step in and when to step back",
    excerpt: "Practical advice from parents who survived the bac year with their kids.",
    author: "Amina Riahi",
    date: "May 12",
    reading: "5 min read",
  },
  {
    id: "4",
    category: "Study tips",
    title: "Active recall beats highlighting — here's how",
    excerpt: "The science behind spaced repetition and why your highlighter is lying to you.",
    author: "Rim Cherif",
    date: "May 8",
    reading: "7 min read",
  },
  {
    id: "5",
    category: "Platform",
    title: "New: AI-powered grading and instant feedback",
    excerpt: "How our grading engine works, what models we use, and how teachers stay in the loop.",
    author: "EduBoost team",
    date: "May 4",
    reading: "4 min read",
  },
  {
    id: "6",
    category: "Bac prep",
    title: "Top 10 mistakes in bac maths — and how to avoid them",
    excerpt: "We analyzed 500 mock exams. These patterns came up over and over.",
    author: "Amira Ben Salem",
    date: "Apr 28",
    reading: "10 min read",
  },
];

const CONTACT = [
  { label: "Email", value: "support@eduboost.tn", href: "mailto:support@eduboost.tn" },
  { label: "WhatsApp", value: "+216 55 555 555", href: "https://wa.me/21655555555" },
  { label: "Phone", value: "+216 70 555 555", href: "tel:+21670555555" },
];

const FAQ_SECTIONS = [
  { title: "General", items: FAQ_GENERAL },
  { title: "For students and parents", items: FAQ_STUDENTS },
  { title: "For teachers", items: FAQ_TEACHERS },
  { title: "Refunds & money-back guarantee", items: FAQ_REFUNDS },
];

export default function BlogFaqPage() {
  const [tab, setTab] = useState<"blog" | "faq">("blog");
  const [category, setCategory] = useState("All");

  const categories = ["All", ...Array.from(new Set(BLOG_POSTS.map((p) => p.category)))];
  const featured = BLOG_POSTS[0];
  const rest = BLOG_POSTS.slice(1);
  const filtered = category === "All" ? rest : rest.filter((p) => p.category === category);

  return (
    <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
      {/* Hero heading */}
      <div className="grid items-end gap-12 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="eyebrow">The folio</div>
          <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl lg:text-7xl">
            Writing on learning, teaching, and the <span className="italic">bac</span>.
          </h1>
        </div>
        <p className="text-base leading-relaxed text-ink-soft lg:max-w-[460px]">
          Honest guides from teachers, parents, and students who use EduBoost every
          week. No fluff, no SEO tricks.
        </p>
      </div>

      {/* Blog / FAQ toggle */}
      <div className="mt-10 flex items-center gap-6 border-b border-rule pb-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab("blog")}
            className={`rounded-full px-5 py-2 text-sm font-medium transition ${
              tab === "blog"
                ? "bg-ink text-white"
                : "border border-rule text-ink-soft hover:text-ink"
            }`}
          >
            Blog
          </button>
          <button
            onClick={() => setTab("faq")}
            className={`rounded-full px-5 py-2 text-sm font-medium transition ${
              tab === "faq"
                ? "bg-ink text-white"
                : "border border-rule text-ink-soft hover:text-ink"
            }`}
          >
            FAQ
          </button>
        </div>
        {tab === "blog" && (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-4 py-2 text-[13px] font-medium transition ${
                  category === c
                    ? "bg-accent text-white"
                    : "border border-rule text-ink-soft hover:border-ink/30 hover:text-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "blog" && (
        <>
          {/* Featured article */}
          <article className="card-interactive mt-8 grid overflow-hidden p-0 lg:grid-cols-[1.1fr_1fr]">
            <div className="flex aspect-[5/4] items-center justify-center bg-bg-soft lg:aspect-auto">
              <span className="font-serif text-4xl text-ink-faded/30">
                {featured.category}
              </span>
            </div>
            <div className="flex flex-col p-8 lg:p-9">
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
                {featured.category} &middot; Featured
              </div>
              <h2 className="mt-4 font-serif text-3xl tracking-tight lg:text-4xl">
                {featured.title}
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
                {featured.excerpt}
              </p>
              <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-pale font-serif text-sm font-medium text-accent">
                    {featured.author[0]}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-ink">
                      {featured.author}
                    </div>
                    <div className="text-xs text-ink-faded">
                      {featured.date} &middot; {featured.reading}
                    </div>
                  </div>
                </div>
                <span className="btn-ghost text-sm">
                  Read article &rarr;
                </span>
              </div>
            </div>
          </article>

          {/* Blog grid */}
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <article
                key={p.id}
                className="card-interactive flex flex-col overflow-hidden p-0"
              >
                <div className="flex h-44 items-center justify-center bg-bg-soft">
                  <span className="font-serif text-2xl text-ink-faded/30">
                    {p.category}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-faded">
                    {p.category}
                  </div>
                  <h3 className="mt-2.5 font-serif text-xl leading-tight tracking-tight">
                    {p.title}
                  </h3>
                  <p className="mt-2.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink-soft">
                    {p.excerpt}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-5 text-xs text-ink-faded">
                    <span>{p.author}</span>
                    <span>{p.date}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Newsletter */}
          <div className="card mt-10 flex flex-wrap items-center justify-between gap-8 bg-bg-soft p-9">
            <div className="max-w-[480px]">
              <div className="eyebrow">Newsletter</div>
              <h3 className="mt-2 font-serif text-2xl">
                One letter, every two weeks.
              </h3>
              <p className="mt-2 text-sm text-ink-soft">
                Study guides, teacher interviews, and the rare new feature
                announcement. Unsubscribe in one click.
              </p>
            </div>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex min-w-[280px] gap-2"
            >
              <input
                className="input min-w-[200px]"
                placeholder="you@example.com"
              />
              <button className="btn-seal">Subscribe</button>
            </form>
          </div>
        </>
      )}

      {tab === "faq" && (
        <div className="mt-8">
          {FAQ_SECTIONS.map((section) => (
            <section key={section.title} className="mt-10 first:mt-0">
              <h2 className="font-serif text-xl text-ink">{section.title}</h2>
              <div className="card mt-4 divide-y divide-rule overflow-hidden">
                {section.items.map((f) => (
                  <FaqItem key={f.q} {...f} />
                ))}
              </div>
            </section>
          ))}

          <section className="mt-12">
            <h2 className="font-serif text-xl text-ink">Still need help?</h2>
            <p className="mt-2 text-sm text-ink-soft">
              For payment, booking, or account issues the fastest route is{" "}
              <Link href="/support/new" className="underline">
                opening a support ticket
              </Link>{" "}
              — it reaches our team directly. You can also reach us at:
            </p>
            <dl className="card mt-4 divide-y divide-rule">
              {CONTACT.map((c) => (
                <div
                  key={c.label}
                  className="flex items-center justify-between p-3 text-sm"
                >
                  <dt className="font-medium text-ink">{c.label}</dt>
                  <dd>
                    <a href={c.href} className="underline">
                      {c.value}
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-ink-faded">
              Office hours: Mon–Fri, 09:00–17:00 Tunis time (GMT+1).
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

function FaqItem({ q, a }: FAQ) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer items-center justify-between gap-2 p-4 text-sm font-medium text-ink">
        <span>{q}</span>
        <span className="text-ink-faded transition group-open:rotate-45">+</span>
      </summary>
      <p className="px-4 pb-4 text-sm leading-relaxed text-ink-soft">{a}</p>
    </details>
  );
}
