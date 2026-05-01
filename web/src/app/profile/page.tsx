"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { currentSession, currentRole, type Role } from "@/lib/cognito";
import { toMinorUnits } from "@/lib/money";
import { AvatarPicker } from "@/components/AvatarPicker";
import { VideoPicker } from "@/components/VideoPicker";

type Me = {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
};

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

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Teacher-specific state
  const [teacherForm, setTeacherForm] = useState<TeacherProfile>({
    subjects: [],
    languages: [],
    yearsExperience: 0,
    hourlyRateCents: 30000,
    currency: "TND",
    trialSession: false,
    individualSessions: true,
    groupSessions: false,
  });
  const [teacherSaving, setTeacherSaving] = useState(false);
  const [teacherSaved, setTeacherSaved] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      const r = currentRole(session);
      setRole(r);
      try {
        const m = await api<Me>(`/users/me`);
        setMe(m);
        setDisplayName(m.displayName ?? "");

        if (r === "teacher") {
          try {
            const resp = await api<{ profile: TeacherProfile }>(`/teachers/${m.userId}`);
            setTeacherForm({
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
            // no teacher profile yet
          }
        }
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  async function onSaveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Display name can't be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api(`/users/me`, {
        method: "PATCH",
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onSaveTeacher(e: React.FormEvent) {
    e.preventDefault();
    setTeacherSaving(true);
    setTeacherError(null);
    setTeacherSaved(false);
    try {
      await api("/teachers/me", { method: "PUT", body: JSON.stringify(teacherForm) });
      setTeacherSaved(true);
    } catch (err) {
      setTeacherError((err as Error).message);
    } finally {
      setTeacherSaving(false);
    }
  }

  async function submitVerification() {
    if (!confirm("Submit your profile for team review? You won't be able to edit certain fields until it's decided.")) return;
    try {
      await api(`/teachers/me/submit-verification`, { method: "POST" });
      setTeacherForm((f) => ({ ...f, verificationStatus: "pending" }));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("already_pending")) alert("Already under review.");
      else if (msg.includes("already_verified")) alert("Already verified.");
      else alert(msg);
    }
  }

  if (!me)
    return (
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-ink-soft">
        {error ?? "Loading..."}
      </main>
    );

  const isTeacher = role === "teacher";
  const vStatus = teacherForm.verificationStatus ?? "unsubmitted";

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <p className="eyebrow">Account</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">My profile</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {me.email} · <span className="capitalize">{me.role}</span>
      </p>

      {/* ── Profile picture ──────────────────────────────────── */}
      <section className="card mt-8 p-6">
        <div className="font-display text-base text-ink">Profile picture</div>
        <div className="mt-0.5 text-xs text-ink-faded">
          Shown on your public profile and in conversations.
        </div>
        <div className="mt-4">
          <AvatarPicker userId={me.userId} />
        </div>
      </section>

      {/* ── Intro video (teacher only) ───────────────────────── */}
      {isTeacher && (
        <section className="card mt-6 p-6">
          <div className="font-display text-base text-ink">Intro video</div>
          <div className="mt-0.5 text-xs text-ink-faded">
            A short video introducing yourself. Students see this on your profile page.
          </div>
          <div className="mt-4">
            <VideoPicker userId={me.userId} />
          </div>
        </section>
      )}

      {/* ── Display name ─────────────────────────────────────── */}
      <form onSubmit={onSaveAccount} className="card mt-6 space-y-4 p-6">
        <label className="block">
          <span className="label">Display name</span>
          <input
            className="input"
            maxLength={100}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </label>
        {error && <p className="text-sm text-seal">{error}</p>}
        {saved && <p className="text-sm text-ink">Saved.</p>}
        <button disabled={saving} className="btn-seal">
          {saving ? "Saving..." : "Save profile"}
        </button>
      </form>

      {/* ══════════════════════════════════════════════════════════
          TEACHER SECTIONS
          ══════════════════════════════════════════════════════════ */}
      {isTeacher && (
        <>
          {/* ── Verification ───────────────────────────────────── */}
          <section className="card mt-8 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-base text-ink">Verification</div>
                <div className="mt-0.5 text-xs text-ink-faded">
                  Verified teachers get a badge and rank higher in search.
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
            {vStatus === "rejected" && teacherForm.verificationNotes && (
              <p className="mt-3 text-sm text-ink">
                <span className="font-medium">Reviewer notes:</span> {teacherForm.verificationNotes}
              </p>
            )}
            {(vStatus === "unsubmitted" || vStatus === "rejected") && (
              <button onClick={submitVerification} className="btn-secondary mt-3">
                {vStatus === "rejected" ? "Resubmit for review" : "Submit for review"}
              </button>
            )}
          </section>

          {/* ── Teacher profile form ───────────────────────────── */}
          <form onSubmit={onSaveTeacher} className="card mt-6 space-y-5 p-6">
            <div className="font-display text-base text-ink">Teacher profile</div>
            <p className="text-xs text-ink-faded">This is what students and parents see on your public page.</p>

            <Field label="Bio">
              <textarea
                className="input"
                rows={4}
                value={teacherForm.bio ?? ""}
                onChange={(e) => setTeacherForm({ ...teacherForm, bio: e.target.value })}
                placeholder="Tell students about your teaching style, experience, what subjects you love..."
              />
            </Field>

            <Field label="Subjects (comma separated)">
              <input
                className="input"
                value={teacherForm.subjects.join(", ")}
                onChange={(e) =>
                  setTeacherForm({
                    ...teacherForm,
                    subjects: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="Mathematics, Physics, Chemistry"
              />
            </Field>

            <Field label="Languages (comma separated)">
              <input
                className="input"
                value={teacherForm.languages.join(", ")}
                onChange={(e) =>
                  setTeacherForm({
                    ...teacherForm,
                    languages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
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
                  value={teacherForm.yearsExperience}
                  onChange={(e) => setTeacherForm({ ...teacherForm, yearsExperience: Number(e.target.value) })}
                />
              </Field>
              <Field label="Hourly rate (TND)">
                <input
                  type="number"
                  min={1}
                  step="0.001"
                  className="input"
                  value={teacherForm.hourlyRateCents / 1000}
                  onChange={(e) => setTeacherForm({ ...teacherForm, hourlyRateCents: toMinorUnits(Number(e.target.value), "TND") })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="City">
                <input
                  className="input"
                  value={teacherForm.city ?? ""}
                  onChange={(e) => setTeacherForm({ ...teacherForm, city: e.target.value })}
                  placeholder="Tunis"
                />
              </Field>
              <Field label="Country (2 letters)">
                <input
                  maxLength={2}
                  className="input uppercase"
                  value={teacherForm.country ?? ""}
                  onChange={(e) => setTeacherForm({ ...teacherForm, country: e.target.value.toUpperCase() })}
                  placeholder="TN"
                />
              </Field>
            </div>

            <div className="space-y-2">
              <div className="label">Session types</div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={teacherForm.trialSession}
                  onChange={(e) => setTeacherForm({ ...teacherForm, trialSession: e.target.checked })}
                  className="accent-seal"
                />
                Offer a free trial session
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={teacherForm.individualSessions}
                  onChange={(e) => setTeacherForm({ ...teacherForm, individualSessions: e.target.checked })}
                  className="accent-seal"
                />
                Offer 1-on-1 individual sessions
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={teacherForm.groupSessions}
                  onChange={(e) => setTeacherForm({ ...teacherForm, groupSessions: e.target.checked })}
                  className="accent-seal"
                />
                Offer group sessions
              </label>
            </div>

            {teacherError && <p className="text-sm text-seal">{teacherError}</p>}
            {teacherSaved && <p className="text-sm text-ink">Teacher profile saved.</p>}

            <button disabled={teacherSaving} className="btn-seal">
              {teacherSaving ? "Saving..." : "Save teacher profile"}
            </button>
          </form>
        </>
      )}
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
