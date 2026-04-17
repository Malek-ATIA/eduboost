"use client";
import { use, useEffect, useRef, useState } from "react";
import {
  ConsoleLogger,
  DataMessage,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration,
} from "amazon-chime-sdk-js";
import { api } from "@/lib/api";

type JoinResponse = {
  meeting: unknown;
  attendee: unknown;
};

type SessionResponse = {
  sessionId: string;
  classroomId: string;
  teacherId: string;
  status: string;
};

type ChatEntry = { senderId: string; body: string; at: string };

const CHAT_TOPIC = "classroom-chat";

export default function ClassroomPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<DefaultMeetingSession | null>(null);
  const [status, setStatus] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [classroomId, setClassroomId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("joining");
      try {
        const sessionInfo = await api<SessionResponse>(`/sessions/${sessionId}`);
        if (cancelled) return;
        setClassroomId(sessionInfo.classroomId);

        const { meeting, attendee } = await api<JoinResponse>(
          `/chime/sessions/${sessionId}/join`,
          { method: "POST" },
        );
        if (cancelled) return;

        const logger = new ConsoleLogger("chime", LogLevel.WARN);
        const deviceController = new DefaultDeviceController(logger);
        const config = new MeetingSessionConfiguration(meeting, attendee);
        const session = new DefaultMeetingSession(config, logger, deviceController);
        sessionRef.current = session;

        const audioInputs = await session.audioVideo.listAudioInputDevices();
        if (audioInputs[0]) await session.audioVideo.startAudioInput(audioInputs[0].deviceId);
        const videoInputs = await session.audioVideo.listVideoInputDevices();
        if (videoInputs[0]) await session.audioVideo.startVideoInput(videoInputs[0].deviceId);

        if (audioRef.current) session.audioVideo.bindAudioElement(audioRef.current);

        session.audioVideo.realtimeSubscribeToReceiveDataMessage(CHAT_TOPIC, (msg: DataMessage) => {
          const body = new TextDecoder().decode(msg.data);
          setChat((prev) => [
            ...prev,
            { senderId: msg.senderAttendeeId, body, at: new Date(msg.timestampMs).toISOString() },
          ]);
        });

        session.audioVideo.start();
        session.audioVideo.startLocalVideoTile();
        setStatus("joined");
      } catch (err) {
        setError((err as Error).message);
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      sessionRef.current?.audioVideo.stop();
    };
  }, [sessionId]);

  async function sendMessage() {
    const session = sessionRef.current;
    if (!session || !draft.trim() || !classroomId) return;
    const body = draft;
    setDraft("");
    const bytes = new TextEncoder().encode(body);
    session.audioVideo.realtimeSendDataMessage(CHAT_TOPIC, bytes);
    setChat((prev) => [...prev, { senderId: "me", body, at: new Date().toISOString() }]);
    try {
      await api(`/chat/classroom/${classroomId}`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
    } catch (err) {
      console.warn("chat persistence failed", err);
    }
  }

  async function toggleRecording() {
    const path = recording ? "stop" : "start";
    try {
      await api(`/chime/sessions/${sessionId}/recording/${path}`, { method: "POST" });
      setRecording(!recording);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Classroom · {sessionId}</h1>
        <button
          onClick={toggleRecording}
          disabled={status !== "joined"}
          className={`rounded px-3 py-1 text-sm ${
            recording ? "bg-red-600 text-white" : "border"
          } disabled:opacity-50`}
        >
          {recording ? "Stop recording" : "Start recording"}
        </button>
      </div>
      <p className="mt-2 text-sm text-gray-500">Status: {status}</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="aspect-video w-full overflow-hidden rounded bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted />
        </div>

        <div className="flex h-[480px] flex-col rounded border">
          <div className="flex-1 overflow-y-auto p-3">
            {chat.length === 0 && <p className="text-sm text-gray-500">No messages yet.</p>}
            {chat.map((m, i) => (
              <div key={i} className="mb-2">
                <div className="text-xs text-gray-500">{m.senderId}</div>
                <div className="text-sm">{m.body}</div>
              </div>
            ))}
          </div>
          <div className="border-t p-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex gap-2"
            >
              <input
                className="flex-1 rounded border px-2 py-1 text-sm"
                placeholder="Type a message..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={status !== "joined"}
              />
              <button
                type="submit"
                className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
                disabled={status !== "joined" || !draft.trim()}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>

      <audio ref={audioRef} />
    </main>
  );
}
