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
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Google Calendar</h1>
      <p className="mt-1 text-sm text-gray-500">
        Connect your Google account so scheduled EduBoost sessions automatically
        appear in your calendar.
      </p>

      {status === "connected" && (
        <div className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-100">
          Google connected.
        </div>
      )}
      {status === "denied" && (
        <div className="mt-4 rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-100">
          Google declined the request{reason ? ` (${reason})` : ""}.
        </div>
      )}
      {status === "error" && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          Something went wrong{reason ? ` (${reason})` : ""}. Try again.
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {info === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}

      {info && (
        <section className="mt-6 rounded border p-4">
          {info.connected ? (
            <>
              <div className="text-sm font-semibold">Connected</div>
              <div className="mt-1 text-xs text-gray-500">
                {info.googleEmail ?? "(unknown email)"} · calendar {info.calendarId} ·
                since {new Date(info.connectedAt).toLocaleDateString()}
              </div>
              <button
                onClick={disconnect}
                disabled={busy}
                className="mt-3 rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                {busy ? "..." : "Disconnect"}
              </button>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold">Not connected</div>
              <p className="mt-1 text-xs text-gray-500">
                We ask for permission to create and update events on your primary Google
                Calendar — nothing else.
              </p>
              <button
                onClick={connect}
                disabled={busy}
                className="mt-3 rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {busy ? "..." : "Connect Google Calendar"}
              </button>
            </>
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

export default function GoogleSettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl px-6 py-12">
          <h1 className="text-2xl font-bold">Google Calendar</h1>
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </main>
      }
    >
      <GoogleSettingsInner />
    </Suspense>
  );
}
