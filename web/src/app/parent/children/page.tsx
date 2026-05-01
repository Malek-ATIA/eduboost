"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { Avatar } from "@/components/Avatar";
import {
  UserPlus,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  ChevronLeft,
} from "lucide-react";

type ChildLink = {
  parentId: string;
  childId: string;
  relationship: "mother" | "father" | "guardian";
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  child: { userId: string; displayName: string; email: string } | null;
};

const STATUS_CONFIG: Record<
  ChildLink["status"],
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

export default function ParentChildrenPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm: showConfirm } = useDialog();
  const [items, setItems] = useState<ChildLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [childEmail, setChildEmail] = useState("");
  const [relationship, setRelationship] = useState<"mother" | "father" | "guardian">("mother");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: ChildLink[] }>(`/family/children`);
      setItems(r.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (currentRole(session) !== "parent") return router.replace("/dashboard");
      await load();
    })();
  }, [router, load]);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await api(`/family/children`, {
        method: "POST",
        body: JSON.stringify({ childEmail, relationship }),
      });
      toast("Link request sent! Your child will receive a notification to accept.", "success");
      setChildEmail("");
      await load();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("child_not_registered")) {
        setFormError("No student with that email. Ask them to sign up on EduBoost first.");
      } else if (msg.includes("not_a_student")) {
        setFormError("That email belongs to a non-student account. Only students can be linked.");
      } else if (msg.includes("link_exists")) {
        setFormError("You already have a link with this child.");
      } else {
        setFormError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onRemove(childId: string, childName: string) {
    const ok = await showConfirm({
      title: "Remove child link",
      message: `Remove the link with ${childName}? You will no longer be able to view their learning progress. You can re-invite them later.`,
      destructive: true,
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      await api(`/family/children/${childId}`, { method: "DELETE" });
      toast("Child link removed.", "success");
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function onChangeRelationship(
    childId: string,
    nextRelationship: "mother" | "father" | "guardian",
  ) {
    try {
      await api(`/family/children/${childId}`, {
        method: "PATCH",
        body: JSON.stringify({ relationship: nextRelationship }),
      });
      toast("Relationship updated.", "success");
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  const accepted = (items ?? []).filter((l) => l.status === "accepted");
  const pending = (items ?? []).filter((l) => l.status === "pending");
  const rejected = (items ?? []).filter((l) => l.status === "rejected");

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <Link href="/parent" className="btn-ghost -ml-3 inline-flex items-center gap-1.5">
        <ChevronLeft size={16} />
        Parent dashboard
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Family</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">My children</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Link your child&apos;s student account to track their progress. They&apos;ll need to
            accept your invitation.
          </p>
        </div>
      </div>

      {/* Add child form */}
      <div className="card mt-6 p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <UserPlus size={16} className="text-seal" />
          Add a child
        </div>
        <form onSubmit={onInvite} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <label className="block">
              <span className="label">Child&apos;s email address</span>
              <input
                required
                type="email"
                className="input"
                value={childEmail}
                onChange={(e) => setChildEmail(e.target.value)}
                placeholder="child@example.com"
              />
            </label>
            <label className="block">
              <span className="label">Your relationship</span>
              <select
                className="input"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value as typeof relationship)}
              >
                <option value="mother">Mother</option>
                <option value="father">Father</option>
                <option value="guardian">Guardian</option>
              </select>
            </label>
          </div>
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <button type="submit" disabled={submitting || !childEmail} className="btn-seal">
            {submitting ? "Sending invitation..." : "Send link request"}
          </button>
        </form>
      </div>

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

      {/* Empty state */}
      {items && items.length === 0 && (
        <div className="mt-8 card p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parchment-dark">
            <UserPlus size={28} className="text-ink-faded" />
          </div>
          <p className="mt-4 font-display text-lg text-ink">No children linked yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            Use the form above to send a link request to your child&apos;s EduBoost student email.
          </p>
        </div>
      )}

      {/* Pending links */}
      {pending.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow mb-3">Awaiting response ({pending.length})</h2>
          <ul className="space-y-2">
            {pending.map((link) => (
              <ChildCard
                key={link.childId}
                link={link}
                onRemove={onRemove}
                onChangeRelationship={onChangeRelationship}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Accepted links */}
      {accepted.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow mb-3">Linked children ({accepted.length})</h2>
          <ul className="space-y-2">
            {accepted.map((link) => (
              <ChildCard
                key={link.childId}
                link={link}
                onRemove={onRemove}
                onChangeRelationship={onChangeRelationship}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Rejected links */}
      {rejected.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow mb-3">Declined ({rejected.length})</h2>
          <ul className="space-y-2">
            {rejected.map((link) => (
              <ChildCard
                key={link.childId}
                link={link}
                onRemove={onRemove}
                onChangeRelationship={onChangeRelationship}
              />
            ))}
          </ul>
        </section>
      )}

      {items && items.length > 0 && (
        <p className="mt-6 text-center text-xs text-ink-faded">
          {items.length} child link{items.length !== 1 ? "s" : ""} total
        </p>
      )}
    </main>
  );
}

function ChildCard({
  link,
  onRemove,
  onChangeRelationship,
}: {
  link: ChildLink;
  onRemove: (childId: string, name: string) => void;
  onChangeRelationship: (childId: string, rel: "mother" | "father" | "guardian") => void;
}) {
  const st = STATUS_CONFIG[link.status];
  const StIcon = st.icon;
  const childName = link.child?.displayName ?? link.child?.email ?? "Child";

  return (
    <li className="card overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <Avatar userId={link.childId} size="md" initial={childName.charAt(0)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-base text-ink">{childName}</span>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${st.bg} ${st.color}`}
            >
              <StIcon size={10} />
              {st.label}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-faded">
            {link.child?.email && <span>{link.child.email}</span>}
            <span>
              Added{" "}
              {new Date(link.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <select
            value={link.relationship}
            onChange={(e) =>
              onChangeRelationship(
                link.childId,
                e.target.value as "mother" | "father" | "guardian",
              )
            }
            className="input !py-1.5 !text-xs"
            aria-label="Change relationship"
          >
            <option value="mother">Mother</option>
            <option value="father">Father</option>
            <option value="guardian">Guardian</option>
          </select>
          <button
            onClick={() => onRemove(link.childId, childName)}
            className="rounded-md border border-ink-faded/30 p-2 text-ink-faded transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            title="Remove link"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </li>
  );
}
