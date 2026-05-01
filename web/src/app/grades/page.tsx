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

type SortKey = "date" | "score" | "subject";
type FilterSubject = string | "all";

function scorePercent(g: Grade): number {
  return g.maxScore > 0 ? Math.round((g.score / g.maxScore) * 100) : 0;
}

function scoreColor(pct: number): string {
  if (pct >= 80) return "text-green-700";
  if (pct >= 60) return "text-amber-600";
  return "text-red-600";
}

function scoreBgColor(pct: number): string {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function scoreLabel(pct: number): string {
  if (pct >= 90) return "Excellent";
  if (pct >= 80) return "Very Good";
  if (pct >= 70) return "Good";
  if (pct >= 60) return "Satisfactory";
  if (pct >= 50) return "Needs Improvement";
  return "Below Average";
}

export default function GradesPage() {
  const router = useRouter();
  const [role, setRole] = useState<"student" | "teacher" | null>(null);
  const [items, setItems] = useState<Grade[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [filterSubject, setFilterSubject] = useState<FilterSubject>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const subjects = [...new Set((items ?? []).map((g) => g.subject))].sort();

  const filtered = (items ?? [])
    .filter((g) => filterSubject === "all" || g.subject === filterSubject)
    .sort((a, b) => {
      if (sortBy === "date") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "score") return scorePercent(b) - scorePercent(a);
      return a.subject.localeCompare(b.subject);
    });

  const avgScore =
    filtered.length > 0
      ? Math.round(filtered.reduce((sum, g) => sum + scorePercent(g), 0) / filtered.length)
      : 0;
  const highestScore = filtered.length > 0 ? Math.max(...filtered.map(scorePercent)) : 0;
  const lowestScore = filtered.length > 0 ? Math.min(...filtered.map(scorePercent)) : 0;

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Grades</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">
            {isTeacher ? "Grades you've given" : "My grades"}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {isTeacher
              ? "AI-assisted grading results for your students"
              : "Track your progress across subjects"}
          </p>
        </div>
        {isTeacher && (
          <Link href="/teacher/grader" className="btn-seal shrink-0">
            New grade
          </Link>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}

      {/* Loading */}
      {items === null && !error && (
        <div className="mt-8 flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
        </div>
      )}

      {/* Stats cards */}
      {items && items.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-ink">{filtered.length}</div>
            <div className="text-xs text-ink-faded">Total grades</div>
          </div>
          <div className="card p-3 text-center">
            <div className={`font-display text-2xl ${scoreColor(avgScore)}`}>{avgScore}%</div>
            <div className="text-xs text-ink-faded">Average</div>
          </div>
          <div className="card p-3 text-center">
            <div className={`font-display text-2xl ${scoreColor(highestScore)}`}>{highestScore}%</div>
            <div className="text-xs text-ink-faded">Highest</div>
          </div>
          <div className="card p-3 text-center">
            <div className={`font-display text-2xl ${scoreColor(lowestScore)}`}>{lowestScore}%</div>
            <div className="text-xs text-ink-faded">Lowest</div>
          </div>
        </div>
      )}

      {/* Filters */}
      {items && items.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="input w-auto text-sm"
            >
              <option value="all">All subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-ink-faded/30 p-0.5">
            {(["date", "score", "subject"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`rounded px-3 py-1 text-xs font-medium capitalize transition ${
                  sortBy === s
                    ? "bg-parchment-dark text-ink"
                    : "text-ink-faded hover:text-ink"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {items && items.length === 0 && (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parchment-dark">
            <span className="text-2xl">📊</span>
          </div>
          <p className="mt-4 font-display text-lg text-ink">No grades yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            {isTeacher
              ? "Use the AI grader to evaluate student work."
              : "Your grades will appear here after your teacher evaluates your work."}
          </p>
          {isTeacher && (
            <Link href="/teacher/grader" className="btn-seal mt-4 inline-block">
              Start grading
            </Link>
          )}
        </div>
      )}

      {/* Grade list */}
      {filtered.length > 0 && (
        <ul className="mt-4 space-y-3">
          {filtered.map((g) => {
            const pct = scorePercent(g);
            const expanded = expandedId === g.gradeId;
            return (
              <li key={g.gradeId} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : g.gradeId)}
                  className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-parchment-dark"
                >
                  {/* Score circle */}
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                    <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-ink-faded/20" />
                      <circle
                        cx="28"
                        cy="28"
                        r="24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeDasharray={`${(pct / 100) * 150.8} 150.8`}
                        strokeLinecap="round"
                        className={scoreColor(pct)}
                      />
                    </svg>
                    <span className={`absolute text-sm font-bold ${scoreColor(pct)}`}>
                      {pct}%
                    </span>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-base text-ink">{g.subject}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        pct >= 80
                          ? "bg-green-50 text-green-700"
                          : pct >= 60
                            ? "bg-amber-50 text-amber-600"
                            : "bg-red-50 text-red-600"
                      }`}>
                        {scoreLabel(pct)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-faded">
                      {g.score}/{g.maxScore} points ·{" "}
                      {new Date(g.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {" · "}
                      {g.modelId.split(".")[1] ?? g.modelId}
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="hidden w-24 sm:block">
                    <div className="h-2 overflow-hidden rounded-full bg-ink-faded/15">
                      <div
                        className={`h-full rounded-full transition-all ${scoreBgColor(pct)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <span className={`text-ink-faded transition ${expanded ? "rotate-90" : ""}`}>›</span>
                </button>

                {/* Expanded feedback */}
                {expanded && (
                  <div className="border-t border-ink-faded/20 bg-parchment-dark p-4">
                    <h4 className="eyebrow mb-2">AI Feedback</h4>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                      {g.feedback}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Results count */}
      {filtered.length > 0 && (
        <p className="mt-4 text-center text-xs text-ink-faded">
          Showing {filtered.length} grade{filtered.length !== 1 ? "s" : ""}
          {filterSubject !== "all" ? ` in ${filterSubject}` : ""}
        </p>
      )}
    </main>
  );
}
