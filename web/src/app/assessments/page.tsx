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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Assessments</h1>
        {role === "teacher" && (
          <Link
            href="/assessments/new"
            className="rounded border px-3 py-1 text-sm"
          >
            New exam
          </Link>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {role === "teacher" && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">My exams</h2>
          {mine === null ? (
            <p className="mt-3 text-sm text-gray-500">Loading...</p>
          ) : mine.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No exams yet.</p>
          ) : (
            <ul className="mt-3 divide-y rounded border">
              {mine.map((e) => (
                <li key={e.examId}>
                  <Link
                    href={`/assessments/${e.examId}/results` as never}
                    className="flex items-center justify-between p-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                  >
                    <div>
                      <div className="font-medium">{e.title}</div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {e.questionCount} questions · status {e.status}
                      </div>
                    </div>
                    <span className="font-mono text-xs text-gray-400">{e.examId}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Published exams</h2>
        {published === null && !error && (
          <p className="mt-3 text-sm text-gray-500">Loading...</p>
        )}
        {published && published.length === 0 && (
          <p className="mt-3 text-sm text-gray-500">No exams available.</p>
        )}
        {published && published.length > 0 && (
          <ul className="mt-3 divide-y rounded border">
            {published.map((e) => (
              <li key={e.examId}>
                <Link
                  href={`/assessments/${e.examId}` as never}
                  className="flex items-center justify-between p-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <div>
                    <div className="font-medium">{e.title}</div>
                    <div className="mt-0.5 text-xs text-gray-500">
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

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-gray-500 underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
