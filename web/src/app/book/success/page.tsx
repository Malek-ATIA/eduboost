"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";

type Booking = {
  bookingId: string;
  teacherId: string;
  type: string;
  status: string;
  amountCents: number;
  currency: string;
};

function BookSuccessInner() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const paymentIntentStatus = searchParams.get("redirect_status");
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    const poll = async () => {
      try {
        const b = await api<Booking>(`/bookings/${bookingId}`);
        setBooking(b);
        if (b.status === "pending") setTimeout(poll, 1500);
      } catch {
        setTimeout(poll, 2000);
      }
    };
    poll();
  }, [bookingId]);

  const paid = paymentIntentStatus === "succeeded" || booking?.status === "confirmed";

  return (
    <main className="mx-auto max-w-md px-8 pb-24 pt-12 text-center">
      <div className="eyebrow">Checkout</div>
      <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">
        {paid ? "Booking confirmed" : "Processing..."}
      </h1>
      <p className="mt-2 text-ink-soft">
        {paid
          ? "Check your email — we sent you a confirmation. Your teacher will be in touch to schedule the session."
          : "We're confirming your payment. This usually takes a few seconds."}
      </p>
      {booking && (
        <p className="mt-6 font-mono text-sm text-ink-soft">
          Booking {booking.bookingId} · {booking.type} · {formatMoney(booking.amountCents, booking.currency)}
        </p>
      )}
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/bookings" className="btn-secondary">
          My bookings
        </Link>
        <Link href="/dashboard" className="btn-primary">
          Dashboard
        </Link>
      </div>
    </main>
  );
}

// Next.js 15 requires useSearchParams consumers to be wrapped in Suspense so
// the static shell can pre-render while the query string resolves client-side.
export default function BookSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-8 pb-24 pt-12 text-center">
          <div className="eyebrow">Checkout</div>
          <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">
            Processing...
          </h1>
        </main>
      }
    >
      <BookSuccessInner />
    </Suspense>
  );
}
