"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type NewListing = {
  listingId: string;
};

type MyOrg = {
  orgId: string;
  name: string;
  kind: "educational" | "commercial";
  myRole: "owner" | "admin" | "teacher" | "student";
};

export default function NewSellerListingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<"digital" | "physical">("digital");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjects, setSubjects] = useState("");
  const [priceEur, setPriceEur] = useState("10");
  const [shippingEur, setShippingEur] = useState("0");
  const [inStockCount, setInStockCount] = useState("1");
  const [shipsFrom, setShipsFrom] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [commercialOrgs, setCommercialOrgs] = useState<MyOrg[]>([]);
  const [sellerOrgId, setSellerOrgId] = useState("");

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (currentRole(session) !== "teacher") return router.replace("/dashboard");
      setReady(true);
      try {
        const r = await api<{ items: MyOrg[] }>(`/orgs/mine`);
        setCommercialOrgs(
          r.items.filter(
            (o) =>
              o.kind === "commercial" && (o.myRole === "owner" || o.myRole === "admin"),
          ),
        );
      } catch {
        /* orgs are optional — silently fall back to individual selling */
      }
    })();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "digital" && !file) {
      setError("Choose a file to upload.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      setProgress("Creating listing...");
      const listing = await api<NewListing>(`/marketplace/listings`, {
        method: "POST",
        body: JSON.stringify({
          kind,
          title,
          description: description || undefined,
          subjects: subjects
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          priceCents: Math.round(Number(priceEur) * 100),
          currency: "EUR",
          sellerOrgId: sellerOrgId || undefined,
          ...(kind === "physical"
            ? {
                shippingCostCents: Math.round(Number(shippingEur) * 100),
                inStockCount: Math.max(0, Math.round(Number(inStockCount))),
                shipsFrom: shipsFrom.trim() ? shipsFrom.trim().toUpperCase() : undefined,
              }
            : {}),
        }),
      });

      if (kind === "digital" && file) {
        setProgress("Requesting upload URL...");
        const upload = await api<{ uploadUrl: string; key: string }>(
          `/marketplace/listings/${listing.listingId}/upload-url`,
          {
            method: "POST",
            body: JSON.stringify({
              mimeType: file.type || "application/octet-stream",
              sizeBytes: file.size,
            }),
          },
        );

        setProgress("Uploading file to S3...");
        const put = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!put.ok) throw new Error(`S3 upload failed: ${put.status}`);
      }

      setProgress("Publishing listing...");
      await api(`/marketplace/listings/${listing.listingId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "active" }),
      });

      router.replace(`/seller/listings`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  if (!ready) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <Link href="/seller/listings" className="btn-ghost -ml-3">
        ← My listings
      </Link>
      <p className="eyebrow mt-4">Seller</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">New listing</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Upload a PDF, slides, or any digital study material. Max 100 MB.
      </p>

      <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
        <label className="block">
          <span className="label">Kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "digital" | "physical")}
            className="input"
          >
            <option value="digital">Digital (file download)</option>
            <option value="physical">Physical (shipped to buyer)</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Title</span>
          <input
            required
            minLength={3}
            maxLength={200}
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Description</span>
          <textarea
            rows={4}
            maxLength={4000}
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Subjects (comma separated)</span>
          <input
            className="input"
            value={subjects}
            onChange={(e) => setSubjects(e.target.value)}
            placeholder="Mathematics, Calculus"
          />
        </label>
        <label className="block">
          <span className="label">Price (EUR)</span>
          <input
            required
            type="number"
            min={1}
            className="input"
            value={priceEur}
            onChange={(e) => setPriceEur(e.target.value)}
          />
        </label>
        {commercialOrgs.length > 0 && (
          <label className="block">
            <span className="label">Sell as (optional)</span>
            <select
              value={sellerOrgId}
              onChange={(e) => setSellerOrgId(e.target.value)}
              className="input"
            >
              <option value="">Myself (individual seller)</option>
              {commercialOrgs.map((o) => (
                <option key={o.orgId} value={o.orgId}>
                  {o.name} (commercial org)
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === "physical" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">In stock</span>
                <input
                  type="number"
                  min={0}
                  value={inStockCount}
                  onChange={(e) => setInStockCount(e.target.value)}
                  className="input"
                />
              </label>
              <label className="block">
                <span className="label">Shipping cost (EUR)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={shippingEur}
                  onChange={(e) => setShippingEur(e.target.value)}
                  className="input"
                />
              </label>
            </div>
            <label className="block">
              <span className="label">Ships from (ISO country, optional)</span>
              <input
                maxLength={2}
                value={shipsFrom}
                onChange={(e) => setShipsFrom(e.target.value.toUpperCase())}
                className="input font-mono"
                placeholder="IE"
              />
            </label>
          </>
        )}

        {kind === "digital" && (
          <label className="block">
            <span className="label">File</span>
            <input
              required
              type="file"
              accept="application/pdf,.pdf,.doc,.docx,.ppt,.pptx,.zip"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-ink"
            />
          </label>
        )}

        {progress && <p className="text-sm text-ink-soft">{progress}</p>}
        {error && <p className="text-sm text-seal">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="btn-seal"
        >
          {submitting ? "Publishing..." : "Publish listing"}
        </button>
      </form>
    </main>
  );
}
