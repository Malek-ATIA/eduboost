"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { forgotPassword, confirmPassword } from "@/lib/cognito";
import { Check, ChevronLeft, Eye, EyeOff } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setStep("code");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    setLoading(true);
    try {
      await confirmPassword(email.trim(), code.trim(), newPassword);
      setStep("done");
      setTimeout(() => router.push("/login"), 1800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-[460px] px-8 pb-16 pt-12 sm:pt-20">
      <div>
        <div>
          <div className="eyebrow">Account recovery</div>
          <h1 className="mt-3 font-bold text-[32px] tracking-tight text-ink sm:text-5xl">
            Forgot your <span className="text-accent">password</span>?
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
            Enter the email you used to sign up. We&apos;ll send a one-time code so you can set a new password.
          </p>

          {step === "email" && (
            <form onSubmit={onSendCode} className="mt-10 space-y-5">
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

              {error && (
                <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button disabled={loading} className="btn-seal w-full">
                {loading ? "Sending..." : "Send reset code"}
              </button>

              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-ink-faded transition hover:text-ink"
              >
                <ChevronLeft size={14} /> Back to log in
              </Link>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={onConfirm} className="mt-10 space-y-5">
              <div className="rounded-[10px] border border-accent-soft bg-accent-pale px-4 py-3 text-sm">
                <div className="flex items-center gap-2 text-accent-deep">
                  <Check size={16} /> <strong className="font-medium">Check your inbox</strong>
                </div>
                <p className="mt-1.5 text-ink-soft">
                  We sent a 6-digit code to <strong className="text-ink">{email}</strong>. Code is valid for 15 minutes.
                </p>
              </div>

              <label className="block">
                <span className="label">Confirmation code</span>
                <input
                  className="input text-center font-mono text-lg tracking-[0.3em]"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </label>

              <div>
                <span className="label">New password</span>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPw ? "text" : "password"}
                    placeholder="At least 10 characters"
                    minLength={10}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faded transition hover:text-ink"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button disabled={loading} className="btn-seal w-full">
                {loading ? "Updating..." : "Set new password"}
              </button>

              <button
                type="button"
                onClick={() => { setStep("email"); setCode(""); setNewPassword(""); }}
                className="text-sm text-ink-faded transition hover:text-ink"
              >
                Try a different email
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="mt-10 rounded-[10px] border border-accent-soft bg-accent-pale px-5 py-5">
              <div className="flex items-center gap-2 text-accent-deep">
                <Check size={18} />
                <strong className="font-medium">Password updated.</strong>
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                Redirecting you to log in...
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
