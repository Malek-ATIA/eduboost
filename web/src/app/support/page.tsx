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
  open: "text-accent",
  in_review: "text-ink-faded",
  awaiting_user: "text-ink-faded",
  resolved: "text-ink",
  closed: "text-ink-faded",
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
    <main className="pb-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Help</div>
          <h1 className="mt-3 text-[clamp(28px,3vw,40px)] font-bold tracking-[-0.018em]">
            Support & disputes
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            File a dispute or contact the EduBoost team.
          </p>
        </div>
        <Link
          href="/support/new"
          className="btn-seal"
        >
          New ticket
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No tickets yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-rule">
          {items.map((t) => (
            <li key={t.ticketId}>
              <Link
                href={`/support/${t.ticketId}` as never}
                className="flex items-center justify-between gap-3 p-4 transition hover:bg-bg-soft"
              >
                <div>
                  <div className="font-semibold text-[15px] text-ink">{t.subject}</div>
                  <div className="mt-0.5 text-xs text-ink-faded">
                    <span className="font-mono">#{t.ticketId}</span> · {t.category.replace(/_/g, " ")} · updated{" "}
                    {new Date(t.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <span className={`text-xs uppercase tracking-widest ${STATUS_COLORS[t.status] ?? ""}`}>
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
