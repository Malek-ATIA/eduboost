"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

const ROLES: User["role"][] = ["parent", "student", "teacher", "org_admin", "admin"];

export default function AdminUsersPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<User["role"] | "">("student");
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (!isAdmin(session)) return router.replace("/dashboard");
      setReady(true);
    })();
  }, [router]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (role) p.set("role", role);
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }, [role]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setItems(null);
    setError(null);
    api<{ items: User[] }>(`/admin/users${queryString}`)
      .then((r) => {
        if (!cancelled) setItems(r.items);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, queryString]);

  async function lookupByEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setError(null);
    try {
      const u = await api<User>(`/admin/users/by-email/${encodeURIComponent(email)}`);
      router.push(`/admin/users/${u.userId}` as never);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!ready) return <main className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Users</h1>
        </div>
        <Link href="/admin" className="btn-ghost">
          ← Admin hub
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Filter by role</span>
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as User["role"] | "")}
          >
            <option value="">(all — scan)</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <form onSubmit={lookupByEmail}>
          <span className="label">Look up by email</span>
          <div className="flex gap-2">
            <input
              type="email"
              className="input flex-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
            <button type="submit" className="btn-secondary">
              Find
            </button>
          </div>
        </form>
      </div>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && <p className="mt-6 text-sm text-ink-soft">No users found.</p>}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-ink-faded/30">
          {items.map((u) => (
            <li key={u.userId}>
              <Link
                href={`/admin/users/${u.userId}` as never}
                className="flex items-center justify-between p-3 transition hover:bg-parchment-shade"
              >
                <div>
                  <div className="font-display text-base text-ink">{u.displayName}</div>
                  <div className="text-xs text-ink-faded">
                    {u.email} · {u.role} · joined {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {u.bannedAt ? (
                  <span className="rounded-sm border border-seal/40 bg-seal/10 px-2 py-0.5 text-xs uppercase tracking-widest text-seal">
                    banned
                  </span>
                ) : (
                  <span className="text-xs uppercase tracking-widest text-ink-faded">active</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
