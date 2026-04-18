"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

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

export default function FavoritesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Favorite[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    try {
      await api(`/favorites/${favoriteId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Bookmarks</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">My favorites</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Teachers and organizations you&apos;ve saved for later.
      </p>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && (
        <p className="mt-6 text-sm text-ink-soft">Loading...</p>
      )}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">
          No favorites yet. Bookmark a teacher from their profile to save them here.
        </p>
      )}

      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-ink-faded/30">
          {items.map((f) => {
            if (!f.target) {
              return (
                <li key={f.favoriteId} className="flex items-center justify-between p-4 text-sm">
                  <span className="text-ink-faded italic">
                    (removed {f.kind}) · <span className="font-mono">{f.favoriteId}</span>
                  </span>
                  <button
                    onClick={() => remove(f.favoriteId)}
                    className="btn-ghost text-seal"
                  >
                    Remove
                  </button>
                </li>
              );
            }
            const t = f.target;
            return (
              <li key={f.favoriteId} className="flex items-center justify-between p-4">
                <div>
                  <Link
                    href={
                      f.kind === "teacher"
                        ? `/teachers/${t.id}`
                        : (`/orgs/${t.id}` as never)
                    }
                    className="font-display text-base text-ink"
                  >
                    {t.displayName}
                  </Link>
                  {f.kind === "teacher" && "subjects" in t && (
                    <div className="mt-0.5 text-xs text-ink-faded">
                      {t.subjects.slice(0, 3).join(" · ") || "No subjects"} ·{" "}
                      {t.ratingCount > 0
                        ? `★ ${t.ratingAvg.toFixed(1)} (${t.ratingCount})`
                        : "New"}{" "}
                      · €{Math.round(t.hourlyRateCents / 100)}/hr
                    </div>
                  )}
                  {f.kind === "organization" && "kind" in t && (
                    <div className="mt-0.5 text-xs text-ink-faded">
                      {t.kind} org
                    </div>
                  )}
                </div>
                <button
                  onClick={() => remove(f.favoriteId)}
                  className="btn-ghost text-seal"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-ink-soft underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
