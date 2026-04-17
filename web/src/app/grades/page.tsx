"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Grade = {
  gradeId: string;
  subject: string;
  score: number;
  maxScore: number;
  feedback: string;
  createdAt: string;
  modelId: string;
};

export default function GradesPage() {
  const router = useRouter();
  const [role, setRole] = useState<"student" | "teacher" | null>(null);
  const [items, setItems] = useState<Grade[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      const r = currentRole(session);
      if (r === "student" || r === "parent") setRole("student");
      else if (r === "teacher") setRole("teacher");
      else return router.replace("/dashboard");
      const endpoint = r === "teacher" ? "/ai-grades/teacher/mine" : "/ai-grades/student/mine";
      try {
        const list = await api<{ items: Grade[] }>(endpoint);
        setItems(list.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  const isTeacher = role === "teacher";
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {isTeacher ? "Grades you've given" : "My grades"}
        </h1>
        {isTeacher && (
          <Link
            href="/teacher/grader"
            className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
          >
            New grade
          </Link>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No AI-graded work yet.</p>
      )}

      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((g) => (
            <li key={g.gradeId} className="p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="font-medium">{g.subject}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(g.createdAt).toLocaleString()} · {g.modelId.split(".")[1] ?? g.modelId}
                  </div>
                </div>
                <span className="font-mono text-lg font-bold">
                  {g.score}/{g.maxScore}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                {g.feedback}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-gray-500 underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
