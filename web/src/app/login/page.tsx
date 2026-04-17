"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/cognito";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <main className="mx-auto max-w-md px-6 pb-16 pt-20">
      <div className="text-center">
        <p className="eyebrow">Return to your studies</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
          Log in
        </h1>
      </div>
      <form onSubmit={onSubmit} className="card mt-10 space-y-5 p-8">
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
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="text-sm text-seal">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn-seal w-full"
        >
          {loading ? "Signing in..." : "Log in"}
        </button>
        <p className="text-center text-sm text-ink-soft">
          New here?{" "}
          <a href="/signup" className="underline">
            Create an account
          </a>
          .
        </p>
      </form>
    </main>
  );
}
