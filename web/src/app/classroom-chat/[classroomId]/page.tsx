"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type ChatMessage = {
  channelId: string;
  messageId: string;
  senderId: string;
  body: string;
  kind: "text" | "system";
  createdAt: string;
};

type ClassroomChatResponse = { channelId: string; items: ChatMessage[] };

export default function ClassroomChatPage({
  params,
}: {
  params: Promise<{ classroomId: string }>;
}) {
  const { classroomId } = use(params);
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<ClassroomChatResponse>(
        `/chat/classroom/${encodeURIComponent(classroomId)}`,
      );
      setMessages([...r.items].reverse());
    } catch (err) {
      // API enforces membership server-side (403 if non-member); surface it.
      const msg = (err as Error).message;
      if (msg.includes("403")) {
        setError("You are not a member of this classroom.");
      } else {
        setError(msg);
      }
    }
  }, [classroomId]);

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

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const msg = await api<ChatMessage>(
        `/chat/classroom/${encodeURIComponent(classroomId)}`,
        { method: "POST", body: JSON.stringify({ body }) },
      );
      setMessages((prev) => (prev ? [...prev, msg] : [msg]));
      setDraft("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Classroom</p>
      <h1 className="mt-1 font-display text-3xl text-ink">Classroom chat</h1>
      <p className="mt-1 font-mono text-sm text-ink-soft">Classroom {classroomId}</p>
      {error && <p className="mt-2 text-sm text-seal">{error}</p>}

      <div className="card mt-6 flex h-[520px] flex-col">
        <div ref={scrollerRef} className="flex-1 overflow-y-auto p-3">
          {messages === null && !error && (
            <p className="text-sm text-ink-soft">Loading...</p>
          )}
          {messages && messages.length === 0 && (
            <p className="text-sm text-ink-soft">No messages yet.</p>
          )}
          {messages?.map((m) => (
            <div key={m.messageId} className="mb-2">
              <div className="text-xs text-ink-faded">
                <span className="font-mono">{m.senderId}</span> · {new Date(m.createdAt).toLocaleString()}
              </div>
              <div className="text-sm text-ink">{m.body}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-ink-faded/30 p-2">
          <form onSubmit={send} className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Type a message..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={sending || !!error}
              maxLength={4000}
            />
            <button
              type="submit"
              className="btn-seal"
              disabled={sending || !draft.trim() || !!error}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
