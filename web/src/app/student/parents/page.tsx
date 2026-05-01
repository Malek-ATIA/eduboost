"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";

type ParentLink = {
  parentId: string;
  childId: string;
  relationship: "mother" | "father" | "guardian";
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  parent: { userId: string; displayName: string; email: string } | null;
};

const STATUS_COLORS: Record<ParentLink["status"], string> = {
  pending: "text-ink-faded",
  accepted: "text-ink",
  rejected: "text-seal",
};

export default function StudentParentsPage() {
  const router = useRouter();
  const { toast } = useToast();
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
      toast((err as Error).message, "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <p className="eyebrow">Family</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">My parents / guardians</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Parents who have requested a link with your account.
      </p>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No parent links yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-ink-faded/30">
          {items.map((link) => (
            <li key={link.parentId} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-display text-base text-ink">
                    {link.parent?.displayName ?? "(unknown parent)"}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faded">
                    {link.parent?.email ?? link.parentId} · {link.relationship} · requested{" "}
                    {new Date(link.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className={`text-xs uppercase tracking-widest ${STATUS_COLORS[link.status]}`}>
                  {link.status}
                </span>
              </div>
              {link.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => respond(link.parentId, "accept")}
                    disabled={busyId === link.parentId}
                    className="btn-seal"
                  >
                    {busyId === link.parentId ? "..." : "Accept"}
                  </button>
                  <button
                    onClick={() => respond(link.parentId, "reject")}
                    disabled={busyId === link.parentId}
                    className="btn-secondary"
                  >
                    Decline
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
</main>
  );
}
