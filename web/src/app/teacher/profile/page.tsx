"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession, currentRole } from "@/lib/cognito";
import { api } from "@/lib/api";

type TeacherProfile = {
  bio?: string;
  subjects: string[];
  languages: string[];
  yearsExperience: number;
  hourlyRateCents: number;
  currency: string;
  trialSession: boolean;
  individualSessions: boolean;
  groupSessions: boolean;
  city?: string;
  country?: string;
  verificationStatus?: "unsubmitted" | "pending" | "verified" | "rejected";
  verificationNotes?: string;
};

export default function TeacherProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<TeacherProfile>({
    subjects: [],
    languages: [],
    yearsExperience: 0,
    hourlyRateCents: 3000,
    currency: "EUR",
    trialSession: false,
    individualSessions: true,
    groupSessions: false,
  });

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      if (currentRole(session) !== "teacher") {
        router.replace("/dashboard");
        return;
      }
      const sub = session.getIdToken().payload.sub as string;
      try {
        const resp = await api<{ profile: TeacherProfile }>(`/teachers/${sub}`);
        setForm({
          bio: resp.profile.bio ?? "",
          subjects: resp.profile.subjects ?? [],
          languages: resp.profile.languages ?? [],
          yearsExperience: resp.profile.yearsExperience ?? 0,
          hourlyRateCents: resp.profile.hourlyRateCents ?? 3000,
          currency: resp.profile.currency ?? "EUR",
          trialSession: resp.profile.trialSession ?? false,
          individualSessions: resp.profile.individualSessions ?? true,
          groupSessions: resp.profile.groupSessions ?? false,
          city: resp.profile.city ?? "",
          country: resp.profile.country ?? "",
          verificationStatus: resp.profile.verificationStatus ?? "unsubmitted",
          verificationNotes: resp.profile.verificationNotes,
        });
      } catch {
        // no existing profile yet
      }
      setLoading(false);
    })();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api("/teachers/me", { method: "PUT", body: JSON.stringify(form) });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function submitVerification() {
    if (!confirm("Submit your profile for team review? You won't be able to edit certain fields until it's decided.")) return;
    try {
      await api(`/teachers/me/submit-verification`, { method: "POST" });
      setForm((f) => ({ ...f, verificationStatus: "pending" }));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("already_pending")) alert("Already under review.");
      else if (msg.includes("already_verified")) alert("Already verified.");
      else alert(msg);
    }
  }

  if (loading) return <main className="mx-auto max-w-2xl px-6 py-12">Loading...</main>;

  const vStatus = form.verificationStatus ?? "unsubmitted";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Teacher profile</h1>
      <p className="mt-1 text-sm text-gray-500">This is what students and parents see.</p>

      <section className="mt-6 rounded border p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Verification</div>
            <div className="mt-0.5 text-xs text-gray-500">
              Verified teachers get a badge and rank higher in search results.
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs uppercase ${
              vStatus === "verified"
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                : vStatus === "pending"
                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                  : vStatus === "rejected"
                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
            }`}
          >
            {vStatus.replace("_", " ")}
          </span>
        </div>
        {vStatus === "rejected" && form.verificationNotes && (
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">Reviewer notes:</span> {form.verificationNotes}
          </p>
        )}
        {(vStatus === "unsubmitted" || vStatus === "rejected") && (
          <button
            onClick={submitVerification}
            className="mt-3 rounded border px-3 py-1 text-xs"
          >
            {vStatus === "rejected" ? "Resubmit for review" : "Submit for review"}
          </button>
        )}
      </section>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Bio">
          <textarea
            className="w-full rounded border px-3 py-2"
            rows={4}
            value={form.bio ?? ""}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Tell students about your teaching style, experience, what subjects you love..."
          />
        </Field>

        <Field label="Subjects (comma separated)">
          <input
            className="w-full rounded border px-3 py-2"
            value={form.subjects.join(", ")}
            onChange={(e) =>
              setForm({
                ...form,
                subjects: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Mathematics, Physics, Chemistry"
          />
        </Field>

        <Field label="Languages (comma separated)">
          <input
            className="w-full rounded border px-3 py-2"
            value={form.languages.join(", ")}
            onChange={(e) =>
              setForm({
                ...form,
                languages: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="English, French, Arabic"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Years experience">
            <input
              type="number"
              min={0}
              max={80}
              className="w-full rounded border px-3 py-2"
              value={form.yearsExperience}
              onChange={(e) => setForm({ ...form, yearsExperience: Number(e.target.value) })}
            />
          </Field>
          <Field label="Hourly rate (EUR)">
            <input
              type="number"
              min={1}
              className="w-full rounded border px-3 py-2"
              value={Math.round(form.hourlyRateCents / 100)}
              onChange={(e) => setForm({ ...form, hourlyRateCents: Number(e.target.value) * 100 })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="City">
            <input
              className="w-full rounded border px-3 py-2"
              value={form.city ?? ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </Field>
          <Field label="Country (2 letters)">
            <input
              maxLength={2}
              className="w-full rounded border px-3 py-2 uppercase"
              value={form.country ?? ""}
              onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
              placeholder="IE"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.trialSession}
            onChange={(e) => setForm({ ...form, trialSession: e.target.checked })}
          />
          Offer a free or discounted trial session
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.individualSessions}
            onChange={(e) => setForm({ ...form, individualSessions: e.target.checked })}
          />
          Offer 1-on-1 individual sessions
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.groupSessions}
            onChange={(e) => setForm({ ...form, groupSessions: e.target.checked })}
          />
          Offer group sessions
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-700">Saved.</p>}

        <button
          disabled={saving}
          className="rounded bg-black px-5 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
