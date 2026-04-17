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

function NewTicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetBookingId = searchParams.get("bookingId") ?? "";
  const rawCategory = searchParams.get("category");
  const presetCategory: Category | null = isCategory(rawCategory) ? rawCategory : null;

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<Category>(presetCategory ?? "other");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [bookingId, setBookingId] = useState(presetBookingId);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    currentSession().then((s) => {
      if (!s) router.replace("/login");
    });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const t = await api<Ticket>(`/support/tickets`, {
        method: "POST",
        body: JSON.stringify({
          subject,
          category,
          priority,
          body,
          bookingId: bookingId || undefined,
        }),
      });
      router.replace(`/support/${t.ticketId}` as never);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
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
