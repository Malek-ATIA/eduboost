"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { api } from "@/lib/api";
import { currentSession } from "@/lib/cognito";
import { formatMoneySymbol } from "@/lib/money";
import { Avatar } from "@/components/Avatar";
import {
  ArrowRight,
  ChevronLeft,
  Check,
  Monitor,
  MapPin,
  Lock,
} from "lucide-react";

type BookingType = "trial" | "single" | "package";

type CreateBookingResponse = {
  booking: { bookingId: string; amountCents: number; currency: string };
  clientSecret: string;
};

type TeacherResponse = {
  user: { userId: string; displayName: string };
  profile: {
    hourlyRateCents: number;
    currency: string;
    trialSession: boolean;
    subjects: string[];
  };
};

type BookingData = {
  type: "trial" | "regular" | "long";
  duration: number;
  date: string;
  time: string;
  location: "online" | "irl";
  goals: string;
  pay: "card" | "edinar" | "later";
};

const STEPS = [
  { n: 1, label: "Session details" },
  { n: 2, label: "Goals & focus" },
  { n: 3, label: "Payment" },
  { n: 4, label: "Confirmed" },
];

export default function BookPage({ params }: { params: Promise<{ teacherId: string }> }) {
  const { teacherId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");

  const [step, setStep] = useState(1);
  const [teacher, setTeacher] = useState<TeacherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<BookingData>({
    type: typeParam === "trial" ? "trial" : "regular",
    duration: typeParam === "trial" ? 30 : 60,
    date: "Tue 27 May",
    time: "17:30",
    location: "online",
    goals: "",
    pay: "card",
  });

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) {
        router.replace(`/login?next=/book/${teacherId}` as never);
        return;
      }
      try {
        const t = await api<TeacherResponse>(`/teachers/${teacherId}`);
        setTeacher(t);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [teacherId, router]);

  async function confirmBooking() {
    if (!teacher) return;
    setSubmitting(true);
    setError(null);
    try {
      const price = form.type === "trial" ? 0 : form.type === "long"
        ? Math.round(teacher.profile.hourlyRateCents * 1.5)
        : teacher.profile.hourlyRateCents;
      const typeMap: Record<string, BookingType> = { trial: "trial", regular: "single", long: "package" };
      const resp = await api<CreateBookingResponse>(`/bookings`, {
        method: "POST",
        body: JSON.stringify({
          teacherId,
          type: typeMap[form.type] ?? "single",
          amountCents: price,
          currency: teacher.profile.currency ?? "TND",
        }),
      });
      setBookingId(resp.booking.bookingId);
      setClientSecret(resp.clientSecret);
      setStep(4);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !teacher) {
    return <main className="mx-auto max-w-container-wide px-4 pb-24 pt-12 sm:px-8 text-red-600">{error}</main>;
  }
  if (!teacher) {
    return (
      <main className="mx-auto max-w-container-wide px-4 pb-24 pt-12 sm:px-8">
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
        </div>
      </main>
    );
  }

  const rate = teacher.profile.hourlyRateCents;
  const currency = teacher.profile.currency ?? "TND";
  const total = form.type === "trial" ? 0 : form.type === "long" ? Math.round(rate * 1.5) : rate;
  const teacherName = teacher.user.displayName;

  return (
    <main className="mx-auto max-w-container-wide px-4 pb-24 pt-8 sm:px-8">
      <Link
        href={`/teachers/${teacherId}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-faded transition hover:text-ink"
      >
        <ChevronLeft size={16} /> Back to {teacherName}
      </Link>

      <div className="mt-3 space-y-6">
        {/* ══ Steps ══ */}
        <div>
          <div className="eyebrow">Book a session</div>
          <h1 className="mt-2.5 font-bold text-[clamp(32px,4vw,44px)] tracking-tight">
            {step < 4 ? (
              <>With <span className="text-accent">{teacherName}</span>.</>
            ) : (
              <>You&apos;re all set.</>
            )}
          </h1>

          {/* Step dots */}
          <div className="mt-5 flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-center">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full font-mono text-[11px] ${
                      step >= s.n
                        ? "border border-accent bg-accent text-white"
                        : "border border-rule bg-white text-ink-faded"
                    }`}
                  >
                    {step > s.n ? <Check size={11} /> : s.n}
                  </span>
                  <span className={`text-[13px] ${step >= s.n ? "text-ink" : "text-ink-faded"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-3.5 h-px flex-1 ${step > s.n ? "bg-accent" : "bg-rule"}`}
                    style={{ maxWidth: 80, minWidth: 20 }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step content card */}
          <div className="card mt-5 p-7">
            {/* ─── Step 1: Session details ─── */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <div className="label mb-2">Session type</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { k: "trial" as const, label: "Free trial · 30m", price: "Free", dur: 30 },
                      { k: "regular" as const, label: "Regular · 1h", price: formatMoneySymbol(rate, currency, { trim: true }), dur: 60 },
                      { k: "long" as const, label: "Deep dive · 90m", price: formatMoneySymbol(Math.round(rate * 1.5), currency, { trim: true }), dur: 90 },
                    ].map((o) => (
                      <button
                        key={o.k}
                        onClick={() => setForm((d) => ({ ...d, type: o.k, duration: o.dur }))}
                        className={`rounded-[10px] p-3.5 text-left transition ${
                          form.type === o.k
                            ? "border-[1.5px] border-ink bg-ink text-white"
                            : "border border-rule bg-white text-ink hover:border-ink/30"
                        }`}
                      >
                        <div className="text-[13.5px] font-medium">{o.label}</div>
                        <div className={`mt-1 text-xs ${form.type === o.k ? "text-white/65" : "text-ink-faded"}`}>
                          {o.price}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="label mb-2">Date & time</div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      className="input"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                    <input
                      className="input"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                    />
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {["Today 17:30", "Tomorrow 16:00", "Thu 28 · 18:00", "Sat 31 · 10:00"].map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          const parts = s.includes(" · ") ? s.split(" · ") : [s.split(" ").slice(0, -1).join(" "), s.split(" ").slice(-1)[0]];
                          setForm((x) => ({ ...x, date: parts[0], time: parts[1] }));
                        }}
                        className="chip cursor-pointer border border-rule bg-white hover:border-ink/30"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="label mb-2">Location</div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { k: "online" as const, icon: <Monitor size={16} />, label: "Online", sub: "EduBoost classroom" },
                      { k: "irl" as const, icon: <MapPin size={16} />, label: "In person", sub: "Tunis · Lac 2" },
                    ].map((o) => (
                      <button
                        key={o.k}
                        onClick={() => setForm({ ...form, location: o.k })}
                        className={`flex items-center gap-3 rounded-[10px] p-3.5 text-left transition ${
                          form.location === o.k
                            ? "border-[1.5px] border-ink bg-ink text-white"
                            : "border border-rule bg-white text-ink hover:border-ink/30"
                        }`}
                      >
                        <span>{o.icon}</span>
                        <div>
                          <div className="text-[13.5px] font-medium">{o.label}</div>
                          <div className={`mt-0.5 text-xs ${form.location === o.k ? "text-white/65" : "text-ink-faded"}`}>
                            {o.sub}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Step 2: Goals ─── */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <div className="label mb-2">What do you want to cover?</div>
                  <div className="mb-2.5 flex flex-wrap gap-1.5">
                    {["Bac prep", "Integrals", "Trigonometry", "Mock exam", "Homework help", "Test review"].map((s) => (
                      <button
                        key={s}
                        className="chip cursor-pointer border border-rule bg-white hover:border-ink/30"
                        onClick={() => setForm((d) => ({ ...d, goals: d.goals + (d.goals ? ", " : "") + s }))}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder={`What chapters or problems do you want to work on? Anything ${teacherName.split(" ")[0]} should know ahead of time?`}
                    value={form.goals}
                    onChange={(e) => setForm({ ...form, goals: e.target.value })}
                  />
                </div>

                <div>
                  <div className="label mb-2">Your level</div>
                  <select className="input">
                    <option>Bac · 4ème année (terminale)</option>
                    <option>1ère année</option>
                    <option>2ème année</option>
                    <option>3ème année</option>
                    <option>Université</option>
                  </select>
                </div>
              </div>
            )}

            {/* ─── Step 3: Payment ─── */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <div className="label mb-2">Payment method</div>
                  <div className="flex flex-col gap-2">
                    {[
                      { k: "card" as const, label: "Visa · ending 4242", sub: "Saved card" },
                      { k: "edinar" as const, label: "e-DINAR Smart", sub: "Tunisian post" },
                      { k: "later" as const, label: "Pay after the lesson", sub: "Card on file, charged after" },
                    ].map((o) => (
                      <button
                        key={o.k}
                        onClick={() => setForm({ ...form, pay: o.k })}
                        className={`flex items-center gap-3 rounded-[10px] px-4 py-3.5 text-left transition ${
                          form.pay === o.k
                            ? "border-[1.5px] border-accent bg-accent-pale"
                            : "border border-rule bg-white"
                        }`}
                      >
                        <span
                          className={`h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] ${
                            form.pay === o.k ? "border-[5px] border-accent" : "border-ink/20"
                          }`}
                        />
                        <div>
                          <div className="text-sm font-medium">{o.label}</div>
                          <div className="mt-0.5 text-xs text-ink-faded">{o.sub}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-[10px] bg-bg-soft p-3.5 text-xs text-ink-soft">
                  <Lock size={14} className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    You&apos;re not charged until after the lesson is delivered. If something goes wrong, EduBoost covers the refund.
                  </span>
                </div>
              </div>
            )}

            {/* ─── Step 4: Confirmed ─── */}
            {step === 4 && (
              <div className="py-5 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-pale text-accent-deep">
                  <Check size={28} />
                </div>
                <h3 className="mt-4 font-bold text-[28px]">Booking confirmed</h3>
                <p className="mx-auto mt-2 max-w-[460px] text-[14.5px] text-ink-soft">
                  {teacherName.split(" ")[0]} will join the classroom 5 minutes before. We sent a calendar invite to your inbox and a reminder will arrive 1 hour before the lesson.
                </p>
                <div className="mt-5 flex justify-center gap-2">
                  <Link href="/calendar" className="btn-secondary">View in calendar</Link>
                  <Link href="/dashboard" className="btn-seal">Back to dashboard</Link>
                </div>
              </div>
            )}

            {/* Navigation */}
            {step < 4 && (
              <div className="mt-7 flex items-center justify-between">
                <button
                  className="btn-ghost text-sm"
                  disabled={step === 1}
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                >
                  ← Back
                </button>
                <button
                  className="btn-seal flex items-center gap-2"
                  onClick={() => {
                    if (step === 3) {
                      confirmBooking();
                    } else {
                      setStep((s) => s + 1);
                    }
                  }}
                  disabled={submitting}
                >
                  {submitting ? "Processing..." : step === 3 ? "Confirm and pay" : "Continue"} {!submitting && <ArrowRight size={14} />}
                </button>
              </div>
            )}

            {error && step < 4 && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>
        </div>

        {/* ══ Summary card (below form, full width) ══ */}
        <div>
          <div className="card p-7">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faded">Summary</div>
            <div className="mt-3 flex items-center gap-3">
              <Avatar userId={teacherId} size="md" initial={teacherName} />
              <div>
                <div className="font-semibold text-base">{teacherName}</div>
                <div className="text-xs text-ink-faded">
                  {teacher.profile.subjects?.slice(0, 2).join(" · ") || "Teacher"}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 border-t border-rule pt-3.5 text-[13px] text-ink-soft">
              <div className="flex justify-between">
                <span className="text-ink-faded">Type</span>
                <span className="text-ink">
                  {form.type === "trial" ? "Free trial" : form.type === "long" ? "Deep dive · 90m" : "Regular · 1h"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-faded">Date</span>
                <span className="text-ink">{form.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-faded">Time</span>
                <span className="text-ink">{form.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-faded">Location</span>
                <span className="text-ink">{form.location === "online" ? "Online classroom" : "Tunis · Lac 2"}</span>
              </div>
            </div>

            <div className="mt-3.5 flex items-baseline justify-between border-t border-rule pt-3.5">
              <span className="text-[13px] text-ink-soft">Total</span>
              <div>
                <span className="font-bold text-[28px] tracking-tight">
                  {total === 0 ? "Free" : formatMoneySymbol(total, currency, { trim: true })}
                </span>
              </div>
            </div>
            {total > 0 && (
              <div className="mt-1.5 text-xs text-ink-faded">Charged after the lesson</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
