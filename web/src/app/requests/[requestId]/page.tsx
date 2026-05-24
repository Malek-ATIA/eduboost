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

  if (error) return <main className="mx-auto max-w-2xl px-8 pb-24 pt-12 text-red-600">{error}</main>;
  if (!req) return <main className="mx-auto max-w-2xl px-8 pb-24 pt-12 text-ink-soft">Loading...</main>;

  const isTeacher = viewerSub === req.teacherId;
  const isStudent = viewerSub === req.studentId;

  return (
    <main className="mx-auto max-w-2xl px-8 pb-24 pt-12">
      <Link href="/requests" className="btn-ghost -ml-3">
        ← All requests
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Request</div>
          <h1 className="mt-1 font-serif text-3xl text-ink">{req.subject}</h1>
          <p className="mt-3 text-sm text-ink-soft">
            Sent {new Date(req.createdAt).toLocaleString()}
          </p>
        </div>
        <span className="rounded-md border border-rule bg-bg-soft px-3 py-1 text-xs uppercase tracking-widest text-ink-soft">
          {req.status}
        </span>
      </div>

      {req.preferredTime && (
        <p className="mt-6 text-sm text-ink">
          <span className="text-ink-soft">Preferred time:</span>{" "}
          {formatPreferredTime(req.preferredTime)}
        </p>
      )}
      {req.message && (
        <div className="card mt-4 p-3">
          <p className="whitespace-pre-wrap text-sm text-ink">{req.message}</p>
        </div>
      )}

      {req.respondedAt && req.responseMessage && (
        <div className="mt-6 rounded-lg border border-accent/20 bg-accent-pale p-3">
          <p className="text-xs uppercase tracking-widest text-ink-soft">
            Teacher response · {new Date(req.respondedAt).toLocaleString()}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{req.responseMessage}</p>
        </div>
      )}

      {req.status === "pending" && isTeacher && (
        <div className="card mt-8 space-y-3 p-4">
          <h2 className="font-serif text-xl text-ink">Respond</h2>
          <textarea
            rows={4}
            maxLength={2000}
            className="input"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Optional note to the student..."
          />
          <div className="flex gap-2">
            <button
              onClick={() => act("accept")}
              disabled={submitting}
              className="btn-seal"
            >
              {submitting ? "..." : "Accept"}
            </button>
            <button
              onClick={() => act("reject")}
              disabled={submitting}
              className="btn-secondary"
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
          className="btn-ghost mt-8 -ml-3 text-red-600"
        >
          Cancel this request
        </button>
      )}

      {req.status === "accepted" && isStudent && (
        <div className="mt-8 rounded-lg border border-accent/20 bg-accent-pale p-4">
          <p className="text-sm text-ink">Your request was accepted. You can book a session now.</p>
          <Link
            href={`/book/${req.teacherId}?type=single`}
            className="btn-seal mt-3"
          >
            Book a session
          </Link>
        </div>
      )}
    </main>
  );
}

// Older rows may carry freeform strings like "weekday evenings" from before
// the picker switch; fall back to the raw value if the string doesn't parse
// as a date so we never show "Invalid Date" on the detail page.
function formatPreferredTime(value: string): string {
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString();
}
