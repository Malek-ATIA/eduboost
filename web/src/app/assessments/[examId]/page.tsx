"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type McqQ = { kind: "mcq"; prompt: string; options: string[] };
type ShortQ = { kind: "short"; prompt: string };
type Question = McqQ | ShortQ;

type Exam = {
  examId: string;
  title: string;
  description?: string;
  questions: Question[];
  teacherId: string;
};

type Attempt = {
  examId: string;
  studentId: string;
  autoScore: number;
  maxMcqScore: number;
};

export default function TakeAssessmentPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<(number | string)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      try {
        const r = await api<Exam>(`/assessments/${examId}`);
        setExam(r);
        setAnswers(r.questions.map((q) => (q.kind === "mcq" ? -1 : "")));
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [examId, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const r = await api<Attempt>(`/assessments/${examId}/attempts`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      setResult(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !exam) {
    return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-sm text-seal">{error}</main>;
  }
  if (!exam) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  if (result) {
    return (
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-center">
        <p className="eyebrow">Result</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Submitted</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {exam.title}: auto-graded MCQ score{" "}
          <span className="font-mono text-ink">{result.autoScore}/{result.maxMcqScore}</span>.
          {result.maxMcqScore < exam.questions.length && (
            <>
              {" "}
              Short-answer responses are sent to the teacher for manual review.
            </>
          )}
        </p>
        <Link
          href="/assessments"
          className="btn-secondary mt-6"
        >
          Back to assessments
        </Link>
      </main>
    );
  }

  const unanswered = answers.some((a, i) => {
    const q = exam.questions[i];
    if (!q) return false;
    if (q.kind === "mcq") return typeof a !== "number" || a < 0;
    return typeof a !== "string" || a.trim().length === 0;
  });

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <p className="eyebrow">Assessment</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">{exam.title}</h1>
      {exam.description && (
        <p className="mt-1 text-sm text-ink-soft">{exam.description}</p>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        {exam.questions.map((q, i) => (
          <div key={i} className="card p-4">
            <div className="eyebrow">
              Q{i + 1} · {q.kind === "mcq" ? "Multiple choice" : "Short answer"}
            </div>
            <p className="mt-1 text-sm text-ink">{q.prompt}</p>
            {q.kind === "mcq" ? (
              <div className="mt-3 space-y-2">
                {q.options.map((o, oi) => (
                  <label key={oi} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="radio"
                      name={`q-${i}`}
                      checked={answers[i] === oi}
                      onChange={() =>
                        setAnswers(answers.map((a, idx) => (idx === i ? oi : a)))
                      }
                      className="accent-seal"
                    />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                rows={3}
                maxLength={5000}
                value={typeof answers[i] === "string" ? (answers[i] as string) : ""}
                onChange={(e) =>
                  setAnswers(
                    answers.map((a, idx) => (idx === i ? e.target.value : a)),
                  )
                }
                className="input mt-3"
                placeholder="Your answer..."
              />
            )}
          </div>
        ))}

        {error && <p className="text-sm text-seal">{error}</p>}

        <button
          type="submit"
          disabled={submitting || unanswered}
          className="btn-seal"
        >
          {submitting ? "Submitting..." : "Submit attempt"}
        </button>
        {unanswered && (
          <p className="text-xs text-ink-faded">Answer every question to submit.</p>
        )}
      </form>
    </main>
  );
}
