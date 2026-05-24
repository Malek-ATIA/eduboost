"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";

type Row = {
  userId: string;
  bio?: string;
  subjects: string[];
  verificationStatus: "unsubmitted" | "pending" | "verified" | "rejected";
  verificationNotes?: string;
  updatedAt: string;
  user: { userId: string; email: string; displayName: string } | null;
};

const STATUSES = ["pending", "verified", "rejected", "unsubmitted"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_COLORS: Record<Status, string> = {
  pending: "text-ink-faded",
  verified: "text-ink",
  rejected: "text-red-600",
  unsubmitted: "text-ink-faded",
};

export default function AdminVerificationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { prompt: showPrompt } = useDialog();
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<Status>("pending");
  const [items, setItems] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(null);
    setError(null);
    try {
      const r = await api<{ items: Row[] }>(`/admin/verifications?status=${status}`);
      setItems(r.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [status]);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (!isAdmin(session)) return router.replace("/dashboard");
      setReady(true);
    })();
  }, [router]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function approve(userId: string) {
    const notes = await showPrompt({ title: "Approve teacher", message: "Optional internal note for this approval (visible in history):", inputLabel: "Note" }) ?? undefined;
    try {
      await api(`/admin/verifications/${userId}/approve`, {
        method: "POST",
        body: JSON.stringify({ notes: notes?.trim() || undefined }),
      });
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function reject(userId: string) {
    const notes = await showPrompt({ title: "Reject teacher", message: "Reason (shown to the teacher):", inputLabel: "Reason", inputMinLength: 10 });
    if (!notes) return;
    try {
      await api(`/admin/verifications/${userId}/reject`, {
        method: "POST",
        body: JSON.stringify({ notes: notes.trim() }),
      });
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  if (!ready) {
    return (
      <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">
            Teacher verifications
          </h1>
        </div>
        <Link href="/admin" className="btn-ghost">
          ← Back to admin
        </Link>
      </div>

      <div className="mt-6 max-w-xs">
        <label className="block">
          <span className="label">Filter by status</span>
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No teachers in this status.</p>
      )}

      {items && items.length > 0 && (
        <div className="card mt-6 overflow-hidden p-0">
          {items.map((r, i) => (
            <div
              key={r.userId}
              className="flex items-center gap-3.5 px-5 py-3.5"
              style={i > 0 ? { borderTop: "1px solid var(--rule-soft)" } : undefined}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-soft font-serif text-sm text-ink-soft">
                {(r.user?.displayName ?? r.userId).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-ink">{r.user?.displayName ?? r.userId}</div>
                <div className="text-xs text-ink-faded">
                  {r.user?.email ?? ""} · Applied {new Date(r.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="text-[13px] text-ink-soft">{r.subjects.join(", ") || "—"}</div>
              <span className={`chip text-xs ${STATUS_COLORS[r.verificationStatus]}`}>
                {r.verificationStatus}
              </span>
              <div className="flex gap-1.5">
                {r.verificationStatus === "pending" && (
                  <>
                    <button onClick={() => reject(r.userId)} className="btn-ghost text-sm">
                      Decline
                    </button>
                    <button onClick={() => approve(r.userId)} className="btn-primary text-sm">
                      Review
                    </button>
                  </>
                )}
                <Link href={`/teachers/${r.userId}` as never} className="btn-ghost text-sm">
                  Profile
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
