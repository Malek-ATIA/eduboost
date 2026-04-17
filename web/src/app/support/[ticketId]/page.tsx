"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Ticket = {
  ticketId: string;
  userId: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  bookingId?: string;
  createdAt: string;
  updatedAt: string;
};

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

  if (error) return <main className="mx-auto max-w-2xl px-6 py-12 text-red-600">{error}</main>;
  if (!data) return <main className="mx-auto max-w-2xl px-6 py-12">Loading...</main>;

  const { ticket, messages } = data;
  const closed = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/support" className="text-sm text-gray-500 underline">
            ← All tickets
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-gray-500">
            #{ticket.ticketId} · {ticket.category.replace(/_/g, " ")} · priority {ticket.priority}
          </p>
          {ticket.bookingId && (
            <p className="mt-1 text-sm text-gray-500">
              Linked booking: <span className="font-mono">{ticket.bookingId}</span>
            </p>
          )}
        </div>
        <span className="rounded-full border px-3 py-1 text-xs uppercase">
          {ticket.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-8 space-y-4">
        {messages.map((m) => (
          <div
            key={m.messageId}
            className={`rounded border p-3 ${
              m.authorRole === "admin"
                ? "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950"
                : ""
            }`}
          >
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="capitalize">{m.authorRole}</span>
              <span>{new Date(m.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
            {m.attachments && m.attachments.length > 0 && (
              <ul className="mt-3 space-y-1">
                {m.attachments.map((a) => (
                  <li key={a.s3Key}>
                    <button
                      type="button"
                      onClick={() => downloadAttachment(a)}
                      disabled={downloadingKey === a.s3Key}
                      className="text-xs text-blue-700 underline disabled:opacity-50"
                    >
                      📎{" "}
                      {downloadingKey === a.s3Key ? "Opening..." : a.filename}
                      {a.sizeBytes ? (
                        <span className="ml-1 text-gray-500">
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
        <form onSubmit={onReply} className="mt-6 space-y-2">
          <textarea
            rows={4}
            maxLength={8000}
            className="w-full rounded border px-3 py-2"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a reply..."
          />
          <div>
            <label className="mb-1 block text-xs text-gray-500">
              Attachments (up to 5, 25 MB each)
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
              className="text-xs"
            />
            {files.length > 0 && (
              <ul className="mt-1 text-xs text-gray-600">
                {files.map((f) => (
                  <li key={f.name}>
                    {f.name} ({(f.size / 1024).toFixed(1)} KB)
                  </li>
                ))}
              </ul>
            )}
          </div>
          {progress && <p className="text-xs text-gray-500">{progress}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={submitting || !draft.trim()}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {submitting ? "Sending..." : "Reply"}
            </button>
          </div>
        </form>
      )}
      {closed && (
        <p className="mt-6 text-sm text-gray-500">
          This ticket is {ticket.status}. <Link href="/support/new" className="underline">Open a new one</Link> if needed.
        </p>
      )}
    </main>
  );
}
