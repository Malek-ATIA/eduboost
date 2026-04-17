"use client";
import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { api } from "@/lib/api";
import { currentSession } from "@/lib/cognito";

type BookingType = "trial" | "single" | "package";

type CreateBookingResponse = {
  booking: { bookingId: string; amountCents: number; currency: string };
  clientSecret: string;
};

type TeacherResponse = {
  user: { displayName: string };
  profile: { hourlyRateCents: number; currency: string; trialSession: boolean };
};

export default function BookPage({ params }: { params: Promise<{ teacherId: string }> }) {
  const { teacherId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  const type: BookingType = typeParam === "trial" || typeParam === "package" ? typeParam : "single";

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<TeacherResponse | null>(null);
  const [amountCents, setAmountCents] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) {
        router.replace(`/login?next=/book/${teacherId}` as never);
        return;
      }
      try {
        const t = await api<TeacherResponse>(`/teachers/${teacherId}`);
        setTeacher(t);
        const price =
          type === "trial" ? Math.min(1000, Math.round(t.profile.hourlyRateCents / 2)) : t.profile.hourlyRateCents;
        setAmountCents(price);

        const resp = await api<CreateBookingResponse>(`/bookings`, {
          method: "POST",
          body: JSON.stringify({
            teacherId: teacherId,
            type,
            amountCents: price,
            currency: t.profile.currency ?? "EUR",
          }),
        });
        setClientSecret(resp.clientSecret);
        setBookingId(resp.booking.bookingId);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [teacherId, type, router]);

  if (error) return <main className="mx-auto max-w-md px-6 pb-24 pt-16 text-seal">{error}</main>;
  if (!teacher || !clientSecret)
    return <main className="mx-auto max-w-md px-6 pb-24 pt-16 text-ink-soft">Preparing checkout...</main>;

  return (
    <main className="mx-auto max-w-md px-6 pb-24 pt-16">
      <p className="eyebrow">Checkout</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">
        Book with {teacher.user.displayName}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        <span className="capitalize">{type}</span> session · €{(amountCents / 100).toFixed(2)}
      </p>

      <Elements stripe={getStripe()} options={{ clientSecret }}>
        <CheckoutForm bookingId={bookingId!} />
      </Elements>
    </main>
  );
}

function CheckoutForm({ bookingId }: { bookingId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/book/success?bookingId=${bookingId}`,
      },
    });
    if (result.error) {
      setError(result.error.message ?? "Payment failed");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
      <PaymentElement />
      {error && <p className="text-sm text-seal">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="btn-seal w-full"
      >
        {submitting ? "Processing..." : "Pay now"}
      </button>
    </form>
  );
}
