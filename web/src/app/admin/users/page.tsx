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

  if (!ready) return <main className="mx-auto max-w-4xl px-6 py-12">Loading...</main>;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <Link href="/admin" className="text-sm text-gray-500 underline">
          ← Admin hub
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Filter by role</label>
          <select
            className="w-full rounded border px-3 py-2"
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
        </div>
        <form onSubmit={lookupByEmail}>
          <label className="mb-1 block text-sm font-medium">Look up by email</label>
          <div className="flex gap-2">
            <input
              type="email"
              className="flex-1 rounded border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
            <button type="submit" className="rounded border px-3 py-2 text-sm">
              Find
            </button>
          </div>
        </form>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && <p className="mt-6 text-sm text-gray-500">No users found.</p>}
      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((u) => (
            <li key={u.userId}>
              <Link
                href={`/admin/users/${u.userId}` as never}
                className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <div>
                  <div className="font-medium">{u.displayName}</div>
                  <div className="text-xs text-gray-500">
                    {u.email} · {u.role} · joined {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {u.bannedAt ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-900 dark:text-red-100">
                    banned
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">active</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
