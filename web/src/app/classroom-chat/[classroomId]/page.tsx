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
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-xl font-bold">Classroom chat</h1>
      <p className="mt-1 text-sm text-gray-500">Classroom {classroomId}</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex h-[520px] flex-col rounded border">
        <div ref={scrollerRef} className="flex-1 overflow-y-auto p-3">
          {messages === null && !error && (
            <p className="text-sm text-gray-500">Loading...</p>
          )}
          {messages && messages.length === 0 && (
            <p className="text-sm text-gray-500">No messages yet.</p>
          )}
          {messages?.map((m) => (
            <div key={m.messageId} className="mb-2">
              <div className="text-xs text-gray-500">
                {m.senderId} · {new Date(m.createdAt).toLocaleString()}
              </div>
              <div className="text-sm">{m.body}</div>
            </div>
          ))}
        </div>
        <div className="border-t p-2">
          <form onSubmit={send} className="flex gap-2">
            <input
              className="flex-1 rounded border px-2 py-1 text-sm"
              placeholder="Type a message..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={sending || !!error}
              maxLength={4000}
            />
            <button
              type="submit"
              className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
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
