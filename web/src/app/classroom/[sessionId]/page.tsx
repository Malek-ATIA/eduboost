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

type JoinResponse = { meeting: unknown; attendee: unknown };
type SessionResponse = { sessionId: string; classroomId: string; teacherId: string; status: string };
type ChatEntry = { senderId: string; body: string; at: string };
type AttendanceItem = {
  sessionId: string;
  userId: string;
  status: "present" | "absent" | "excused" | "late";
  markedAt: string;
  notes?: string;
  user?: { userId: string; displayName: string; email: string } | null;
};
type BreakoutRoom = {
  sessionId: string;
  breakoutId: string;
  label: string;
  chimeMeetingId: string;
  createdBy: string;
  assignedUserIds: string[];
  createdAt: string;
};

const ATTENDANCE_STATUSES = ["present", "late", "absent", "excused"] as const;
type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
const CHAT_TOPIC = "classroom-chat";

type Panel = "chat" | "participants" | "notes" | "breakouts" | null;

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "bg-emerald-400",
  late: "bg-amber-400",
  absent: "bg-red-400",
  excused: "bg-slate-400",
};

export default function ClassroomPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<DefaultMeetingSession | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
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
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const joinedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== "joined") return;
    joinedAtRef.current = Date.now();
    const t = setInterval(() => {
      if (joinedAtRef.current) setElapsed(Math.floor((Date.now() - joinedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ body?: string }>(`/notes/sessions/${sessionId}`);
        setNoteBody(r.body ?? "");
      } catch { /* not a participant yet */ }
    })();
  }, [sessionId]);

  async function saveNote() {
    setNoteSaving(true);
    setNoteSaved(false);
    try {
      await api(`/notes/sessions/${sessionId}`, { method: "PUT", body: JSON.stringify({ body: noteBody }) });
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
    } catch (err) { console.warn("breakouts load failed", err); }
  }, [sessionId]);

  const loadAttendance = useCallback(async () => {
    try {
      const r = await api<{ items: AttendanceItem[] }>(`/attendance/sessions/${sessionId}`);
      setAttendance(r.items);
    } catch (err) { console.warn("attendance load failed", err); }
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
        const { meeting, attendee } = await api<JoinResponse>(`/chime/sessions/${sessionId}/join`, { method: "POST" });
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
          setChat((prev) => [...prev, { senderId: msg.senderAttendeeId, body, at: new Date(msg.timestampMs).toISOString() }]);
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
    return () => { cancelled = true; sessionRef.current?.audioVideo.stop(); };
  }, [sessionId, loadAttendance, loadBreakouts]);

  async function createBreakout(e: React.FormEvent) {
    e.preventDefault();
    setBreakoutError(null);
    const label = newBreakoutLabel.trim();
    if (!label) return;
    const assignedUserIds = newBreakoutAssignees.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      await api(`/chime/sessions/${sessionId}/breakouts`, { method: "POST", body: JSON.stringify({ label, assignedUserIds }) });
      setNewBreakoutLabel("");
      setNewBreakoutAssignees("");
      await loadBreakouts();
    } catch (err) { setBreakoutError((err as Error).message); }
  }

  async function endBreakout(breakoutId: string) {
    if (!confirm("End this breakout and disconnect participants?")) return;
    try {
      await api(`/chime/sessions/${sessionId}/breakouts/${breakoutId}`, { method: "DELETE" });
      await loadBreakouts();
    } catch (err) { setBreakoutError((err as Error).message); }
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
      await api(`/chat/classroom/${classroomId}`, { method: "POST", body: JSON.stringify({ body }) });
    } catch (err) { console.warn("chat persistence failed", err); }
  }

  async function toggleRecording() {
    const path = recording ? "stop" : "start";
    try {
      await api(`/chime/sessions/${sessionId}/recording/${path}`, { method: "POST" });
      setRecording(!recording);
    } catch (err) { setError((err as Error).message); }
  }

  async function markAttendance(userId: string, newStatus: AttendanceStatus) {
    try {
      await api(`/attendance/sessions/${sessionId}`, { method: "POST", body: JSON.stringify({ entries: [{ userId, status: newStatus }] }) });
      await loadAttendance();
    } catch (err) { alert((err as Error).message); }
  }

  function togglePanel(panel: Panel) {
    setActivePanel((cur) => (cur === panel ? null : panel));
  }

  const isTeacher = viewerSub !== null && viewerSub === teacherId;
  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");
  const participantCount = attendance?.length ?? 0;

  if (status === "idle" || status === "joining") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a2e]">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white/80" />
          <p className="mt-6 font-display text-xl text-white/90">Joining session...</p>
          <p className="mt-2 text-sm text-white/50">Connecting to classroom</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1a1a2e] px-6">
        <div className="rounded-2xl bg-white/10 p-10 text-center backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
            <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="mt-4 font-display text-xl text-white">Unable to join</h2>
          <p className="mt-2 max-w-sm text-sm text-white/60">{error}</p>
          <Link href="/classrooms" className="mt-6 inline-block rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-white/20">
            Back to classrooms
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1a2e] text-white">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-5">
        <div className="flex items-center gap-3">
          <Link href="/classrooms" className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            EduBoost
          </Link>
          <div className="h-5 w-px bg-white/20" />
          <span className="text-sm font-medium text-white/90">Live Session</span>
        </div>

        <div className="flex items-center gap-3">
          {recording && (
            <div className="flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1">
              <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-xs font-medium text-red-400">REC</span>
            </div>
          )}
          <div className="rounded-lg bg-white/10 px-3 py-1 font-mono text-sm text-white/70">
            {mins}:{secs}
          </div>
          {participantCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1 text-sm text-white/70">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {participantCount}
            </div>
          )}
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────── */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Video area */}
        <div className={`flex flex-1 flex-col items-center justify-center p-4 transition-all duration-300 ${activePanel ? "mr-[380px]" : ""}`}>
          <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl bg-[#0f0f23] shadow-2xl shadow-black/50">
            <div className="aspect-video">
              <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted />
            </div>
            {status === "joined" && (
              <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur-sm">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-medium text-white/90">You</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Slide-out panel ──────────────────────────────────── */}
        {activePanel && (
          <div className="absolute inset-y-0 right-0 flex w-[380px] flex-col border-l border-white/10 bg-[#16162a]">
            {/* Panel header */}
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
              <h3 className="text-sm font-semibold capitalize text-white/90">
                {activePanel === "participants" ? `Participants (${participantCount})` : activePanel}
              </h3>
              <button onClick={() => setActivePanel(null)} className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* ── Chat panel ──────────────────────────────────── */}
            {activePanel === "chat" && (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  {chat.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                        <svg className="h-6 w-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      </div>
                      <p className="mt-3 text-sm text-white/40">No messages yet</p>
                      <p className="mt-1 text-xs text-white/25">Start the conversation</p>
                    </div>
                  )}
                  {chat.map((m, i) => (
                    <div key={i} className="mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${m.senderId === "me" ? "bg-indigo-500" : "bg-white/20"}`}>
                          {m.senderId === "me" ? "Y" : m.senderId.slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-white/70">{m.senderId === "me" ? "You" : m.senderId.slice(0, 8)}</span>
                        <span className="text-[10px] text-white/30">{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="mt-1 pl-8 text-sm leading-relaxed text-white/85">{m.body}</p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="border-t border-white/10 p-3">
                  <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                    <input
                      className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition focus:ring-indigo-500/50"
                      placeholder="Type a message..."
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      disabled={status !== "joined"}
                    />
                    <button type="submit" disabled={status !== "joined" || !draft.trim()} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-40">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                  </form>
                </div>
              </>
            )}

            {/* ── Participants panel ──────────────────────────── */}
            {activePanel === "participants" && (
              <div className="flex-1 overflow-y-auto p-4">
                {(!attendance || attendance.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                      <svg className="h-6 w-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <p className="mt-3 text-sm text-white/40">No participants yet</p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {attendance.map((a) => (
                      <li key={a.userId} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-white/5">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white/80">
                              {(a.user?.displayName ?? a.userId).slice(0, 1).toUpperCase()}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#16162a] ${STATUS_COLORS[a.status]}`} />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white/90">{a.user?.displayName ?? a.userId.slice(0, 12)}</div>
                            <div className="text-[11px] text-white/40">{a.status}</div>
                          </div>
                        </div>
                        {isTeacher && (
                          <select
                            value={a.status}
                            onChange={(e) => markAttendance(a.userId, e.target.value as AttendanceStatus)}
                            className="rounded-md bg-white/10 px-2 py-1 text-xs text-white/70 outline-none"
                          >
                            {ATTENDANCE_STATUSES.map((s) => (<option key={s} value={s} className="bg-[#16162a]">{s}</option>))}
                          </select>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* ── Notes panel ────────────────────────────────── */}
            {activePanel === "notes" && (
              <div className="flex flex-1 flex-col p-4">
                <p className="mb-3 text-xs text-white/40">Private notes — only you can see these.</p>
                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  rows={12}
                  maxLength={20000}
                  className="flex-1 resize-none rounded-lg bg-white/5 p-3 text-sm leading-relaxed text-white/85 placeholder-white/25 outline-none ring-1 ring-white/10 transition focus:ring-indigo-500/50"
                  placeholder="Capture key learning points..."
                />
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-white/40">{noteSaved ? "Saved" : noteBody.length > 0 ? `${noteBody.length.toLocaleString()} chars` : ""}</span>
                  <button onClick={saveNote} disabled={noteSaving} className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-600 disabled:opacity-40">
                    {noteSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Breakout rooms panel ───────────────────────── */}
            {activePanel === "breakouts" && (
              <div className="flex-1 overflow-y-auto p-4">
                {isTeacher && (
                  <form onSubmit={createBreakout} className="mb-4 space-y-2">
                    <input
                      value={newBreakoutLabel}
                      onChange={(e) => setNewBreakoutLabel(e.target.value)}
                      placeholder="Room label (e.g. Group A)"
                      maxLength={60}
                      className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition focus:ring-indigo-500/50"
                    />
                    <input
                      value={newBreakoutAssignees}
                      onChange={(e) => setNewBreakoutAssignees(e.target.value)}
                      placeholder="Student IDs (comma-separated)"
                      className="w-full rounded-lg bg-white/10 px-3 py-2 font-mono text-sm text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition focus:ring-indigo-500/50"
                    />
                    <button type="submit" disabled={!newBreakoutLabel.trim()} className="w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-40">
                      Create breakout
                    </button>
                  </form>
                )}
                {breakoutError && <p className="mb-3 text-xs text-red-400">{breakoutError}</p>}
                {breakouts && breakouts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                      <svg className="h-6 w-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    </div>
                    <p className="mt-3 text-sm text-white/40">No breakout rooms</p>
                    {isTeacher && <p className="mt-1 text-xs text-white/25">Create one above to split the class</p>}
                  </div>
                )}
                {breakouts && breakouts.length > 0 && (
                  <ul className="space-y-2">
                    {breakouts.map((b) => {
                      const canJoin = isTeacher || (viewerSub && b.assignedUserIds.includes(viewerSub));
                      return (
                        <li key={b.breakoutId} className="rounded-xl bg-white/5 p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-white/90">{b.label}</div>
                              <div className="mt-0.5 text-[11px] text-white/40">{b.assignedUserIds.length} assigned</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {canJoin && (
                                <Link href={`/breakout/${sessionId}/${b.breakoutId}`} target="_blank" className="rounded-lg bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/30">
                                  Join
                                </Link>
                              )}
                              {isTeacher && (
                                <button onClick={() => endBreakout(b.breakoutId)} className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/30">
                                  End
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom toolbar ──────────────────────────────────────── */}
      <div className="flex h-20 shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-[#12122a] px-6">
        {/* Mic toggle */}
        <ToolbarButton
          active={micOn}
          onClick={() => setMicOn(!micOn)}
          label={micOn ? "Mute" : "Unmute"}
          icon={micOn
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            : <><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" /></>
          }
          danger={!micOn}
        />

        {/* Camera toggle */}
        <ToolbarButton
          active={camOn}
          onClick={() => setCamOn(!camOn)}
          label={camOn ? "Stop video" : "Start video"}
          icon={camOn
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" /></>
          }
          danger={!camOn}
        />

        <div className="mx-1 h-8 w-px bg-white/15" />

        {/* Whiteboard */}
        {classroomId && (
          <ToolbarButton
            onClick={() => window.open(`/whiteboard/${classroomId}`, "_blank")}
            label="Whiteboard"
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />}
          />
        )}

        {/* Record (teacher only) */}
        {isTeacher && (
          <ToolbarButton
            active={recording}
            onClick={toggleRecording}
            label={recording ? "Stop recording" : "Record"}
            icon={<circle cx="12" cy="12" r="5" fill={recording ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} />}
            danger={recording}
          />
        )}

        <div className="mx-1 h-8 w-px bg-white/15" />

        {/* Chat */}
        <ToolbarButton
          active={activePanel === "chat"}
          onClick={() => togglePanel("chat")}
          label="Chat"
          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />}
          badge={chat.length > 0 ? chat.length : undefined}
        />

        {/* Participants */}
        <ToolbarButton
          active={activePanel === "participants"}
          onClick={() => togglePanel("participants")}
          label="Participants"
          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />}
          badge={participantCount > 0 ? participantCount : undefined}
        />

        {/* Notes */}
        <ToolbarButton
          active={activePanel === "notes"}
          onClick={() => togglePanel("notes")}
          label="Notes"
          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />}
        />

        {/* Breakout rooms */}
        <ToolbarButton
          active={activePanel === "breakouts"}
          onClick={() => togglePanel("breakouts")}
          label="Breakouts"
          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />}
        />

        <div className="mx-1 h-8 w-px bg-white/15" />

        {/* Leave */}
        <button
          onClick={() => { sessionRef.current?.audioVideo.stop(); window.location.href = "/classrooms"; }}
          className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition hover:bg-red-600"
        >
          Leave
        </button>
      </div>

      <audio ref={audioRef} />
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  active,
  danger,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  badge?: number;
}) {
  return (
    <div className="group relative flex flex-col items-center">
      <button
        onClick={onClick}
        className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition ${
          danger
            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
            : active
              ? "bg-indigo-500/20 text-indigo-400"
              : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
        }`}
        aria-label={label}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          {icon}
        </svg>
        {badge !== undefined && badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
      <span className="mt-1 text-[10px] text-white/40 opacity-0 transition group-hover:opacity-100">{label}</span>
    </div>
  );
}
