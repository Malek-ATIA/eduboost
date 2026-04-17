"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

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

function MembershipInner() {
  const router = useRouter();
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
    if (!confirm("Cancel your subscription at the end of the billing period?")) return;
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
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Account</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Membership</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Upgrade your account for extra features.
      </p>

      {checkoutStatus === "success" && (
        <div className="mt-4 rounded-md border border-seal/30 bg-seal/10 p-3 text-sm text-ink">
          Thanks! Your subscription will activate within a minute.
        </div>
      )}
      {checkoutStatus === "cancelled" && (
        <div className="mt-4 rounded-md border border-ink-faded/40 bg-parchment-shade p-3 text-sm text-ink">
          Checkout cancelled. No charge was made.
        </div>
      )}
      {error && <p className="mt-4 text-sm text-seal">{error}</p>}

      {sub && (sub.status === "active" || sub.status === "trialing") && (
        <section className="card mt-8 p-4">
          <h2 className="font-display text-xl text-ink">Current plan: {sub.planId.replace(/_/g, " ")}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Status: {sub.status}
            {sub.currentPeriodEnd
              ? ` · ${sub.cancelAtPeriodEnd ? "Ends" : "Renews"} ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
              : ""}
          </p>
          {!sub.cancelAtPeriodEnd && (
            <button
              onClick={cancel}
              disabled={busy}
              className="btn-secondary mt-3"
            >
              Cancel at period end
            </button>
          )}
        </section>
      )}

      {plans === null && !error && <p className="mt-6 text-sm text-ink-soft">Loading plans...</p>}
      {plans && visiblePlans.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No plans available for your account type.</p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {visiblePlans.map((p) => {
          const isActive = activePlan === p.id;
          return (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between">
                <h3 className="font-display text-xl text-ink">{p.label}</h3>
                {isActive && (
                  <span className="rounded-sm border border-seal/40 bg-seal/10 px-2 py-0.5 text-xs uppercase tracking-widest text-seal">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink-soft">{p.description}</p>
              <div className="mt-4 font-display text-3xl text-ink">
                {p.currency} {(p.priceMonthlyCents / 100).toFixed(2)}
                <span className="text-sm font-normal text-ink-soft">/mo</span>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-ink">
                {p.features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
              <button
                onClick={() => upgrade(p.id)}
                disabled={busy || isActive}
                className="btn-seal mt-4"
              >
                {isActive ? "Current" : "Upgrade"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-ink-soft underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}

export default function MembershipPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
          <p className="eyebrow">Account</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Membership</h1>
          <p className="mt-4 text-sm text-ink-soft">Loading...</p>
        </main>
      }
    >
      <MembershipInner />
    </Suspense>
  );
}
