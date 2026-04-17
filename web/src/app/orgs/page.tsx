"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Org = {
  orgId: string;
  name: string;
  kind: "educational" | "commercial";
  country?: string;
  myRole: "owner" | "admin" | "teacher" | "student";
  createdAt: string;
};

export default function OrgsListPage() {
  const router = useRouter();
  const [items, setItems] = useState<Org[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      try {
        const r = await api<{ items: Org[] }>(`/orgs/mine`);
        setItems(r.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <Link
          href="/orgs/new"
          className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          New organization
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">You aren&apos;t part of any organization yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((o) => (
            <li key={o.orgId}>
              <Link
                href={`/orgs/${o.orgId}` as never}
                className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{o.name}</div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {o.kind} · {o.country ?? "—"} · your role: {o.myRole}
                    </div>
                  </div>
                  <span className="font-mono text-xs text-gray-400">{o.orgId}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-gray-500 underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
