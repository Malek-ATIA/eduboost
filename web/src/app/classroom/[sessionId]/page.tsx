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
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { Avatar } from "@/components/Avatar";
import {
  X,
  Settings,
  Pen,
  Monitor,
  FileText,
  BookOpen,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share2,
  Hand,
  MessageCircle,
  MoreHorizontal,
  Send,
  Plus,
  Users,
} from "lucide-react";

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

type ActiveTool = "whiteboard" | "screenshare" | "notes" | "quiz";

export default function ClassroomPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const { toast } = useToast();
  const { confirm: showConfirm } = useDialog();
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
  const [showChat, setShowChat] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>("whiteboard");
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
      toast((err as Error).message, "error");
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
    const yes = await showConfirm({ title: "End breakout", message: "End this breakout and disconnect participants?", destructive: true, confirmLabel: "End breakout" });
    if (!yes) return;
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
    } catch (err) { toast((err as Error).message, "error"); }
  }

  const isTeacher = viewerSub !== null && viewerSub === teacherId;
  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");
  const participantCount = attendance?.length ?? 0;

  if (status === "idle" || status === "joining") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "#0c0e10", fontFamily: "Geist, sans-serif" }}>
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white/80" />
          <p className="mt-6 font-bold text-lg text-white/90">Joining session...</p>
          <p className="mt-2 text-sm text-white/50">Connecting to classroom</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6" style={{ background: "#0c0e10" }}>
        <div className="rounded-2xl p-10 text-center" style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(227,76,76,0.2)" }}>
            <X size={32} style={{ color: "#ff7a72" }} />
          </div>
          <h2 className="mt-4 font-bold text-lg text-white">Unable to join</h2>
          <p className="mt-2 max-w-sm text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{error}</p>
          <Link href="/classrooms" className="mt-6 inline-block rounded-lg px-6 py-2.5 text-sm font-medium text-white transition" style={{ background: "rgba(255,255,255,0.1)" }}>
            Back to classrooms
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0c0e10", color: "#e8e8e6", fontFamily: "Geist, sans-serif" }}>
      {/* ── Top bar ── */}
      <header className="flex shrink-0 items-center gap-4 px-[18px]" style={{ height: 56, borderBottom: "1px solid #1a1d20" }}>
        <button
          onClick={() => { sessionRef.current?.audioVideo.stop(); window.location.href = "/classrooms"; }}
          className="inline-flex items-center gap-2 text-[13px]"
          style={{ color: "#9aa0a6" }}
        >
          <X size={16} /> Leave
        </button>

        <div className="ml-3.5 flex items-center gap-2">
          {recording && (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#e34c4c" }} />
              <span className="font-mono text-xs tracking-wider" style={{ color: "#9aa0a6" }}>REC · {mins}:{secs}</span>
            </>
          )}
          {!recording && (
            <span className="font-mono text-xs tracking-wider" style={{ color: "#9aa0a6" }}>{mins}:{secs}</span>
          )}
        </div>

        <div className="ml-4 text-[13.5px]">
          <strong style={{ fontWeight: 500, color: "#e8e8e6" }}>Live Session</strong>
          <span className="ml-2.5" style={{ color: "#7c8086" }}>#{sessionId.slice(0, 8)}</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="rounded-full px-2.5 py-1 font-mono text-[11.5px] tracking-wider" style={{ background: "#1a1d20", color: "#9aa0a6" }}>
            {participantCount} in classroom
          </span>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#1a1d20", color: "#9aa0a6" }}>
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* ── Body: 3-column grid ── */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left rail: tools + participants + files */}
        <aside className="flex w-[260px] shrink-0 flex-col gap-3.5 overflow-y-auto p-3.5" style={{ borderRight: "1px solid #1a1d20" }}>
          <div>
            <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.12em]" style={{ color: "#6b7079" }}>Tools</div>
            <div className="flex flex-col gap-1">
              {([
                { k: "whiteboard" as ActiveTool, icon: <Pen size={15} />, label: "Whiteboard" },
                { k: "screenshare" as ActiveTool, icon: <Monitor size={15} />, label: "Screen share" },
                { k: "notes" as ActiveTool, icon: <FileText size={15} />, label: "Notes" },
                { k: "quiz" as ActiveTool, icon: <BookOpen size={15} />, label: "Quiz" },
              ]).map((o) => (
                <button
                  key={o.k}
                  onClick={() => setActiveTool(o.k)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px]"
                  style={{
                    background: activeTool === o.k ? "#1f2226" : "transparent",
                    color: activeTool === o.k ? "#fff" : "#9aa0a6",
                    border: activeTool === o.k ? "1px solid #2a2e34" : "1px solid transparent",
                  }}
                >
                  {o.icon} {o.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #1a1d20", paddingTop: 14 }}>
            <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.12em]" style={{ color: "#6b7079" }}>Participants</div>
            {attendance && attendance.length > 0 ? (
              attendance.map((a) => (
                <div key={a.userId} className="flex items-center gap-2.5 py-2">
                  <Avatar userId={a.userId} size="sm" initial={a.user?.displayName} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]" style={{ color: "#e8e8e6" }}>
                      {a.user?.displayName ?? a.userId.slice(0, 12)}
                    </div>
                    <div className="text-[11px]" style={{ color: "#7c8086" }}>{a.status}</div>
                  </div>
                  {isTeacher && (
                    <select
                      value={a.status}
                      onChange={(e) => markAttendance(a.userId, e.target.value as AttendanceStatus)}
                      className="rounded-md px-1.5 py-0.5 text-[11px] outline-none"
                      style={{ background: "#1a1d20", color: "#9aa0a6" }}
                    >
                      {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  {handRaised && a.userId === viewerSub && (
                    <Hand size={14} style={{ color: "#e0a83a" }} />
                  )}
                  {micOn ? <Mic size={13} style={{ color: "#7c8086" }} /> : <MicOff size={13} style={{ color: "#e34c4c" }} />}
                </div>
              ))
            ) : (
              <p className="text-xs" style={{ color: "#7c8086" }}>Waiting for participants...</p>
            )}
          </div>

          <div style={{ borderTop: "1px solid #1a1d20", paddingTop: 14 }}>
            <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.12em]" style={{ color: "#6b7079" }}>Session files</div>
            <div className="flex flex-col gap-1.5">
              {["Formula sheet.pdf", "Exercises 1.2 – 1.8.pdf", "Last week's recording"].map((f) => (
                <a key={f} className="flex cursor-pointer items-center gap-2 truncate rounded-md px-2 py-1.5 text-xs transition hover:bg-[#1a1d20]" style={{ color: "#bcc0c5" }}>
                  <BookOpen size={13} /> <span className="truncate">{f}</span>
                </a>
              ))}
              <button className="mt-1 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs" style={{ border: "1px dashed #2a2e34", color: "#9aa0a6" }}>
                <Plus size={13} /> Add a file
              </button>
            </div>
          </div>
        </aside>

        {/* Stage */}
        <div className="relative flex-1 overflow-hidden" style={{ background: "#15171a" }}>
          {/* Whiteboard surface */}
          <div className="absolute inset-4 flex flex-col overflow-hidden rounded-[10px]" style={{ background: "#fafaf9", color: "#15171a" }}>
            {activeTool === "whiteboard" && (
              <>
                <div className="flex items-center gap-2.5 border-b px-4 py-3" style={{ borderColor: "#e8e6e0" }}>
                  <span className="font-mono text-[11px]" style={{ color: "#76787c" }}>WHITEBOARD</span>
                  <div className="ml-auto flex gap-1">
                    {[
                      <Pen key="pen" size={13} />,
                      <span key="a" className="font-bold">A</span>,
                      <span key="int" className="font-mono">∫</span>,
                      <Share2 key="share" size={13} />,
                    ].map((ic, i) => (
                      <button key={i} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[13px]" style={{
                        background: i === 0 ? "#1f4a3a" : "transparent",
                        color: i === 0 ? "#fff" : "#5a5e64",
                      }}>{ic}</button>
                    ))}
                  </div>
                </div>
                <div className="flex-1" style={{
                  background: "linear-gradient(#fafaf9, #fafaf9), repeating-linear-gradient(0deg, #ececea 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, #ececea 0 1px, transparent 1px 24px)",
                  backgroundBlendMode: "multiply",
                }} />
              </>
            )}
            {activeTool === "notes" && (
              <div className="flex-1 overflow-auto p-7">
                <div className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "#76787c" }}>Shared notes · live edit</div>
                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  className="mt-4 w-full flex-1 resize-none text-[15.5px] leading-relaxed outline-none"
                  style={{ fontFamily: "Newsreader, serif", color: "#2a2d31", minHeight: 300 }}
                  placeholder="Start typing session notes..."
                />
                <div className="mt-4 flex items-center justify-end gap-2">
                  {noteSaved && <span className="text-xs" style={{ color: "#76787c" }}>Saved</span>}
                  <button onClick={saveNote} disabled={noteSaving} className="rounded-lg px-4 py-2 text-xs font-medium text-white" style={{ background: "#1f4a3a" }}>
                    {noteSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            )}
            {activeTool === "screenshare" && (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <Monitor size={48} style={{ color: "#d8d5cf" }} className="mx-auto" />
                  <p className="mt-3 text-sm" style={{ color: "#76787c" }}>Click "Share screen" in the toolbar to start</p>
                </div>
              </div>
            )}
            {activeTool === "quiz" && (
              <div className="flex-1 overflow-auto p-8" style={{ maxWidth: 720 }}>
                <div className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "#76787c" }}>Quick check</div>
                <h2 className="mt-3 font-bold text-[28px]" style={{ color: "#15171a" }}>Quiz mode coming soon</h2>
                <p className="mt-2 text-sm" style={{ color: "#76787c" }}>The teacher can start a live quiz from their controls.</p>
              </div>
            )}
          </div>

          {/* PiP self-view */}
          <div className="absolute bottom-6 right-7 overflow-hidden rounded-xl shadow-2xl" style={{ width: 220, aspectRatio: "4/3", background: "#0c0e10", border: "1px solid #2a2e34" }}>
            <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted />
            {!camOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: "#9aa0a6" }}>
                <VideoOff size={24} />
                <span className="text-xs">Camera off</span>
              </div>
            )}
            <div className="absolute bottom-1.5 left-2 rounded px-1.5 py-0.5 font-mono text-[11px] text-white" style={{ background: "rgba(0,0,0,0.45)" }}>YOU</div>
            {!micOn && (
              <div className="absolute right-2 top-2 flex h-[22px] w-[22px] items-center justify-center rounded-full" style={{ background: "#e34c4c" }}>
                <MicOff size={12} className="text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Right: chat panel */}
        {showChat && (
          <aside className="flex w-[320px] shrink-0 flex-col" style={{ borderLeft: "1px solid #1a1d20", minHeight: 0 }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #1a1d20" }}>
              <span className="text-[13px] font-medium">Chat</span>
              <button onClick={() => setShowChat(false)} style={{ color: "#7c8086" }}><X size={14} /></button>
            </div>

            <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-3.5">
              {chat.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center" style={{ color: "#7c8086" }}>
                  <MessageCircle size={24} className="mb-2" />
                  <p className="text-sm">No messages yet</p>
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className="flex flex-col" style={{ alignItems: m.senderId === "me" ? "flex-end" : "flex-start" }}>
                  <div className="mb-1 text-[11px]" style={{ color: "#7c8086" }}>
                    {m.senderId === "me" ? "You" : m.senderId.slice(0, 8)} · {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div
                    className="rounded-xl px-3 py-2 text-[13.5px] leading-snug"
                    style={{
                      maxWidth: "82%",
                      background: m.senderId === "me" ? "#1f4a3a" : "#1a1d20",
                      color: m.senderId === "me" ? "#fff" : "#e8e8e6",
                    }}
                  >
                    {m.body}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2 p-3" style={{ borderTop: "1px solid #1a1d20" }}>
              <input
                placeholder="Message everyone…"
                className="flex-1 rounded-lg px-3 py-2.5 text-[13.5px] outline-none"
                style={{ background: "#1a1d20", border: "1px solid #2a2e34", color: "#e8e8e6" }}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                disabled={status !== "joined"}
              />
              <button
                onClick={sendMessage}
                disabled={status !== "joined" || !draft.trim()}
                className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg text-white disabled:opacity-40"
                style={{ background: "#1f4a3a" }}
              >
                <Send size={14} />
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* ── Bottom control bar ── */}
      <div className="flex shrink-0 items-center justify-center gap-3 px-[18px]" style={{ height: 76, borderTop: "1px solid #1a1d20" }}>
        <CtrlBtn icon={micOn ? <Mic size={18} /> : <MicOff size={18} />} label={micOn ? "Mute" : "Unmute"} active={micOn} danger={!micOn} onClick={() => setMicOn((v) => !v)} />
        <CtrlBtn icon={camOn ? <Video size={18} /> : <VideoOff size={18} />} label={camOn ? "Camera" : "Camera off"} active={camOn} danger={!camOn} onClick={() => setCamOn((v) => !v)} />
        <CtrlBtn icon={<Share2 size={18} />} label="Share screen" onClick={() => setActiveTool("screenshare")} />
        <CtrlBtn icon={<Hand size={18} />} label={handRaised ? "Lower hand" : "Raise hand"} active={handRaised} onClick={() => setHandRaised((v) => !v)} />
        <CtrlBtn icon={<MessageCircle size={18} />} label="Chat" active={showChat} onClick={() => setShowChat((v) => !v)} />
        {isTeacher && <CtrlBtn icon={<Users size={18} />} label="Breakouts" onClick={() => {}} />}
        {isTeacher && (
          <CtrlBtn icon={<div className={`h-3 w-3 rounded-full border-2 ${recording ? "border-red-400 bg-red-400" : "border-current"}`} />} label={recording ? "Stop rec" : "Record"} danger={recording} onClick={toggleRecording} />
        )}
        <CtrlBtn icon={<MoreHorizontal size={18} />} label="More" onClick={() => {}} />

        <div className="flex-1" />
        <button
          onClick={() => { sessionRef.current?.audioVideo.stop(); window.location.href = "/classrooms"; }}
          className="rounded-full px-5 py-2.5 text-sm font-medium text-white"
          style={{ background: "#b2362c" }}
        >
          Leave session
        </button>
      </div>

      <audio ref={audioRef} />
    </div>
  );
}

function CtrlBtn({
  icon,
  label,
  active,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="inline-flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2"
      style={{
        background: danger ? "#3a1715" : active ? "#1f2226" : "transparent",
        color: danger ? "#ff7a72" : active ? "#fff" : "#9aa0a6",
        border: `1px solid ${danger ? "#5a1f1c" : active ? "#2a2e34" : "transparent"}`,
      }}
    >
      {icon}
      <span className="text-[11px]">{label}</span>
    </button>
  );
}
