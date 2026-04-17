"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

export default function NewOrgPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"educational" | "commercial">("educational");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      const r = currentRole(s);
      if (r !== "teacher") return router.replace("/dashboard");
      setReady(true);
    })();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const org = await api<{ orgId: string }>(`/orgs`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          kind,
          country: country.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      router.replace(`/orgs/${org.orgId}` as never);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <p className="eyebrow">Teams</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Create an organization</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Invite teachers to collaborate, link classrooms, and manage students under
        a single umbrella.
      </p>
      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6">
        <label className="block">
          <span className="label">Name</span>
          <input
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="label">Kind</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="input"
            >
              <option value="educational">Educational</option>
              <option value="commercial">Commercial</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Country (optional)</span>
            <input
              maxLength={80}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="input"
              placeholder="e.g. France"
            />
          </label>
        </div>
        <label className="block">
          <span className="label">Description (optional)</span>
          <textarea
            rows={4}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
          />
        </label>
        {error && <p className="text-sm text-seal">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="btn-seal"
        >
          {submitting ? "Creating..." : "Create"}
        </button>
      </form>
      <p className="mt-8 text-sm">
        <Link href="/orgs" className="text-ink-soft underline">
          ← All organizations
        </Link>
      </p>
    </main>
  );
}
