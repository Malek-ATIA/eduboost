"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

const DIMENSIONS = [
  { key: "knowledge", label: "Knowledge of subject" },
  { key: "clarity", label: "Clarity of explanation" },
  { key: "patience", label: "Patience with questions" },
] as const;

type Dimension = (typeof DIMENSIONS)[number]["key"];

export default function TeacherQuizPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  const router = useRouter();
  const [scores, setScores] = useState<Record<Dimension, number>>({
    knowledge: 5,
    clarity: 5,
    patience: 5,
  });
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    currentSession().then((s) => {
      if (!s) router.replace("/login");
    });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api(`/teacher-quiz`, {
        method: "POST",
        body: JSON.stringify({
          bookingId,
          ...scores,
          wouldRecommend,
          comment: comment.trim() || undefined,
        }),
      });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto max-w-xl px-6 pb-24 pt-16 text-center">
        <p className="eyebrow">Feedback</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Thanks for the feedback!</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Your rating helps future students choose the right teacher.
        </p>
        <Link
          href="/bookings"
          className="btn-seal mt-6"
        >
          Back to bookings
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 pb-24 pt-16">
      <p className="eyebrow">Feedback</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Rate this session</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Booking <span className="font-mono">{bookingId}</span>. Your ratings are
        anonymised and aggregated across sessions.
      </p>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}

      <form onSubmit={onSubmit} className="card mt-6 space-y-5 p-6">
        {DIMENSIONS.map((d) => (
          <label key={d.key} className="block">
            <span className="mb-1 flex items-center justify-between text-sm font-medium text-ink">
              <span>{d.label}</span>
              <span className="font-mono">{scores[d.key]}/5</span>
            </span>
            <input
              type="range"
              min={0}
              max={5}
              value={scores[d.key]}
              onChange={(e) =>
                setScores({ ...scores, [d.key]: Number(e.target.value) })
              }
              className="w-full"
            />
          </label>
        ))}

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={wouldRecommend}
            onChange={(e) => setWouldRecommend(e.target.checked)}
          />
          I would recommend this teacher to a friend.
        </label>

        <label className="block">
          <span className="label">Comment (optional, not shown publicly)</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            className="input"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="btn-seal"
        >
          {submitting ? "Submitting..." : "Submit feedback"}
        </button>
      </form>
    </main>
  );
}
