"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Booking = {
  bookingId: string;
  teacherId: string;
  type: string;
  status: string;
};

function NewReviewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") ?? "";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      if (!bookingId) {
        setError("Missing bookingId");
        return;
      }
      try {
        const b = await api<Booking>(`/bookings/${bookingId}`);
        setBooking(b);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router, bookingId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api(`/reviews`, {
        method: "POST",
        body: JSON.stringify({
          bookingId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      if (booking) router.replace(`/teachers/${booking.teacherId}` as never);
    } catch (err) {
      // Map known backend error codes to friendly messages.
      // The api() helper throws `api <status>: <body>` where body contains
      // `{"error":"..."}`. We match on substrings rather than parsing JSON
      // because the wrapper does not preserve structured error data.
      const msg = (err as Error).message;
      if (msg.includes("already_reviewed")) {
        setError("You've already reviewed this booking.");
      } else if (msg.includes("booking_not_completed")) {
        setError("You can only review a booking once it's confirmed or completed.");
      } else if (msg.includes("not_your_booking")) {
        setError("This booking doesn't belong to you.");
      } else if (msg.includes("booking_not_found")) {
        setError("Booking not found.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <main className="mx-auto max-w-md px-6 pb-24 pt-16 text-seal">{error}</main>;
  if (!booking) return <main className="mx-auto max-w-md px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-md px-6 pb-24 pt-16">
      <Link href="/bookings" className="btn-ghost -ml-3">
        ← My bookings
      </Link>
      <p className="eyebrow mt-4">Feedback</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Leave a review</h1>
      <p className="mt-1 text-sm text-ink-soft">
        For your {booking.type} session (booking <span className="font-mono">{booking.bookingId}</span>).
      </p>

      <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
        <div>
          <span className="label">Rating</span>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`h-10 w-10 rounded-md border text-lg transition ${
                  n <= rating
                    ? "border-seal bg-seal text-parchment"
                    : "border-ink-faded/50 bg-parchment/40 text-ink-faded hover:border-ink-faded"
                }`}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="label">Comment (optional)</span>
          <textarea
            rows={5}
            maxLength={2000}
            className="input"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you enjoy? What could be improved?"
          />
        </label>

        {error && <p className="text-sm text-seal">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="btn-seal"
        >
          {submitting ? "Submitting..." : "Post review"}
        </button>
      </form>
    </main>
  );
}

export default function NewReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-6 pb-24 pt-16">
          <p className="eyebrow">Feedback</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Leave a review</h1>
          <p className="mt-4 text-sm text-ink-soft">Loading...</p>
        </main>
      }
    >
      <NewReviewForm />
    </Suspense>
  );
}
