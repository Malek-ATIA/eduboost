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
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Grades</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">
            {isTeacher ? "Grades you've given" : "My grades"}
          </h1>
        </div>
        {isTeacher && (
          <Link
            href="/teacher/grader"
            className="btn-seal"
          >
            New grade
          </Link>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No AI-graded work yet.</p>
      )}

      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-ink-faded/30">
          {items.map((g) => (
            <li key={g.gradeId} className="p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="font-display text-base text-ink">{g.subject}</div>
                  <div className="text-xs text-ink-faded">
                    {new Date(g.createdAt).toLocaleString()} · {g.modelId.split(".")[1] ?? g.modelId}
                  </div>
                </div>
                <span className="font-mono text-lg font-bold text-ink">
                  {g.score}/{g.maxScore}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">
                {g.feedback}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-ink-soft underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
