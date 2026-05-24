"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signUp, confirmSignUp, type Role } from "@/lib/cognito";

// Display-only signup option that maps to a Cognito role. "Organization" is
// an onboarding label only — there is no `organization` Cognito role; the
// user signs up as a teacher and we flag the dashboard to redirect them to
// the org-creation flow right after their first login.
type SignupOption = "student" | "parent" | "teacher" | "organization";
const SIGNUP_OPTIONS: {
  key: SignupOption;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "student",
    label: "Student",
    hint: "Take lessons",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
      </svg>
    ),
  },
  {
    key: "parent",
    label: "Parent",
    hint: "For your child",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: "teacher",
    label: "Teacher",
    hint: "Teach solo",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    key: "organization",
    label: "Organization",
    hint: "Tutoring center",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <path d="M9 22v-4h6v4" />
        <line x1="8" y1="6" x2="8" y2="6" />
        <line x1="12" y1="6" x2="12" y2="6" />
        <line x1="16" y1="6" x2="16" y2="6" />
        <line x1="8" y1="10" x2="8" y2="10" />
        <line x1="12" y1="10" x2="12" y2="10" />
        <line x1="16" y1="10" x2="16" y2="10" />
        <line x1="8" y1="14" x2="8" y2="14" />
        <line x1="12" y1="14" x2="12" y2="14" />
        <line x1="16" y1="14" x2="16" y2="14" />
      </svg>
    ),
  },
];

function roleForOption(option: SignupOption): Role {
  // Organizations sign up as teachers and then create an OrganizationEntity
  // from /orgs/new. The dashboard auto-redirects them there on first visit.
  return option === "organization" ? "teacher" : option;
}

/* ── Password strength helpers ── */
const PW_RULES = [
  { label: "10+ characters", test: (p: string) => p.length >= 10 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /\d/.test(p) },
  { label: "Special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function usePasswordStrength(password: string) {
  return useMemo(() => {
    const passed = PW_RULES.map((r) => r.test(password));
    const score = passed.filter(Boolean).length;
    const allMet = passed.every(Boolean);
    return { passed, score, allMet };
  }, [password]);
}

const STRENGTH_COLORS = [
  "bg-ink-mute",       // 0 — empty
  "bg-warn",           // 1
  "bg-warn",           // 2
  "bg-gold",           // 3
  "bg-accent-soft",    // 4
  "bg-accent",         // 5 — all met
];

function SignupInner() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"credentials" | "confirm">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [option, setOption] = useState<SignupOption>("student");
  const [tosAccepted, setTosAccepted] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { passed, score, allMet } = usePasswordStrength(password);
  const canSubmit = tosAccepted && allMet && email.length > 0;

  // Honour ?role=teacher etc. from external CTAs (e.g. the landing page's
  // "Apply as a teacher" button).
  useEffect(() => {
    const r = searchParams.get("role");
    if (r === "teacher" || r === "student" || r === "parent" || r === "organization") {
      setOption(r);
    }
  }, [searchParams]);

  // Capture ?ref= from the signup share link and stash it in sessionStorage so
  // the dashboard can auto-claim it once the user completes signup + login.
  // sessionStorage survives page reloads within the same tab (signup -> confirm
  // -> login -> dashboard) but not cross-tab/cross-browser flows — acceptable for
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
      await signUp(email, password, roleForOption(option), new Date().toISOString());
      if (option === "organization" && typeof window !== "undefined") {
        try {
          sessionStorage.setItem("eduboost_pending_org_create", "1");
        } catch {
          /* storage disabled — dashboard just won't auto-redirect */
        }
      }
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
    <main className="mx-auto max-w-container-wide px-8 pb-16 pt-12 sm:pt-20">
      <div className="grid min-h-[calc(100vh-200px)] items-start gap-12 lg:grid-cols-2 lg:gap-16">
        {/* ── Left column: form ── */}
        <div className="mx-auto w-full max-w-md lg:mx-0">
          <div className="eyebrow">Join EduBoost</div>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-ink sm:text-5xl">
            Create your account.
          </h1>

          {step === "credentials" ? (
            <form onSubmit={onSignup} className="mt-10 space-y-6">
              {/* Role picker */}
              <div>
                <span className="label">I am a&hellip;</span>
                <div className="mt-1 grid grid-cols-2 gap-2.5">
                  {SIGNUP_OPTIONS.map((opt) => {
                    const active = option === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setOption(opt.key)}
                        className={`group flex flex-col items-start gap-1.5 rounded-xl border px-4 py-3.5 text-left transition ${
                          active
                            ? "border-ink bg-ink text-white shadow-vellum"
                            : "border-rule bg-bg-card text-ink hover:border-ink-mute hover:bg-bg-soft"
                        }`}
                      >
                        <span className={active ? "text-white/70" : "text-ink-faded"}>
                          {opt.icon}
                        </span>
                        <div>
                          <div className="text-sm font-medium">{opt.label}</div>
                          <div
                            className={`text-[11px] ${
                              active ? "text-white/60" : "text-ink-faded"
                            }`}
                          >
                            {opt.hint}
                          </div>
                        </div>
                        {active && (
                          <span className="absolute right-3 top-3 text-white/70" aria-hidden>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {option === "organization" && (
                  <p className="mt-2 text-xs text-ink-soft">
                    You&apos;ll create your organization profile right after confirming your account.
                  </p>
                )}
              </div>

              {/* Email */}
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

              {/* Password with strength */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-soft tracking-wide">
                    Password
                  </span>
                </div>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 10 characters"
                    minLength={10}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faded hover:text-ink transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Strength bar */}
                <div className="mt-3 flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < score ? STRENGTH_COLORS[score] : "bg-rule-soft"
                      }`}
                    />
                  ))}
                </div>

                {/* Requirements checklist */}
                <ul className="mt-3 space-y-1">
                  {PW_RULES.map((rule, i) => (
                    <li
                      key={rule.label}
                      className={`flex items-center gap-2 text-xs transition-colors ${
                        passed[i] ? "text-accent" : "text-ink-faded"
                      }`}
                    >
                      {passed[i] ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                      )}
                      {rule.label}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Terms */}
              <label className="flex items-start gap-2.5 select-none">
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={(e) => setTosAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-rule accent-accent"
                  required
                />
                <span className="text-sm text-ink-soft">
                  I agree to the{" "}
                  <Link href="/terms" target="_blank" className="underline text-accent hover:text-accent-deep transition">
                    Terms and Code of Conduct
                  </Link>
                  .
                </span>
              </label>

              {error && (
                <div className="rounded-[10px] border border-warn/30 bg-warn/5 px-4 py-3">
                  <p className="text-sm text-warn">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !canSubmit}
                className="btn-seal w-full"
              >
                {loading ? "Creating..." : "Create account"}
              </button>

              <p className="text-center text-sm text-ink-soft">
                Already registered?{" "}
                <Link href="/login" className="font-medium text-accent hover:text-accent-deep underline transition">
                  Log in
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={onConfirm} className="mt-10 space-y-5">
              <div className="rounded-[10px] border border-accent-soft bg-accent-pale/40 px-4 py-3">
                <p className="text-sm text-ink-soft">
                  Enter the 6-digit code we emailed to{" "}
                  <strong className="text-ink">{email}</strong>.
                </p>
              </div>
              <label className="block">
                <span className="label">Confirmation code</span>
                <input
                  className="input font-mono text-center text-lg tracking-[0.3em]"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </label>
              {error && (
                <div className="rounded-[10px] border border-warn/30 bg-warn/5 px-4 py-3">
                  <p className="text-sm text-warn">{error}</p>
                </div>
              )}
              <button disabled={loading} className="btn-seal w-full">
                {loading ? "Confirming..." : "Confirm"}
              </button>
            </form>
          )}
        </div>

        {/* ── Right column: testimonial panel ── */}
        <div className="hidden lg:flex lg:items-center lg:justify-center">
          <div className="w-full max-w-md rounded-2xl bg-accent p-10 text-white">
            <blockquote className="space-y-6">
              <svg width="32" height="24" viewBox="0 0 32 24" fill="none" className="text-white/30">
                <path d="M0 24V14.4C0 6.13 4.48 1.07 13.44 0l1.28 3.2C9.6 4.27 7.36 7.47 7.04 12H12.8V24H0zm18.56 0V14.4c0-8.27 4.48-13.33 13.44-14.4L33.28 3.2C28.16 4.27 25.92 7.47 25.6 12h5.76V24H18.56z" fill="currentColor" />
              </svg>
              <p className="font-serif text-xl italic leading-relaxed text-white/95">
                &ldquo;I signed up as a teacher and had my first student within
                a week. The classroom tools and scheduling are incredibly
                smooth.&rdquo;
              </p>
              <div className="flex items-center gap-4 pt-2">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 font-serif text-lg font-medium">
                  S
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Sarra M.</div>
                  <div className="text-xs text-white/60">Teacher, Sfax</div>
                </div>
              </div>
            </blockquote>
          </div>
        </div>
      </div>
    </main>
  );
}

// Next.js 15 requires useSearchParams consumers to be wrapped in Suspense so
// the page can statically render while the query string is resolved on client.
export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-container-wide px-8 pb-16 pt-12 sm:pt-20 text-center">
          <div className="eyebrow">Join EduBoost</div>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-ink sm:text-5xl">
            Create your account.
          </h1>
          <p className="mt-6 text-sm text-ink-soft">Loading...</p>
        </main>
      }
    >
      <SignupInner />
    </Suspense>
  );
}
