"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type McqQ = { kind: "mcq"; prompt: string; options: string[]; correctIndex: number };
type ShortQ = { kind: "short"; prompt: string };
type Question = McqQ | ShortQ;

export default function NewAssessmentPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([
    { kind: "mcq", prompt: "", options: ["", ""], correctIndex: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      if (currentRole(s) !== "teacher") return router.replace("/dashboard");
      setReady(true);
    })();
  }, [router]);

  function addMcq() {
    setQuestions([...questions, { kind: "mcq", prompt: "", options: ["", ""], correctIndex: 0 }]);
  }
  function addShort() {
    setQuestions([...questions, { kind: "short", prompt: "" }]);
  }
  function removeQuestion(i: number) {
    setQuestions(questions.filter((_, idx) => idx !== i));
  }
  function updateQuestion(i: number, patch: Partial<McqQ> | Partial<ShortQ>) {
    setQuestions(questions.map((q, idx) => (idx === i ? ({ ...q, ...patch } as Question) : q)));
  }
  function addOption(i: number) {
    const q = questions[i];
    if (!q || q.kind !== "mcq") return;
    if (q.options.length >= 8) return;
    updateQuestion(i, { options: [...q.options, ""] });
  }
  function updateOption(i: number, oi: number, value: string) {
    const q = questions[i];
    if (!q || q.kind !== "mcq") return;
    const options = q.options.map((o, idx) => (idx === oi ? value : o));
    updateQuestion(i, { options });
  }
  function removeOption(i: number, oi: number) {
    const q = questions[i];
    if (!q || q.kind !== "mcq" || q.options.length <= 2) return;
    const options = q.options.filter((_, idx) => idx !== oi);
    const correctIndex = Math.min(q.correctIndex, options.length - 1);
    updateQuestion(i, { options, correctIndex });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api<{ examId: string }>(`/assessments`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          questions,
        }),
      });
      await api(`/assessments/${created.examId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "published" }),
      });
      router.replace(`/assessments/${created.examId}/results` as never);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <p className="eyebrow">Study</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">New assessment</h1>
      <p className="mt-1 text-sm text-ink-soft">
        MCQ questions auto-grade; short-answer responses are visible to you for manual review.
      </p>

      <form onSubmit={onSubmit} className="card mt-6 space-y-5 p-6">
        <label className="block">
          <span className="label">Title</span>
          <input
            required
            minLength={3}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
          />
        </label>

        <label className="block">
          <span className="label">Description (optional)</span>
          <textarea
            rows={2}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
          />
        </label>

        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="rounded-md border border-ink-faded/40 bg-parchment/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="eyebrow">
                  Q{i + 1} · {q.kind === "mcq" ? "Multiple choice" : "Short answer"}
                </span>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(i)}
                    className="btn-ghost text-seal"
                  >
                    Remove
                  </button>
                )}
              </div>
              <textarea
                required
                rows={2}
                maxLength={1000}
                value={q.prompt}
                onChange={(e) => updateQuestion(i, { prompt: e.target.value })}
                className="input"
                placeholder="Prompt"
              />
              {q.kind === "mcq" && (
                <div className="mt-3 space-y-2">
                  {q.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${i}`}
                        checked={q.correctIndex === oi}
                        onChange={() => updateQuestion(i, { correctIndex: oi })}
                        aria-label={`Correct option ${oi + 1}`}
                      />
                      <input
                        required
                        value={o}
                        onChange={(e) => updateOption(i, oi, e.target.value)}
                        maxLength={500}
                        className="input flex-1"
                        placeholder={`Option ${oi + 1}`}
                      />
                      {q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(i, oi)}
                          className="text-xs text-seal"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {q.options.length < 8 && (
                    <button
                      type="button"
                      onClick={() => addOption(i)}
                      className="text-xs text-ink-soft underline"
                    >
                      + Add option
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={addMcq}
            className="btn-secondary"
          >
            + MCQ question
          </button>
          <button
            type="button"
            onClick={addShort}
            className="btn-secondary"
          >
            + Short-answer question
          </button>
        </div>

        {error && <p className="text-sm text-seal">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="btn-seal"
        >
          {submitting ? "Publishing..." : "Publish exam"}
        </button>
      </form>

      <p className="mt-8 text-sm">
        <Link href="/assessments" className="text-ink-soft underline">
          ← Assessments
        </Link>
      </p>
    </main>
  );
}
