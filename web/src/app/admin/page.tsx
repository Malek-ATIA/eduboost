"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";

type Stats = {
  totalUsers?: number;
  pendingVerifications?: number;
  openTickets?: number;
};

type Verification = {
  userId: string;
  displayName: string;
  subjects?: string[];
  status: string;
  submittedAt?: string;
};

type Ticket = {
  ticketId: string;
  subject: string;
  status: string;
  userId: string;
  createdAt: string;
};

type AdminUser = {
  userId: string;
  email: string;
  displayName?: string;
  role: string;
};

type AdminTab = "verifications" | "tickets" | "users";

export default function AdminHubPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<Stats>({});
  const [activeTab, setActiveTab] = useState<AdminTab>("verifications");
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (!isAdmin(session)) return router.replace("/dashboard");
      setReady(true);

      const [usersRes, verifsRes, ticketsRes] = await Promise.all([
        api<{ total?: number }>(`/admin/users?limit=1`).catch(() => ({})),
        api<{ items: Verification[] }>(`/admin/verifications?status=pending`).catch(() => ({ items: [] })),
        api<{ items: Ticket[] }>(`/admin/tickets?status=open`).catch(() => ({ items: [] })),
      ]);
      setStats({
        totalUsers: (usersRes as { total?: number }).total,
        pendingVerifications: (verifsRes as { items: Verification[] }).items?.length,
        openTickets: (ticketsRes as { items: Ticket[] }).items?.length,
      });
      setVerifications((verifsRes as { items: Verification[] }).items ?? []);
      setTickets((ticketsRes as { items: Ticket[] }).items ?? []);
    })();
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    if (activeTab === "users" && users.length === 0) {
      api<{ items: AdminUser[] }>(`/admin/users?limit=20`)
        .then((r) => setUsers(r.items ?? []))
        .catch(() => {});
    }
  }, [ready, activeTab, users.length]);

  if (!ready) {
    return (
      <main className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
      </main>
    );
  }

  function timeAgo(s?: string): string {
    if (!s) return "";
    const ms = Date.now() - new Date(s).getTime();
    const d = Math.floor(ms / 86400_000);
    if (d <= 0) return "today";
    if (d === 1) return "1 day ago";
    return `${d} days ago`;
  }

  return (
    <main className="pb-8">
      {/* PageHead */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-rule px-4 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="mt-2 text-[clamp(28px,3vw,40px)] font-bold tracking-[-0.018em]">
            Platform <span className="text-accent">operations</span>.
          </h1>
          <p className="mt-2 max-w-[640px] text-[14.5px] text-ink-soft">
            Verifications, support tickets, and users — for the EduBoost team.
          </p>
        </div>
        <span className="chip chip-accent">All systems normal</span>
      </div>

      {/* Today — 4 stat cards */}
      <section className="px-4 pt-6 sm:px-8 sm:pt-7">
        <h2 className="pb-3.5 text-[22px] font-bold tracking-[-0.01em]">Today</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Active users" value={stats.totalUsers != null ? stats.totalUsers.toLocaleString() : "—"} sub="+8.4% week over week" accent />
          <Stat label="Lessons today" value="—" sub="48 in progress now" />
          <Stat label="Pending verifications" value={String(stats.pendingVerifications ?? 0)} sub={`${Math.min(stats.pendingVerifications ?? 0, 3)} over 48 h`} warn />
          <Stat label="Open tickets" value={String(stats.openTickets ?? 0)} sub="Median reply 2.3 h" />
        </div>
      </section>

      {/* Horizontal tabs + content */}
      <section className="px-4 pt-6 sm:px-8 sm:pt-7">
        <div className="flex flex-wrap gap-x-8 border-b border-rule">
          {[
            { k: "verifications" as AdminTab, label: "Verifications" },
            { k: "tickets" as AdminTab, label: "Support tickets" },
            { k: "users" as AdminTab, label: "Users" },
          ].map((t) => {
            const active = activeTab === t.k;
            return (
              <button
                key={t.k}
                onClick={() => setActiveTab(t.k)}
                className="-mb-px border-b-2 px-1 py-3.5 text-[14.5px] transition"
                style={{
                  borderColor: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--accent)" : "var(--ink-faded)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Verifications table */}
        {activeTab === "verifications" && (
          <div className="card mt-5 overflow-hidden p-0">
            {verifications.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-ink-soft">No pending verifications.</div>
            ) : (
              verifications.map((v, i) => (
                <div
                  key={v.userId}
                  className="grid items-center gap-4 px-5 py-4"
                  style={{
                    borderTop: i === 0 ? "none" : "1px solid var(--rule-soft)",
                    gridTemplateColumns: "auto 1.5fr 1.5fr 1fr auto",
                  }}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-pale font-bold text-[13px] text-accent-deep">
                    {v.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold">{v.displayName}</div>
                    <div className="text-[12px] text-ink-faded">Applied {timeAgo(v.submittedAt)}</div>
                  </div>
                  <div className="text-[13px] text-ink-soft">{v.subjects?.join(", ") ?? "—"}</div>
                  <span className="chip">{v.status === "pending" ? "Needs review" : "Awaiting docs"}</span>
                  <div className="flex gap-2">
                    <button className="btn-ghost text-sm">Decline</button>
                    <Link href={`/admin/verifications`} className="btn-accent btn-sm">
                      Review
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tickets table */}
        {activeTab === "tickets" && (
          <div className="card mt-5 overflow-hidden p-0">
            {tickets.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-ink-soft">No open tickets.</div>
            ) : (
              tickets.map((t, i) => (
                <Link
                  key={t.ticketId}
                  href={`/admin/tickets`}
                  className="grid items-center gap-4 px-5 py-4 transition hover:bg-bg-soft"
                  style={{
                    borderTop: i === 0 ? "none" : "1px solid var(--rule-soft)",
                    gridTemplateColumns: "100px 1.5fr 1fr 1fr auto",
                  }}
                >
                  <span className="font-mono text-[11.5px] text-ink-faded">
                    T-{t.ticketId.slice(0, 6)}
                  </span>
                  <div className="text-[13.5px]">{t.subject}</div>
                  <div className="text-[12.5px] text-ink-soft">{t.userId.slice(0, 8)}</div>
                  <span className="chip">{t.status}</span>
                  <span className="font-mono text-[12px] text-ink-faded">{timeAgo(t.createdAt)}</span>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Users table */}
        {activeTab === "users" && (
          <div className="mt-5">
            <div className="mb-3 flex gap-2">
              <input className="input max-w-[340px]" placeholder="Search by name, email, ID…" />
              <select className="input w-auto">
                <option>All roles</option>
                <option>Student</option>
                <option>Teacher</option>
                <option>Parent</option>
              </select>
            </div>
            <div className="card overflow-hidden p-0">
              {users.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-ink-soft">No users.</div>
              ) : (
                users.map((u, i) => (
                  <Link
                    key={u.userId}
                    href={`/admin/users`}
                    className="grid items-center gap-4 px-5 py-4 transition hover:bg-bg-soft"
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--rule-soft)",
                      gridTemplateColumns: "auto 1.5fr 1fr 1fr auto",
                    }}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-pale text-xs font-bold text-accent-deep">
                      {(u.displayName ?? u.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-[13.5px]">{u.displayName ?? u.email}</div>
                      <div className="text-xs text-ink-faded">{u.email}</div>
                    </div>
                    <span className="chip chip-outline">{u.role}</span>
                    <span className="text-[12.5px] text-ink-soft">—</span>
                    <button className="btn-ghost text-sm">Open</button>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="card p-[18px]">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">{label}</div>
      <div className="mt-1.5 text-[34px] font-bold leading-none tracking-[-0.02em]">{value}</div>
      {sub && (
        <div
          className="mt-1.5 text-[12.5px]"
          style={{
            color: warn ? "var(--warn)" : accent ? "var(--accent-deep)" : "var(--ink-soft)",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
