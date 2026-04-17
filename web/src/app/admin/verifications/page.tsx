"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";

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
  pending: "text-yellow-700",
  verified: "text-green-700",
  rejected: "text-red-700",
  unsubmitted: "text-gray-500",
};

export default function AdminVerificationsPage() {
  const router = useRouter();
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
    const notes = prompt("Optional internal note for this approval (visible in history):") ?? undefined;
    try {
      await api(`/admin/verifications/${userId}/approve`, {
        method: "POST",
        body: JSON.stringify({ notes: notes?.trim() || undefined }),
      });
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function reject(userId: string) {
    const notes = prompt("Reason (shown to the teacher, min 10 chars):");
    if (!notes || notes.trim().length < 10) {
      alert("Reason is required (min 10 characters).");
      return;
    }
    try {
      await api(`/admin/verifications/${userId}/reject`, {
        method: "POST",
        body: JSON.stringify({ notes: notes.trim() }),
      });
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  if (!ready) return <main className="mx-auto max-w-3xl px-6 py-12">Loading...</main>;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Teacher verifications</h1>
        <Link href="/admin" className="text-sm text-gray-500 underline">
          ← Admin hub
        </Link>
      </div>

      <div className="mt-6 max-w-xs">
        <label className="mb-1 block text-sm font-medium">Filter by status</label>
        <select
          className="w-full rounded border px-3 py-2"
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No teachers in this status.</p>
      )}

      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((r) => (
            <li key={r.userId} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {r.user?.displayName ?? r.userId}{" "}
                    <span className={`ml-2 text-xs uppercase ${STATUS_COLORS[r.verificationStatus]}`}>
                      {r.verificationStatus}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {r.user?.email ?? ""} · subjects: {r.subjects.join(", ") || "—"}
                  </div>
                  {r.verificationNotes && (
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      Notes: {r.verificationNotes}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/teachers/${r.userId}` as never}
                    className="text-xs underline"
                  >
                    View profile
                  </Link>
                  {r.verificationStatus === "pending" && (
                    <>
                      <button
                        onClick={() => approve(r.userId)}
                        className="rounded bg-green-700 px-3 py-1 text-xs text-white"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => reject(r.userId)}
                        className="rounded border border-red-400 px-3 py-1 text-xs text-red-700"
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
