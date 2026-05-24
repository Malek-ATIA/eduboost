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
    <main className="pb-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Teams</div>
          <h1 className="mt-3 text-[clamp(28px,3vw,40px)] font-bold tracking-[-0.018em]">Organizations</h1>
        </div>
        <Link
          href="/orgs/new"
          className="btn-seal"
        >
          New organization
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">You aren&apos;t part of any organization yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-rule">
          {items.map((o) => (
            <li key={o.orgId}>
              <Link
                href={`/orgs/${o.orgId}` as never}
                className="block p-4 transition hover:bg-bg-soft"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[15px] text-ink">{o.name}</div>
                    <div className="mt-0.5 text-xs text-ink-faded">
                      {o.kind} · {o.country ?? "—"} · your role: {o.myRole}
                    </div>
                  </div>
                  <span className="font-mono text-xs text-ink-faded">{o.orgId}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
</main>
  );
}
