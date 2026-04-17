"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession, isAdmin } from "@/lib/cognito";

export default function AdminHubPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      if (!isAdmin(session)) {
        router.replace("/dashboard");
        return;
      }
      setReady(true);
    })();
  }, [router]);

  if (!ready) return <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Internal</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Admin</h1>
      <p className="mt-2 text-sm text-ink-soft">Internal tools for platform operations.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <AdminCard
          href="/admin/users"
          label="Users"
          description="Browse by role, ban or unban users, look up by email"
        />
        <AdminCard
          href="/admin/tickets"
          label="Support tickets"
          description="All tickets across users; filter by status"
        />
        <AdminCard
          href="/admin/verifications"
          label="Teacher verifications"
          description="Approve or reject pending teacher profile verifications"
        />
      </div>
    </main>
  );
}

function AdminCard({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <Link
      href={href as never}
      className="card-interactive block p-4"
    >
      <div className="font-display text-base text-ink">{label}</div>
      <div className="mt-1 text-sm text-ink-soft">{description}</div>
    </Link>
  );
}
