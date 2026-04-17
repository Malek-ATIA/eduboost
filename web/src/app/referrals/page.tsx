"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type Mine = {
  referralCode: string;
  shareUrl: string;
  referredByCode: string | null;
};

type ReferralRow = {
  referrerId: string;
  referredId: string;
  referralCode: string;
  createdAt: string;
  referred: { userId: string; displayName: string } | null;
};

export default function ReferralsPage() {
  const router = useRouter();
  const [mine, setMine] = useState<Mine | null>(null);
  const [list, setList] = useState<ReferralRow[] | null>(null);
  const [claimCode, setClaimCode] = useState("");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [m, l] = await Promise.all([
        api<Mine>(`/referrals/mine`),
        api<{ items: ReferralRow[] }>(`/referrals/list`),
      ]);
      setMine(m);
      setList(l.items);
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

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    setClaimError(null);
    setClaimSuccess(null);
    try {
      const r = await api<{ referrerDisplayName: string }>(`/referrals/claim`, {
        method: "POST",
        body: JSON.stringify({ code: claimCode.trim() }),
      });
      setClaimSuccess(`Linked to ${r.referrerDisplayName}.`);
      setClaimCode("");
      await load();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("already_claimed")) setClaimError("You've already claimed a referral.");
      else if (msg.includes("unknown_code")) setClaimError("That code doesn't match any user.");
      else if (msg.includes("cannot_refer_self")) setClaimError("You can't use your own code.");
      else setClaimError(msg);
    }
  }

  async function copyShareLink() {
    if (!mine) return;
    try {
      await navigator.clipboard.writeText(mine.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Invite a friend</h1>
      <p className="mt-1 text-sm text-gray-500">
        Share your code to invite students, parents, or teachers to EduBoost.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {mine && (
        <section className="mt-8 rounded border p-4">
          <div className="text-xs uppercase text-gray-500">Your code</div>
          <div className="mt-2 font-mono text-3xl font-bold tracking-widest">
            {mine.referralCode}
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-xs text-gray-500">Share link</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={mine.shareUrl}
                className="flex-1 rounded border px-3 py-2 text-sm"
              />
              <button
                onClick={copyShareLink}
                className="rounded border px-3 py-2 text-sm"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </section>
      )}

      {mine && !mine.referredByCode && (
        <section className="mt-6 rounded border p-4">
          <h2 className="text-sm font-semibold">Got invited?</h2>
          <p className="mt-1 text-xs text-gray-500">
            Enter the code a friend shared with you. (One-time; can't change later.)
          </p>
          <form onSubmit={claim} className="mt-3 flex gap-2">
            <input
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
              placeholder="ABCD1234"
              maxLength={16}
              className="flex-1 rounded border px-3 py-2 font-mono uppercase"
            />
            <button
              type="submit"
              disabled={claimCode.trim().length < 4}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              Claim
            </button>
          </form>
          {claimError && <p className="mt-2 text-sm text-red-600">{claimError}</p>}
          {claimSuccess && <p className="mt-2 text-sm text-green-700">{claimSuccess}</p>}
        </section>
      )}

      {mine?.referredByCode && (
        <p className="mt-4 text-xs text-gray-500">
          You were referred with code <span className="font-mono">{mine.referredByCode}</span>.
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-semibold">People you've invited</h2>
        {list === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}
        {list && list.length === 0 && (
          <p className="mt-4 text-sm text-gray-500">No one has claimed your code yet.</p>
        )}
        {list && list.length > 0 && (
          <ul className="mt-4 divide-y rounded border">
            {list.map((r) => (
              <li key={r.referredId} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium">
                    {r.referred?.displayName ?? "(unknown)"}
                  </div>
                  <div className="text-xs text-gray-500">
                    Joined {new Date(r.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {r.rewardedAt ? (
                  <span className="text-xs text-green-700">Rewarded</span>
                ) : (
                  <span className="text-xs text-gray-400">Pending</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-gray-500 underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
