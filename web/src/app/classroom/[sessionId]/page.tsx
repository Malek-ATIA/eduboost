"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import {
  ConsoleLogger,
  DataMessage,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration,
} from "amazon-chime-sdk-js";
import { api } from "@/lib/api";
import { currentSession } from "@/lib/cognito";

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

type AttendanceItem = {
  sessionId: string;
  userId: string;
  status: "present" | "absent" | "excused" | "late";
  markedAt: string;
  notes?: string;
  user?: { userId: string; displayName: string; email: string } | null;
};

const ATTENDANCE_STATUSES = ["present", "late", "absent", "excused"] as const;
type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
const CHAT_TOPIC = "classroom-chat";

type BreakoutRoom = {
  sessionId: string;
  breakoutId: string;
  label: string;
  chimeMeetingId: string;
  createdBy: string;
  assignedUserIds: string[];
  createdAt: string;
};

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
  const [viewerSub, setViewerSub] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceItem[] | null>(null);
  const [breakouts, setBreakouts] = useState<BreakoutRoom[] | null>(null);
  const [newBreakoutLabel, setNewBreakoutLabel] = useState("");
  const [newBreakoutAssignees, setNewBreakoutAssignees] = useState("");
  const [breakoutError, setBreakoutError] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ body?: string }>(`/notes/sessions/${sessionId}`);
        setNoteBody(r.body ?? "");
      } catch {
        /* not a participant yet — stay empty */
      }
    })();
  }, [sessionId]);

  async function saveNote() {
    setNoteSaving(true);
    setNoteSaved(false);
    try {
      await api(`/notes/sessions/${sessionId}`, {
        method: "PUT",
        body: JSON.stringify({ body: noteBody }),
      });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2500);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setNoteSaving(false);
    }
  }

  const loadBreakouts = useCallback(async () => {
    try {
      const r = await api<{ items: BreakoutRoom[] }>(`/chime/sessions/${sessionId}/breakouts`);
      setBreakouts(r.items);
    } catch (err) {
      console.warn("breakouts load failed", err);
    }
  }, [sessionId]);

  const loadAttendance = useCallback(async () => {
    try {
      const r = await api<{ items: AttendanceItem[] }>(`/attendance/sessions/${sessionId}`);
      setAttendance(r.items);
    } catch (err) {
      console.warn("attendance load failed", err);
    }
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("joining");
      try {
        const s = await currentSession();
        if (s) setViewerSub((s.getIdToken().payload.sub as string) ?? null);

        const sessionInfo = await api<SessionResponse>(`/sessions/${sessionId}`);
        if (cancelled) return;
        setClassroomId(sessionInfo.classroomId);
        setTeacherId(sessionInfo.teacherId);

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

        await Promise.all([loadAttendance(), loadBreakouts()]);
      } catch (err) {
        setError((err as Error).message);
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      sessionRef.current?.audioVideo.stop();
    };
  }, [sessionId, loadAttendance, loadBreakouts]);

  async function createBreakout(e: React.FormEvent) {
    e.preventDefault();
    setBreakoutError(null);
    const label = newBreakoutLabel.trim();
    if (!label) return;
    const assignedUserIds = newBreakoutAssignees
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await api(`/chime/sessions/${sessionId}/breakouts`, {
        method: "POST",
        body: JSON.stringify({ label, assignedUserIds }),
      });
      setNewBreakoutLabel("");
      setNewBreakoutAssignees("");
      await loadBreakouts();
    } catch (err) {
      setBreakoutError((err as Error).message);
    }
  }

  async function endBreakout(breakoutId: string) {
    if (!confirm("End this breakout and disconnect participants?")) return;
    try {
      await api(`/chime/sessions/${sessionId}/breakouts/${breakoutId}`, { method: "DELETE" });
      await loadBreakouts();
    } catch (err) {
      setBreakoutError((err as Error).message);
    }
  }

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

  async function markAttendance(userId: string, newStatus: AttendanceStatus) {
    try {
      await api(`/attendance/sessions/${sessionId}`, {
        method: "POST",
        body: JSON.stringify({ entries: [{ userId, status: newStatus }] }),
      });
      await loadAttendance();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const isTeacher = viewerSub !== null && viewerSub === teacherId;

  return (
    <main className="mx-auto max-w-6xl px-6 pb-24 pt-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Classroom</p>
          <h1 className="mt-1 font-display text-3xl text-ink">Classroom · <span className="font-mono text-2xl">{sessionId}</span></h1>
        </div>
        <div className="flex items-center gap-2">
          {classroomId && (
            <Link
              href={`/whiteboard/${classroomId}` as never}
              target="_blank"
              className="btn-secondary"
            >
              Whiteboard
            </Link>
          )}
          {isTeacher && (
            <button
              onClick={toggleRecording}
              disabled={status !== "joined"}
              className={recording ? "btn-seal" : "btn-secondary"}
            >
              {recording ? "Stop recording" : "Start recording"}
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm text-ink-soft">Status: {status}</p>
      {error && <p className="mt-2 text-sm text-seal">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="aspect-video w-full overflow-hidden rounded-md bg-ink/90">
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted />
        </div>

        <div className="card flex h-[480px] flex-col">
          <div className="flex-1 overflow-y-auto p-3">
            {chat.length === 0 && <p className="text-sm text-ink-soft">No messages yet.</p>}
            {chat.map((m, i) => (
              <div key={i} className="mb-2">
                <div className="text-xs text-ink-faded">{m.senderId}</div>
                <div className="text-sm text-ink">{m.body}</div>
              </div>
            ))}
          </div>
          <div className="border-t border-ink-faded/30 p-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex gap-2"
            >
              <input
                className="input flex-1"
                placeholder="Type a message..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={status !== "joined"}
              />
              <button
                type="submit"
                className="btn-seal"
                disabled={status !== "joined" || !draft.trim()}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>

      {isTeacher && attendance && (
        <section className="mt-10">
          <h2 className="font-display text-xl text-ink">Attendance</h2>
          <p className="mt-1 text-xs text-ink-faded">
            Students are auto-marked present when they join. Override below.
          </p>
          {attendance.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">No students have joined yet.</p>
          ) : (
            <ul className="card mt-4 divide-y divide-ink-faded/30">
              {attendance.map((a) => (
                <li key={a.userId} className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-display text-base text-ink">{a.user?.displayName ?? a.userId}</div>
                    <div className="text-xs text-ink-faded">
                      {a.user?.email ?? ""} · marked {new Date(a.markedAt).toLocaleString()}
                    </div>
                  </div>
                  <select
                    value={a.status}
                    onChange={(e) => markAttendance(a.userId, e.target.value as AttendanceStatus)}
                    className="input max-w-[8rem]"
                  >
                    {ATTENDANCE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">My notes</h2>
        <p className="mt-1 text-xs text-ink-faded">
          Private to you. Use this space to capture key learning points during the session.
        </p>
        <textarea
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          rows={6}
          maxLength={20000}
          className="input mt-3"
          placeholder="Write your notes here..."
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-ink-faded">
            {noteSaved ? "Saved." : noteBody.length > 0 ? "Unsaved" : ""}
          </span>
          <button
            onClick={saveNote}
            disabled={noteSaving}
            className="btn-seal"
          >
            {noteSaving ? "Saving..." : "Save notes"}
          </button>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">Breakout rooms</h2>
        <p className="mt-1 text-xs text-ink-faded">
          {isTeacher
            ? "Split the class into smaller groups. Each breakout is a separate video room; students you assign can join from here."
            : "If the teacher assigns you to a breakout, click Join to move there."}
        </p>

        {isTeacher && (
          <form onSubmit={createBreakout} className="mt-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <input
              value={newBreakoutLabel}
              onChange={(e) => setNewBreakoutLabel(e.target.value)}
              placeholder="Room label (e.g. Group A)"
              maxLength={60}
              className="input"
            />
            <input
              value={newBreakoutAssignees}
              onChange={(e) => setNewBreakoutAssignees(e.target.value)}
              placeholder="Assigned student IDs (comma-separated)"
              className="input font-mono"
            />
            <button
              type="submit"
              disabled={!newBreakoutLabel.trim()}
              className="btn-seal"
            >
              Create breakout
            </button>
          </form>
        )}

        {breakoutError && <p className="mt-2 text-sm text-seal">{breakoutError}</p>}

        {breakouts && breakouts.length === 0 && (
          <p className="mt-4 text-sm text-ink-soft">No breakouts yet.</p>
        )}

        {breakouts && breakouts.length > 0 && (
          <ul className="card mt-4 divide-y divide-ink-faded/30">
            {breakouts.map((b) => {
              const canJoin = isTeacher || (viewerSub && b.assignedUserIds.includes(viewerSub));
              return (
                <li key={b.breakoutId} className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-display text-base text-ink">{b.label}</div>
                    <div className="text-xs text-ink-faded">
                      {b.assignedUserIds.length} assigned · created{" "}
                      {new Date(b.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canJoin && (
                      <Link
                        href={`/breakout/${sessionId}/${b.breakoutId}`}
                        target="_blank"
                        className="btn-secondary"
                      >
                        Join
                      </Link>
                    )}
                    {isTeacher && (
                      <button
                        onClick={() => endBreakout(b.breakoutId)}
                        className="btn-ghost text-seal"
                      >
                        End
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <audio ref={audioRef} />
    </main>
  );
}
