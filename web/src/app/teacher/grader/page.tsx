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

  if (!ready) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <p className="eyebrow">Teacher</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">AI grader</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Paste a student submission; the grader returns a score and constructive
        feedback against your rubric. The student is notified.
      </p>

      <form onSubmit={onGrade} className="card mt-6 space-y-4 p-6">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="label">Student ID</span>
            <input
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="input font-mono"
              placeholder="sub_..."
            />
          </label>
          <label className="block">
            <span className="label">Classroom ID (optional)</span>
            <input
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
              className="input font-mono"
              placeholder="cls_..."
            />
          </label>
        </div>

        <label className="block">
          <span className="label">Subject</span>
          <input
            required
            maxLength={100}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="input"
            placeholder="Calculus — chain rule"
          />
        </label>

        <label className="block">
          <span className="label">Rubric (optional)</span>
          <textarea
            rows={3}
            maxLength={4000}
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            className="input"
            placeholder="- Correct differentiation steps (50%)\n- Clear notation (20%)\n- Final answer with units (30%)"
          />
        </label>

        <label className="block">
          <span className="label">Student submission</span>
          <textarea
            required
            minLength={10}
            maxLength={20_000}
            rows={10}
            value={submission}
            onChange={(e) => setSubmission(e.target.value)}
            className="input font-mono text-sm"
            placeholder="Paste the student's answer here..."
          />
        </label>

        <label className="block max-w-xs">
          <span className="label">Max score</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={maxScore}
            onChange={(e) => setMaxScore(Number(e.target.value))}
            className="input"
          />
        </label>

        {error && <p className="text-sm text-seal">{error}</p>}

        <button
          type="submit"
          disabled={grading || !submission.trim() || !studentId.trim() || !subject.trim()}
          className="btn-seal"
        >
          {grading ? "Grading..." : "Grade with AI"}
        </button>
      </form>

      {result && (
        <section className="card mt-8 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl text-ink">Result</h2>
            <span className="font-mono text-2xl font-bold text-ink">
              {result.score}/{result.maxScore}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{result.feedback}</p>
          <p className="mt-3 text-xs text-ink-faded">
            Saved as <span className="font-mono">{result.gradeId}</span>. The student has been notified.
          </p>
        </section>
      )}
</main>
  );
}
