"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { Avatar } from "@/components/Avatar";
import {
  Users,
  GraduationCap,
  CalendarDays,
  CreditCard,
  BookOpen,
  Search,
  Heart,
  ShoppingBag,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";

type ChildLink = {
  parentId: string;
  childId: string;
  relationship: "mother" | "father" | "guardian";
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  child: { userId: string; displayName: string; email: string } | null;
};

type FamilySummary = {
  totalSpentCents: number;
  sessionsAttended: number;
  currency: string;
  childCount: number;
};

type AnalyticsResponse = {
  summary: FamilySummary;
};

const STATUS_CONFIG: Record<
  ChildLink["status"],
  { icon: typeof CheckCircle2; label: string; color: string; bg: string }
> = {
  accepted: {
    icon: CheckCircle2,
    label: "Linked",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
  },
  pending: {
    icon: Clock,
    label: "Pending",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
  },
  rejected: {
    icon: XCircle,
    label: "Declined",
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
  },
};

export default function ParentSpacePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState("there");
  const [unreadCount, setUnreadCount] = useState(0);
  const [children, setChildren] = useState<ChildLink[]>([]);
  const [summary, setSummary] = useState<FamilySummary | null>(null);

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

      api<{ items: ChildLink[] }>("/family/children")
        .then((r) => setChildren(r.items))
        .catch(() => {});

      api<AnalyticsResponse>("/analytics/parent")
        .then((r) => setSummary(r.summary))
        .catch(() => {});
    })();
  }, [router]);

  if (!ready) {
    return (
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
        </div>
      </main>
    );
  }

  const greeting = getGreeting();
  const accepted = children.filter((c) => c.status === "accepted");
  const pending = children.filter((c) => c.status === "pending");

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink">
            {greeting}, {displayName}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Manage your children&apos;s learning journey from one place.
          </p>
        </div>
        <Link href="/parent/children" className="btn-seal shrink-0 inline-flex items-center gap-2">
          <Users size={16} />
          Manage children
        </Link>
      </div>

      {/* Stats cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/parent/children" className="card-interactive p-4 text-center">
          <div className="font-display text-2xl text-ink">{children.length}</div>
          <div className="text-xs text-ink-faded">Children linked</div>
        </Link>
        <Link href="/analytics" className="card-interactive p-4 text-center">
          <div className="font-display text-2xl text-green-700">
            {summary ? summary.sessionsAttended : "..."}
          </div>
          <div className="text-xs text-ink-faded">Sessions attended</div>
        </Link>
        <Link href="/mailbox" className="card-interactive p-4 text-center">
          <div className="font-display text-2xl text-ink">
            {unreadCount > 0 ? unreadCount : "0"}
          </div>
          <div className="text-xs text-ink-faded">Unread messages</div>
        </Link>
        <Link href="/payments" className="card-interactive p-4 text-center">
          <div className="font-display text-2xl text-ink">
            {summary
              ? formatMoney(summary.totalSpentCents, summary.currency, { trim: true })
              : "..."}
          </div>
          <div className="text-xs text-ink-faded">Total spent</div>
        </Link>
      </div>

      {/* Pending requests alert */}
      {pending.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              {pending.length} pending link request{pending.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-1 text-xs text-amber-700">
            Waiting for your child{pending.length !== 1 ? "ren" : ""} to accept the link invitation.
          </p>
        </div>
      )}

      {/* Children overview */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">My children</h2>
          <Link
            href="/parent/children"
            className="inline-flex items-center gap-1 text-xs text-seal hover:underline"
          >
            Manage <ChevronRight size={12} />
          </Link>
        </div>

        {children.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {children.map((c) => {
              const st = STATUS_CONFIG[c.status];
              const StIcon = st.icon;
              return (
                <li key={c.childId} className="card overflow-hidden">
                  <div className="flex items-center gap-4 p-4">
                    <Avatar
                      userId={c.childId}
                      size="md"
                      initial={c.child?.displayName?.charAt(0)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-display text-base text-ink">
                          {c.child?.displayName ?? c.child?.email ?? "Child"}
                        </span>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${st.bg} ${st.color}`}
                        >
                          <StIcon size={10} />
                          {st.label}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-faded">
                        {c.child?.email && <span>{c.child.email}</span>}
                        <span className="capitalize">{c.relationship}</span>
                      </div>
                    </div>
                    {c.status === "accepted" && (
                      <Link
                        href="/analytics"
                        className="shrink-0 rounded-md border border-ink-faded/30 px-3 py-1.5 text-xs text-ink-soft transition hover:bg-parchment-dark hover:text-ink"
                      >
                        View progress
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="card mt-3 p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parchment-dark">
              <Users size={28} className="text-ink-faded" />
            </div>
            <p className="mt-4 font-display text-lg text-ink">No children linked yet</p>
            <p className="mt-1 text-sm text-ink-soft">
              Link your child&apos;s EduBoost student account to track their learning progress.
            </p>
            <Link href="/parent/children" className="btn-seal mt-4 inline-block">
              Add a child
            </Link>
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="mt-8">
        <h2 className="font-display text-lg text-ink">Quick actions</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/teachers" className="card-interactive group flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-parchment-dark">
              <Search size={18} className="text-ink-faded group-hover:text-seal" />
            </div>
            <div>
              <div className="font-display text-sm text-ink group-hover:text-seal">
                Find a teacher
              </div>
              <div className="text-xs text-ink-soft">Browse verified tutors</div>
            </div>
          </Link>
          <Link href="/calendar" className="card-interactive group flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-parchment-dark">
              <CalendarDays size={18} className="text-ink-faded group-hover:text-seal" />
            </div>
            <div>
              <div className="font-display text-sm text-ink group-hover:text-seal">
                View calendar
              </div>
              <div className="text-xs text-ink-soft">Upcoming sessions & events</div>
            </div>
          </Link>
          <Link href="/analytics" className="card-interactive group flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-parchment-dark">
              <GraduationCap size={18} className="text-ink-faded group-hover:text-seal" />
            </div>
            <div>
              <div className="font-display text-sm text-ink group-hover:text-seal">
                Family analytics
              </div>
              <div className="text-xs text-ink-soft">Grades, attendance & spending</div>
            </div>
          </Link>
          <Link href="/payments" className="card-interactive group flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-parchment-dark">
              <CreditCard size={18} className="text-ink-faded group-hover:text-seal" />
            </div>
            <div>
              <div className="font-display text-sm text-ink group-hover:text-seal">
                Payments
              </div>
              <div className="text-xs text-ink-soft">View transaction history</div>
            </div>
          </Link>
          <Link href="/favorites" className="card-interactive group flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-parchment-dark">
              <Heart size={18} className="text-ink-faded group-hover:text-seal" />
            </div>
            <div>
              <div className="font-display text-sm text-ink group-hover:text-seal">
                Saved teachers
              </div>
              <div className="text-xs text-ink-soft">Bookmarked teachers</div>
            </div>
          </Link>
          <Link href="/marketplace" className="card-interactive group flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-parchment-dark">
              <ShoppingBag size={18} className="text-ink-faded group-hover:text-seal" />
            </div>
            <div>
              <div className="font-display text-sm text-ink group-hover:text-seal">
                Marketplace
              </div>
              <div className="text-xs text-ink-soft">Study materials & exam banks</div>
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
