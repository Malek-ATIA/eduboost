"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Thread = {
  threadId: string;
  participantA: string;
  participantB: string;
  subject: string;
};

type Message = {
  threadId: string;
  messageId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export default function MailboxThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = use(params);
  const router = useRouter();
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ thread: Thread; messages: Message[] }>(
        `/mailbox/threads/${threadId}`,
      );
      setThread(r.thread);
      setMessages(r.messages);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [threadId]);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      setSub((s.getIdToken().payload.sub as string) ?? null);
      await load();
    })();
  }, [router, load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api(`/mailbox/threads/${threadId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: draft.trim() }),
      });
      setDraft("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (error && !thread) {
    return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-sm text-seal">{error}</main>;
  }
  if (!thread) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <Link href="/mailbox" className="btn-ghost -ml-3">
        ← Mailbox
      </Link>
      <p className="eyebrow mt-3">Thread</p>
      <h1 className="mt-1 font-display text-3xl text-ink">{thread.subject}</h1>

      <section className="mt-6 space-y-3">
        {messages?.map((m) => (
          <div
            key={m.messageId}
            className={`rounded-md border p-3 text-sm ${
              m.authorId === sub
                ? "ml-8 border-seal/30 bg-seal/10 text-ink"
                : "mr-8 border-ink-faded/40 bg-parchment-dark/70 text-ink"
            }`}
          >
            <div className="text-xs text-ink-faded">
              {m.authorId === sub ? "You" : m.authorId.slice(0, 10)} ·{" "}
              {new Date(m.createdAt).toLocaleString()}
            </div>
            <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
      </section>

      <form onSubmit={send} className="mt-6 space-y-2">
        <textarea
          rows={3}
          maxLength={10_000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Reply..."
          className="input"
        />
        {error && <p className="text-sm text-seal">{error}</p>}
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="btn-seal"
        >
          {sending ? "Sending..." : "Reply"}
        </button>
      </form>
    </main>
  );
}
