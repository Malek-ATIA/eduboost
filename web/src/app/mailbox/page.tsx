"use client";
import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

type Message = {
  threadId: string;
  messageId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

type Contact = {
  userId: string;
  displayName?: string;
  source: string;
};

export default function MailboxPageWrapper() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-container-wide px-4 pb-24 pt-12 sm:px-8"><div className="eyebrow">Messages</div><h1 className="mt-3 text-[clamp(32px,4vw,44px)] font-bold tracking-[-0.022em]">Inbox</h1><div className="mt-6 flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" /></div></main>}>
      <MailboxPage />
    </Suspense>
  );
}

function MailboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillTo = searchParams.get("to") ?? "";
  const [items, setItems] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [composing, setComposing] = useState(!!prefillTo);
  const [recipientId, setRecipientId] = useState(prefillTo);
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContacts, setShowContacts] = useState(false);
  const [search, setSearch] = useState("");

  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [threadMeta, setThreadMeta] = useState<Thread | null>(null);
  const [draft, setDraft] = useState("");
  const [replying, setReplying] = useState(false);

  const loadThreads = useCallback(async () => {
    try {
      const r = await api<{ items: Thread[] }>(`/mailbox/threads/mine`);
      setItems(r.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

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
    } catch {}
  }

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      const userId = (s.getIdToken().payload.sub as string) ?? null;
      const r = currentRole(s);
      setSub(userId);
      setRole(r);
      await loadThreads();
      await loadContacts(r);
    })();
  }, [router, loadThreads]);

  async function openThread(threadId: string) {
    setActiveThread(threadId);
    setComposing(false);
    setMessages(null);
    try {
      const r = await api<{ thread: Thread; messages: Message[] }>(
        `/mailbox/threads/${threadId}`,
      );
      setThreadMeta(r.thread);
      setMessages(r.messages);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeThread || !draft.trim()) return;
    setReplying(true);
    try {
      await api(`/mailbox/threads/${activeThread}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: draft.trim() }),
      });
      setDraft("");
      const r = await api<{ thread: Thread; messages: Message[] }>(
        `/mailbox/threads/${activeThread}`,
      );
      setMessages(r.messages);
      await loadThreads();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReplying(false);
    }
  }

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
      await loadThreads();
      openThread(r.threadId);
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
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  const sortedThreads = (items ?? []).sort((a, b) => {
    const aT = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bT = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bT - aT;
  });

  const filteredThreads = search
    ? sortedThreads.filter(
        (t) =>
          t.subject.toLowerCase().includes(search.toLowerCase()) ||
          t.participantA.includes(search) ||
          t.participantB.includes(search),
      )
    : sortedThreads;

  const activeCounterparty = threadMeta
    ? threadMeta.participantA === sub
      ? threadMeta.participantB
      : threadMeta.participantA
    : null;

  return (
    <main className="pb-8">
      {/* PageHead */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-rule px-4 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
        <div>
          <div className="eyebrow">Messages</div>
          <h1 className="mt-2 text-[clamp(28px,3vw,40px)] font-bold tracking-[-0.018em]">
            Inbox
          </h1>
          <p className="mt-2 max-w-[640px] text-[14.5px] text-ink-soft">
            One thread per teacher, parent, or admin contact.
          </p>
        </div>
      </div>

      <div className="mx-4 mt-6 sm:mx-8 sm:mt-7 space-y-6">
        {/* Thread list (full width) */}
        <div className="card overflow-hidden p-0">
          <div className="flex gap-2 border-b border-rule p-3.5">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faded" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input w-full pl-8"
                placeholder="Search messages…"
              />
            </div>
            <button
              onClick={() => { setComposing(true); setActiveThread(null); }}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-rule text-ink-soft transition hover:bg-bg-soft"
            >
              +
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {items === null && (
              <div className="flex justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
              </div>
            )}
            {filteredThreads.map((t) => {
              const counterparty = t.participantA === sub ? t.participantB : t.participantA;
              const isActive = activeThread === t.threadId;
              return (
                <button
                  key={t.threadId}
                  onClick={() => openThread(t.threadId)}
                  className={`flex w-full gap-3 border-b border-rule-soft px-4 py-3.5 text-left transition ${
                    isActive ? "bg-bg-soft" : "hover:bg-bg-soft/50"
                  }`}
                >
                  <Avatar userId={counterparty} size="md" initial={counterparty.charAt(0)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13.5px] font-medium text-ink">{t.subject}</span>
                      {t.lastMessageAt && (
                        <span className="shrink-0 font-mono text-[11px] text-ink-faded">
                          {timeSince(t.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-faded">
                      {counterparty.slice(0, 12)}…
                    </div>
                    {t.lastMessageBody && (
                      <p className="mt-1 truncate text-[12.5px] text-ink-soft">
                        {t.lastMessageBody.slice(0, 100)}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
            {filteredThreads.length === 0 && items !== null && (
              <div className="px-4 py-8 text-center text-sm text-ink-faded">
                {search ? "No threads match your search." : "No conversations yet."}
              </div>
            )}
          </div>
        </div>

        {/* Active thread / compose panel — below the list */}
        {(composing || activeThread) && (
        <div className="card overflow-hidden p-0">
          {composing ? (
            <div className="flex flex-1 flex-col">
              <div className="border-b border-rule px-5 py-3.5">
                <h2 className="font-semibold text-base text-ink">New message</h2>
              </div>
              <form onSubmit={compose} className="flex flex-1 flex-col p-5">
                <div className="relative">
                  <label className="label">To</label>
                  {recipientName ? (
                    <div className="input flex items-center gap-2">
                      <Avatar userId={recipientId} size="sm" />
                      <span className="flex-1 text-sm text-ink">{recipientName}</span>
                      <button
                        type="button"
                        onClick={() => { setRecipientId(""); setRecipientName(""); }}
                        className="text-ink-faded hover:text-accent"
                      >×</button>
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
                            className="rounded-full border border-rule px-3 text-xs text-ink-soft transition hover:bg-bg-soft"
                          >Contacts</button>
                        )}
                      </div>
                      {showContacts && contacts.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-2xl border border-rule bg-white shadow-lg">
                          {contacts
                            .filter((c) =>
                              !recipientId ||
                              c.displayName?.toLowerCase().includes(recipientId.toLowerCase()) ||
                              c.userId.includes(recipientId),
                            )
                            .map((c) => (
                              <button
                                key={c.userId}
                                type="button"
                                onClick={() => selectContact(c)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-bg-soft"
                              >
                                <Avatar userId={c.userId} size="sm" initial={c.displayName?.charAt(0)} />
                                <div className="flex-1">
                                  <div className="font-medium text-ink">{c.displayName || c.userId.slice(0, 16)}</div>
                                  <div className="text-xs text-ink-faded">{c.source}</div>
                                </div>
                              </button>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <label className="mt-3 block">
                  <span className="label">Subject</span>
                  <input required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's this about?" className="input" />
                </label>
                <label className="mt-3 block flex-1">
                  <span className="label">Message</span>
                  <textarea required rows={6} maxLength={10_000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message..." className="input" style={{ resize: "none" }} />
                </label>
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setComposing(false)} className="btn-ghost">Cancel</button>
                  <button type="submit" disabled={sending || !body.trim() || !recipientId.trim() || !subject.trim()} className="btn-primary">{sending ? "Sending…" : "Send"}</button>
                </div>
              </form>
            </div>
          ) : activeThread && threadMeta ? (
            <div className="flex flex-col">
              {/* Thread header */}
              <div className="flex items-center gap-3 border-b border-rule px-5 py-3.5">
                {activeCounterparty && (
                  <Avatar userId={activeCounterparty} size="md" initial={activeCounterparty.charAt(0)} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-medium text-ink">{threadMeta.subject}</div>
                  {activeCounterparty && (
                    <div className="truncate text-xs text-ink-faded">
                      {activeCounterparty.slice(0, 16)}…
                    </div>
                  )}
                </div>
              </div>
              {/* Messages */}
              <div className="flex flex-col gap-4 px-5 py-6" style={{ maxHeight: 480, overflowY: "auto" }}>
                {messages === null && (
                  <div className="flex justify-center py-8">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
                  </div>
                )}
                {messages?.map((m) => {
                  const isMe = m.authorId === sub;
                  return (
                    <div key={m.messageId} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      <div className="text-[11.5px] text-ink-faded">
                        {isMe ? "" : `${m.authorId.slice(0, 10)} · `}
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div
                        className={`mt-1 max-w-[70%] rounded-[14px] px-3.5 py-2.5 text-sm leading-relaxed ${
                          isMe
                            ? "bg-ink text-white"
                            : "bg-bg-soft text-ink"
                        }`}
                      >
                        {m.body}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Reply input */}
              <form onSubmit={sendReply} className="border-t border-rule px-4 py-3">
                <div className="flex items-end gap-2">
                  <textarea
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a message…"
                    className="input flex-1"
                    style={{ resize: "none" }}
                  />
                  <button
                    type="submit"
                    disabled={replying || !draft.trim()}
                    className="btn-primary h-9 px-4"
                  >
                    {replying ? "…" : "Send"}
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
        )}
      </div>
    </main>
  );
}
