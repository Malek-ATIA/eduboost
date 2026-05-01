"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { Avatar } from "@/components/Avatar";

type TeacherTarget = {
  id: string;
  displayName: string;
  bio?: string;
  subjects: string[];
  ratingAvg: number;
  ratingCount: number;
  hourlyRateCents: number;
  currency: string;
};

type OrgTarget = {
  id: string;
  displayName: string;
  kind: "educational" | "commercial";
};

type Favorite = {
  userId: string;
  favoriteId: string;
  kind: "teacher" | "organization";
  createdAt: string;
  target: TeacherTarget | OrgTarget | null;
};

type FilterKind = "all" | "teacher" | "organization";

export default function FavoritesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Favorite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<FilterKind>("all");
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api<{ items: Favorite[] }>(`/favorites/mine`);
      setItems(r.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      await load();
    })();
  }, [router]);

  async function remove(favoriteId: string) {
    setRemovingId(favoriteId);
    try {
      await api(`/favorites/${favoriteId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRemovingId(null);
    }
  }

  const filtered = (items ?? [])
    .filter((f) => filterKind === "all" || f.kind === filterKind)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const teacherCount = (items ?? []).filter((f) => f.kind === "teacher").length;
  const orgCount = (items ?? []).filter((f) => f.kind === "organization").length;

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Bookmarks</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">My favorites</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {items && items.length > 0
              ? `${items.length} saved item${items.length !== 1 ? "s" : ""}`
              : "Save teachers and organizations for quick access"}
          </p>
        </div>
        <Link href="/teachers" className="btn-ghost shrink-0">
          Browse teachers
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}

      {/* Loading */}
      {items === null && !error && (
        <div className="mt-8 flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
        </div>
      )}

      {/* Stats */}
      {items && items.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-ink">{items.length}</div>
            <div className="text-xs text-ink-faded">Total saved</div>
          </div>
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-ink">{teacherCount}</div>
            <div className="text-xs text-ink-faded">Teachers</div>
          </div>
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-ink">{orgCount}</div>
            <div className="text-xs text-ink-faded">Organizations</div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {items && items.length > 0 && (
        <div className="mt-6 flex gap-1 border-b border-ink-faded/20">
          {(["all", "teacher", "organization"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterKind(f)}
              className={`border-b-2 px-4 py-2 text-xs font-medium capitalize transition ${
                filterKind === f
                  ? "border-seal text-seal"
                  : "border-transparent text-ink-faded hover:text-ink"
              }`}
            >
              {f === "all" ? "All" : f === "teacher" ? "Teachers" : "Organizations"}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {items && items.length === 0 && (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parchment-dark">
            <span className="text-2xl">❤️</span>
          </div>
          <p className="mt-4 font-display text-lg text-ink">No favorites yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            Bookmark a teacher from their profile to save them for later.
          </p>
          <Link href="/teachers" className="btn-seal mt-4 inline-block">
            Find teachers
          </Link>
        </div>
      )}

      {/* Favorites list */}
      {filtered.length > 0 && (
        <ul className="mt-4 space-y-3">
          {filtered.map((f) => {
            if (!f.target) {
              return (
                <li key={f.favoriteId} className="card flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-parchment-dark text-ink-faded">
                      ?
                    </div>
                    <div>
                      <span className="text-sm italic text-ink-faded">Removed {f.kind}</span>
                      <div className="text-xs text-ink-faded">
                        Saved {new Date(f.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(f.favoriteId)}
                    disabled={removingId === f.favoriteId}
                    className="rounded-md border border-ink-faded/30 px-3 py-1.5 text-xs text-ink-faded transition hover:border-red-200 hover:text-red-600"
                  >
                    Remove
                  </button>
                </li>
              );
            }

            const t = f.target;
            const isTeacher = f.kind === "teacher" && "subjects" in t;

            return (
              <li key={f.favoriteId} className="card overflow-hidden transition hover:shadow-md">
                <div className="flex items-center gap-4 p-4">
                  {/* Avatar */}
                  <Avatar userId={t.id} size="md" initial={t.displayName?.charAt(0)} />

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={
                          f.kind === "teacher"
                            ? `/teachers/${t.id}`
                            : (`/orgs/${t.id}` as never)
                        }
                        className="font-display text-base text-ink hover:text-seal transition"
                      >
                        {t.displayName}
                      </Link>
                      <span className="rounded-full border border-ink-faded/30 bg-parchment-dark px-2 py-0.5 text-[10px] uppercase tracking-widest text-ink-faded">
                        {f.kind}
                      </span>
                    </div>

                    {isTeacher && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-faded">
                        {(t as TeacherTarget).subjects.length > 0 && (
                          <span>{(t as TeacherTarget).subjects.slice(0, 3).join(", ")}</span>
                        )}
                        <span>
                          {(t as TeacherTarget).ratingCount > 0
                            ? `★ ${(t as TeacherTarget).ratingAvg.toFixed(1)} (${(t as TeacherTarget).ratingCount})`
                            : "New teacher"}
                        </span>
                        <span className="font-medium text-ink">
                          {formatMoney((t as TeacherTarget).hourlyRateCents, (t as TeacherTarget).currency, { trim: true })}/hr
                        </span>
                      </div>
                    )}

                    {!isTeacher && "kind" in t && (
                      <div className="mt-1 text-xs text-ink-faded capitalize">
                        {(t as OrgTarget).kind} organization
                      </div>
                    )}

                    <div className="mt-0.5 text-xs text-ink-faded">
                      Saved {new Date(f.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    {isTeacher && (
                      <Link
                        href={`/teachers/${t.id}`}
                        className="rounded-md border border-seal/40 bg-seal/10 px-3 py-1.5 text-xs font-medium text-seal transition hover:bg-seal/20"
                      >
                        Book
                      </Link>
                    )}
                    <button
                      onClick={() => remove(f.favoriteId)}
                      disabled={removingId === f.favoriteId}
                      className="rounded-md border border-ink-faded/30 px-3 py-1.5 text-xs text-ink-faded transition hover:border-red-200 hover:text-red-600"
                    >
                      {removingId === f.favoriteId ? "..." : "Remove"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
