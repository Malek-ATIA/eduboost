"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { api } from "@/lib/api";
import { currentSession } from "@/lib/cognito";
import { formatMoney } from "@/lib/money";

type Listing = {
  listingId: string;
  kind?: "digital" | "physical";
  title: string;
  priceCents: number;
  currency: string;
  shippingCostCents?: number;
  inStockCount?: number;
};

type CreateOrderResponse = {
  order: { orderId: string };
  clientSecret: string;
};

type ShippingAddress = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
};

const EMPTY_ADDR: ShippingAddress = {
  name: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  // Default shipping country is Tunisia — the platform's primary market.
  // Buyers shipping elsewhere override the ISO code in the form.
  country: "TN",
  phone: "+216 ",
};

export default function BuyListingPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = use(params);
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDR);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace(`/login`);
      try {
        const l = await api<Listing>(`/marketplace/listings/${listingId}`);
        setListing(l);
        // Digital listings auto-create the order immediately (no address
        // needed). Physical listings wait for the address form submit.
        if (l.kind !== "physical") {
          const resp = await api<CreateOrderResponse>(`/marketplace/orders`, {
            method: "POST",
            body: JSON.stringify({ listingId }),
          });
          setClientSecret(resp.clientSecret);
          setOrderId(resp.order.orderId);
        }
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes("already_purchased")) {
          setError("You already own this listing. Find it in your orders.");
        } else if (msg.includes("cannot_buy_own")) {
          setError("You can't buy your own listing.");
        } else if (msg.includes("not_available")) {
          setError("This listing is no longer available.");
        } else if (msg.includes("out_of_stock")) {
          setError("This item is out of stock.");
        } else {
          setError(msg);
        }
      }
    })();
  }, [listingId, router]);

  async function onAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!listing) return;
    setCreating(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        listingId,
        shippingAddress: {
          name: address.name.trim(),
          line1: address.line1.trim(),
          line2: address.line2.trim() || undefined,
          city: address.city.trim(),
          state: address.state.trim() || undefined,
          postalCode: address.postalCode.trim(),
          country: address.country.trim().toUpperCase(),
          phone: address.phone.trim() || undefined,
        },
      };
      const resp = await api<CreateOrderResponse>(`/marketplace/orders`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setClientSecret(resp.clientSecret);
      setOrderId(resp.order.orderId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  if (error) return <main className="mx-auto max-w-md px-6 pb-24 pt-16 text-seal">{error}</main>;
  if (!listing)
    return <main className="mx-auto max-w-md px-6 pb-24 pt-16 text-ink-soft">Preparing checkout...</main>;

  const isPhysical = listing.kind === "physical";
  const shipping = listing.shippingCostCents ?? 0;
  const total = listing.priceCents + (isPhysical ? shipping : 0);

  return (
    <main className="mx-auto max-w-md px-6 pb-24 pt-16">
      <p className="eyebrow">Checkout</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Buy {listing.title}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {formatMoney(listing.priceCents, listing.currency)}
        {isPhysical && (
          <>
            {" "}
            +{" "}
            {shipping > 0
              ? `${formatMoney(shipping, listing.currency)} shipping`
              : "free shipping"}
          </>
        )}
      </p>
      {isPhysical && (
        <p className="mt-1 text-sm text-ink-soft">
          Total:{" "}
          <strong className="text-ink">
            {formatMoney(total, listing.currency)}
          </strong>
        </p>
      )}

      {isPhysical && !clientSecret && (
        <form onSubmit={onAddressSubmit} className="card mt-8 space-y-3 p-6">
          <h2 className="font-display text-base text-ink">Shipping address</h2>
          <label className="block">
            <span className="label">Full name</span>
            <input
              required
              maxLength={120}
              value={address.name}
              onChange={(e) => setAddress({ ...address, name: e.target.value })}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Address line 1</span>
            <input
              required
              maxLength={200}
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Address line 2 (optional)</span>
            <input
              maxLength={200}
              value={address.line2}
              onChange={(e) => setAddress({ ...address, line2: e.target.value })}
              className="input"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">City</span>
              <input
                required
                maxLength={100}
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
                className="input"
              />
            </label>
            <label className="block">
              <span className="label">State / region</span>
              <input
                maxLength={100}
                value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.target.value })}
                className="input"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Postal code</span>
              <input
                required
                maxLength={20}
                value={address.postalCode}
                onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                className="input"
              />
            </label>
            <label className="block">
              <span className="label">Country (ISO)</span>
              <input
                required
                maxLength={2}
                value={address.country}
                onChange={(e) =>
                  setAddress({ ...address, country: e.target.value.toUpperCase() })
                }
                className="input font-mono"
                placeholder="TN"
              />
            </label>
          </div>
          <label className="block">
            <span className="label">Phone (optional)</span>
            <input
              maxLength={30}
              value={address.phone}
              onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              className="input"
              placeholder="+216 55 555 555"
            />
          </label>
          <button type="submit" disabled={creating} className="btn-seal w-full">
            {creating ? "Saving address..." : "Continue to payment"}
          </button>
        </form>
      )}

      {clientSecret && orderId && (
        <Elements stripe={getStripe()} options={{ clientSecret }}>
          <CheckoutForm orderId={orderId} />
        </Elements>
      )}
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
