"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type LessonRequest = {
  requestId: string;
  studentId: string;
  teacherId: string;
  subject: string;
  preferredTime?: string;
  message?: string;
  status: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
  responseMessage?: string;
  respondedAt?: string;
  createdAt: string;
};

export default function RequestDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  const router = useRouter();
  const [req, setReq] = useState<LessonRequest | null>(null);
  const [viewerSub, setViewerSub] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<LessonRequest>(`/lesson-requests/${requestId}`);
      setReq(r);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [requestId]);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      setViewerSub((session.getIdToken().payload.sub as string) ?? null);
      load();
    })();
  }, [router, load]);

  async function act(path: "accept" | "reject" | "cancel") {
    setSubmitting(true);
    setError(null);
    try {
      await api(`/lesson-requests/${requestId}/${path}`, {
        method: "POST",
        body: path === "cancel" ? undefined : JSON.stringify({ responseMessage: response.trim() || undefined }),
      });
      setResponse("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <main className="mx-auto max-w-2xl px-6 py-12 text-red-600">{error}</main>;
  if (!req) return <main className="mx-auto max-w-2xl px-6 py-12">Loading...</main>;

  const isTeacher = viewerSub === req.teacherId;
  const isStudent = viewerSub === req.studentId;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/requests" className="text-sm text-gray-500 underline">
        ← All requests
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{req.subject}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sent {new Date(req.createdAt).toLocaleString()}
          </p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs uppercase">{req.status}</span>
      </div>

      {req.preferredTime && (
        <p className="mt-6 text-sm">
          <span className="text-gray-500">Preferred time:</span> {req.preferredTime}
        </p>
      )}
      {req.message && (
        <div className="mt-4 rounded border p-3">
          <p className="whitespace-pre-wrap text-sm">{req.message}</p>
        </div>
      )}

      {req.respondedAt && req.responseMessage && (
        <div className="mt-6 rounded border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
          <p className="text-xs uppercase text-gray-500">
            Teacher response · {new Date(req.respondedAt).toLocaleString()}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{req.responseMessage}</p>
        </div>
      )}

      {req.status === "pending" && isTeacher && (
        <div className="mt-8 space-y-3 rounded border p-4">
          <h2 className="font-semibold">Respond</h2>
          <textarea
            rows={4}
            maxLength={2000}
            className="w-full rounded border px-3 py-2"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Optional note to the student..."
          />
          <div className="flex gap-2">
            <button
              onClick={() => act("accept")}
              disabled={submitting}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {submitting ? "..." : "Accept"}
            </button>
            <button
              onClick={() => act("reject")}
              disabled={submitting}
              className="rounded border px-4 py-2 text-sm disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {req.status === "pending" && isStudent && (
        <button
          onClick={() => act("cancel")}
          disabled={submitting}
          className="mt-8 text-sm text-gray-500 underline disabled:opacity-50"
        >
          Cancel this request
        </button>
      )}

      {req.status === "accepted" && isStudent && (
        <div className="mt-8 rounded border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
          <p className="text-sm">Your request was accepted. You can book a session now.</p>
          <Link
            href={`/book/${req.teacherId}?type=single`}
            className="mt-3 inline-block rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
          >
            Book a session
          </Link>
        </div>
      )}
    </main>
  );
}
