"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, isAdmin } from "@/lib/cognito";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";

type Row = {
  studentId: string;
  displayName?: string;
  email?: string;
  bookingCount: number;
  classroomCount: number;
  lastEngagementAt: string;
};

type SortKey = "name" | "recent" | "bookings" | "classrooms";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function TeacherStudentsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("recent");

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      if (currentRole(s) !== "teacher" && !isAdmin(s)) return router.replace("/dashboard");
      setReady(true);
      try {
        const r = await api<{ items: Row[] }>(`/teachers/me/students`);
        setItems(r.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  if (!ready) {
    return (
      <main className="pb-8">
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
        </div>
      </main>
    );
  }

  const filtered = (items ?? [])
    .filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (r.displayName ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        r.studentId.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "name") return (a.displayName ?? "").localeCompare(b.displayName ?? "");
      if (sortBy === "bookings") return b.bookingCount - a.bookingCount;
      if (sortBy === "classrooms") return b.classroomCount - a.classroomCount;
      return new Date(b.lastEngagementAt).getTime() - new Date(a.lastEngagementAt).getTime();
    });

  const totalBookings = (items ?? []).reduce((sum, r) => sum + r.bookingCount, 0);

  return (
    <main className="pb-8">
      {/* Header */}
      <div>
        <div className="eyebrow">Teacher · Classroom portal</div>
        <h1 className="mt-3 text-[clamp(28px,3vw,40px)] font-bold tracking-[-0.018em]">My students</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Students from bookings and classroom enrollments
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {/* Loading */}
      {items === null && !error && (
        <div className="mt-8 flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
        </div>
      )}

      {/* Stats */}
      {items && items.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <div className="font-bold text-[22px] text-ink">{items.length}</div>
            <div className="text-xs text-ink-faded">Students</div>
          </div>
          <div className="card p-3 text-center">
            <div className="font-bold text-[22px] text-ink">{totalBookings}</div>
            <div className="text-xs text-ink-faded">Total bookings</div>
          </div>
          <div className="card p-3 text-center">
            <div className="font-bold text-[22px] text-ink">
              {items.filter((r) => {
                const d = Date.now() - new Date(r.lastEngagementAt).getTime();
                return d < 30 * 86_400_000;
              }).length}
            </div>
            <div className="text-xs text-ink-faded">Active (30d)</div>
          </div>
        </div>
      )}

      {/* Search & sort */}
      {items && items.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="input w-full sm:w-72"
          />
          <div className="flex items-center gap-1 rounded-md border border-rule p-0.5">
            {(["recent", "name", "bookings", "classrooms"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`rounded px-3 py-1 text-xs font-medium capitalize transition ${
                  sortBy === s
                    ? "bg-bg-soft text-ink"
                    : "text-ink-faded hover:text-ink"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {items && items.length === 0 && (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-bg-soft">
            <span className="text-2xl">👥</span>
          </div>
          <p className="mt-4 font-semibold text-base text-ink">No students yet</p>
          <p className="mt-3 text-sm text-ink-soft">
            Students will appear here after their first booking or classroom enrollment.
          </p>
        </div>
      )}

      {/* Student list */}
      {filtered.length > 0 && (
        <ul className="mt-4 space-y-2">
          {filtered.map((r) => (
            <li key={r.studentId}>
              <Link
                href={`/teacher/students/${r.studentId}` as never}
                className="card group flex items-center gap-4 p-4 transition hover:shadow-md"
              >
                <Avatar userId={r.studentId} size="md" initial={r.displayName?.charAt(0)} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-[15px] text-ink group-hover:text-accent transition-colors">
                      {r.displayName ?? r.email ?? r.studentId}
                    </h3>
                  </div>
                  {r.email && r.displayName && (
                    <div className="mt-0.5 text-xs text-ink-faded">{r.email}</div>
                  )}
                </div>

                <div className="hidden shrink-0 gap-4 text-center sm:flex">
                  <div>
                    <div className="font-semibold text-[13.5px] text-ink">{r.bookingCount}</div>
                    <div className="text-[10px] text-ink-faded">Bookings</div>
                  </div>
                  <div>
                    <div className="font-semibold text-[13.5px] text-ink">{r.classroomCount}</div>
                    <div className="text-[10px] text-ink-faded">Classes</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-faded">{timeAgo(r.lastEngagementAt)}</div>
                    <div className="text-[10px] text-ink-faded">Last active</div>
                  </div>
                </div>

                <span className="text-ink-faded">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* No search results */}
      {items && items.length > 0 && filtered.length === 0 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-ink-soft">No students match "{search}"</p>
          <button
            onClick={() => setSearch("")}
            className="mt-2 text-sm text-red-600 hover:underline"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Count */}
      {filtered.length > 0 && (
        <p className="mt-4 text-center text-xs text-ink-faded">
          Showing {filtered.length} student{filtered.length !== 1 ? "s" : ""}
        </p>
      )}
    </main>
  );
}
