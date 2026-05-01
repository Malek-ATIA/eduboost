"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Prefs = {
  phoneNumber: string | null;
  phoneVerifiedAt: string | null;
  smsOptIn: boolean;
};

export default function SmsSettingsPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api<Prefs>(`/sms/me`);
      setPrefs(r);
      if (r.phoneNumber) setPhone(r.phoneNumber);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      await load();
    })();
  }, [router]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSendingCode(true);
    try {
      await api(`/sms/phone`, {
        method: "POST",
        body: JSON.stringify({ phoneNumber: phone.trim() }),
      });
      setCodeSent(true);
      setInfo("Code sent. Check your phone.");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("E.164")) setError("Use international format, e.g. +21655555555.");
      else if (msg.includes("sms_send_failed")) setError("Couldn't send SMS. Double-check the number.");
      else setError(msg);
    } finally {
      setSendingCode(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setVerifying(true);
    try {
      await api(`/sms/verify`, {
        method: "POST",
        body: JSON.stringify({ code: code.trim() }),
      });
      setCode("");
      setCodeSent(false);
      setInfo("Phone verified. SMS notifications are on.");
      await load();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("wrong_code")) setError("That code didn't match. Try again.");
      else if (msg.includes("code_expired")) setError("Code expired. Request a new one.");
      else if (msg.includes("no_pending_verification")) setError("Start by entering your phone number above.");
      else setError(msg);
    } finally {
      setVerifying(false);
    }
  }

  async function toggleOptIn(nextOn: boolean) {
    setError(null);
    setInfo(null);
    try {
      await api(nextOn ? `/sms/opt-in` : `/sms/opt-out`, { method: "POST" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 pb-24 pt-16">
      <p className="eyebrow">Settings</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">SMS notifications</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Get texted for time-sensitive updates: session reminders, confirmed
        bookings, payment issues, support replies.
      </p>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {info && <p className="mt-4 text-sm text-ink">{info}</p>}
      {prefs === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}

      {prefs && (
        <section className="mt-6 space-y-6">
          <form onSubmit={sendCode} className="card p-4">
            <label className="block">
              <span className="label">Phone number</span>
              <input
                type="tel"
                className="input font-mono"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+21655555555"
              />
              <span className="mt-1 block text-xs text-ink-faded">
                International format (E.164), starting with +.
              </span>
            </label>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="submit"
                disabled={sendingCode || !phone.trim().startsWith("+")}
                className="btn-seal"
              >
                {sendingCode ? "Sending..." : prefs.phoneVerifiedAt ? "Update & re-verify" : "Send code"}
              </button>
              {prefs.phoneVerifiedAt && (
                <span className="text-xs italic text-ink-soft">
                  Verified {new Date(prefs.phoneVerifiedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </form>

          {(codeSent || !prefs.phoneVerifiedAt) && prefs.phoneNumber && (
            <form onSubmit={verify} className="card p-4">
              <label className="block">
                <span className="label">Verification code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="input font-mono text-lg tracking-widest"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                />
                <span className="mt-1 block text-xs text-ink-faded">
                  6-digit code from the SMS we sent you. Expires in 10 minutes.
                </span>
              </label>
              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="btn-secondary mt-3"
              >
                {verifying ? "Verifying..." : "Verify"}
              </button>
            </form>
          )}

          {prefs.phoneVerifiedAt && (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-base text-ink">SMS notifications</div>
                  <div className="mt-0.5 text-xs text-ink-faded">
                    Currently {prefs.smsOptIn ? "enabled" : "disabled"}.
                  </div>
                </div>
                <button
                  onClick={() => toggleOptIn(!prefs.smsOptIn)}
                  className={prefs.smsOptIn ? "btn-secondary" : "btn-seal"}
                >
                  {prefs.smsOptIn ? "Turn off" : "Turn on"}
                </button>
              </div>
              <p className="mt-3 text-xs text-ink-faded">
                Standard SMS rates may apply. You can reply STOP to any message to
                immediately disable. Only transactional messages are sent — never
                marketing.
              </p>
            </div>
          )}
        </section>
      )}
</main>
  );
}
