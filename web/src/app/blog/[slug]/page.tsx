"use client";
import Link from "next/link";
import { use } from "react";
import { ChevronLeft } from "lucide-react";

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const title = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <main className="mx-auto max-w-[720px] px-8 pb-24 pt-12">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-sm text-ink-faded transition hover:text-ink"
      >
        <ChevronLeft size={16} /> Back to the folio
      </Link>

      <article className="mt-8">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
          Study guides
        </div>
        <h1 className="mt-3 font-bold text-[clamp(36px,4.5vw,52px)] leading-[1.08] tracking-tight">
          {title}
        </h1>

        <div className="mt-5 flex items-center gap-3 border-b border-rule pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-pale font-semibold text-[15px] text-accent-deep">
            A
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">Amira Ben Salem</div>
            <div className="text-xs text-ink-faded">May 22, 2026 · 8 min read</div>
          </div>
        </div>

        <div className="prose mt-8 max-w-none">
          <div className="aspect-[16/9] rounded-xl bg-gradient-to-br from-accent-pale via-bg-soft to-accent-soft/50" />

          <p className="mt-8 font-bold text-[19px] italic leading-relaxed text-ink-soft">
            This article hasn&apos;t been written yet — the blog system is in place but the editorial calendar is still being built. Drop in soon.
          </p>

          <p className="mt-6 text-[16px] leading-[1.75] text-ink">
            In the meantime, browse other posts on{" "}
            <Link href="/blog" className="underline decoration-rule decoration-2 underline-offset-4 transition hover:decoration-accent">
              the folio
            </Link>
            , or jump into a real lesson with one of our verified teachers.
          </p>
        </div>

        <div className="mt-10 flex items-center justify-between border-t border-rule pt-8">
          <Link href="/blog" className="btn-ghost text-sm">← All posts</Link>
          <Link href="/teachers" className="btn-seal text-sm">Find a teacher</Link>
        </div>
      </article>
    </main>
  );
}
