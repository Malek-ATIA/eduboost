"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Teacher = {
  user: { userId: string; displayName: string };
};

type LessonRequest = { requestId: string };

function NewRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teacherId = searchParams.get("teacherId") ?? "";

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [subject, setSubject] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace(`/login`);
      if (!teacherId) return setError("Missing teacherId");
      try {
        const t = await api<Teacher>(`/teachers/${teacherId}`);
        setTeacher(t);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router, teacherId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const r = await api<LessonRequest>(`/lesson-requests`, {
        method: "POST",
        body: JSON.stringify({
          teacherId,
          subject,
          preferredTime: preferredTime.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });
      router.replace(`/requests/${r.requestId}` as never);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <main className="mx-auto max-w-md px-6 pb-24 pt-16 text-seal">{error}</main>;
  if (!teacher) return <main className="mx-auto max-w-md px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-md px-6 pb-24 pt-16">
      <Link href={`/teachers/${teacherId}` as never} className="btn-ghost -ml-3">
        ← Back to {teacher.user.displayName}
      </Link>
      <p className="eyebrow mt-4">Lesson request</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Request a lesson</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Send a note to {teacher.user.displayName}. They&apos;ll accept or decline before you book.
      </p>

      <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
        <label className="block">
          <span className="label">Subject</span>
          <input
            required
            minLength={1}
            maxLength={200}
            className="input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Mathematics — Calculus help"
          />
        </label>

        <label className="block">
          <span className="label">Preferred time (optional)</span>
          <input
            maxLength={200}
            className="input"
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value)}
            placeholder="Weekday evenings, or Saturday afternoon"
          />
        </label>

        <label className="block">
          <span className="label">Message (optional)</span>
          <textarea
            rows={5}
            maxLength={2000}
            className="input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What do you need help with? Any goals or deadlines?"
          />
        </label>

        {error && <p className="text-sm text-seal">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="btn-seal"
        >
          {submitting ? "Sending..." : "Send request"}
        </button>
      </form>
    </main>
  );
}

export default function NewRequestPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-6 pb-24 pt-16">
          <p className="eyebrow">Lesson request</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Request a lesson</h1>
          <p className="mt-4 text-sm text-ink-soft">Loading...</p>
        </main>
      }
    >
      <NewRequestForm />
    </Suspense>
  );
}
