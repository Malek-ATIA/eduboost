"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Ticket = {
  ticketId: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  open: "text-blue-700",
  in_review: "text-yellow-700",
  awaiting_user: "text-orange-700",
  resolved: "text-green-700",
  closed: "text-gray-500",
};

export default function SupportPage() {
  const router = useRouter();
  const [items, setItems] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      try {
        const r = await api<{ items: Ticket[] }>(`/support/tickets/mine`);
        setItems(r.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support & disputes</h1>
          <p className="mt-1 text-sm text-gray-500">
            File a dispute or contact the EduBoost team.
          </p>
        </div>
        <Link
          href="/support/new"
          className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          New ticket
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No tickets yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((t) => (
            <li key={t.ticketId}>
              <Link
                href={`/support/${t.ticketId}` as never}
                className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <div>
                  <div className="font-medium">{t.subject}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    #{t.ticketId} · {t.category.replace(/_/g, " ")} · updated{" "}
                    {new Date(t.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <span className={`text-xs uppercase ${STATUS_COLORS[t.status] ?? ""}`}>
                  {t.status.replace(/_/g, " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
