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
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Mailbox</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Mailbox</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Threaded async messages with parents, students, or teachers.
      </p>

      <section className="card mt-8 p-4">
        <h2 className="font-display text-base text-ink">New message</h2>
        <form onSubmit={compose} className="mt-3 space-y-2">
          <input
            required
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            placeholder="Recipient user ID (sub_...)"
            className="input font-mono"
          />
          <input
            required
            maxLength={200}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="input"
          />
          <textarea
            required
            rows={3}
            maxLength={10_000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            className="input"
          />
          <button
            type="submit"
            disabled={sending || !body.trim() || !recipientId.trim() || !subject.trim()}
            className="btn-seal"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      </section>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}

      <section className="mt-8">
        <h2 className="eyebrow">Your threads</h2>
        {items === null && !error && (
          <p className="mt-3 text-sm text-ink-soft">Loading...</p>
        )}
        {items && items.length === 0 && (
          <p className="mt-3 text-sm text-ink-soft">No threads yet.</p>
        )}
        {items && items.length > 0 && (
          <ul className="card mt-3 divide-y divide-ink-faded/30">
            {items.map((t) => {
              const counterparty =
                t.participantA === sub ? t.participantB : t.participantA;
              return (
                <li key={t.threadId}>
                  <Link
                    href={`/mailbox/${t.threadId}` as never}
                    className="block p-3 text-sm transition hover:bg-parchment-shade"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-display text-base text-ink">{t.subject}</div>
                      {t.lastMessageAt && (
                        <span className="text-xs text-ink-faded">
                          {new Date(t.lastMessageAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-faded">
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
        <Link href="/dashboard" className="text-ink-soft underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
