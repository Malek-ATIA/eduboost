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
  rewardedAt?: string | null;
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
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Referrals</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Invite a friend</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Share your code to invite students, parents, or teachers to EduBoost.
      </p>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}

      {mine && (
        <section className="card mt-8 p-4">
          <div className="eyebrow">Your code</div>
          <div className="mt-2 font-mono text-3xl font-bold tracking-widest text-ink">
            {mine.referralCode}
          </div>
          <div className="mt-4">
            <label className="label">Share link</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={mine.shareUrl}
                className="input flex-1"
              />
              <button
                onClick={copyShareLink}
                className="btn-secondary"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </section>
      )}

      {mine && !mine.referredByCode && (
        <section className="card mt-6 p-4">
          <h2 className="font-display text-base text-ink">Got invited?</h2>
          <p className="mt-1 text-xs text-ink-faded">
            Enter the code a friend shared with you. (One-time; can't change later.)
          </p>
          <form onSubmit={claim} className="mt-3 flex gap-2">
            <input
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
              placeholder="ABCD1234"
              maxLength={16}
              className="input flex-1 font-mono uppercase"
            />
            <button
              type="submit"
              disabled={claimCode.trim().length < 4}
              className="btn-seal"
            >
              Claim
            </button>
          </form>
          {claimError && <p className="mt-2 text-sm text-seal">{claimError}</p>}
          {claimSuccess && <p className="mt-2 text-sm text-ink">{claimSuccess}</p>}
        </section>
      )}

      {mine?.referredByCode && (
        <p className="mt-4 text-xs text-ink-faded">
          You were referred with code <span className="font-mono">{mine.referredByCode}</span>.
        </p>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl text-ink">People you&apos;ve invited</h2>
        {list === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
        {list && list.length === 0 && (
          <p className="mt-4 text-sm text-ink-soft">No one has claimed your code yet.</p>
        )}
        {list && list.length > 0 && (
          <ul className="card mt-4 divide-y divide-ink-faded/30">
            {list.map((r) => (
              <li key={r.referredId} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-display text-base text-ink">
                    {r.referred?.displayName ?? "(unknown)"}
                  </div>
                  <div className="text-xs text-ink-faded">
                    Joined {new Date(r.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {r.rewardedAt ? (
                  <span className="text-xs uppercase tracking-widest text-ink">Rewarded</span>
                ) : (
                  <span className="text-xs uppercase tracking-widest text-ink-faded">Pending</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
</main>
  );
}
