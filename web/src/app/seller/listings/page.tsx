"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";

type Listing = {
  listingId: string;
  title: string;
  kind?: "digital" | "physical";
  priceCents: number;
  currency: string;
  status: "draft" | "active" | "archived";
  fileS3Key?: string;
  createdAt: string;
  description?: string;
  subjects?: string[];
};

type StatusFilter = "all" | "active" | "draft" | "archived";

const STATUS_STYLES: Record<Listing["status"], { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  draft: { label: "Draft", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  archived: { label: "Archived", color: "text-ink-faded", bg: "bg-parchment-dark border-ink-faded/30" },
};

export default function SellerListingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm: showConfirm } = useDialog();
  const [items, setItems] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  async function load() {
    try {
      const r = await api<{ items: Listing[] }>(`/marketplace/listings/mine`);
      setItems(r.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (currentRole(session) !== "teacher") return router.replace("/dashboard");
      await load();
    })();
  }, [router]);

  async function deleteListing(listingId: string) {
    const ok = await showConfirm({ title: "Delete listing", message: "Delete this listing? Any active orders will be automatically refunded. This cannot be undone.", destructive: true });
    if (!ok) return;
    try {
      const r = await api<{ ok: boolean; ordersRefunded?: number }>(`/marketplace/listings/${listingId}`, { method: "DELETE" });
      if (r.ordersRefunded && r.ordersRefunded > 0) {
        toast(`Listing removed. ${r.ordersRefunded} order(s) were refunded and buyers notified.`, "success");
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleStatus(l: Listing) {
    const newStatus = l.status === "active" ? "archived" : "active";
    try {
      await api(`/marketplace/listings/${l.listingId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await load();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("file_not_uploaded")) {
        setError("Upload a file before publishing this listing.");
      } else {
        setError(msg);
      }
    }
  }

  const filtered = (items ?? [])
    .filter((l) => statusFilter === "all" || l.status === statusFilter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const activeCount = (items ?? []).filter((l) => l.status === "active").length;
  const draftCount = (items ?? []).filter((l) => l.status === "draft").length;
  const archivedCount = (items ?? []).filter((l) => l.status === "archived").length;

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Seller</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">My listings</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Manage your marketplace products and study materials
          </p>
        </div>
        <Link href="/seller/listings/new" className="btn-seal shrink-0">
          New listing
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

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
            <div className="font-display text-2xl text-green-700">{activeCount}</div>
            <div className="text-xs text-ink-faded">Active</div>
          </div>
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-amber-600">{draftCount}</div>
            <div className="text-xs text-ink-faded">Drafts</div>
          </div>
          <div className="card p-3 text-center">
            <div className="font-display text-2xl text-ink-faded">{archivedCount}</div>
            <div className="text-xs text-ink-faded">Archived</div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {items && items.length > 0 && (
        <div className="mt-6 flex gap-1 border-b border-ink-faded/20">
          {(["all", "active", "draft", "archived"] as const).map((f) => {
            const count =
              f === "all"
                ? items.length
                : f === "active"
                  ? activeCount
                  : f === "draft"
                    ? draftCount
                    : archivedCount;
            return (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`border-b-2 px-4 py-2 text-xs font-medium capitalize transition ${
                  statusFilter === f
                    ? "border-seal text-seal"
                    : "border-transparent text-ink-faded hover:text-ink"
                }`}
              >
                {f}
                {count > 0 && (
                  <span className="ml-1.5 text-[10px] text-ink-faded">({count})</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {items && items.length === 0 && (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parchment-dark">
            <span className="text-2xl">🏪</span>
          </div>
          <p className="mt-4 font-display text-lg text-ink">No listings yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            Create your first listing to start selling study materials on the marketplace.
          </p>
          <Link href="/seller/listings/new" className="btn-seal mt-4 inline-block">
            Create listing
          </Link>
        </div>
      )}

      {/* Listing cards */}
      {filtered.length > 0 && (
        <ul className="mt-4 space-y-3">
          {filtered.map((l) => {
            const st = STATUS_STYLES[l.status];
            const hasFile = !!l.fileS3Key;
            return (
              <li key={l.listingId} className="card overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  {/* Kind icon */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-parchment-dark">
                    <span className="text-xl">
                      {l.kind === "physical" ? "📦" : "📄"}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-display text-base text-ink">{l.title}</h3>
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${st.bg} ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-faded">
                      <span className="font-medium text-ink">
                        {formatMoney(l.priceCents, l.currency, { trim: true })}
                      </span>
                      <span>
                        Created{" "}
                        {new Date(l.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {!hasFile && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <span>⚠️</span> No file uploaded
                        </span>
                      )}
                      {l.subjects && l.subjects.length > 0 && (
                        <span>{l.subjects.slice(0, 2).join(", ")}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/marketplace/listings/${l.listingId}` as never}
                      className="rounded-md border border-ink-faded/30 px-3 py-1.5 text-xs text-ink-soft transition hover:bg-parchment-dark hover:text-ink"
                    >
                      View
                    </Link>
                    {l.status !== "archived" && (
                      <button
                        onClick={() => toggleStatus(l)}
                        className={`rounded-md border px-3 py-1.5 text-xs transition ${
                          l.status === "active"
                            ? "border-ink-faded/30 text-ink-faded hover:border-red-200 hover:text-red-600"
                            : "border-seal/40 text-seal hover:bg-seal/10"
                        }`}
                      >
                        {l.status === "active" ? "Archive" : "Publish"}
                      </button>
                    )}
                    {l.status === "archived" && (
                      <button
                        onClick={() => toggleStatus(l)}
                        className="rounded-md border border-ink-faded/30 px-3 py-1.5 text-xs text-ink-faded transition hover:text-ink"
                      >
                        Reactivate
                      </button>
                    )}
                    {(l.status === "draft" || l.status === "archived") && (
                      <button
                        onClick={() => deleteListing(l.listingId)}
                        className="rounded-md border border-ink-faded/30 px-3 py-1.5 text-xs text-red-500 transition hover:border-red-200 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Count */}
      {filtered.length > 0 && (
        <p className="mt-4 text-center text-xs text-ink-faded">
          Showing {filtered.length} listing{filtered.length !== 1 ? "s" : ""}
        </p>
      )}
    </main>
  );
}
