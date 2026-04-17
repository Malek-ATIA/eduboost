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
      if (msg.includes("E.164")) setError("Use international format, e.g. +35318001234.");
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
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-2xl font-bold">SMS notifications</h1>
      <p className="mt-1 text-sm text-gray-500">
        Get texted for time-sensitive updates: session reminders, confirmed
        bookings, payment issues, support replies.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {info && <p className="mt-4 text-sm text-green-700">{info}</p>}
      {prefs === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}

      {prefs && (
        <section className="mt-6 space-y-6">
          <form onSubmit={sendCode} className="rounded border p-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Phone number</span>
              <input
                type="tel"
                className="w-full rounded border px-3 py-2 font-mono"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+35318001234"
              />
              <span className="mt-1 block text-xs text-gray-500">
                International format (E.164), starting with +.
              </span>
            </label>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="submit"
                disabled={sendingCode || !phone.trim().startsWith("+")}
                className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {sendingCode ? "Sending..." : prefs.phoneVerifiedAt ? "Update & re-verify" : "Send code"}
              </button>
              {prefs.phoneVerifiedAt && (
                <span className="text-xs text-green-700">
                  Verified {new Date(prefs.phoneVerifiedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </form>

          {(codeSent || !prefs.phoneVerifiedAt) && prefs.phoneNumber && (
            <form onSubmit={verify} className="rounded border p-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Verification code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full rounded border px-3 py-2 font-mono text-lg tracking-widest"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  6-digit code from the SMS we sent you. Expires in 10 minutes.
                </span>
              </label>
              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="mt-3 rounded border px-4 py-2 text-sm disabled:opacity-50"
              >
                {verifying ? "Verifying..." : "Verify"}
              </button>
            </form>
          )}

          {prefs.phoneVerifiedAt && (
            <div className="rounded border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">SMS notifications</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    Currently {prefs.smsOptIn ? "enabled" : "disabled"}.
                  </div>
                </div>
                <button
                  onClick={() => toggleOptIn(!prefs.smsOptIn)}
                  className={`rounded px-4 py-2 text-sm ${
                    prefs.smsOptIn
                      ? "border"
                      : "bg-black text-white dark:bg-white dark:text-black"
                  }`}
                >
                  {prefs.smsOptIn ? "Turn off" : "Turn on"}
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Standard SMS rates may apply. You can reply STOP to any message to
                immediately disable. Only transactional messages are sent — never
                marketing.
              </p>
            </div>
          )}
        </section>
      )}

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-gray-500 underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
