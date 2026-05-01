"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";

type ChatMessage = {
  channelId: string;
  messageId: string;
  senderId: string;
  body: string;
  kind: "text" | "system";
  createdAt: string;
};

type ClassroomChatResponse = { channelId: string; items: ChatMessage[] };

type Classroom = {
  classroomId: string;
  teacherId: string;
  title: string;
  chatEnabled?: boolean;
};

export default function ClassroomChatPage({
  params,
}: {
  params: Promise<{ classroomId: string }>;
}) {
  const { classroomId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { confirm: showConfirm } = useDialog();
  const [sub, setSub] = useState<string | null>(null);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
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
      setError((err as Error).message);
    }
  }, [classroomId]);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setSub((session.getIdToken().payload.sub as string) ?? null);
      try {
        const cls = await api<Classroom>(`/classrooms/${classroomId}`);
        setClassroom(cls);
      } catch {
        /* non-fatal; teacher-only moderation fallback */
      }
      load();
    })();
  }, [router, load, classroomId]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  const chatOn = classroom?.chatEnabled ?? true;
  const isTeacher = !!classroom && sub !== null && classroom.teacherId === sub;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
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

  async function deleteMessage(messageId: string) {
    const ok = await showConfirm({ title: "Delete message", message: "Delete this message for everyone?", destructive: true });
    if (!ok) return;
    try {
      await api(
        `/chat/classroom/${encodeURIComponent(classroomId)}/${encodeURIComponent(
          messageId,
        )}`,
        { method: "DELETE" },
      );
      setMessages((prev) => prev?.filter((m) => m.messageId !== messageId) ?? null);
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Classroom</p>
      <h1 className="mt-1 font-display text-3xl text-ink">
        {classroom?.title ?? "Classroom chat"}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        {isTeacher
          ? "You're the teacher — tap Delete on any message to remove it."
          : "Posts are visible to every member of this classroom."}
      </p>
      {!chatOn && (
        <p className="mt-3 rounded-md border border-ink-faded/40 bg-parchment-dark px-3 py-2 text-sm text-ink-soft">
          Chat is currently <strong>disabled</strong> by the teacher. You can read
          history, but new messages can&apos;t be posted.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-seal">{error}</p>}

      <div className="card mt-6 flex h-[520px] flex-col">
        <div ref={scrollerRef} className="flex-1 overflow-y-auto p-3">
          {messages === null && !error && (
            <p className="text-sm text-ink-soft">Loading…</p>
          )}
          {messages && messages.length === 0 && (
            <p className="text-sm text-ink-soft">No messages yet.</p>
          )}
          {messages?.map((m) => {
            const canDelete = isTeacher || m.senderId === sub;
            return (
              <div key={m.messageId} className="group mb-3">
                <div className="flex items-center gap-2 text-xs text-ink-faded">
                  <span className="font-mono">{m.senderId.slice(0, 8)}…</span>
                  <span>·</span>
                  <span>{new Date(m.createdAt).toLocaleString()}</span>
                  {canDelete && (
                    <button
                      onClick={() => deleteMessage(m.messageId)}
                      className="ml-auto text-seal opacity-0 transition group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div className="mt-0.5 text-sm text-ink">{m.body}</div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-ink-faded/30 p-2">
          <form onSubmit={send} className="flex gap-2">
            <input
              className="input flex-1"
              placeholder={chatOn ? "Type a message…" : "Chat is disabled"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={sending || !!error || !chatOn}
              maxLength={4000}
            />
            <button
              type="submit"
              className="btn-seal"
              disabled={sending || !draft.trim() || !!error || !chatOn}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
