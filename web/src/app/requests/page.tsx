"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, type Role } from "@/lib/cognito";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { useDialog } from "@/components/Dialog";

type LessonRequest = {
  requestId: string;
  studentId: string;
  teacherId: string;
  subject: string;
  message?: string;
  status: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
  createdAt: string;
};

type StatusFilter = "all" | "pending" | "accepted" | "rejected";

const STATUS_STYLES: Record<LessonRequest["status"], { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: "Pending", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: "⏳" },
  accepted: { label: "Accepted", color: "text-green-700", bg: "bg-green-50 border-green-200", icon: "✅" },
  rejected: { label: "Rejected", color: "text-red-600", bg: "bg-red-50 border-red-200", icon: "✗" },
  expired: { label: "Expired", color: "text-ink-faded", bg: "bg-parchment-dark border-ink-faded/30", icon: "⌛" },
  cancelled: { label: "Cancelled", color: "text-ink-faded", bg: "bg-parchment-dark border-ink-faded/30", icon: "—" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function RequestsPage() {
  const router = useRouter();
  const { confirm: showConfirm } = useDialog();
  const [role, setRole] = useState<Role | null>(null);
  const [items, setItems] = useState<LessonRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      const r = currentRole(session);
      setRole(r);
      const endpoint = r === "teacher" ? "/lesson-requests/inbox" : "/lesson-requests/mine";
      try {
        const res = await api<{ items: LessonRequest[] }>(endpoint);
        setItems(res.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  async function cancelRequest(requestId: string) {
    const ok = await showConfirm({ title: "Cancel request", message: "Cancel this lesson request?", destructive: true });
    if (!ok) return;
    setCancellingId(requestId);
    try {
      await api(`/lesson-requests/${requestId}/cancel`, { method: "POST" });
      const endpoint = role === "teacher" ? "/lesson-requests/inbox" : "/lesson-requests/mine";
      const res = await api<{ items: LessonRequest[] }>(endpoint);
      setItems(res.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancellingId(null);
    }
  }

  const isTeacher = role === "teacher";
  const title = isTeacher ? "Lesson requests" : "My lesson requests";

  const filtered = (items ?? [])
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pendingCount = (items ?? []).filter((r) => r.status === "pending").length;
  const acceptedCount = (items ?? []).filter((r) => r.status === "accepted").length;

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Requests</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {isTeacher
              ? "Lesson requests from students"
              : "Track your lesson requests to teachers"}
          </p>
        </div>
        {!isTeacher && (
          <Link href="/teachers" className="btn-ghost shrink-0">
            Find teachers
          </Link>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}

      {/* Loading */}
      {items === null && !error && (
        <div className="mt-8 flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
        </div>
      )}

      {/* Stats */}
      {items && items.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-ink">{items.length}</div>
            <div className="text-xs text-ink-faded">Total</div>
          </div>
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-amber-600">{pendingCount}</div>
            <div className="text-xs text-ink-faded">Pending</div>
          </div>
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-green-700">{acceptedCount}</div>
            <div className="text-xs text-ink-faded">Accepted</div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {items && items.length > 0 && (
        <div className="mt-6 flex gap-1 border-b border-ink-faded/20">
          {(["all", "pending", "accepted", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`border-b-2 px-4 py-2 text-xs font-medium capitalize transition ${
                statusFilter === f
                  ? "border-seal text-seal"
                  : "border-transparent text-ink-faded hover:text-ink"
              }`}
            >
              {f}
              {f === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-600">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {items && items.length === 0 && (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parchment-dark">
            <span className="text-2xl">📬</span>
          </div>
          <p className="mt-4 font-display text-lg text-ink">
            {isTeacher ? "No lesson requests yet" : "No requests sent"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {isTeacher
              ? "Students will send requests from your profile page."
              : "Request a custom lesson from any teacher's profile."}
          </p>
          {!isTeacher && (
            <Link href="/teachers" className="btn-seal mt-4 inline-block">
              Find a teacher
            </Link>
          )}
        </div>
      )}

      {/* Request list */}
      {filtered.length > 0 && (
        <ul className="mt-4 space-y-3">
          {filtered.map((r) => {
            const st = STATUS_STYLES[r.status];
            const counterpartyId = isTeacher ? r.studentId : r.teacherId;
            return (
              <li key={r.requestId}>
                <Link
                  href={`/requests/${r.requestId}` as never}
                  className="card group flex items-center gap-4 p-4 transition hover:shadow-md"
                >
                  {/* Avatar */}
                  <Avatar userId={counterpartyId} size="md" />

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-display text-base text-ink group-hover:text-seal transition-colors">
                        {r.subject}
                      </h3>
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${st.bg} ${st.color}`}>
                        {st.icon} {st.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-ink-faded">
                      <span>
                        {isTeacher ? "From student" : "To teacher"}: {counterpartyId.slice(0, 12)}...
                      </span>
                      <span>{timeAgo(r.createdAt)}</span>
                    </div>
                    {r.message && (
                      <p className="mt-1 truncate text-sm text-ink-soft">{r.message}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {!isTeacher && r.status === "pending" && (
                      <button
                        onClick={(e) => { e.preventDefault(); cancelRequest(r.requestId); }}
                        disabled={cancellingId === r.requestId}
                        className="rounded-md border border-ink-faded/30 px-3 py-1.5 text-xs text-red-500 transition hover:border-red-200 hover:bg-red-50"
                      >
                        {cancellingId === r.requestId ? "..." : "Cancel"}
                      </button>
                    )}
                    <span className="text-ink-faded">›</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Count */}
      {filtered.length > 0 && (
        <p className="mt-4 text-center text-xs text-ink-faded">
          Showing {filtered.length} request{filtered.length !== 1 ? "s" : ""}
        </p>
      )}
    </main>
  );
}
