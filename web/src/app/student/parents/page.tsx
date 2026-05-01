"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Avatar } from "@/components/Avatar";
import {
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Users,
} from "lucide-react";

type ParentLink = {
  parentId: string;
  childId: string;
  relationship: "mother" | "father" | "guardian";
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  parent: { userId: string; displayName: string; email: string } | null;
};

const STATUS_CONFIG: Record<
  ParentLink["status"],
  { icon: typeof CheckCircle2; label: string; color: string; bg: string }
> = {
  accepted: {
    icon: CheckCircle2,
    label: "Linked",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
  },
  pending: {
    icon: Clock,
    label: "Pending",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
  },
  rejected: {
    icon: XCircle,
    label: "Declined",
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
  },
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

  async function respond(parentId: string, decision: "accept" | "reject", parentName: string) {
    setBusyId(parentId);
    try {
      await api(`/family/parents/${parentId}/${decision}`, { method: "POST" });
      toast(
        decision === "accept"
          ? `Linked with ${parentName}. They can now view your learning progress.`
          : `Declined link request from ${parentName}.`,
        decision === "accept" ? "success" : "info",
      );
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusyId(null);
    }
  }

  const pending = (items ?? []).filter((l) => l.status === "pending");
  const accepted = (items ?? []).filter((l) => l.status === "accepted");
  const rejected = (items ?? []).filter((l) => l.status === "rejected");

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Family</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">
        My parents / guardians
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Parents and guardians who have linked their account to yours. Linked parents can view your
        learning progress, session history, and grades.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {items === null && !error && (
        <div className="mt-8 flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
        </div>
      )}

      {/* Pending requests */}
      {pending.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-600" />
            <h2 className="eyebrow text-amber-600">
              Pending requests ({pending.length})
            </h2>
          </div>
          <ul className="mt-3 space-y-3">
            {pending.map((link) => {
              const parentName = link.parent?.displayName ?? "Unknown parent";
              return (
                <li
                  key={link.parentId}
                  className="card overflow-hidden border-amber-200 bg-amber-50/30"
                >
                  <div className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar
                        userId={link.parentId}
                        size="md"
                        initial={parentName.charAt(0)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-base text-ink">{parentName}</div>
                        <div className="mt-0.5 text-xs text-ink-faded">
                          {link.parent?.email ?? link.parentId} · wants to link as your{" "}
                          <span className="capitalize font-medium text-ink-soft">
                            {link.relationship}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-ink-faded">
                          Requested{" "}
                          {new Date(link.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3 rounded-md bg-parchment-dark/50 p-3">
                      <ShieldCheck size={16} className="shrink-0 text-ink-faded" />
                      <p className="text-xs text-ink-soft">
                        Accepting will let this person view your session history, grades, and
                        learning analytics. They will <span className="font-medium">not</span> be
                        able to modify your account or send messages on your behalf.
                      </p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => respond(link.parentId, "accept", parentName)}
                        disabled={busyId === link.parentId}
                        className="btn-seal inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={14} />
                        {busyId === link.parentId ? "..." : "Accept"}
                      </button>
                      <button
                        onClick={() => respond(link.parentId, "reject", parentName)}
                        disabled={busyId === link.parentId}
                        className="rounded-md border border-ink-faded/30 px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-red-200 hover:text-red-600"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Accepted parents */}
      {accepted.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow mb-3">Linked parents ({accepted.length})</h2>
          <ul className="space-y-2">
            {accepted.map((link) => {
              const st = STATUS_CONFIG[link.status];
              const StIcon = st.icon;
              const parentName = link.parent?.displayName ?? "Parent";
              return (
                <li key={link.parentId} className="card overflow-hidden">
                  <div className="flex items-center gap-4 p-4">
                    <Avatar
                      userId={link.parentId}
                      size="md"
                      initial={parentName.charAt(0)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-display text-base text-ink">
                          {parentName}
                        </span>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${st.bg} ${st.color}`}
                        >
                          <StIcon size={10} />
                          {st.label}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-ink-faded">
                        {link.parent?.email} · <span className="capitalize">{link.relationship}</span> ·
                        Linked{" "}
                        {new Date(link.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Rejected parents */}
      {rejected.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow mb-3">Declined ({rejected.length})</h2>
          <ul className="space-y-2">
            {rejected.map((link) => {
              const st = STATUS_CONFIG[link.status];
              const StIcon = st.icon;
              const parentName = link.parent?.displayName ?? "Parent";
              return (
                <li key={link.parentId} className="card overflow-hidden">
                  <div className="flex items-center gap-4 p-4">
                    <Avatar
                      userId={link.parentId}
                      size="md"
                      initial={parentName.charAt(0)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-display text-base text-ink">
                          {parentName}
                        </span>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${st.bg} ${st.color}`}
                        >
                          <StIcon size={10} />
                          {st.label}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-ink-faded">
                        {link.parent?.email} · <span className="capitalize">{link.relationship}</span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Empty state */}
      {items && items.length === 0 && (
        <div className="mt-12 card p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parchment-dark">
            <Users size={28} className="text-ink-faded" />
          </div>
          <p className="mt-4 font-display text-lg text-ink">No parent links yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            When a parent or guardian sends you a link request, it will appear here for you to
            accept or decline.
          </p>
        </div>
      )}
    </main>
  );
}
