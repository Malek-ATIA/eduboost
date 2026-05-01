"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type ExamSummary = {
  examId: string;
  teacherId: string;
  title: string;
  description?: string;
  questionCount: number;
  createdAt: string;
};

type MyExam = ExamSummary & { status: "draft" | "published" | "archived" };

export default function AssessmentsPage() {
  const router = useRouter();
  const [role, setRole] = useState<"student" | "parent" | "teacher" | null>(null);
  const [published, setPublished] = useState<ExamSummary[] | null>(null);
  const [mine, setMine] = useState<MyExam[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      const r = currentRole(s);
      setRole(r);
      try {
        const pubResp = await api<{ items: ExamSummary[] }>(`/assessments`);
        setPublished(pubResp.items);
        if (r === "teacher") {
          const mineResp = await api<{ items: MyExam[] }>(`/assessments/teacher/mine`);
          setMine(mineResp.items);
        }
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Study</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Assessments</h1>
        </div>
        {role === "teacher" && (
          <Link
            href="/assessments/new"
            className="btn-seal"
          >
            New exam
          </Link>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}

      {role === "teacher" && (
        <section className="mt-8">
          <h2 className="font-display text-xl text-ink">My exams</h2>
          {mine === null ? (
            <p className="mt-3 text-sm text-ink-soft">Loading...</p>
          ) : mine.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">No exams yet.</p>
          ) : (
            <ul className="card mt-3 divide-y divide-ink-faded/30">
              {mine.map((e) => (
                <li key={e.examId}>
                  <Link
                    href={`/assessments/${e.examId}/results` as never}
                    className="flex items-center justify-between p-3 text-sm transition hover:bg-parchment-shade"
                  >
                    <div>
                      <div className="font-display text-base text-ink">{e.title}</div>
                      <div className="mt-0.5 text-xs text-ink-faded">
                        {e.questionCount} questions · status {e.status}
                      </div>
                    </div>
                    <span className="font-mono text-xs text-ink-faded">{e.examId}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">Published exams</h2>
        {published === null && !error && (
          <p className="mt-3 text-sm text-ink-soft">Loading...</p>
        )}
        {published && published.length === 0 && (
          <p className="mt-3 text-sm text-ink-soft">No exams available.</p>
        )}
        {published && published.length > 0 && (
          <ul className="card mt-3 divide-y divide-ink-faded/30">
            {published.map((e) => (
              <li key={e.examId}>
                <Link
                  href={`/assessments/${e.examId}` as never}
                  className="flex items-center justify-between p-3 text-sm transition hover:bg-parchment-shade"
                >
                  <div>
                    <div className="font-display text-base text-ink">{e.title}</div>
                    <div className="mt-0.5 text-xs text-ink-faded">
                      {e.questionCount} questions · by teacher{" "}
                      <span className="font-mono">{e.teacherId.slice(0, 8)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
</main>
  );
}
