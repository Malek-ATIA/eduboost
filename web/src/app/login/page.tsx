"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/cognito";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      router.push("/dashboard");
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
          <div className="eyebrow">Welcome back</div>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-ink sm:text-5xl">
            Log in.
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            Pick up where you left off on EduBoost.
          </p>

          <form onSubmit={onSubmit} className="mt-10 space-y-5">
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

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-ink-soft tracking-wide">
                  Password
                </span>
                <a
                  href="/forgot-password"
                  className="text-xs font-medium text-accent hover:text-accent-deep transition"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
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
            </div>

            {/* Keep signed in */}
            <label className="flex items-center gap-2.5 select-none">
              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                className="h-4 w-4 rounded border-rule accent-accent"
              />
              <span className="text-sm text-ink-soft">Keep me signed in</span>
            </label>

            {error && (
              <div className="rounded-[10px] border border-warn/30 bg-warn/5 px-4 py-3">
                <p className="text-sm text-warn">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-seal w-full"
            >
              {loading ? "Signing in..." : "Log in"}
            </button>

            {/* Divider */}
            <div className="rule text-xs">OR</div>

            {/* Google */}
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => {
                /* Google OAuth — not yet wired */
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            <p className="text-center text-sm text-ink-soft">
              New to EduBoost?{" "}
              <Link href="/signup" className="font-medium text-accent hover:text-accent-deep underline transition">
                Create an account
              </Link>
            </p>
          </form>
        </div>

        {/* ── Right column: testimonial panel ── */}
        <div className="hidden lg:flex lg:items-center lg:justify-center">
          <div className="w-full max-w-md rounded-2xl bg-accent p-10 text-white">
            <blockquote className="space-y-6">
              <svg width="32" height="24" viewBox="0 0 32 24" fill="none" className="text-white/30">
                <path d="M0 24V14.4C0 6.13 4.48 1.07 13.44 0l1.28 3.2C9.6 4.27 7.36 7.47 7.04 12H12.8V24H0zm18.56 0V14.4c0-8.27 4.48-13.33 13.44-14.4L33.28 3.2C28.16 4.27 25.92 7.47 25.6 12h5.76V24H18.56z" fill="currentColor" />
              </svg>
              <p className="font-serif text-xl italic leading-relaxed text-white/95">
                &ldquo;EduBoost transformed how I prepare for the Bac. My tutor
                explains things so clearly, and the AI quizzes keep me on
                track.&rdquo;
              </p>
              <div className="flex items-center gap-4 pt-2">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 font-serif text-lg font-medium">
                  A
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Amine B.</div>
                  <div className="text-xs text-white/60">Student, Tunis</div>
                </div>
              </div>
            </blockquote>
          </div>
        </div>
      </div>
    </main>
  );
}
