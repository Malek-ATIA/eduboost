"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { api } from "@/lib/api";
import { currentSession } from "@/lib/cognito";

type Listing = {
  listingId: string;
  title: string;
  priceCents: number;
  currency: string;
};

type CreateOrderResponse = {
  order: { orderId: string };
  clientSecret: string;
};

export default function BuyListingPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = use(params);
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace(`/login`);
      try {
        const l = await api<Listing>(`/marketplace/listings/${listingId}`);
        setListing(l);
        const resp = await api<CreateOrderResponse>(`/marketplace/orders`, {
          method: "POST",
          body: JSON.stringify({ listingId }),
        });
        setClientSecret(resp.clientSecret);
        setOrderId(resp.order.orderId);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes("already_purchased")) {
          setError("You already own this listing. Find it in your orders.");
        } else if (msg.includes("cannot_buy_own")) {
          setError("You can't buy your own listing.");
        } else if (msg.includes("not_available")) {
          setError("This listing is no longer available.");
        } else {
          setError(msg);
        }
      }
    })();
  }, [listingId, router]);

  if (error) return <main className="mx-auto max-w-md px-6 py-12 text-red-600">{error}</main>;
  if (!listing || !clientSecret || !orderId)
    return <main className="mx-auto max-w-md px-6 py-12">Preparing checkout...</main>;

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-2xl font-bold">Buy {listing.title}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {listing.currency} {(listing.priceCents / 100).toFixed(2)}
      </p>
      <Elements stripe={getStripe()} options={{ clientSecret }}>
        <CheckoutForm orderId={orderId} />
      </Elements>
    </main>
  );
}

function CheckoutForm({ orderId }: { orderId: string }) {
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
        return_url: `${window.location.origin}/orders?orderId=${orderId}`,
      },
    });
    if (result.error) {
      setError(result.error.message ?? "Payment failed");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full rounded bg-black py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {submitting ? "Processing..." : "Pay now"}
      </button>
    </form>
  );
}
