"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Role = "owner" | "admin" | "teacher" | "student";

type Org = {
  orgId: string;
  name: string;
  kind: "educational" | "commercial";
  country?: string;
  description?: string;
  ownerId: string;
  myRole: Role;
};

type Member = {
  orgId: string;
  userId: string;
  role: Role;
  joinedAt: string;
  user: { userId: string; displayName: string; email: string } | null;
};

type OrgResponse = { org: Org; members: Member[] };

type Classroom = {
  classroomId: string;
  title: string;
  subject: string;
  status: string;
  teacherId: string;
  orgId?: string;
};

type OrgListing = {
  listingId: string;
  title: string;
  priceCents: number;
  currency: string;
  status: string;
};

type ClassroomMember = {
  classroomId: string;
  userId: string;
  role: "student" | "teacher" | "observer";
  user: { userId: string; displayName: string; email: string } | null;
};

type AssignResponse = {
  added: { userId: string; email: string; displayName: string }[];
  alreadyMember: { userId: string; email: string }[];
  notFound: string[];
};

function ClassroomStudents({
  orgId,
  classroomId,
}: {
  orgId: string;
  classroomId: string;
}) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<ClassroomMember[] | null>(null);
  const [emails, setEmails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<AssignResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api<{ items: ClassroomMember[] }>(
        `/orgs/${orgId}/classrooms/${classroomId}/students`,
      );
      setMembers(r.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && members === null) await load();
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    const list = emails
      .split(/[,;\n\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await api<AssignResponse>(
        `/orgs/${orgId}/classrooms/${classroomId}/students`,
        { method: "POST", body: JSON.stringify({ emails: list }) },
      );
      setLastResult(r);
      setEmails("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={toggle}
        className="btn-ghost -ml-3 text-xs"
      >
        {open ? "Hide" : "Manage"} students →
      </button>
      {open && (
        <div className="mt-3 space-y-3 rounded-md border border-ink-faded/40 bg-parchment/40 p-3">
          <form onSubmit={assign} className="space-y-2">
            <label className="block">
              <span className="label">Add students by email (comma, space, or newline-separated)</span>
              <textarea
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                rows={2}
                placeholder="alice@example.com, bob@example.com"
                className="input"
              />
            </label>
            <button
              type="submit"
              disabled={submitting || !emails.trim()}
              className="btn-seal"
            >
              {submitting ? "Adding..." : "Add students"}
            </button>
          </form>
          {error && <p className="text-xs text-seal">{error}</p>}
          {lastResult && (
            <p className="text-xs text-ink-soft">
              {lastResult.added.length} added · {lastResult.alreadyMember.length} already enrolled ·{" "}
              {lastResult.notFound.length} not found
              {lastResult.notFound.length > 0 && (
                <>
                  {" "}
                  (<span className="font-mono">{lastResult.notFound.join(", ")}</span>)
                </>
              )}
            </p>
          )}
          {members && members.length === 0 && (
            <p className="text-xs text-ink-faded">No members yet.</p>
          )}
          {members && members.length > 0 && (
            <ul className="divide-y divide-ink-faded/30">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between py-2 text-xs">
                  <span>
                    {m.user?.displayName ?? m.userId}
                    <span className="ml-2 text-ink-faded">{m.user?.email ?? ""}</span>
                  </span>
                  <span className="uppercase tracking-widest text-ink-soft">{m.role}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const ROLE_CHOICES: Exclude<Role, "owner">[] = ["admin", "teacher", "student"];

export default function OrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<OrgResponse | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[] | null>(null);
  const [listings, setListings] = useState<OrgListing[] | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<Role, "owner">>("teacher");
  const [linkClassroomId, setLinkClassroomId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, lr, ml] = await Promise.all([
        api<OrgResponse>(`/orgs/${orgId}`),
        api<{ items: Classroom[] }>(`/orgs/${orgId}/classrooms`),
        api<{ items: OrgListing[] }>(`/marketplace/orgs/${orgId}/listings`),
      ]);
      setData(r);
      setClassrooms(lr.items);
      setListings(ml.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [orgId]);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      load();
    })();
  }, [router, load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api(`/orgs/${orgId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setInviteEmail("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function removeMember(userId: string) {
    if (!confirm("Remove this member?")) return;
    try {
      await api(`/orgs/${orgId}/members/${userId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function linkClassroom(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/orgs/${orgId}/classrooms/${linkClassroomId.trim()}`, {
        method: "POST",
      });
      setLinkClassroomId("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (error && !data) {
    return <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-sm text-seal">{error}</main>;
  }
  if (!data) return <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  const { org, members } = data;
  const canManage = org.myRole === "owner" || org.myRole === "admin";

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Organization</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">{org.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {org.kind} · {org.country ?? "—"} · your role: {org.myRole}
          </p>
        </div>
        <Link href="/orgs" className="btn-ghost">
          ← All orgs
        </Link>
      </div>

      {org.description && (
        <p className="mt-4 text-sm text-ink">{org.description}</p>
      )}

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">Members ({members.length})</h2>
        {canManage && (
          <form onSubmit={invite} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="member@example.com"
              className="input"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
              className="input"
            >
              {ROLE_CHOICES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={submitting || !inviteEmail.trim()}
              className="btn-seal"
            >
              {submitting ? "Inviting..." : "Invite"}
            </button>
          </form>
        )}
        <ul className="card mt-4 divide-y divide-ink-faded/30">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-display text-base text-ink">{m.user?.displayName ?? m.userId}</div>
                <div className="text-xs text-ink-faded">
                  {m.user?.email ?? m.userId} · {m.role} · joined{" "}
                  {new Date(m.joinedAt).toLocaleDateString()}
                </div>
              </div>
              {canManage && m.userId !== org.ownerId && (
                <button
                  onClick={() => removeMember(m.userId)}
                  className="btn-ghost text-seal"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">Classrooms ({classrooms?.length ?? 0})</h2>
        {canManage && (
          <form onSubmit={linkClassroom} className="mt-4 flex gap-2">
            <input
              value={linkClassroomId}
              onChange={(e) => setLinkClassroomId(e.target.value)}
              placeholder="cls_..."
              className="input flex-1 font-mono"
            />
            <button
              type="submit"
              disabled={!linkClassroomId.trim()}
              className="btn-secondary"
            >
              Link classroom
            </button>
          </form>
        )}
        {classrooms && classrooms.length === 0 && (
          <p className="mt-4 text-sm text-ink-soft">No classrooms linked yet.</p>
        )}
        {classrooms && classrooms.length > 0 && (
          <ul className="card mt-4 divide-y divide-ink-faded/30">
            {classrooms.map((c) => (
              <li key={c.classroomId} className="p-3 text-sm">
                <div className="font-display text-base text-ink">{c.title}</div>
                <div className="text-xs text-ink-faded">
                  {c.subject} · status {c.status} ·{" "}
                  <span className="font-mono">{c.classroomId}</span>
                </div>
                {canManage && (
                  <ClassroomStudents orgId={orgId} classroomId={c.classroomId} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {org.kind === "commercial" && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-ink">
              Marketplace listings ({listings?.length ?? 0})
            </h2>
            {canManage && (
              <Link
                href="/seller/listings/new"
                className="btn-ghost"
              >
                Add listing →
              </Link>
            )}
          </div>
          {listings && listings.length === 0 && (
            <p className="mt-4 text-sm text-ink-soft">
              No active listings under this organization.
            </p>
          )}
          {listings && listings.length > 0 && (
            <ul className="card mt-4 divide-y divide-ink-faded/30">
              {listings.map((l) => (
                <li
                  key={l.listingId}
                  className="flex items-center justify-between p-3 text-sm"
                >
                  <div>
                    <Link
                      href={`/marketplace/listings/${l.listingId}` as never}
                      className="font-display text-base text-ink underline"
                    >
                      {l.title}
                    </Link>
                    <div className="text-xs text-ink-faded">status {l.status}</div>
                  </div>
                  <span className="font-mono text-ink">
                    {l.currency} {(l.priceCents / 100).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
