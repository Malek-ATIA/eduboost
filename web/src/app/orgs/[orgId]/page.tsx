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
};

type OrgListing = {
  listingId: string;
  title: string;
  priceCents: number;
  currency: string;
  status: string;
};

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
    return <main className="mx-auto max-w-3xl px-6 py-12 text-sm text-red-600">{error}</main>;
  }
  if (!data) return <main className="mx-auto max-w-3xl px-6 py-12">Loading...</main>;

  const { org, members } = data;
  const canManage = org.myRole === "owner" || org.myRole === "admin";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {org.kind} · {org.country ?? "—"} · your role: {org.myRole}
          </p>
        </div>
        <Link href="/orgs" className="text-sm text-gray-500 underline">
          ← All orgs
        </Link>
      </div>

      {org.description && (
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">{org.description}</p>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Members ({members.length})</h2>
        {canManage && (
          <form onSubmit={invite} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="member@example.com"
              className="rounded border px-3 py-2 text-sm"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
              className="rounded border px-3 py-2 text-sm"
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
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {submitting ? "Inviting..." : "Invite"}
            </button>
          </form>
        )}
        <ul className="mt-4 divide-y rounded border">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-medium">{m.user?.displayName ?? m.userId}</div>
                <div className="text-xs text-gray-500">
                  {m.user?.email ?? m.userId} · {m.role} · joined{" "}
                  {new Date(m.joinedAt).toLocaleDateString()}
                </div>
              </div>
              {canManage && m.userId !== org.ownerId && (
                <button
                  onClick={() => removeMember(m.userId)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Classrooms ({classrooms?.length ?? 0})</h2>
        {canManage && (
          <form onSubmit={linkClassroom} className="mt-4 flex gap-2">
            <input
              value={linkClassroomId}
              onChange={(e) => setLinkClassroomId(e.target.value)}
              placeholder="cls_..."
              className="flex-1 rounded border px-3 py-2 font-mono text-sm"
            />
            <button
              type="submit"
              disabled={!linkClassroomId.trim()}
              className="rounded border px-4 py-2 text-sm disabled:opacity-50"
            >
              Link classroom
            </button>
          </form>
        )}
        {classrooms && classrooms.length === 0 && (
          <p className="mt-4 text-sm text-gray-500">No classrooms linked yet.</p>
        )}
        {classrooms && classrooms.length > 0 && (
          <ul className="mt-4 divide-y rounded border">
            {classrooms.map((c) => (
              <li key={c.classroomId} className="p-3 text-sm">
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-gray-500">
                  {c.subject} · status {c.status} ·{" "}
                  <span className="font-mono">{c.classroomId}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {org.kind === "commercial" && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Marketplace listings ({listings?.length ?? 0})
            </h2>
            {canManage && (
              <Link
                href="/seller/listings/new"
                className="text-sm text-gray-500 underline"
              >
                Add listing →
              </Link>
            )}
          </div>
          {listings && listings.length === 0 && (
            <p className="mt-4 text-sm text-gray-500">
              No active listings under this organization.
            </p>
          )}
          {listings && listings.length > 0 && (
            <ul className="mt-4 divide-y rounded border">
              {listings.map((l) => (
                <li
                  key={l.listingId}
                  className="flex items-center justify-between p-3 text-sm"
                >
                  <div>
                    <Link
                      href={`/marketplace/listings/${l.listingId}` as never}
                      className="font-medium underline"
                    >
                      {l.title}
                    </Link>
                    <div className="text-xs text-gray-500">status {l.status}</div>
                  </div>
                  <span className="font-mono">
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
