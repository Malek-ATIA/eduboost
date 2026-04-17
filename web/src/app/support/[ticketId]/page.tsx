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

type Message = {
  ticketId: string;
  messageId: string;
  authorId: string;
  authorRole: "user" | "admin" | "system";
  body: string;
  createdAt: string;
};

type TicketResponse = { ticket: Ticket; messages: Message[] };

export default function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<TicketResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function onReply(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/support/tickets/${ticketId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: draft }),
      });
      setDraft("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
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
