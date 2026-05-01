"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";
import { useDialog } from "@/components/Dialog";

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
  const { confirm: showConfirm } = useDialog();
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
    const okBan = await showConfirm({ title: "Ban user", message: `Ban ${user?.email}? They will be signed out and blocked from the platform.`, destructive: true });
    if (!okBan) return;
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
    const ok = await showConfirm({ title: "Restore user", message: `Restore ${user?.email}? They will regain access.`, destructive: true });
    if (!ok) return;
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

  if (!ready) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <Link href="/admin/users" className="btn-ghost -ml-3">
        ← All users
      </Link>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {!user && !error && <p className="mt-6 text-sm text-ink-soft">Loading...</p>}

      {user && (
        <>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">User</p>
              <h1 className="mt-1 font-display text-3xl text-ink">{user.displayName}</h1>
              <p className="mt-1 text-sm text-ink-soft">
                {user.email} · {user.role} · joined{" "}
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
              <p className="mt-1 font-mono text-xs text-ink-faded">{user.userId}</p>
            </div>
            <span
              className={`rounded-sm border px-3 py-1 text-xs uppercase tracking-widest ${
                user.bannedAt
                  ? "border-seal/40 bg-seal/10 text-seal"
                  : "border-ink-faded/50 bg-parchment/40 text-ink-soft"
              }`}
            >
              {user.bannedAt ? "Banned" : "Active"}
            </span>
          </div>

          {user.bannedAt ? (
            <div className="mt-8 rounded-md border border-seal/30 bg-seal/10 p-4">
              <h2 className="font-display text-xl text-ink">Account suspended</h2>
              <p className="mt-2 text-sm text-ink">
                <strong>Since:</strong> {new Date(user.bannedAt).toLocaleString()}
              </p>
              {user.banReason && (
                <p className="mt-2 text-sm text-ink">
                  <strong>Reason:</strong> {user.banReason}
                </p>
              )}
              <button
                onClick={onUnban}
                disabled={submitting}
                className="btn-secondary mt-4"
              >
                {submitting ? "Restoring..." : "Restore access"}
              </button>
            </div>
          ) : user.role === "admin" ? (
            <p className="mt-8 text-sm text-ink-soft">Admins cannot be banned from this interface.</p>
          ) : (
            <form onSubmit={onBan} className="card mt-8 space-y-4 p-6">
              <label className="block">
                <span className="label">Ban reason</span>
                <textarea
                  rows={4}
                  minLength={10}
                  maxLength={500}
                  className="input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain the violation. This is visible to the user in the ban email."
                />
              </label>
              <button
                type="submit"
                disabled={submitting || reason.trim().length < 10}
                className="btn-seal"
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
