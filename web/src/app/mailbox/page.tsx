"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Thread = {
  threadId: string;
  participantA: string;
  participantB: string;
  subject: string;
  lastMessageAt?: string;
  lastMessageBody?: string;
};

export default function MailboxPage() {
  const router = useRouter();
  const [items, setItems] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      const r = await api<{ items: Thread[] }>(`/mailbox/threads/mine`);
      setItems(r.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      setSub((s.getIdToken().payload.sub as string) ?? null);
      await load();
    })();
  }, [router]);

  async function compose(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const r = await api<{ threadId: string }>(`/mailbox/threads`, {
        method: "POST",
        body: JSON.stringify({
          recipientId: recipientId.trim(),
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      setRecipientId("");
      setSubject("");
      setBody("");
      router.push(`/mailbox/${r.threadId}` as never);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Mailbox</h1>
      <p className="mt-1 text-sm text-gray-500">
        Threaded async messages with parents, students, or teachers.
      </p>

      <section className="mt-8 rounded border p-4">
        <h2 className="text-sm font-medium">New message</h2>
        <form onSubmit={compose} className="mt-3 space-y-2">
          <input
            required
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            placeholder="Recipient user ID (sub_...)"
            className="w-full rounded border px-3 py-2 font-mono text-sm"
          />
          <input
            required
            maxLength={200}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <textarea
            required
            rows={3}
            maxLength={10_000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={sending || !body.trim() || !recipientId.trim() || !subject.trim()}
            className="rounded bg-black px-4 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      </section>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <section className="mt-8">
        <h2 className="text-sm font-medium">Your threads</h2>
        {items === null && !error && (
          <p className="mt-3 text-sm text-gray-500">Loading...</p>
        )}
        {items && items.length === 0 && (
          <p className="mt-3 text-sm text-gray-500">No threads yet.</p>
        )}
        {items && items.length > 0 && (
          <ul className="mt-3 divide-y rounded border">
            {items.map((t) => {
              const counterparty =
                t.participantA === sub ? t.participantB : t.participantA;
              return (
                <li key={t.threadId}>
                  <Link
                    href={`/mailbox/${t.threadId}` as never}
                    className="block p-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{t.subject}</div>
                      {t.lastMessageAt && (
                        <span className="text-xs text-gray-500">
                          {new Date(t.lastMessageAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      with <span className="font-mono">{counterparty.slice(0, 10)}</span>
                      {t.lastMessageBody && ` · ${t.lastMessageBody.slice(0, 80)}`}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-gray-500 underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
