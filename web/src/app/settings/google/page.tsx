"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type GoogleStatus =
  | { connected: false }
  | {
      connected: true;
      googleEmail: string | null;
      calendarId: string;
      connectedAt: string;
      expiresAt: string;
    };

function GoogleSettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const reason = searchParams.get("reason");

  const [info, setInfo] = useState<GoogleStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await api<GoogleStatus>(`/google/me`);
      setInfo(r);
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

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ authorizeUrl: string }>(`/google/connect-url`);
      window.location.assign(r.authorizeUrl);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("google_not_configured")) {
        setError("Google integration isn't configured on the server yet.");
      } else {
        setError(msg);
      }
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Google? Calendar events already pushed will remain but won't stay in sync.")) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/google/disconnect`, { method: "POST" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <p className="eyebrow">Settings</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Google Calendar</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Connect your Google account so scheduled EduBoost sessions automatically
        appear in your calendar.
      </p>

      {status === "connected" && (
        <div className="mt-4 rounded-md border border-seal/30 bg-seal/10 p-3 text-sm text-ink">
          Google connected.
        </div>
      )}
      {status === "denied" && (
        <div className="mt-4 rounded-md border border-ink-faded/40 bg-parchment-shade p-3 text-sm text-ink">
          Google declined the request{reason ? ` (${reason})` : ""}.
        </div>
      )}
      {status === "error" && (
        <div className="mt-4 rounded-md border border-seal/30 bg-seal/10 p-3 text-sm text-seal">
          Something went wrong{reason ? ` (${reason})` : ""}. Try again.
        </div>
      )}

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {info === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}

      {info && (
        <section className="card mt-6 p-4">
          {info.connected ? (
            <>
              <div className="font-display text-base text-ink">Connected</div>
              <div className="mt-1 text-xs text-ink-faded">
                {info.googleEmail ?? "(unknown email)"} · calendar {info.calendarId} ·
                since {new Date(info.connectedAt).toLocaleDateString()}
              </div>
              <button
                onClick={disconnect}
                disabled={busy}
                className="btn-secondary mt-3"
              >
                {busy ? "..." : "Disconnect"}
              </button>
            </>
          ) : (
            <>
              <div className="font-display text-base text-ink">Not connected</div>
              <p className="mt-1 text-xs text-ink-faded">
                We ask for permission to create and update events on your primary Google
                Calendar — nothing else.
              </p>
              <button
                onClick={connect}
                disabled={busy}
                className="btn-seal mt-3"
              >
                {busy ? "..." : "Connect Google Calendar"}
              </button>
            </>
          )}
        </section>
      )}

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-ink-soft underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}

export default function GoogleSettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
          <p className="eyebrow">Settings</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Google Calendar</h1>
          <p className="mt-4 text-sm text-ink-soft">Loading...</p>
        </main>
      }
    >
      <GoogleSettingsInner />
    </Suspense>
  );
}
