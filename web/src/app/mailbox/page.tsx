"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession, currentRole } from "@/lib/cognito";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";

type Thread = {
  threadId: string;
  participantA: string;
  participantB: string;
  subject: string;
  lastMessageAt?: string;
  lastMessageBody?: string;
};

type Contact = {
  userId: string;
  displayName?: string;
  source: string;
};

export default function MailboxPage() {
  const router = useRouter();
  const [items, setItems] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContacts, setShowContacts] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  async function load() {
    try {
      const r = await api<{ items: Thread[] }>(`/mailbox/threads/mine`);
      setItems(r.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function loadContacts(userRole: string | null) {
    try {
      if (userRole === "teacher") {
        const r = await api<{ items: { studentId: string; displayName?: string }[] }>(
          `/teacher/students`,
        ).catch(() => ({ items: [] }));
        setContacts(
          r.items.map((s) => ({
            userId: s.studentId,
            displayName: s.displayName,
            source: "Student",
          })),
        );
      } else {
        const r = await api<{ items: { teacherId: string; displayName?: string }[] }>(
          `/bookings/mine`,
        ).catch(() => ({ items: [] }));
        const seen = new Set<string>();
        const c: Contact[] = [];
        for (const b of r.items) {
          if (b.teacherId && !seen.has(b.teacherId)) {
            seen.add(b.teacherId);
            c.push({ userId: b.teacherId, displayName: b.displayName, source: "Teacher" });
          }
        }
        setContacts(c);
      }
    } catch {
      // contacts are optional — failing silently is fine
    }
  }

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      const userId = (s.getIdToken().payload.sub as string) ?? null;
      const r = currentRole(s);
      setSub(userId);
      setRole(r);
      await load();
      await loadContacts(r);
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
      setRecipientName("");
      setSubject("");
      setBody("");
      setComposing(false);
      router.push(`/mailbox/${r.threadId}` as never);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  function selectContact(c: Contact) {
    setRecipientId(c.userId);
    setRecipientName(c.displayName || c.userId.slice(0, 12));
    setShowContacts(false);
  }

  function timeSince(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  const sortedThreads = (items ?? []).sort((a, b) => {
    const aT = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bT = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bT - aT;
  });

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Messages</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Inbox</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {sortedThreads.length === 0
              ? "Send a message to a teacher or student to get started."
              : `${sortedThreads.length} conversation${sortedThreads.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button onClick={() => setComposing(!composing)} className="btn-seal">
          {composing ? "Cancel" : "New message"}
        </button>
      </div>

      {/* Compose panel */}
      {composing && (
        <section className="card mt-6 overflow-hidden">
          <div className="border-b border-ink-faded/20 bg-parchment-dark px-4 py-3">
            <h2 className="font-display text-base text-ink">Compose message</h2>
          </div>
          <form onSubmit={compose} className="space-y-4 p-4">
            {/* Recipient selector */}
            <div className="relative">
              <label className="label">To</label>
              {recipientName ? (
                <div className="input flex items-center gap-2">
                  <Avatar userId={recipientId} size="sm" />
                  <span className="flex-1 text-sm text-ink">{recipientName}</span>
                  <button
                    type="button"
                    onClick={() => { setRecipientId(""); setRecipientName(""); }}
                    className="text-ink-faded hover:text-seal"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      required
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value)}
                      placeholder="Search contacts or enter user ID..."
                      className="input flex-1"
                      onFocus={() => setShowContacts(true)}
                    />
                    {contacts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowContacts(!showContacts)}
                        className="rounded-md border border-ink-faded/40 px-3 text-xs text-ink-soft transition hover:bg-parchment-dark"
                      >
                        Contacts
                      </button>
                    )}
                  </div>
                  {showContacts && contacts.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-ink-faded/30 bg-parchment shadow-lg">
                      {contacts
                        .filter(
                          (c) =>
                            !recipientId ||
                            c.displayName?.toLowerCase().includes(recipientId.toLowerCase()) ||
                            c.userId.includes(recipientId),
                        )
                        .map((c) => (
                          <button
                            key={c.userId}
                            type="button"
                            onClick={() => selectContact(c)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-parchment-dark"
                          >
                            <Avatar userId={c.userId} size="sm" initial={c.displayName?.charAt(0)} />
                            <div className="flex-1">
                              <div className="font-medium text-ink">
                                {c.displayName || c.userId.slice(0, 16)}
                              </div>
                              <div className="text-xs text-ink-faded">{c.source}</div>
                            </div>
                          </button>
                        ))}
                      {contacts.length === 0 && (
                        <div className="px-4 py-3 text-sm text-ink-faded">
                          No contacts found. You can paste a user ID directly.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <label className="block">
              <span className="label">Subject</span>
              <input
                required
                maxLength={200}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What's this about?"
                className="input"
              />
            </label>

            <label className="block">
              <span className="label">Message</span>
              <textarea
                required
                rows={5}
                maxLength={10_000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message..."
                className="input"
              />
            </label>

            {error && <p className="text-sm text-seal">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setComposing(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending || !body.trim() || !recipientId.trim() || !subject.trim()}
                className="btn-seal"
              >
                {sending ? "Sending..." : "Send message"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Filter tabs */}
      {sortedThreads.length > 0 && (
        <div className="mt-6 flex gap-1 border-b border-ink-faded/20">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`border-b-2 px-4 py-2 text-xs font-medium capitalize transition ${
                filter === f
                  ? "border-seal text-seal"
                  : "border-transparent text-ink-faded hover:text-ink"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Thread list */}
      {items === null && !error && (
        <div className="mt-8 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
        </div>
      )}

      {sortedThreads.length === 0 && items !== null && !composing && (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parchment-dark">
            <span className="text-2xl text-ink-faded">✉️</span>
          </div>
          <p className="mt-4 font-display text-lg text-ink">No messages yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            Start a conversation with your {role === "teacher" ? "students" : "teachers"}.
          </p>
          <button onClick={() => setComposing(true)} className="btn-seal mt-4">
            Compose
          </button>
        </div>
      )}

      {sortedThreads.length > 0 && (
        <ul className="mt-4 divide-y divide-ink-faded/20">
          {sortedThreads.map((t) => {
            const counterparty = t.participantA === sub ? t.participantB : t.participantA;
            return (
              <li key={t.threadId}>
                <Link
                  href={`/mailbox/${t.threadId}` as never}
                  className="flex items-center gap-4 px-2 py-4 transition hover:bg-parchment-dark"
                >
                  <Avatar userId={counterparty} size="md" initial={counterparty.charAt(0)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-display text-base text-ink">
                        {t.subject}
                      </span>
                      {t.lastMessageAt && (
                        <span className="shrink-0 text-xs text-ink-faded">
                          {timeSince(t.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-faded">
                      <span className="shrink-0">
                        {counterparty.slice(0, 12)}…
                      </span>
                    </div>
                    {t.lastMessageBody && (
                      <p className="mt-0.5 truncate text-sm text-ink-soft">
                        {t.lastMessageBody.slice(0, 120)}
                      </p>
                    )}
                  </div>
                  <span className="text-ink-faded">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
