"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

export default function NewClassroomPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [maxStudents, setMaxStudents] = useState(12);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const r = await api<{ classroomId: string }>(`/classrooms`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          description: description.trim() || undefined,
          maxStudents,
        }),
      });
      router.replace(`/classrooms/${r.classroomId}` as never);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready)
    return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading…</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <p className="eyebrow">Classroom</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Create a classroom</h1>
      <p className="mt-1 text-sm text-ink-soft">
        A classroom groups sessions, chat, notes, and enrolled students under one course.
      </p>

      <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
        <label className="block">
          <span className="label">Title</span>
          <input
            required
            minLength={3}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="Baccalauréat revision — Mathematics"
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Subject</span>
            <input
              required
              maxLength={100}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input"
              placeholder="Mathematics"
            />
          </label>
          <label className="block">
            <span className="label">Max students</span>
            <input
              required
              type="number"
              min={1}
              max={250}
              value={maxStudents}
              onChange={(e) => setMaxStudents(Number(e.target.value))}
              className="input"
            />
          </label>
        </div>
        <label className="block">
          <span className="label">Description (optional)</span>
          <textarea
            rows={4}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
            placeholder="Weekly revision group for bac students. Taught in French + Arabic."
          />
        </label>
        {error && <p className="text-sm text-seal">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-seal">
          {submitting ? "Creating…" : "Create classroom"}
        </button>
      </form>
    </main>
  );
}
