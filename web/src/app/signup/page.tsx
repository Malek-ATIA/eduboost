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
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-bold">Sign up</h1>
      {step === "credentials" ? (
        <form onSubmit={onSignup} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">I am a...</label>
            <div className="grid grid-cols-3 gap-2">
              {(["student", "parent", "teacher"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded border px-2 py-2 text-sm capitalize ${
                    role === r ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : ""
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <input
            className="w-full rounded border px-3 py-2"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded border px-3 py-2"
            type="password"
            placeholder="Password (min 10 chars)"
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={tosAccepted}
              onChange={(e) => setTosAccepted(e.target.checked)}
              className="mt-0.5"
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={loading || !tosAccepted}
            className="w-full rounded bg-black py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "..." : "Create account"}
          </button>
        </form>
      ) : (
        <form onSubmit={onConfirm} className="mt-6 space-y-4">
          <p className="text-sm text-gray-600">Enter the code we emailed to {email}.</p>
          <input
            className="w-full rounded border px-3 py-2"
            type="text"
            placeholder="Confirmation code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={loading}
            className="w-full rounded bg-black py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "..." : "Confirm"}
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
        <main className="mx-auto max-w-sm px-6 py-16">
          <h1 className="text-2xl font-bold">Sign up</h1>
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </main>
      }
    >
      <SignupInner />
    </Suspense>
  );
}
