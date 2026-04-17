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
    return <main className="mx-auto max-w-2xl px-6 py-12 text-sm text-red-600">{error}</main>;
  }
  if (!thread) return <main className="mx-auto max-w-2xl px-6 py-12">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/mailbox" className="text-sm text-gray-500 underline">
        ← Mailbox
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{thread.subject}</h1>

      <section className="mt-6 space-y-3">
        {messages?.map((m) => (
          <div
            key={m.messageId}
            className={`rounded border p-3 text-sm ${
              m.authorId === sub
                ? "ml-8 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950"
                : "mr-8"
            }`}
          >
            <div className="text-xs text-gray-500">
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
          className="w-full rounded border px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="rounded bg-black px-4 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {sending ? "Sending..." : "Reply"}
        </button>
      </form>
    </main>
  );
}
