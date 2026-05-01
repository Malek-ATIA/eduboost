"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Resource = {
  url: string;
  label: string;
  kind: "drive" | "docs" | "slides" | "sheets" | "video" | "other";
};

type Classroom = {
  classroomId: string;
  teacherId: string;
  title: string;
  subject: string;
  description?: string;
  maxStudents?: number;
  status: string;
  chatEnabled?: boolean;
  resources?: Resource[];
};

type Member = {
  userId: string;
  role: "teacher" | "student" | "observer";
  joinedAt: string;
  displayName?: string;
  email?: string;
};

type SessionRow = {
  sessionId: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "live" | "completed" | "cancelled";
  hasRecording: boolean;
};

const KIND_LABELS: Record<Resource["kind"], string> = {
  drive: "Drive",
  docs: "Docs",
  slides: "Slides",
  sheets: "Sheets",
  video: "Video",
  other: "Link",
};

export default function ClassroomInfoPage({
  params,
}: {
  params: Promise<{ classroomId: string }>;
}) {
  const { classroomId } = use(params);
  const router = useRouter();
  const [sub, setSub] = useState<string | null>(null);
  const [data, setData] = useState<Classroom | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"student" | "observer">("student");
  const [memberBusy, setMemberBusy] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<Classroom>(`/classrooms/${classroomId}`);
      setData(r);
      setResources(r.resources ?? []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [classroomId]);

  const loadSessions = useCallback(async () => {
    try {
      const r = await api<{ items: SessionRow[] }>(`/classrooms/${classroomId}/sessions`);
      setSessions(r.items);
    } catch {
      // Non-members get 403; show nothing for sessions in that case.
      setSessions([]);
    }
  }, [classroomId]);

  const loadMembers = useCallback(async () => {
    try {
      const r = await api<{ items: Member[] }>(`/classrooms/${classroomId}/members`);
      setMembers(r.items);
    } catch (err) {
      // 403 for strangers is expected; swallow silently so the rest of the
      // page still renders useful info for classroom detail views shared
      // externally (e.g. a student landing here from a calendar link).
      const msg = (err as Error).message;
      if (!msg.includes("403") && !msg.includes("forbidden")) {
        console.warn("loadMembers failed:", msg);
      }
      setMembers([]);
    }
  }, [classroomId]);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      setSub((s.getIdToken().payload.sub as string) ?? null);
      await load();
      await Promise.all([loadMembers(), loadSessions()]);
    })();
  }, [router, load, loadMembers, loadSessions]);

  async function toggleChat() {
    if (!data) return;
    setChatBusy(true);
    try {
      await api(`/classrooms/${classroomId}`, {
        method: "PATCH",
        body: JSON.stringify({ chatEnabled: !(data.chatEnabled ?? true) }),
      });
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setChatBusy(false);
    }
  }

  async function downloadRecording(sessionId: string) {
    try {
      const r = await api<{ url: string }>(
        `/classrooms/${classroomId}/sessions/${sessionId}/recording-url`,
      );
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;
    setMemberBusy(true);
    setMemberError(null);
    try {
      await api(`/classrooms/${classroomId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: newMemberEmail.trim(), role: newMemberRole }),
      });
      setNewMemberEmail("");
      await loadMembers();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("user_not_found"))
        setMemberError("No user with that email. Ask them to sign up first.");
      else if (msg.includes("already_member"))
        setMemberError("Already in this classroom.");
      else if (msg.includes("classroom_full"))
        setMemberError("Classroom is at capacity.");
      else if (msg.includes("cannot_add_self"))
        setMemberError("You can't add yourself — you're already the teacher.");
      else setMemberError(msg);
    } finally {
      setMemberBusy(false);
    }
  }

  async function removeMember(userId: string) {
    if (!confirm("Remove this member from the classroom?")) return;
    try {
      await api(`/classrooms/${classroomId}/members/${userId}`, { method: "DELETE" });
      await loadMembers();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/classrooms/${classroomId}/resources`, {
        method: "PUT",
        body: JSON.stringify({ resources }),
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function addRow() {
    if (resources.length >= 25) return;
    setResources([...resources, { url: "", label: "", kind: "other" }]);
  }

  function updateRow(i: number, patch: Partial<Resource>) {
    setResources(resources.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRow(i: number) {
    setResources(resources.filter((_, idx) => idx !== i));
  }

  if (error && !data) {
    return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-sm text-seal">{error}</main>;
  }
  if (!data) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  const isTeacher = sub !== null && sub === data.teacherId;

  const chatOn = data.chatEnabled ?? true;
  const lastLive = sessions?.find((s) => s.status === "live" || s.status === "scheduled");
  const completedSessions = sessions?.filter(
    (s) => s.status === "completed" || s.hasRecording,
  ) ?? [];

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Classroom</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">{data.title}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {data.subject} · status {data.status} ·{" "}
            <span className="font-mono text-xs">{data.classroomId}</span>
          </p>
        </div>
        {lastLive && (
          <Link
            href={`/classroom/${lastLive.sessionId}` as never}
            className="btn-seal shrink-0"
          >
            {lastLive.status === "live" ? "Join live" : "Join session"}
          </Link>
        )}
      </div>
      {data.description && (
        <p className="mt-4 text-sm text-ink">{data.description}</p>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl text-ink">Classroom features</h2>
        <p className="mt-1 text-xs text-ink-faded">
          Everything this course supports — chat, whiteboard, breakouts, notes, and recordings.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureTile
            href={`/classroom-chat/${data.classroomId}` as never}
            label="Group chat"
            description={chatOn ? "Moderated by the teacher" : "Disabled by the teacher"}
            muted={!chatOn}
          />
          <FeatureTile
            href={`/whiteboard/${data.classroomId}` as never}
            label="Whiteboard"
            description="Shared drawing canvas"
          />
          {lastLive ? (
            <FeatureTile
              href={`/classroom/${lastLive.sessionId}` as never}
              label="Live session & breakouts"
              description="Video, chat, split rooms"
            />
          ) : (
            <FeatureTile
              href={
                `/sessions/new?classroomId=${data.classroomId}` as never
              }
              label={isTeacher ? "Schedule a session" : "Sessions"}
              description={
                isTeacher ? "Create the next live session" : "No live session yet"
              }
              muted={!isTeacher}
            />
          )}
          <FeatureTile
            href={
              lastLive
                ? (`/classroom/${lastLive.sessionId}/notes` as never)
                : ("/notes" as never)
            }
            label="Session notes"
            description="Your private notes per session"
          />
          <FeatureTile
            href="#recordings"
            label={`Recordings${completedSessions.length ? ` (${completedSessions.length})` : ""}`}
            description={
              completedSessions.length
                ? "Watch or download past sessions"
                : "Past sessions appear here"
            }
            muted={completedSessions.length === 0}
          />
        </div>
      </section>

      {isTeacher && (
        <section className="card mt-8 flex items-center justify-between p-4">
          <div>
            <div className="font-display text-base text-ink">Group chat</div>
            <div className="text-xs text-ink-faded">
              {chatOn
                ? "Members can post messages. You can delete any message."
                : "Members can read history but cannot post new messages."}
            </div>
          </div>
          <button
            onClick={toggleChat}
            disabled={chatBusy}
            className={chatOn ? "btn-secondary" : "btn-seal"}
          >
            {chatBusy ? "…" : chatOn ? "Disable chat" : "Enable chat"}
          </button>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">Members</h2>
          {typeof data.maxStudents === "number" && members && (
            <span className="text-xs text-ink-faded">
              {members.filter((m) => m.role === "student").length} / {data.maxStudents} students
            </span>
          )}
        </div>

        {members === null && <p className="mt-3 text-sm text-ink-soft">Loading members…</p>}
        {members && members.length === 0 && (
          <p className="mt-3 text-sm text-ink-soft">No members yet.</p>
        )}
        {members && members.length > 0 && (
          <ul className="card mt-3 divide-y divide-ink-faded/30">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-3 p-3 text-sm"
              >
                <div>
                  <div className="font-display text-base text-ink">
                    {m.displayName ?? m.email ?? m.userId}
                  </div>
                  <div className="text-xs text-ink-faded">
                    {m.email ? `${m.email} · ` : ""}
                    {m.role}
                    {m.role !== "teacher" ? ` · joined ${new Date(m.joinedAt).toLocaleDateString()}` : ""}
                  </div>
                </div>
                {isTeacher && m.role !== "teacher" && (
                  <button
                    onClick={() => removeMember(m.userId)}
                    className="btn-ghost text-seal"
                  >
                    Remove
                  </button>
                )}
                {!isTeacher && m.userId === sub && m.role !== "teacher" && (
                  <button
                    onClick={() => removeMember(m.userId)}
                    className="btn-ghost text-seal"
                  >
                    Leave
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {isTeacher && (
          <form
            onSubmit={addMember}
            className="card mt-4 flex flex-col gap-2 p-4 sm:flex-row sm:items-end"
          >
            <label className="flex-1">
              <span className="label">Add by email</span>
              <input
                type="email"
                required
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="student@example.com"
                className="input"
              />
            </label>
            <label>
              <span className="label">Role</span>
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value as "student" | "observer")}
                className="input"
              >
                <option value="student">Student</option>
                <option value="observer">Observer (parent)</option>
              </select>
            </label>
            <button type="submit" disabled={memberBusy} className="btn-seal sm:mb-0.5">
              {memberBusy ? "Adding…" : "Add member"}
            </button>
          </form>
        )}
        {memberError && <p className="mt-2 text-sm text-seal">{memberError}</p>}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">Resources</h2>
        <p className="mt-1 text-xs text-ink-faded">
          Links to external materials the teacher has shared for this classroom.
        </p>

        {error && <p className="mt-2 text-sm text-seal">{error}</p>}

        {!isTeacher && resources.length === 0 && (
          <p className="mt-4 text-sm text-ink-soft">No resources shared yet.</p>
        )}

        {!isTeacher && resources.length > 0 && (
          <ul className="mt-4 space-y-2">
            {resources.map((r, i) => (
              <li key={i} className="card flex items-center justify-between p-3 text-sm">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {r.label}
                </a>
                <span className="rounded-sm border border-ink-faded/50 bg-parchment/40 px-2 py-0.5 text-xs text-ink-soft">
                  {KIND_LABELS[r.kind]}
                </span>
              </li>
            ))}
          </ul>
        )}

        {isTeacher && (
          <div className="mt-4 space-y-2">
            {resources.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr_auto_auto] gap-2">
                <input
                  value={r.label}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                  placeholder="Label"
                  className="input"
                />
                <input
                  value={r.url}
                  onChange={(e) => updateRow(i, { url: e.target.value })}
                  placeholder="https://..."
                  className="input font-mono text-xs"
                />
                <select
                  value={r.kind}
                  onChange={(e) => updateRow(i, { kind: e.target.value as Resource["kind"] })}
                  className="input"
                >
                  {Object.entries(KIND_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeRow(i)}
                  className="btn-ghost text-seal"
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={addRow}
                disabled={resources.length >= 25}
                className="btn-secondary"
              >
                + Add resource
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="btn-seal"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section id="recordings" className="mt-10">
        <h2 className="font-display text-xl text-ink">Sessions & recordings</h2>
        {sessions === null && (
          <p className="mt-3 text-sm text-ink-soft">Loading sessions…</p>
        )}
        {sessions && sessions.length === 0 && (
          <p className="mt-3 text-sm text-ink-soft">
            No sessions scheduled yet.
            {isTeacher && (
              <>
                {" "}
                <Link
                  href={`/sessions/new?classroomId=${classroomId}` as never}
                  className="underline"
                >
                  Schedule one →
                </Link>
              </>
            )}
          </p>
        )}
        {sessions && sessions.length > 0 && (
          <ul className="card mt-3 divide-y divide-ink-faded/30">
            {sessions.map((s) => (
              <li
                key={s.sessionId}
                className="flex items-center justify-between gap-3 p-3 text-sm"
              >
                <div>
                  <div className="font-display text-sm text-ink">
                    {new Date(s.startsAt).toLocaleString()}
                  </div>
                  <div className="text-xs text-ink-faded">
                    {s.status}
                    {s.hasRecording ? " · recorded" : ""}
                    {" · "}
                    <span className="font-mono">{s.sessionId}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(s.status === "scheduled" || s.status === "live") && (
                    <Link
                      href={`/classroom/${s.sessionId}` as never}
                      className="btn-ghost"
                    >
                      Open →
                    </Link>
                  )}
                  {s.hasRecording && (
                    <button
                      onClick={() => downloadRecording(s.sessionId)}
                      className="btn-secondary"
                    >
                      Download
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {isTeacher && sessions && sessions.length > 0 && (
          <div className="mt-3">
            <Link
              href={`/sessions/new?classroomId=${classroomId}` as never}
              className="btn-secondary"
            >
              Schedule another session
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

function FeatureTile({
  href,
  label,
  description,
  muted,
}: {
  href: Parameters<typeof Link>[0]["href"];
  label: string;
  description: string;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`card-interactive group block p-4 ${muted ? "opacity-60" : ""}`}
    >
      <div className="font-display text-base text-ink group-hover:text-seal">{label}</div>
      <div className="mt-1 text-xs leading-relaxed text-ink-soft">{description}</div>
    </Link>
  );
}
