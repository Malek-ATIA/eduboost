"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

const CATEGORIES = [
  { value: "payment_dispute", label: "Payment dispute" },
  { value: "review_dispute", label: "Review dispute" },
  { value: "booking_issue", label: "Booking issue" },
  { value: "account", label: "Account" },
  { value: "technical", label: "Technical problem" },
  { value: "abuse_report", label: "Report abuse" },
  { value: "other", label: "Other" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

const CATEGORY_VALUES: readonly Category[] = CATEGORIES.map((c) => c.value);

function isCategory(v: string | null): v is Category {
  return v !== null && (CATEGORY_VALUES as readonly string[]).includes(v);
}

type Ticket = { ticketId: string };
type AttachmentMeta = {
  s3Key: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
};

function NewTicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetBookingId = searchParams.get("bookingId") ?? "";
  const presetPaymentId = searchParams.get("paymentId") ?? "";
  const presetReviewId = searchParams.get("reviewId") ?? "";
  const rawCategory = searchParams.get("category");
  const presetCategory: Category | null = isCategory(rawCategory) ? rawCategory : null;

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<Category>(
    presetCategory ?? (presetPaymentId ? "payment_dispute" : presetReviewId ? "review_dispute" : "other"),
  );
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [bookingId, setBookingId] = useState(presetBookingId);
  const [relatedPaymentId, setRelatedPaymentId] = useState(presetPaymentId);
  const [relatedReviewId, setRelatedReviewId] = useState(presetReviewId);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    currentSession().then((s) => {
      if (!s) router.replace("/login");
    });
  }, [router]);

  // Uploads selected files against a freshly-minted ticketId. Each upload
  // needs a presigned PUT from the server (scoped to this ticket's S3
  // prefix); returned metadata is then handed to the initial-attachments
  // endpoint so the first message picks them up.
  async function uploadAttachments(ticketId: string): Promise<AttachmentMeta[]> {
    const uploaded: AttachmentMeta[] = [];
    for (const f of files) {
      setProgress(`Uploading ${f.name}...`);
      const urlResp = await api<{ uploadUrl: string; s3Key: string }>(
        `/support/tickets/${ticketId}/attachment-url`,
        {
          method: "POST",
          body: JSON.stringify({
            filename: f.name,
            mimeType: f.type || "application/octet-stream",
            sizeBytes: f.size,
          }),
        },
      );
      const put = await fetch(urlResp.uploadUrl, {
        method: "PUT",
        headers: { "content-type": f.type || "application/octet-stream" },
        body: f,
      });
      if (!put.ok) throw new Error(`Upload failed for ${f.name}: ${put.status}`);
      uploaded.push({
        s3Key: urlResp.s3Key,
        filename: f.name,
        mimeType: f.type || undefined,
        sizeBytes: f.size,
      });
    }
    return uploaded;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setProgress(null);
    try {
      // Step 1: create the ticket without attachments. The server mints the
      // ticketId, which we need to scope the S3 uploads. The first message
      // is created inside this call with an empty attachments array.
      setProgress("Creating ticket...");
      const t = await api<Ticket>(`/support/tickets`, {
        method: "POST",
        body: JSON.stringify({
          subject,
          category,
          priority,
          body,
          bookingId: bookingId || undefined,
          relatedPaymentId: relatedPaymentId || undefined,
          relatedReviewId: relatedReviewId || undefined,
        }),
      });

      // Step 2: if the user picked files, upload them under this ticket's
      // prefix and backfill the initial message via a dedicated endpoint.
      // If the upload step fails, the ticket still exists — user can reply
      // to add attachments from the ticket page.
      if (files.length > 0) {
        const attachments = await uploadAttachments(t.ticketId);
        setProgress("Attaching files...");
        await api(`/support/tickets/${t.ticketId}/initial-attachments`, {
          method: "POST",
          body: JSON.stringify({ attachments }),
        });
      }

      router.replace(`/support/${t.ticketId}` as never);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">New support ticket</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Subject">
          <input
            required
            minLength={3}
            maxLength={200}
            className="w-full rounded border px-3 py-2"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short summary of the issue"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <select
              className="w-full rounded border px-3 py-2"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority">
            <select
              className="w-full rounded border px-3 py-2"
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
        </div>

        {(category === "payment_dispute" || category === "booking_issue") && (
          <Field label="Related booking ID (optional)">
            <input
              className="w-full rounded border px-3 py-2 font-mono"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              placeholder="bk_..."
            />
          </Field>
        )}

        {category === "payment_dispute" && (
          <Field label="Related payment ID (optional)">
            <input
              className="w-full rounded border px-3 py-2 font-mono"
              value={relatedPaymentId}
              onChange={(e) => setRelatedPaymentId(e.target.value)}
              placeholder="pay_..."
            />
          </Field>
        )}

        {category === "review_dispute" && (
          <Field label="Related review ID (optional)">
            <input
              className="w-full rounded border px-3 py-2 font-mono"
              value={relatedReviewId}
              onChange={(e) => setRelatedReviewId(e.target.value)}
              placeholder="rv_..."
            />
          </Field>
        )}

        <Field label="Describe the issue">
          <textarea
            required
            minLength={10}
            maxLength={8000}
            rows={8}
            className="w-full rounded border px-3 py-2"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What happened? Include dates, amounts, and anything the team needs to resolve this."
          />
        </Field>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Attachments (optional, up to 5, 25 MB each)
          </label>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
            className="text-xs"
          />
          {files.length > 0 && (
            <ul className="mt-1 text-xs text-gray-600">
              {files.map((f) => (
                <li key={f.name}>
                  {f.name} ({(f.size / 1024).toFixed(1)} KB)
                </li>
              ))}
            </ul>
          )}
        </div>

        {progress && <p className="text-xs text-gray-500">{progress}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-5 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? "Submitting..." : "Submit ticket"}
        </button>
      </form>
    </main>
  );
}

export default function NewTicketPage() {
  // Next.js 15 requires useSearchParams consumers to be wrapped in Suspense so the
  // static shell can pre-render while the search params resolve on the client.
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl px-6 py-12">
          <h1 className="text-2xl font-bold">New support ticket</h1>
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </main>
      }
    >
      <NewTicketForm />
    </Suspense>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
