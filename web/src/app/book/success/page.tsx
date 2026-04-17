"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

type Booking = {
  bookingId: string;
  teacherId: string;
  type: string;
  status: string;
  amountCents: number;
  currency: string;
};

export default function BookSuccessPage() {
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
    <main className="mx-auto max-w-md px-6 pb-24 pt-16 text-center">
      <p className="eyebrow">Checkout</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">
        {paid ? "Booking confirmed" : "Processing..."}
      </h1>
      <p className="mt-2 text-ink-soft">
        {paid
          ? "Check your email — we sent you a confirmation. Your teacher will be in touch to schedule the session."
          : "We're confirming your payment. This usually takes a few seconds."}
      </p>
      {booking && (
        <p className="mt-6 font-mono text-sm text-ink-soft">
          Booking {booking.bookingId} · {booking.type} · €{(booking.amountCents / 100).toFixed(2)}
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
