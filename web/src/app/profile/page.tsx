"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { currentSession, currentRole, type Role } from "@/lib/cognito";
import { toMinorUnits } from "@/lib/money";
import { AvatarPicker } from "@/components/AvatarPicker";
import { VideoPicker } from "@/components/VideoPicker";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import {
  User,
  Settings,
  Lock,
  Bell,
  CreditCard,
  ShieldAlert,
  Plus,
  Download,
} from "lucide-react";

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

type SettingsTab = "profile" | "account" | "security" | "notif" | "billing" | "danger";

const TAB_ITEMS: { k: SettingsTab; label: string; icon: typeof User }[] = [
  { k: "profile", label: "Profile", icon: User },
  { k: "account", label: "Account", icon: Settings },
  { k: "security", label: "Security", icon: Lock },
  { k: "notif", label: "Notifications", icon: Bell },
  { k: "billing", label: "Billing", icon: CreditCard },
  { k: "danger", label: "Danger zone", icon: ShieldAlert },
];

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm: showConfirm } = useDialog();
  const [me, setMe] = useState<Me | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

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
    try {
      await api(`/users/me`, {
        method: "PATCH",
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      toast("Profile saved.", "success");
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
      toast("Teacher profile saved.", "success");
    } catch (err) {
      setTeacherError((err as Error).message);
    } finally {
      setTeacherSaving(false);
    }
  }

  async function submitVerification() {
    const ok = await showConfirm({ title: "Submit for review", message: "Submit your profile for team review? You won't be able to edit certain fields until it's decided.", destructive: true });
    if (!ok) return;
    try {
      await api(`/teachers/me/submit-verification`, { method: "POST" });
      setTeacherForm((f) => ({ ...f, verificationStatus: "pending" }));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("already_pending")) toast("Already under review.", "info");
      else if (msg.includes("already_verified")) toast("Already verified.", "info");
      else toast(msg, "error");
    }
  }

  if (!me)
    return (
      <main className="mx-auto max-w-container-wide px-4 pb-24 pt-12 sm:px-8 text-ink-soft">
        {error ?? "Loading..."}
      </main>
    );

  const isTeacher = role === "teacher";
  const vStatus = teacherForm.verificationStatus ?? "unsubmitted";

  return (
    <main className="pb-8">
      {/* PageHead */}
      <div className="border-b border-rule px-4 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
        <div className="eyebrow">Settings</div>
        <h1 className="mt-2 text-[clamp(28px,3vw,40px)] font-bold tracking-[-0.018em]">
          Account &amp; preferences
        </h1>
      </div>

      {/* Horizontal tabs */}
      <div className="border-b border-rule px-8">
        <div className="flex flex-wrap gap-x-8 gap-y-1 overflow-x-auto">
          {TAB_ITEMS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.k;
            return (
              <button
                key={t.k}
                onClick={() => setActiveTab(t.k)}
                className="-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3.5 text-[14px] transition"
                style={{
                  borderColor: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--ink)" : "var(--ink-faded)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                <Icon size={15} className={active ? "text-accent" : "text-ink-faded"} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-[760px] px-8 pt-7">
        <div className="space-y-6">
          {/* ═══ Profile tab ═══ */}
          {activeTab === "profile" && (
            <>
              <section className="card p-6">
                <h3 className="font-bold text-lg text-ink">Profile picture</h3>
                <p className="mt-1 text-[13px] text-ink-soft">
                  Shown on your public profile and in conversations.
                </p>
                <div className="mt-4">
                  <AvatarPicker userId={me.userId} />
                </div>
              </section>

              {isTeacher && (
                <section className="card p-6">
                  <h3 className="font-bold text-lg text-ink">Intro video</h3>
                  <p className="mt-1 text-[13px] text-ink-soft">
                    A short video introducing yourself. Students see this on your profile page.
                  </p>
                  <div className="mt-4">
                    <VideoPicker userId={me.userId} />
                  </div>
                </section>
              )}

              <form onSubmit={onSaveAccount} className="card space-y-4 p-6">
                <h3 className="font-bold text-lg text-ink">Public profile</h3>
                <p className="text-[13px] text-ink-soft">{me.email} · <span className="capitalize">{me.role}</span></p>
                <div className="mt-4 grid grid-cols-2 gap-3.5">
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
                  <label className="block">
                    <span className="label">Role</span>
                    <input className="input" value={me.role} readOnly />
                  </label>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button disabled={saving} className="btn-seal">
                  {saving ? "Saving..." : "Save profile"}
                </button>
              </form>

              {/* Learning goals */}
              <section className="card p-6">
                <h3 className="font-bold text-lg text-ink">Learning goals</h3>
                <p className="mt-1 text-[13px] text-ink-soft">Helps us match you to teachers and content.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Bac prep", "University admission", "Improve average", "Build study habits", "Mock exams"].map((s, i) => (
                    <span
                      key={s}
                      className={`chip cursor-pointer ${i < 3 ? "bg-ink text-white border-ink" : ""}`}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ═══ Account tab ═══ */}
          {activeTab === "account" && (
            <section className="card p-6">
              <h3 className="font-bold text-lg text-ink">Account</h3>
              <div className="mt-5 space-y-3.5">
                <label className="block">
                  <span className="label">Email</span>
                  <input className="input" defaultValue={me.email} readOnly />
                </label>
                <label className="block">
                  <span className="label">Phone (for SMS reminders)</span>
                  <input className="input" placeholder="+216 55 555 555" />
                </label>
                <label className="block">
                  <span className="label">Language</span>
                  <select className="input">
                    <option>English</option>
                    <option>Français</option>
                    <option>العربية</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label">Timezone</span>
                  <select className="input">
                    <option>Africa/Tunis · GMT+1</option>
                    <option>Europe/Paris · GMT+1</option>
                  </select>
                </label>
                <button className="btn-seal">Save account</button>
              </div>
            </section>
          )}

          {/* ═══ Security tab ═══ */}
          {activeTab === "security" && (
            <>
              <section className="card p-6">
                <h3 className="font-bold text-lg text-ink">Password</h3>
                <p className="mt-1 text-[13px] text-ink-soft">Last changed 3 months ago.</p>
                <div className="mt-5 space-y-3.5">
                  <label className="block">
                    <span className="label">Current password</span>
                    <input className="input" type="password" />
                  </label>
                  <label className="block">
                    <span className="label">New password</span>
                    <input className="input" type="password" />
                  </label>
                  <button className="btn-seal">Update password</button>
                </div>
              </section>

              <section className="card p-6">
                <h3 className="font-bold text-lg text-ink">Two-factor authentication</h3>
                <p className="mt-1 text-[13px] text-ink-soft">Add a code from your phone to every login.</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[13.5px] text-ink-soft">
                    Status: <strong className="font-medium text-ink">Disabled</strong>
                  </span>
                  <button className="btn-secondary text-sm">Enable 2FA</button>
                </div>
              </section>

              <section className="card p-6">
                <h3 className="font-bold text-lg text-ink">Active sessions</h3>
                <div className="mt-4 divide-y divide-rule-soft">
                  {[
                    { device: "Chrome on Mac", where: "Tunis · Tunisia", time: "Now", current: true },
                    { device: "Safari on iPhone", where: "Tunis · Tunisia", time: "2h ago", current: false },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-3">
                      <div>
                        <div className="text-[13.5px]">
                          {s.device}
                          {s.current && (
                            <span className="chip chip-accent ml-1.5 text-[10.5px]">This device</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-faded">{s.where} · {s.time}</div>
                      </div>
                      {!s.current && <button className="btn-ghost text-xs">Revoke</button>}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ═══ Notifications tab ═══ */}
          {activeTab === "notif" && (
            <section className="card p-6">
              <h3 className="font-bold text-lg text-ink">Notification preferences</h3>
              <p className="mt-1 text-[13px] text-ink-soft">We never spam. You can mute everything from here.</p>
              <div className="mt-5">
                <div className="grid grid-cols-[1fr_80px_80px_80px] border-b border-rule pb-2">
                  <div />
                  <div className="text-center font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faded">Email</div>
                  <div className="text-center font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faded">Push</div>
                  <div className="text-center font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faded">SMS</div>
                </div>
                {[
                  { label: "Session reminders", vals: [true, true, true] },
                  { label: "New message", vals: [true, true, false] },
                  { label: "Homework due", vals: [true, false, false] },
                  { label: "Weekly summary", vals: [true, true, false] },
                  { label: "Community activity", vals: [false, false, false] },
                  { label: "Marketing & news", vals: [false, false, false] },
                ].map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_80px_80px] items-center border-b border-rule-soft py-2.5">
                    <span className="text-sm">{row.label}</span>
                    {row.vals.map((v, j) => (
                      <label key={j} className="flex justify-center">
                        <input type="checkbox" defaultChecked={v} className="accent-accent" />
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══ Billing tab ═══ */}
          {activeTab === "billing" && (
            <>
              <section className="card p-6">
                <h3 className="font-bold text-lg text-ink">Payment methods</h3>
                <div className="mt-4">
                  <div className="card flex items-center gap-3.5 p-4">
                    <div className="flex h-[30px] w-[44px] items-center justify-center rounded bg-gradient-to-br from-[#1a1f71] to-[#4154a5] text-[11px] font-bold tracking-wider text-white">
                      VISA
                    </div>
                    <div className="flex-1">
                      <div className="text-[13.5px]">•••• •••• •••• 4242</div>
                      <div className="text-xs text-ink-faded">Expires 04/28 · Default</div>
                    </div>
                    <button className="btn-ghost text-xs">Edit</button>
                  </div>
                  <button className="btn-secondary mt-3 flex items-center gap-1.5 text-sm">
                    <Plus size={13} /> Add payment method
                  </button>
                </div>
              </section>

              <section className="card p-6">
                <h3 className="font-bold text-lg text-ink">Billing history</h3>
                <div className="mt-4 divide-y divide-rule-soft">
                  {[
                    { date: "May 18", desc: "Bac maths · 1h · Amira", amt: "45 DT" },
                    { date: "May 15", desc: "Physics · 1h · Karim", amt: "60 DT" },
                    { date: "May 12", desc: "English · 1h · Rim", amt: "38 DT" },
                    { date: "May 08", desc: "Marketplace · Past problems pack", amt: "28 DT" },
                  ].map((b, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="text-[13.5px]">{b.desc}</div>
                        <div className="text-xs text-ink-faded">{b.date}</div>
                      </div>
                      <span className="font-mono text-[13px]">{b.amt}</span>
                    </div>
                  ))}
                </div>
                <button className="btn-ghost mt-3 flex items-center gap-1.5 text-xs">
                  <Download size={13} /> Download all invoices
                </button>
              </section>
            </>
          )}

          {/* ═══ Danger zone tab ═══ */}
          {activeTab === "danger" && (
            <section className="card p-6">
              <h3 className="font-bold text-lg text-ink">Danger zone</h3>
              <p className="mt-1 text-[13px] text-ink-soft">These actions cannot be undone.</p>
              <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <div>
                  <div className="text-sm font-medium text-red-800">Delete account</div>
                  <div className="mt-0.5 text-xs text-red-700/70">
                    Removes your profile, history, notes and payment methods. Sessions already attended remain in teacher records (anonymized).
                  </div>
                </div>
                <button className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-red-700">
                  Delete account
                </button>
              </div>
            </section>
          )}

          {/* ═══ Teacher profile (always visible at bottom for teachers on profile tab) ═══ */}
          {isTeacher && activeTab === "profile" && (
            <>
              <section className="card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[15px] text-ink">Verification</div>
                    <div className="mt-0.5 text-xs text-ink-faded">
                      Verified teachers get a badge and rank higher in search.
                    </div>
                  </div>
                  <span
                    className={`rounded-sm border px-3 py-1 text-xs uppercase tracking-widest ${
                      vStatus === "verified"
                        ? "border-accent/30 bg-accent/10 text-accent"
                        : vStatus === "pending"
                          ? "border-rule bg-bg-soft text-ink-faded"
                          : vStatus === "rejected"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-rule bg-bg-soft text-ink-soft"
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

              <form onSubmit={onSaveTeacher} className="card space-y-5 p-6">
                <div className="font-semibold text-[15px] text-ink">Teacher profile</div>
                <p className="text-xs text-ink-faded">This is what students and parents see on your public page.</p>

                <label className="block">
                  <span className="label">Bio</span>
                  <textarea
                    className="input"
                    rows={4}
                    value={teacherForm.bio ?? ""}
                    onChange={(e) => setTeacherForm({ ...teacherForm, bio: e.target.value })}
                    placeholder="Tell students about your teaching style, experience, what subjects you love..."
                  />
                </label>

                <label className="block">
                  <span className="label">Subjects (comma separated)</span>
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
                </label>

                <label className="block">
                  <span className="label">Languages (comma separated)</span>
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
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="label">Years experience</span>
                    <input
                      type="number"
                      min={0}
                      max={80}
                      className="input"
                      value={teacherForm.yearsExperience}
                      onChange={(e) => setTeacherForm({ ...teacherForm, yearsExperience: Number(e.target.value) })}
                    />
                  </label>
                  <label className="block">
                    <span className="label">Hourly rate (TND)</span>
                    <input
                      type="number"
                      min={1}
                      step="0.001"
                      className="input"
                      value={teacherForm.hourlyRateCents / 1000}
                      onChange={(e) => setTeacherForm({ ...teacherForm, hourlyRateCents: toMinorUnits(Number(e.target.value), "TND") })}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="label">City</span>
                    <input
                      className="input"
                      value={teacherForm.city ?? ""}
                      onChange={(e) => setTeacherForm({ ...teacherForm, city: e.target.value })}
                      placeholder="Tunis"
                    />
                  </label>
                  <label className="block">
                    <span className="label">Country (2 letters)</span>
                    <input
                      maxLength={2}
                      className="input uppercase"
                      value={teacherForm.country ?? ""}
                      onChange={(e) => setTeacherForm({ ...teacherForm, country: e.target.value.toUpperCase() })}
                      placeholder="TN"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="label">Session types</div>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={teacherForm.trialSession}
                      onChange={(e) => setTeacherForm({ ...teacherForm, trialSession: e.target.checked })}
                      className="accent-accent"
                    />
                    Offer a free trial session
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={teacherForm.individualSessions}
                      onChange={(e) => setTeacherForm({ ...teacherForm, individualSessions: e.target.checked })}
                      className="accent-accent"
                    />
                    Offer 1-on-1 individual sessions
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={teacherForm.groupSessions}
                      onChange={(e) => setTeacherForm({ ...teacherForm, groupSessions: e.target.checked })}
                      className="accent-accent"
                    />
                    Offer group sessions
                  </label>
                </div>

                {teacherError && <p className="text-sm text-red-600">{teacherError}</p>}
                {teacherSaved && <p className="text-sm text-ink">Teacher profile saved.</p>}

                <button disabled={teacherSaving} className="btn-seal">
                  {teacherSaving ? "Saving..." : "Save teacher profile"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
