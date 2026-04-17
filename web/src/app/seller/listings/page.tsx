"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Listing = {
  listingId: string;
  title: string;
  priceCents: number;
  currency: string;
  status: "draft" | "active" | "archived";
  fileS3Key?: string;
  createdAt: string;
};

const STATUS_COLORS: Record<Listing["status"], string> = {
  draft: "text-yellow-700",
  active: "text-green-700",
  archived: "text-gray-500",
};

export default function SellerListingsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        alert("Upload a file before publishing this listing.");
      } else {
        alert(msg);
      }
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My listings</h1>
        <Link
          href="/seller/listings/new"
          className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          New listing
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Digital study materials you sell on the marketplace.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No listings yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((l) => (
            <li key={l.listingId} className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{l.title}</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {l.currency} {(l.priceCents / 100).toFixed(2)} · created{" "}
                  {new Date(l.createdAt).toLocaleDateString()}
                  {!l.fileS3Key && " · file not uploaded"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs uppercase ${STATUS_COLORS[l.status]}`}>
                  {l.status}
                </span>
                {l.status !== "archived" && (
                  <button
                    onClick={() => toggleStatus(l)}
                    className="rounded border px-3 py-1 text-xs"
                  >
                    {l.status === "active" ? "Archive" : "Publish"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
