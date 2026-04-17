"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession, currentRole, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";

type McqQ = { kind: "mcq"; prompt: string; options: string[]; correctIndex: number };
type ShortQ = { kind: "short"; prompt: string };
type Question = McqQ | ShortQ;

type Exam = {
  examId: string;
  title: string;
  teacherId: string;
  questions: Question[];
};

type Attempt = {
  examId: string;
  studentId: string;
  answers: (number | string)[];
  autoScore: number;
  maxMcqScore: number;
  submittedAt: string;
  student: { userId: string; displayName: string } | null;
};

export default function ResultsPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      if (currentRole(s) !== "teacher" && !isAdmin(s)) {
        return router.replace("/assessments");
      }
      try {
        const [e, a] = await Promise.all([
          api<Exam>(`/assessments/${examId}`),
          api<{ items: Attempt[] }>(`/assessments/${examId}/attempts`),
        ]);
        setExam(e);
        setAttempts(a.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [examId, router]);

  if (error && !exam) {
    return <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-sm text-seal">{error}</main>;
  }
  if (!exam) return <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Results</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Results · {exam.title}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {exam.questions.length} questions ·{" "}
        <span className="font-mono">{examId}</span>
      </p>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}

      {attempts && attempts.length === 0 && (
        <p className="mt-8 text-sm text-ink-soft">No attempts yet.</p>
      )}

      {attempts && attempts.length > 0 && (
        <ul className="mt-8 space-y-4">
          {attempts.map((a) => (
            <li key={a.studentId} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-base text-ink">
                    {a.student?.displayName ?? a.studentId}
                  </div>
                  <div className="text-xs text-ink-faded">
                    Submitted {new Date(a.submittedAt).toLocaleString()}
                  </div>
                </div>
                <div className="font-mono text-lg font-bold text-ink">
                  {a.autoScore}/{a.maxMcqScore}
                </div>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-ink-soft underline">
                  Show answers
                </summary>
                <ol className="mt-3 space-y-2">
                  {exam.questions.map((q, i) => {
                    const ans = a.answers[i];
                    return (
                      <li key={i} className="rounded-md bg-parchment/50 p-3 text-sm text-ink">
                        <div className="text-xs text-ink-faded">Q{i + 1}</div>
                        <div>{q.prompt}</div>
                        <div className="mt-1 text-xs">
                          {q.kind === "mcq" ? (
                            <>
                              <span className="font-medium">Answer:</span>{" "}
                              {typeof ans === "number" && q.options[ans] !== undefined
                                ? q.options[ans]
                                : "(skipped)"}{" "}
                              {typeof ans === "number" && ans === q.correctIndex ? (
                                <span className="text-ink">✓</span>
                              ) : (
                                <span className="text-seal">✗</span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="font-medium">Answer:</span>{" "}
                              <span className="whitespace-pre-wrap">
                                {typeof ans === "string" ? ans : "(skipped)"}
                              </span>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </details>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm">
        <Link href="/assessments" className="text-ink-soft underline">
          ← Assessments
        </Link>
      </p>
    </main>
  );
}
