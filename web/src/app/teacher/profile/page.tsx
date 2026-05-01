"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession, currentRole } from "@/lib/cognito";
import { api } from "@/lib/api";
import { toMinorUnits } from "@/lib/money";
import { AvatarPicker } from "@/components/AvatarPicker";
import { VideoPicker } from "@/components/VideoPicker";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";

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
  const { toast } = useToast();
  const { confirm: showConfirm } = useDialog();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState<TeacherProfile>({
    subjects: [],
    languages: [],
    yearsExperience: 0,
    hourlyRateCents: 30000,
    currency: "TND",
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
      setUserId(sub);
      try {
        const resp = await api<{ profile: TeacherProfile }>(`/teachers/${sub}`);
        setForm({
          bio: resp.profile.bio ?? "",
          subjects: resp.profile.subjects ?? [],
          languages: resp.profile.languages ?? [],
          yearsExperience: resp.profile.yearsExperience ?? 0,
          hourlyRateCents: resp.profile.hourlyRateCents ?? 30000,
          currency: resp.profile.currency ?? "TND",
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
    const ok = await showConfirm({ title: "Submit for review", message: "Submit your profile for team review? You won't be able to edit certain fields until it's decided.", destructive: true });
    if (!ok) return;
    try {
      await api(`/teachers/me/submit-verification`, { method: "POST" });
      setForm((f) => ({ ...f, verificationStatus: "pending" }));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("already_pending")) toast("Already under review.", "info");
      else if (msg.includes("already_verified")) toast("Already verified.", "info");
      else toast(msg, "error");
    }
  }

  if (loading) return <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  const vStatus = form.verificationStatus ?? "unsubmitted";

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <p className="eyebrow">Teacher</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Teacher profile</h1>
      <p className="mt-1 text-sm text-ink-soft">This is what students and parents see.</p>

      <section className="card mt-6 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-base text-ink">Verification</div>
            <div className="mt-0.5 text-xs text-ink-faded">
              Verified teachers get a badge and rank higher in search results.
            </div>
          </div>
          <span
            className={`rounded-sm border px-3 py-1 text-xs uppercase tracking-widest ${
              vStatus === "verified"
                ? "border-seal/40 bg-seal/10 text-seal"
                : vStatus === "pending"
                  ? "border-ink-faded/50 bg-parchment/40 text-ink-faded"
                  : vStatus === "rejected"
                    ? "border-seal/40 bg-seal/10 text-seal"
                    : "border-ink-faded/50 bg-parchment/40 text-ink-soft"
            }`}
          >
            {vStatus.replace("_", " ")}
          </span>
        </div>
        {vStatus === "rejected" && form.verificationNotes && (
          <p className="mt-3 text-sm text-ink">
            <span className="font-medium">Reviewer notes:</span> {form.verificationNotes}
          </p>
        )}
        {(vStatus === "unsubmitted" || vStatus === "rejected") && (
          <button
            onClick={submitVerification}
            className="btn-secondary mt-3"
          >
            {vStatus === "rejected" ? "Resubmit for review" : "Submit for review"}
          </button>
        )}
      </section>

      {userId && (
        <section className="card mt-6 p-6">
          <div className="font-display text-base text-ink">Profile picture</div>
          <div className="mt-0.5 text-xs text-ink-faded">Optional. Shown on the directory and your teacher page.</div>
          <div className="mt-4">
            <AvatarPicker userId={userId} />
          </div>
        </section>
      )}

      {userId && (
        <section className="card mt-6 p-6">
          <div className="font-display text-base text-ink">Intro video</div>
          <div className="mt-0.5 text-xs text-ink-faded">
            Record a short video introducing yourself. Students see this on your profile.
          </div>
          <div className="mt-4">
            <VideoPicker userId={userId} />
          </div>
        </section>
      )}

      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6">
        <Field label="Bio">
          <textarea
            className="input"
            rows={4}
            value={form.bio ?? ""}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Tell students about your teaching style, experience, what subjects you love..."
          />
        </Field>

        <Field label="Subjects (comma separated)">
          <input
            className="input"
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
            className="input"
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
              className="input"
              value={form.yearsExperience}
              onChange={(e) => setForm({ ...form, yearsExperience: Number(e.target.value) })}
            />
          </Field>
          <Field label="Hourly rate (TND)">
            <input
              type="number"
              min={1}
              step="0.001"
              className="input"
              value={form.hourlyRateCents / 1000}
              onChange={(e) => setForm({ ...form, hourlyRateCents: toMinorUnits(Number(e.target.value), "TND") })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="City">
            <input
              className="input"
              value={form.city ?? ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Tunis"
            />
          </Field>
          <Field label="Country (2 letters)">
            <input
              maxLength={2}
              className="input uppercase"
              value={form.country ?? ""}
              onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
              placeholder="TN"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.trialSession}
            onChange={(e) => setForm({ ...form, trialSession: e.target.checked })}
            className="accent-seal"
          />
          Offer a free or discounted trial session
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.individualSessions}
            onChange={(e) => setForm({ ...form, individualSessions: e.target.checked })}
            className="accent-seal"
          />
          Offer 1-on-1 individual sessions
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.groupSessions}
            onChange={(e) => setForm({ ...form, groupSessions: e.target.checked })}
            className="accent-seal"
          />
          Offer group sessions
        </label>

        {error && <p className="text-sm text-seal">{error}</p>}
        {saved && <p className="text-sm text-ink">Saved.</p>}

        <button
          disabled={saving}
          className="btn-seal"
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
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
