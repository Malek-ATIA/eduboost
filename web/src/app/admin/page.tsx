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

export default function AdminHubPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<Stats>({});

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (!isAdmin(session)) return router.replace("/dashboard");
      setReady(true);

      const [users, verifications, tickets] = await Promise.all([
        api<{ total?: number }>(`/admin/users?limit=1`).catch(() => ({})),
        api<{ items: unknown[] }>(`/admin/verifications?status=pending`).catch(() => ({ items: [] })),
        api<{ items: unknown[] }>(`/admin/tickets?status=open`).catch(() => ({ items: [] })),
      ]);
      setStats({
        totalUsers: (users as { total?: number }).total,
        pendingVerifications: (verifications as { items: unknown[] }).items?.length,
        openTickets: (tickets as { items: unknown[] }).items?.length,
      });
    })();
  }, [router]);

  if (!ready) {
    return (
      <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
      {/* Page head */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl lg:text-7xl">
            Platform <span className="italic">operations</span>.
          </h1>
          <p className="mt-3 text-base text-ink-soft">
            Verifications, support tickets, and users — for the EduBoost team.
          </p>
        </div>
        <span className="chip-accent">All systems normal</span>
      </div>

      {/* Stat cards */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faded">
            Total users
          </div>
          <div className="mt-1 font-serif text-[32px] tracking-tight text-ink">
            {stats.totalUsers ?? "—"}
          </div>
        </div>
        <div className="card p-5">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faded">
            Pending verifications
          </div>
          <div className="mt-1 font-serif text-[32px] tracking-tight text-ink">
            {stats.pendingVerifications ?? "—"}
          </div>
          {(stats.pendingVerifications ?? 0) > 0 && (
            <div className="mt-1 text-[13px] text-red-600">Needs attention</div>
          )}
        </div>
        <div className="card p-5">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faded">
            Open tickets
          </div>
          <div className="mt-1 font-serif text-[32px] tracking-tight text-ink">
            {stats.openTickets ?? "—"}
          </div>
        </div>
        <div className="card p-5">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faded">
            Platform
          </div>
          <div className="mt-1 font-serif text-[32px] tracking-tight text-accent">
            OK
          </div>
        </div>
      </div>

      {/* Navigation cards */}
      <div className="mt-8 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/verifications" className="card-interactive p-6">
          <h2 className="font-serif text-2xl">Teacher verifications</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
            Approve or reject pending teacher profile verifications.
          </p>
        </Link>
        <Link href="/admin/tickets" className="card-interactive p-6">
          <h2 className="font-serif text-2xl">Support tickets</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
            All tickets across users — filter by status, track SLA.
          </p>
        </Link>
        <Link href="/admin/users" className="card-interactive p-6">
          <h2 className="font-serif text-2xl">Users</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
            Browse by role, ban or unban users, look up by email.
          </p>
        </Link>
      </div>
    </main>
  );
}
