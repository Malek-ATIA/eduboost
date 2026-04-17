"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Grade = {
  gradeId: string;
  studentId: string;
  subject: string;
  score: number;
  maxScore: number;
  feedback: string;
};

export default function GraderPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [subject, setSubject] = useState("");
  const [rubric, setRubric] = useState("");
  const [submission, setSubmission] = useState("");
  const [maxScore, setMaxScore] = useState(100);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Grade | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (currentRole(session) !== "teacher") return router.replace("/dashboard");
      setReady(true);
    })();
  }, [router]);

  async function onGrade(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setGrading(true);
    try {
      const body: Record<string, unknown> = {
        studentId: studentId.trim(),
        subject: subject.trim(),
        submission,
        maxScore,
      };
      if (classroomId.trim()) body.classroomId = classroomId.trim();
      if (rubric.trim()) body.rubric = rubric.trim();
      const g = await api<Grade>(`/ai-grades`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResult(g);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("student_not_in_classroom")) setError("That student isn't a member of the classroom.");
      else if (msg.includes("grading_failed")) setError("The grader couldn't score this submission. Try shortening or simplifying it.");
      else if (msg.includes("only_teachers")) setError("Only teacher accounts can grade.");
      else setError(msg);
    } finally {
      setGrading(false);
    }
  }

  if (!ready) return <main className="mx-auto max-w-2xl px-6 py-12">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">AI grader</h1>
      <p className="mt-1 text-sm text-gray-500">
        Paste a student submission; the grader returns a score and constructive
        feedback against your rubric. The student is notified.
      </p>

      <form onSubmit={onGrade} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Student ID</span>
            <input
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full rounded border px-3 py-2 font-mono"
              placeholder="sub_..."
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Classroom ID (optional)</span>
            <input
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
              className="w-full rounded border px-3 py-2 font-mono"
              placeholder="cls_..."
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Subject</span>
          <input
            required
            maxLength={100}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="Calculus — chain rule"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Rubric (optional)</span>
          <textarea
            rows={3}
            maxLength={4000}
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="- Correct differentiation steps (50%)\n- Clear notation (20%)\n- Final answer with units (30%)"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Student submission</span>
          <textarea
            required
            minLength={10}
            maxLength={20_000}
            rows={10}
            value={submission}
            onChange={(e) => setSubmission(e.target.value)}
            className="w-full rounded border px-3 py-2 font-mono text-sm"
            placeholder="Paste the student's answer here..."
          />
        </label>

        <label className="block max-w-xs">
          <span className="mb-1 block text-sm font-medium">Max score</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={maxScore}
            onChange={(e) => setMaxScore(Number(e.target.value))}
            className="w-full rounded border px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={grading || !submission.trim() || !studentId.trim() || !subject.trim()}
          className="rounded bg-black px-5 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {grading ? "Grading..." : "Grade with AI"}
        </button>
      </form>

      {result && (
        <section className="mt-8 rounded border p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Result</h2>
            <span className="font-mono text-2xl font-bold">
              {result.score}/{result.maxScore}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm">{result.feedback}</p>
          <p className="mt-3 text-xs text-gray-500">
            Saved as <span className="font-mono">{result.gradeId}</span>. The student has been notified.
          </p>
        </section>
      )}

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-gray-500 underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
