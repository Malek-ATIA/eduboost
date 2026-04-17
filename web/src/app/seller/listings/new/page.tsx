"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type NewListing = {
  listingId: string;
};

export default function NewSellerListingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjects, setSubjects] = useState("");
  const [priceEur, setPriceEur] = useState("10");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (currentRole(session) !== "teacher") return router.replace("/dashboard");
      setReady(true);
    })();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
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
          title,
          description: description || undefined,
          subjects: subjects
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          priceCents: Math.round(Number(priceEur) * 100),
          currency: "EUR",
        }),
      });

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

  if (!ready) return <main className="mx-auto max-w-2xl px-6 py-12">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/seller/listings" className="text-sm text-gray-500 underline">
        ← My listings
      </Link>
      <h1 className="mt-4 text-2xl font-bold">New listing</h1>
      <p className="mt-1 text-sm text-gray-500">
        Upload a PDF, slides, or any digital study material. Max 100 MB.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Title</span>
          <input
            required
            minLength={3}
            maxLength={200}
            className="w-full rounded border px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Description</span>
          <textarea
            rows={4}
            maxLength={4000}
            className="w-full rounded border px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Subjects (comma separated)</span>
          <input
            className="w-full rounded border px-3 py-2"
            value={subjects}
            onChange={(e) => setSubjects(e.target.value)}
            placeholder="Mathematics, Calculus"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Price (EUR)</span>
          <input
            required
            type="number"
            min={1}
            className="w-full rounded border px-3 py-2"
            value={priceEur}
            onChange={(e) => setPriceEur(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">File</span>
          <input
            required
            type="file"
            accept="application/pdf,.pdf,.doc,.docx,.ppt,.pptx,.zip"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {progress && <p className="text-sm text-gray-600">{progress}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-5 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? "Publishing..." : "Publish listing"}
        </button>
      </form>
    </main>
  );
}
