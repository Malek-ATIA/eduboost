"use client";
import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { api } from "@/lib/api";
import { currentSession } from "@/lib/cognito";
import { formatMoneySymbol } from "@/lib/money";

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
  const [currency, setCurrency] = useState("TND");
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
        const teacherCurrency = t.profile.currency ?? "TND";
        setCurrency(teacherCurrency);
        const price = type === "trial" ? 0 : t.profile.hourlyRateCents;
        setAmountCents(price);

        const resp = await api<CreateBookingResponse>(`/bookings`, {
          method: "POST",
          body: JSON.stringify({
            teacherId: teacherId,
            type,
            amountCents: price,
            currency: teacherCurrency,
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

  const isDemo = clientSecret.startsWith("demo_");

  return (
    <main className="mx-auto max-w-md px-6 pb-24 pt-16">
      <p className="eyebrow">Checkout</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">
        Book with {teacher.user.displayName}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        <span className="capitalize">{type}</span> session · {formatMoneySymbol(amountCents, currency, { trim: true })}
      </p>

      {isDemo ? (
        <DemoCheckoutForm bookingId={bookingId!} amountCents={amountCents} currency={currency} />
      ) : (
        <Elements stripe={getStripe()} options={{ clientSecret }}>
          <CheckoutForm bookingId={bookingId!} />
        </Elements>
      )}
    </main>
  );
}

function DemoCheckoutForm({
  bookingId,
  amountCents,
  currency,
}: {
  bookingId: string;
  amountCents: number;
  currency: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    router.push(`/book/success?bookingId=${bookingId}&redirect_status=succeeded`);
  }

  return (
    <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
      <div className="rounded-lg border border-dashed border-ink/20 bg-cream/40 p-6">
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-ink-soft">
          Demo payment
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
              Card number
            </label>
            <input
              type="text"
              defaultValue="4242 4242 4242 4242"
              readOnly
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
                Expiry
              </label>
              <input
                type="text"
                defaultValue="12/30"
                readOnly
                className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
                CVC
              </label>
              <input
                type="text"
                defaultValue="123"
                readOnly
                className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-ink-soft">
          Stripe is not configured — this is a simulated checkout.
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="btn-seal w-full"
      >
        {submitting ? "Processing..." : `Pay ${formatMoneySymbol(amountCents, currency, { trim: true })}`}
      </button>
    </form>
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
