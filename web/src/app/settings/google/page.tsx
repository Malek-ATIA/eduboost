"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { useDialog } from "@/components/Dialog";

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
  const { confirm: showConfirm } = useDialog();
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
    const ok = await showConfirm({ title: "Disconnect Google", message: "Disconnect Google? Calendar events already pushed will remain but won't stay in sync.", destructive: true });
    if (!ok) return;
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
    <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
      <div className="eyebrow">Settings</div>
      <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">
        Google Calendar
      </h1>
      <p className="mt-3 text-base text-ink-soft">
        Connect your Google account so scheduled EduBoost sessions automatically
        appear in your calendar.
      </p>

      {status === "connected" && (
        <div className="mt-4 rounded-lg border border-accent/20 bg-accent-pale p-3 text-sm text-ink">
          Google connected.
        </div>
      )}
      {status === "denied" && (
        <div className="mt-4 rounded-lg border border-rule bg-bg-soft p-3 text-sm text-ink">
          Google declined the request{reason ? ` (${reason})` : ""}.
        </div>
      )}
      {status === "error" && (
        <div className="mt-4 rounded-lg border border-accent/20 bg-accent-pale p-3 text-sm text-accent">
          Something went wrong{reason ? ` (${reason})` : ""}. Try again.
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {info === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}

      {info && (
        <section className="card mt-6 p-4">
          {info.connected ? (
            <>
              <div className="font-serif text-base text-ink">Connected</div>
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
              <div className="font-serif text-base text-ink">Not connected</div>
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
</main>
  );
}

export default function GoogleSettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
          <div className="eyebrow">Settings</div>
          <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">Google Calendar</h1>
          <div className="mt-6 flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
          </div>
        </main>
      }
    >
      <GoogleSettingsInner />
    </Suspense>
  );
}
