"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type ParentLink = {
  parentId: string;
  childId: string;
  relationship: "mother" | "father" | "guardian";
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  parent: { userId: string; displayName: string; email: string } | null;
};

const STATUS_COLORS: Record<ParentLink["status"], string> = {
  pending: "text-yellow-700",
  accepted: "text-green-700",
  rejected: "text-red-700",
};

export default function StudentParentsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ParentLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: ParentLink[] }>(`/family/parents`);
      setItems(r.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      const role = currentRole(session);
      if (role !== "student" && role !== "parent") return router.replace("/dashboard");
      await load();
    })();
  }, [router, load]);

  async function respond(parentId: string, decision: "accept" | "reject") {
    setBusyId(parentId);
    try {
      await api(`/family/parents/${parentId}/${decision}`, { method: "POST" });
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">My parents / guardians</h1>
      <p className="mt-1 text-sm text-gray-500">
        Parents who have requested a link with your account.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No parent links yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((link) => (
            <li key={link.parentId} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {link.parent?.displayName ?? "(unknown parent)"}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {link.parent?.email ?? link.parentId} · {link.relationship} · requested{" "}
                    {new Date(link.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className={`text-xs uppercase ${STATUS_COLORS[link.status]}`}>
                  {link.status}
                </span>
              </div>
              {link.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => respond(link.parentId, "accept")}
                    disabled={busyId === link.parentId}
                    className="rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    {busyId === link.parentId ? "..." : "Accept"}
                  </button>
                  <button
                    onClick={() => respond(link.parentId, "reject")}
                    disabled={busyId === link.parentId}
                    className="rounded border px-3 py-1 text-xs disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-gray-500 underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
