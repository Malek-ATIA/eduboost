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

type DmResponse = { channelId: string; items: ChatMessage[] };

export default function DmChatPage({
  params,
}: {
  params: Promise<{ otherUserId: string }>;
}) {
  const { otherUserId } = use(params);
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<DmResponse>(`/chat/dm/${encodeURIComponent(otherUserId)}`);
      // API returns desc by createdAt — reverse for chat-style (oldest first)
      setMessages([...r.items].reverse());
    } catch (err) {
      setError((err as Error).message);
    }
  }, [otherUserId]);

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
        `/chat/dm/${encodeURIComponent(otherUserId)}`,
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
      <p className="eyebrow">Messages</p>
      <h1 className="mt-1 font-display text-3xl text-ink">Direct message</h1>
      <p className="mt-1 font-mono text-sm text-ink-soft">with {otherUserId}</p>
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
              disabled={sending}
              maxLength={4000}
            />
            <button
              type="submit"
              className="btn-seal"
              disabled={sending || !draft.trim()}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
