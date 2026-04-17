"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";

type User = {
  userId: string;
  email: string;
  displayName: string;
  role: "parent" | "student" | "teacher" | "org_admin" | "admin";
  createdAt: string;
  bannedAt?: string;
  banReason?: string;
};

export default function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const u = await api<User>(`/admin/users/${userId}`);
      setUser(u);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [userId]);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (!isAdmin(session)) return router.replace("/dashboard");
      setReady(true);
      load();
    })();
  }, [router, load]);

  async function onBan(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setError("Reason must be at least 10 characters.");
      return;
    }
    if (!confirm(`Ban ${user?.email}? They will be signed out and blocked from the platform.`)) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/admin/users/${userId}/ban`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setReason("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onUnban() {
    if (!confirm(`Restore ${user?.email}? They will regain access.`)) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/admin/users/${userId}/unban`, { method: "POST" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return <main className="mx-auto max-w-2xl px-6 py-12">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/admin/users" className="text-sm text-gray-500 underline">
        ← All users
      </Link>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {!user && !error && <p className="mt-6 text-sm text-gray-500">Loading...</p>}

      {user && (
        <>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{user.displayName}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {user.email} · {user.role} · joined{" "}
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
              <p className="mt-1 font-mono text-xs text-gray-500">{user.userId}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs uppercase ${
                user.bannedAt
                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                  : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
              }`}
            >
              {user.bannedAt ? "Banned" : "Active"}
            </span>
          </div>

          {user.bannedAt ? (
            <div className="mt-8 rounded border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
              <h2 className="font-semibold">Account suspended</h2>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                <strong>Since:</strong> {new Date(user.bannedAt).toLocaleString()}
              </p>
              {user.banReason && (
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  <strong>Reason:</strong> {user.banReason}
                </p>
              )}
              <button
                onClick={onUnban}
                disabled={submitting}
                className="mt-4 rounded border px-4 py-2 text-sm disabled:opacity-50"
              >
                {submitting ? "Restoring..." : "Restore access"}
              </button>
            </div>
          ) : user.role === "admin" ? (
            <p className="mt-8 text-sm text-gray-500">Admins cannot be banned from this interface.</p>
          ) : (
            <form onSubmit={onBan} className="mt-8 space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Ban reason</span>
                <textarea
                  rows={4}
                  minLength={10}
                  maxLength={500}
                  className="w-full rounded border px-3 py-2"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain the violation. This is visible to the user in the ban email."
                />
              </label>
              <button
                type="submit"
                disabled={submitting || reason.trim().length < 10}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {submitting ? "Banning..." : "Ban user"}
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
