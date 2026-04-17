"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";

type Ticket = {
  ticketId: string;
  userId: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  bookingId?: string;
  relatedPaymentId?: string;
  relatedReviewId?: string;
  slaDeadline?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
};

type ResolutionOutcome =
  | "no_action"
  | "refund_full"
  | "refund_partial"
  | "review_removed"
  | "warning_issued";

type Attachment = {
  s3Key: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
};

type Message = {
  ticketId: string;
  messageId: string;
  authorId: string;
  authorRole: "user" | "admin" | "system";
  body: string;
  attachments?: Attachment[];
  createdAt: string;
};

type TicketResponse = { ticket: Ticket; messages: Message[] };

export default function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<TicketResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [resolution, setResolution] = useState<ResolutionOutcome>("no_action");
  const [resolutionNote, setResolutionNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<TicketResponse>(`/support/tickets/${ticketId}`);
      setData(r);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [ticketId]);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setAdmin(isAdmin(session));
      load();
    })();
  }, [router, load]);

  async function uploadAttachments(): Promise<Attachment[]> {
    const uploaded: Attachment[] = [];
    for (const f of files) {
      setProgress(`Uploading ${f.name}...`);
      const urlResp = await api<{ uploadUrl: string; s3Key: string }>(
        `/support/tickets/${ticketId}/attachment-url`,
        {
          method: "POST",
          body: JSON.stringify({
            filename: f.name,
            mimeType: f.type || "application/octet-stream",
            sizeBytes: f.size,
          }),
        },
      );
      const put = await fetch(urlResp.uploadUrl, {
        method: "PUT",
        headers: { "content-type": f.type || "application/octet-stream" },
        body: f,
      });
      if (!put.ok) throw new Error(`Upload failed for ${f.name}: ${put.status}`);
      uploaded.push({
        s3Key: urlResp.s3Key,
        filename: f.name,
        mimeType: f.type || undefined,
        sizeBytes: f.size,
      });
    }
    return uploaded;
  }

  async function onReply(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSubmitting(true);
    setError(null);
    setProgress(null);
    try {
      const attachments = files.length > 0 ? await uploadAttachments() : [];
      setProgress("Posting reply...");
      await api(`/support/tickets/${ticketId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: draft, attachments }),
      });
      setDraft("");
      setFiles([]);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  async function resolveTicket(e: React.FormEvent) {
    e.preventDefault();
    if (resolutionNote.trim().length < 10) {
      setError("Resolution note must be at least 10 characters.");
      return;
    }
    setResolving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        resolution,
        note: resolutionNote.trim(),
      };
      if (resolution === "refund_partial") {
        const cents = Math.round(Number(refundAmount) * 100);
        if (!Number.isFinite(cents) || cents < 1) {
          throw new Error("Enter a valid refund amount.");
        }
        body.refundCents = cents;
      }
      await api(`/support/tickets/${ticketId}/resolve`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResolutionNote("");
      setRefundAmount("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setResolving(false);
    }
  }

  async function downloadAttachment(att: Attachment) {
    setDownloadingKey(att.s3Key);
    try {
      const suffix = att.s3Key.replace(`support/${ticketId}/`, "");
      const r = await api<{ downloadUrl: string }>(
        `/support/attachments/${ticketId}/${encodeURIComponent(suffix)}`,
      );
      window.open(r.downloadUrl, "_blank");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDownloadingKey(null);
    }
  }

  if (error) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-seal">{error}</main>;
  if (!data) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  const { ticket, messages } = data;
  const closed = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/support" className="btn-ghost -ml-3">
            ← All tickets
          </Link>
          <p className="eyebrow mt-2">Ticket</p>
          <h1 className="mt-1 font-display text-3xl text-ink">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            <span className="font-mono">#{ticket.ticketId}</span> · {ticket.category.replace(/_/g, " ")} · priority {ticket.priority}
          </p>
          {ticket.bookingId && (
            <p className="mt-1 text-sm text-ink-soft">
              Linked booking: <span className="font-mono">{ticket.bookingId}</span>
            </p>
          )}
          {ticket.relatedPaymentId && (
            <p className="mt-1 text-sm text-ink-soft">
              Disputed payment: <span className="font-mono">{ticket.relatedPaymentId}</span>
            </p>
          )}
          {ticket.relatedReviewId && (
            <p className="mt-1 text-sm text-ink-soft">
              Disputed review: <span className="font-mono">{ticket.relatedReviewId}</span>
            </p>
          )}
          {ticket.slaDeadline && !ticket.resolvedAt && (
            <p className="mt-1 text-xs">
              <span className="text-ink-soft">SLA deadline:</span>{" "}
              <span
                className={
                  new Date(ticket.slaDeadline) < new Date()
                    ? "font-medium text-seal"
                    : "text-ink"
                }
              >
                {new Date(ticket.slaDeadline).toLocaleString()}
                {new Date(ticket.slaDeadline) < new Date() && " (overdue)"}
              </span>
            </p>
          )}
          {ticket.resolution && (
            <p className="mt-1 text-xs text-ink-soft">
              Resolution:{" "}
              <span className="font-medium text-ink">
                {ticket.resolution.replace(/_/g, " ")}
              </span>
              {ticket.resolvedAt && ` · ${new Date(ticket.resolvedAt).toLocaleString()}`}
            </p>
          )}
        </div>
        <span className="rounded-sm border border-ink-faded/50 bg-parchment/40 px-3 py-1 text-xs uppercase tracking-widest text-ink-soft">
          {ticket.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-8 space-y-4">
        {messages.map((m) => (
          <div
            key={m.messageId}
            className={`card p-3 ${
              m.authorRole === "admin"
                ? "border-seal/30 bg-seal/10"
                : ""
            }`}
          >
            <div className="flex items-center justify-between text-xs text-ink-faded">
              <span className="capitalize">{m.authorRole}</span>
              <span>{new Date(m.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{m.body}</p>
            {m.attachments && m.attachments.length > 0 && (
              <ul className="mt-3 space-y-1">
                {m.attachments.map((a) => (
                  <li key={a.s3Key}>
                    <button
                      type="button"
                      onClick={() => downloadAttachment(a)}
                      disabled={downloadingKey === a.s3Key}
                      className="text-xs text-seal underline disabled:opacity-50"
                    >
                      📎{" "}
                      {downloadingKey === a.s3Key ? "Opening..." : a.filename}
                      {a.sizeBytes ? (
                        <span className="ml-1 text-ink-faded">
                          ({(a.sizeBytes / 1024).toFixed(1)} KB)
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {!closed && (
        <form onSubmit={onReply} className="card mt-6 space-y-2 p-4">
          <textarea
            rows={4}
            maxLength={8000}
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a reply..."
          />
          <div>
            <label className="label">
              Attachments (up to 5, 25 MB each)
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
              className="text-xs text-ink"
            />
            {files.length > 0 && (
              <ul className="mt-1 text-xs text-ink-soft">
                {files.map((f) => (
                  <li key={f.name}>
                    {f.name} ({(f.size / 1024).toFixed(1)} KB)
                  </li>
                ))}
              </ul>
            )}
          </div>
          {progress && <p className="text-xs text-ink-soft">{progress}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={submitting || !draft.trim()}
              className="btn-seal"
            >
              {submitting ? "Sending..." : "Reply"}
            </button>
          </div>
        </form>
      )}
      {closed && (
        <p className="mt-6 text-sm text-ink-soft">
          This ticket is {ticket.status}. <Link href="/support/new" className="underline">Open a new one</Link> if needed.
        </p>
      )}

      {admin && !closed && (
        <section className="mt-8 rounded-md border border-seal/30 bg-seal/10 p-4">
          <h2 className="font-display text-xl text-ink">Admin resolution</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Resolving closes the ticket, records a system message in the
            thread, and (for refund/review_removed outcomes) executes the
            relevant side effect.
          </p>
          <form onSubmit={resolveTicket} className="mt-4 space-y-3">
            <label className="block">
              <span className="label">Outcome</span>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as ResolutionOutcome)}
                className="input"
              >
                <option value="no_action">No action</option>
                <option value="warning_issued">Warning issued</option>
                <option value="refund_full" disabled={!ticket.relatedPaymentId}>
                  Refund (full){!ticket.relatedPaymentId && " — no linked payment"}
                </option>
                <option value="refund_partial" disabled={!ticket.relatedPaymentId}>
                  Refund (partial){!ticket.relatedPaymentId && " — no linked payment"}
                </option>
                <option value="review_removed" disabled={!ticket.relatedReviewId}>
                  Remove review{!ticket.relatedReviewId && " — no linked review"}
                </option>
              </select>
            </label>

            {resolution === "refund_partial" && (
              <label className="block max-w-xs">
                <span className="label">Refund amount (in main currency units)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="input"
                  placeholder="e.g. 25.00"
                  required
                />
              </label>
            )}

            <label className="block">
              <span className="label">Resolution note (shared with the user)</span>
              <textarea
                rows={3}
                minLength={10}
                maxLength={2000}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                className="input"
                placeholder="Explain what was decided and why."
                required
              />
            </label>

            <button
              type="submit"
              disabled={resolving || resolutionNote.trim().length < 10}
              className="btn-seal"
            >
              {resolving ? "Resolving..." : "Resolve ticket"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
