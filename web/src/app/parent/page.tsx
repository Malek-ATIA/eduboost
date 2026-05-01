"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";

type Child = {
  childId: string;
  childName?: string;
  childEmail?: string;
};

export default function ParentSpacePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState("there");
  const [unreadCount, setUnreadCount] = useState(0);
  const [children, setChildren] = useState<Child[]>([]);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      const role = currentRole(s);
      if (role !== "parent" && !isAdmin(s)) return router.replace("/dashboard");
      const payload = s.getIdToken().payload;
      setDisplayName(
        (payload.name as string) ??
          (payload.email as string)?.split("@")[0] ??
          "there",
      );
      setReady(true);

      api<{ count: number }>("/notifications/unread-count")
        .then((r) => setUnreadCount(r.count))
        .catch(() => {});

      api<{ items: Child[] }>("/parent/children")
        .then((r) => setChildren(r.items))
        .catch(() => {});
    })();
  }, [router]);

  if (!ready)
    return <main className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  const greeting = getGreeting();

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
      <h1 className="font-display text-3xl tracking-tight text-ink">
        {greeting}, {displayName}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Manage your children&apos;s learning from one place.
      </p>

      {/* ── Quick stats ────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Link href="/parent/children" className="card-interactive p-4 text-center">
          <div className="font-display text-2xl text-ink">{children.length}</div>
          <div className="text-xs text-ink-faded">Children</div>
        </Link>
        <Link href="/mailbox" className="card-interactive p-4 text-center">
          <div className="font-display text-2xl text-ink">{unreadCount}</div>
          <div className="text-xs text-ink-faded">Unread messages</div>
        </Link>
        <Link href="/payments" className="card-interactive p-4 text-center">
          <div className="font-display text-2xl text-ink">—</div>
          <div className="text-xs text-ink-faded">Payments</div>
        </Link>
      </div>

      {/* ── Children overview ──────────────────────────────── */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">My children</h2>
          <Link href="/parent/children" className="text-xs text-seal hover:underline">
            Manage
          </Link>
        </div>
        {children.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {children.map((c) => (
              <li key={c.childId} className="card flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-medium text-ink">
                    {c.childName ?? c.childEmail ?? "Child"}
                  </div>
                  {c.childEmail && c.childName && (
                    <div className="text-xs text-ink-faded">{c.childEmail}</div>
                  )}
                </div>
                <Link
                  href="/analytics"
                  className="text-xs font-medium text-seal hover:underline"
                >
                  View progress
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card mt-3 p-6 text-center">
            <p className="text-sm text-ink-soft">
              No children linked yet.
            </p>
            <Link href="/parent/children" className="btn-secondary mt-3 inline-block">
              Add a child
            </Link>
          </div>
        )}
      </section>

      {/* ── Quick actions ──────────────────────────────────── */}
      <section className="mt-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/teachers" className="card-interactive group p-4">
            <div className="font-display text-base text-ink group-hover:text-seal">
              Find a teacher
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">
              Browse verified tutors for your children
            </div>
          </Link>
          <Link href="/calendar" className="card-interactive group p-4">
            <div className="font-display text-base text-ink group-hover:text-seal">
              View calendar
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">
              Upcoming sessions and events
            </div>
          </Link>
          <Link href="/favorites" className="card-interactive group p-4">
            <div className="font-display text-base text-ink group-hover:text-seal">
              Saved teachers
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">
              Teachers and resources you bookmarked
            </div>
          </Link>
          <Link href="/marketplace" className="card-interactive group p-4">
            <div className="font-display text-base text-ink group-hover:text-seal">
              Browse marketplace
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">
              Study materials and exam banks
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
