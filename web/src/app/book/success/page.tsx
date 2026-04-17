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
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-2xl font-bold">{paid ? "Booking confirmed" : "Processing..."}</h1>
      <p className="mt-2 text-gray-600">
        {paid
          ? "Check your email — we sent you a confirmation. Your teacher will be in touch to schedule the session."
          : "We're confirming your payment. This usually takes a few seconds."}
      </p>
      {booking && (
        <p className="mt-6 text-sm text-gray-500">
          Booking {booking.bookingId} · {booking.type} · €{(booking.amountCents / 100).toFixed(2)}
        </p>
      )}
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/bookings" className="rounded border px-5 py-2">
          My bookings
        </Link>
        <Link href="/dashboard" className="rounded bg-black px-5 py-2 text-white dark:bg-white dark:text-black">
          Dashboard
        </Link>
      </div>
    </main>
  );
}
