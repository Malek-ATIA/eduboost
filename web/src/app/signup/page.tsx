"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signUp, confirmSignUp, type Role } from "@/lib/cognito";

function SignupInner() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"credentials" | "confirm">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [tosAccepted, setTosAccepted] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Capture ?ref= from the signup share link and stash it in sessionStorage so
  // the dashboard can auto-claim it once the user completes signup + login.
  // sessionStorage survives page reloads within the same tab (signup → confirm
  // → login → dashboard) but not cross-tab/cross-browser flows — acceptable for
  // MVP since the user can always paste the code manually on /referrals.
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && typeof window !== "undefined") {
      try {
        sessionStorage.setItem("eduboost_pending_ref", ref.trim().toUpperCase());
      } catch {
        /* storage disabled — silent no-op */
      }
    }
  }, [searchParams]);

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!tosAccepted) {
      setError("Please accept the Terms and Code of Conduct.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signUp(email, password, role, new Date().toISOString());
      setStep("confirm");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await confirmSignUp(email, code);
      window.location.href = "/login";
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 pb-16 pt-20">
      <div className="text-center">
        <p className="eyebrow">Join the folio</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
          Create an account
        </h1>
      </div>
      {step === "credentials" ? (
        <form onSubmit={onSignup} className="card mt-10 space-y-5 p-8">
          <div>
            <span className="label">I am a…</span>
            <div className="grid grid-cols-3 gap-2">
              {(["student", "parent", "teacher"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-md border px-2 py-2 text-sm font-medium capitalize transition ${
                    role === r
                      ? "border-ink bg-ink text-parchment shadow-vellum"
                      : "border-ink-faded/60 bg-parchment/60 text-ink hover:bg-parchment-dark"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              placeholder="At least 10 characters"
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={tosAccepted}
              onChange={(e) => setTosAccepted(e.target.checked)}
              className="mt-0.5 accent-seal"
              required
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="underline">
                Terms and Code of Conduct
              </Link>
              .
            </span>
          </label>
          {error && <p className="text-sm text-seal">{error}</p>}
          <button
            disabled={loading || !tosAccepted}
            className="btn-seal w-full"
          >
            {loading ? "Creating..." : "Create account"}
          </button>
          <p className="text-center text-sm text-ink-soft">
            Already registered?{" "}
            <Link href="/login" className="underline">
              Log in
            </Link>
            .
          </p>
        </form>
      ) : (
        <form onSubmit={onConfirm} className="card mt-10 space-y-5 p-8">
          <p className="text-sm text-ink-soft">
            Enter the code we emailed to <strong>{email}</strong>.
          </p>
          <label className="block">
            <span className="label">Confirmation code</span>
            <input
              className="input font-mono"
              type="text"
              placeholder="6 digits"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          {error && <p className="text-sm text-seal">{error}</p>}
          <button disabled={loading} className="btn-seal w-full">
            {loading ? "Confirming..." : "Confirm"}
          </button>
        </form>
      )}
    </main>
  );
}

// Next.js 15 requires useSearchParams consumers to be wrapped in Suspense so
// the page can statically render while the query string is resolved on client.
export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-6 pb-16 pt-20 text-center">
          <p className="eyebrow">Join the folio</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
            Create an account
          </h1>
          <p className="mt-6 text-sm text-ink-soft">Loading...</p>
        </main>
      }
    >
      <SignupInner />
    </Suspense>
  );
}
