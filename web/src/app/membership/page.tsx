"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useDialog } from "@/components/Dialog";

type Plan = {
  id: "student_premium" | "teacher_pro";
  label: string;
  description: string;
  audience: "student" | "teacher";
  priceMonthlyCents: number;
  currency: string;
  features: string[];
};

type Subscription = {
  userId: string;
  planId: Plan["id"];
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
};

const PLAN_ICONS: Record<string, string> = {
  student_premium: "🎓",
  teacher_pro: "🏆",
};

function MembershipInner() {
  const router = useRouter();
  const { confirm: showConfirm } = useDialog();
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams.get("status");

  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [role, setRole] = useState<"parent" | "student" | "teacher" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [p, me] = await Promise.all([
        api<{ items: Plan[] }>(`/memberships/plans`),
        api<{ subscription: Subscription | null }>(`/memberships/me`),
      ]);
      setPlans(p.items);
      setSub(me.subscription);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      setRole(currentRole(session));
      await load();
    })();
  }, [router]);

  async function upgrade(planId: Plan["id"]) {
    setBusy(true);
    setError(null);
    try {
      const resp = await api<{ checkoutUrl: string }>(`/memberships/checkout`, {
        method: "POST",
        body: JSON.stringify({ planId }),
      });
      window.location.assign(resp.checkoutUrl);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("already_subscribed")) {
        setError("You already have an active subscription on a different plan.");
      } else if (msg.includes("plan_not_for_your_role")) {
        setError("That plan is for a different account type.");
      } else {
        setError(msg);
      }
      setBusy(false);
    }
  }

  async function cancel() {
    const ok = await showConfirm({ title: "Cancel subscription", message: "Cancel your subscription at the end of the billing period?", destructive: true });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/memberships/cancel`, { method: "POST" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const visiblePlans = (plans ?? []).filter((p) => {
    if (p.audience === "teacher") return role === "teacher";
    return role === "student" || role === "parent";
  });

  const activePlan = sub && (sub.status === "active" || sub.status === "trialing") ? sub.planId : null;

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
      {/* Header */}
      <div className="text-center">
        <p className="eyebrow">Account</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Membership</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Upgrade your account for premium features, exclusive content, and priority support.
        </p>
      </div>

      {/* Checkout status banners */}
      {checkoutStatus === "success" && (
        <div className="mx-auto mt-6 max-w-xl rounded-md border border-green-200 bg-green-50 p-4 text-center">
          <span className="text-lg">🎉</span>
          <p className="mt-1 font-display text-base text-green-800">Welcome to Premium!</p>
          <p className="mt-0.5 text-sm text-green-700">
            Your subscription will activate within a minute. Enjoy your new features!
          </p>
        </div>
      )}
      {checkoutStatus === "cancelled" && (
        <div className="mx-auto mt-6 max-w-xl rounded-md border border-ink-faded/30 bg-parchment-dark p-4 text-center">
          <p className="text-sm text-ink-soft">Checkout cancelled. No charge was made.</p>
        </div>
      )}
      {error && <p className="mt-4 text-center text-sm text-seal">{error}</p>}

      {/* Current subscription banner */}
      {sub && (sub.status === "active" || sub.status === "trialing") && (
        <div className="mx-auto mt-8 max-w-xl">
          <div className="card overflow-hidden">
            <div className="bg-seal/10 px-5 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{PLAN_ICONS[sub.planId] ?? "⭐"}</span>
                  <div>
                    <h2 className="font-display text-lg text-ink">
                      {sub.planId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </h2>
                    <p className="text-xs text-ink-soft">
                      {sub.status === "trialing" ? "Trial" : "Active"} subscription
                    </p>
                  </div>
                </div>
                <span className="rounded-md border border-seal/40 bg-seal/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-seal">
                  {sub.status}
                </span>
              </div>
            </div>
            <div className="divide-y divide-ink-faded/20 px-5">
              {sub.currentPeriodEnd && (
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-ink-soft">
                    {sub.cancelAtPeriodEnd ? "Ends on" : "Renews on"}
                  </span>
                  <span className="text-sm font-medium text-ink">
                    {new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-ink-soft">Status</span>
                <span className="text-sm font-medium text-green-700">
                  {sub.cancelAtPeriodEnd ? "Cancelling at period end" : "Active"}
                </span>
              </div>
            </div>
            {!sub.cancelAtPeriodEnd && (
              <div className="border-t border-ink-faded/20 px-5 py-3">
                <button
                  onClick={cancel}
                  disabled={busy}
                  className="text-sm text-ink-faded hover:text-seal transition"
                >
                  Cancel subscription
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {plans === null && !error && (
        <div className="mt-8 flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
        </div>
      )}

      {plans && visiblePlans.length === 0 && (
        <p className="mt-8 text-center text-sm text-ink-soft">
          No plans available for your account type.
        </p>
      )}

      {/* Plan cards */}
      <div className="mx-auto mt-8 grid max-w-3xl gap-6 sm:grid-cols-2">
        {visiblePlans.map((p) => {
          const isActive = activePlan === p.id;
          const icon = PLAN_ICONS[p.id] ?? "⭐";
          return (
            <div
              key={p.id}
              className={`card relative overflow-hidden transition ${
                isActive ? "ring-2 ring-seal" : ""
              }`}
            >
              {isActive && (
                <div className="absolute right-0 top-0 rounded-bl-lg bg-seal px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-parchment">
                  Current
                </div>
              )}

              <div className="p-6">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{icon}</span>
                  <div>
                    <h3 className="font-display text-xl text-ink">{p.label}</h3>
                    <p className="text-xs text-ink-faded capitalize">{p.audience} plan</p>
                  </div>
                </div>

                <p className="mt-3 text-sm text-ink-soft">{p.description}</p>

                <div className="mt-5">
                  <span className="font-display text-4xl text-ink">
                    {formatMoney(p.priceMonthlyCents, p.currency, { trim: true })}
                  </span>
                  <span className="text-sm text-ink-soft">/month</span>
                </div>

                <button
                  onClick={() => upgrade(p.id)}
                  disabled={busy || isActive}
                  className={`mt-5 w-full ${isActive ? "btn-ghost cursor-default" : "btn-seal"}`}
                >
                  {isActive ? "Current plan" : "Upgrade now"}
                </button>
              </div>

              <div className="border-t border-ink-faded/20 bg-parchment-dark p-6">
                <h4 className="eyebrow mb-3">What's included</h4>
                <ul className="space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-ink">
                      <span className="mt-0.5 text-green-600">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust signals */}
      <div className="mx-auto mt-10 max-w-xl">
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-ink-faded">
          <span className="flex items-center gap-1.5">
            <span>🔒</span> Secure payment via Stripe
          </span>
          <span className="flex items-center gap-1.5">
            <span>↩️</span> Cancel anytime
          </span>
          <span className="flex items-center gap-1.5">
            <span>📧</span> Priority support
          </span>
        </div>
      </div>

      {/* FAQ section */}
      <div className="mx-auto mt-12 max-w-xl">
        <h2 className="eyebrow mb-4 text-center">Common questions</h2>
        <div className="space-y-3">
          <div className="card p-4">
            <h4 className="font-display text-sm text-ink">Can I cancel anytime?</h4>
            <p className="mt-1 text-sm text-ink-soft">
              Yes! Cancel at any time and your subscription will remain active until the end of your billing period.
            </p>
          </div>
          <div className="card p-4">
            <h4 className="font-display text-sm text-ink">What payment methods are accepted?</h4>
            <p className="mt-1 text-sm text-ink-soft">
              We accept all major credit and debit cards through Stripe, including Visa, Mastercard, and Amex.
            </p>
          </div>
          <div className="card p-4">
            <h4 className="font-display text-sm text-ink">Can I switch plans later?</h4>
            <p className="mt-1 text-sm text-ink-soft">
              You can upgrade or change your plan at any time. Contact support for plan changes.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function MembershipPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
          <div className="text-center">
            <p className="eyebrow">Account</p>
            <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Membership</h1>
          </div>
          <div className="mt-8 flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
          </div>
        </main>
      }
    >
      <MembershipInner />
    </Suspense>
  );
}
