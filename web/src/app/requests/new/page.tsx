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

  if (error) return <main className="mx-auto max-w-md px-6 py-12 text-red-600">{error}</main>;
  if (!teacher) return <main className="mx-auto max-w-md px-6 py-12">Loading...</main>;

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Link href={`/teachers/${teacherId}` as never} className="text-sm text-gray-500 underline">
        ← Back to {teacher.user.displayName}
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Request a lesson</h1>
      <p className="mt-1 text-sm text-gray-500">
        Send a note to {teacher.user.displayName}. They&apos;ll accept or decline before you book.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Subject</span>
          <input
            required
            minLength={1}
            maxLength={200}
            className="w-full rounded border px-3 py-2"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Mathematics — Calculus help"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Preferred time (optional)</span>
          <input
            maxLength={200}
            className="w-full rounded border px-3 py-2"
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value)}
            placeholder="Weekday evenings, or Saturday afternoon"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Message (optional)</span>
          <textarea
            rows={5}
            maxLength={2000}
            className="w-full rounded border px-3 py-2"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What do you need help with? Any goals or deadlines?"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-5 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
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
        <main className="mx-auto max-w-md px-6 py-12">
          <h1 className="text-2xl font-bold">Request a lesson</h1>
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </main>
      }
    >
      <NewRequestForm />
    </Suspense>
  );
}
