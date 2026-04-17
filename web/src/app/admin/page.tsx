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

  if (!ready) return <main className="mx-auto max-w-3xl px-6 py-12">Loading...</main>;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="mt-2 text-sm text-gray-500">Internal tools for platform operations.</p>

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
      className="block rounded border p-4 transition hover:border-black dark:hover:border-white"
    >
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-sm text-gray-500">{description}</div>
    </Link>
  );
}
