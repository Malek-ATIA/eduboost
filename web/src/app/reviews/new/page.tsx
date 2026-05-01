"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";

type Booking = {
  bookingId: string;
  teacherId: string;
  type: string;
  status: string;
};

type TeacherInfo = {
  displayName?: string;
  userId: string;
};

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

function NewReviewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") ?? "";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      if (!bookingId) {
        setError("Missing booking ID. Please navigate here from your bookings page.");
        return;
      }
      try {
        const b = await api<Booking>(`/bookings/${bookingId}`);
        setBooking(b);
        api<TeacherInfo>(`/users/${b.teacherId}/public`)
          .then(setTeacher)
          .catch(() => setTeacher({ userId: b.teacherId }));
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
      setSuccess(true);
      setTimeout(() => {
        if (booking) router.replace(`/teachers/${booking.teacherId}` as never);
      }, 2000);
    } catch (err) {
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

  const displayRating = hoverRating || rating;

  if (error && !booking) {
    return (
      <main className="mx-auto max-w-lg px-6 pb-24 pt-16">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="mt-4 font-display text-2xl text-ink">Can't load review</h1>
          <p className="mt-2 text-sm text-ink-soft">{error}</p>
          <Link href="/bookings" className="btn-seal mt-6 inline-block">
            Back to bookings
          </Link>
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="mx-auto max-w-lg px-6 pb-24 pt-16">
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="mx-auto max-w-lg px-6 pb-24 pt-16">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
            <span className="text-2xl">🎉</span>
          </div>
          <h1 className="mt-4 font-display text-2xl text-ink">Thank you!</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Your review has been submitted. Redirecting to the teacher profile...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 pb-24 pt-16">
      {/* Back link */}
      <Link
        href="/bookings"
        className="inline-flex items-center gap-1 text-sm text-ink-faded transition hover:text-ink"
      >
        ← Back to bookings
      </Link>

      {/* Header */}
      <div className="mt-4">
        <p className="eyebrow">Feedback</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">Leave a review</h1>
      </div>

      {/* Teacher card */}
      <div className="card mt-6 flex items-center gap-3 bg-parchment-dark p-4">
        <Avatar userId={booking.teacherId} size="md" initial={teacher?.displayName?.charAt(0)} />
        <div>
          <div className="font-display text-sm text-ink">
            {teacher?.displayName || "Your teacher"}
          </div>
          <div className="text-xs text-ink-faded capitalize">
            {booking.type} session
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="card mt-6 overflow-hidden">
        <div className="border-b border-ink-faded/20 bg-parchment-dark px-5 py-3">
          <h2 className="font-display text-base text-ink">Your experience</h2>
        </div>

        <div className="space-y-6 p-5">
          {/* Star rating */}
          <div>
            <label className="label">Rating</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg border text-lg transition ${
                    n <= displayRating
                      ? "border-seal bg-seal text-parchment"
                      : "border-ink-faded/40 bg-parchment text-ink-faded hover:border-seal/50 hover:text-seal"
                  }`}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              ))}
              <span className="ml-3 text-sm font-medium text-ink">
                {RATING_LABELS[displayRating]}
              </span>
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="label">Comment (optional)</label>
            <textarea
              rows={5}
              maxLength={2000}
              className="input"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you enjoy? What could be improved?"
            />
            <div className="mt-1 text-right text-xs text-ink-faded">
              {comment.length}/2000
            </div>
          </div>

          {/* Guidelines */}
          <div className="rounded-md bg-parchment-dark p-4">
            <h4 className="eyebrow mb-2">Review guidelines</h4>
            <ul className="space-y-1 text-xs text-ink-faded">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-green-600">✓</span>
                <span>Be honest and constructive</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-green-600">✓</span>
                <span>Focus on the teaching quality and communication</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-green-600">✓</span>
                <span>Mention specific things that went well or could improve</span>
              </li>
            </ul>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Link href="/bookings" className="btn-ghost flex-1 text-center">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="btn-seal flex-1"
            >
              {submitting ? "Submitting..." : "Post review"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}

export default function NewReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-lg px-6 pb-24 pt-16">
          <p className="eyebrow">Feedback</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">Leave a review</h1>
          <div className="mt-8 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
          </div>
        </main>
      }
    >
      <NewReviewForm />
    </Suspense>
  );
}
