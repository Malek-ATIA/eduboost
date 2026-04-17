import Link from "next/link";

const FEATURES = [
  {
    title: "Verified teachers",
    body: "Every tutor passes manual profile verification before students can book. You see experience, subjects, and a star-rating history.",
  },
  {
    title: "Video classroom",
    body: "A real-time room built on Chime SDK: recording, chat, breakouts, a shared whiteboard, and personal note-keeping — all in the browser.",
  },
  {
    title: "AI grading",
    body: "Teachers paste a submission, Claude returns a score and written feedback. Students get the result in notifications.",
  },
  {
    title: "Fair money rules",
    body: "Prices are upfront. Bookings 24h out auto-refund; marketplace orders refund on the spot until you download.",
  },
  {
    title: "Marketplace & events",
    body: "Buy digital study materials, share free exam banks, and sell tickets to workshops. All routed through Stripe.",
  },
  {
    title: "For parents too",
    body: "Link your children, see their attendance, spend, and AI-graded work in a shared analytics space.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 pb-24 pt-20">
      <section className="text-center">
        <p className="eyebrow">Anno 2026 · Tutoring Platform</p>
        <h1 className="mt-4 font-display text-5xl leading-[1.05] tracking-tight text-ink sm:text-6xl md:text-7xl">
          A place for
          <span className="italic"> learned </span>
          teachers and
          <span className="italic"> diligent </span>
          students.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          EduBoost pairs verified tutors with students and parents through a
          single parchment — one place to browse, book, learn, pay, and review.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="btn-seal">
            Create an account
          </Link>
          <Link href="/login" className="btn-secondary">
            Log in
          </Link>
          <Link href="/teachers" className="btn-ghost underline-offset-4 hover:underline">
            Browse teachers →
          </Link>
        </div>
        <p className="mt-6 text-sm text-ink-soft">
          Curious first?{" "}
          <Link href="/faq" className="underline">
            Read the FAQ
          </Link>
          .
        </p>
      </section>

      <div className="rule mx-auto mt-20 max-w-xl">
        <span className="font-display italic">· chapter I ·</span>
      </div>

      <section className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title} className="card p-6">
            <h3 className="font-display text-xl">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
          </article>
        ))}
      </section>

      <div className="rule mx-auto mt-20 max-w-xl">
        <span className="font-display italic">· finis ·</span>
      </div>

      <section className="mt-12 text-center">
        <p className="font-display text-lg italic text-ink-soft">
          &ldquo;Never trust a tutoring platform that hides its price list.&rdquo;
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/teachers" className="btn-primary">
            Find a teacher
          </Link>
          <Link href="/events" className="btn-secondary">
            Upcoming events
          </Link>
        </div>
      </section>
    </main>
  );
}
