"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type ChildLink = {
  parentId: string;
  childId: string;
  relationship: "mother" | "father" | "guardian";
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  child: { userId: string; displayName: string; email: string } | null;
};

const STATUS_COLORS: Record<ChildLink["status"], string> = {
  pending: "text-ink-faded",
  accepted: "text-ink",
  rejected: "text-seal",
};

export default function ParentChildrenPage() {
  const router = useRouter();
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
      setChildEmail("");
      await load();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("child_not_registered")) {
        setFormError("No student with that email. Ask them to sign up first.");
      } else if (msg.includes("not_a_student")) {
        setFormError("That email belongs to a non-student account.");
      } else if (msg.includes("link_exists")) {
        setFormError("You already have a link with this child.");
      } else {
        setFormError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onRemove(childId: string) {
    if (!confirm("Remove this child link? They will be unlinked immediately.")) return;
    try {
      await api(`/family/children/${childId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <p className="eyebrow">Family</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">My children</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Add a child by their EduBoost email. They&apos;ll receive a request to confirm the link.
      </p>

      <form onSubmit={onInvite} className="card mt-6 space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="block">
            <span className="label">Child&apos;s email</span>
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
            <span className="label">Relationship</span>
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
        {formError && <p className="text-sm text-seal">{formError}</p>}
        <button
          type="submit"
          disabled={submitting || !childEmail}
          className="btn-seal"
        >
          {submitting ? "Sending..." : "Add child"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No children linked yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-ink-faded/30">
          {items.map((link) => (
            <li key={link.childId} className="flex items-center justify-between p-4">
              <div>
                <div className="font-display text-base text-ink">
                  {link.child?.displayName ?? "(pending user)"}
                </div>
                <div className="mt-0.5 text-xs text-ink-faded">
                  {link.child?.email ?? link.childId} · {link.relationship} · added{" "}
                  {new Date(link.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs uppercase tracking-widest ${STATUS_COLORS[link.status]}`}>
                  {link.status}
                </span>
                <button
                  onClick={() => onRemove(link.childId)}
                  className="btn-ghost text-seal"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-ink-soft underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
