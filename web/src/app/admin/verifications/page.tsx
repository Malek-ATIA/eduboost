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
  rejected: "text-seal",
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

  if (!ready) return <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Teacher verifications</h1>
        </div>
        <Link href="/admin" className="btn-ghost">
          ← Admin hub
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

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No teachers in this status.</p>
      )}

      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-ink-faded/30">
          {items.map((r) => (
            <li key={r.userId} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-base text-ink">
                    {r.user?.displayName ?? r.userId}{" "}
                    <span className={`ml-2 text-xs uppercase tracking-widest ${STATUS_COLORS[r.verificationStatus]}`}>
                      {r.verificationStatus}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faded">
                    {r.user?.email ?? ""} · subjects: {r.subjects.join(", ") || "—"}
                  </div>
                  {r.verificationNotes && (
                    <p className="mt-2 text-xs text-ink-soft">
                      Notes: {r.verificationNotes}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/teachers/${r.userId}` as never}
                    className="text-xs underline text-ink-soft"
                  >
                    View profile
                  </Link>
                  {r.verificationStatus === "pending" && (
                    <>
                      <button
                        onClick={() => approve(r.userId)}
                        className="btn-seal"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => reject(r.userId)}
                        className="btn-secondary text-seal"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
