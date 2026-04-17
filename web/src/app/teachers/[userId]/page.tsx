"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";

type TeacherResponse = {
  user: { userId: string; displayName: string; email: string; avatarUrl?: string };
  profile: {
    bio?: string;
    subjects: string[];
    languages: string[];
    yearsExperience: number;
    hourlyRateCents: number;
    currency: string;
    ratingAvg: number;
    ratingCount: number;
    trialSession: boolean;
    groupSessions: boolean;
    city?: string;
    country?: string;
  };
};

export default function TeacherDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const [data, setData] = useState<TeacherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<TeacherResponse>(`/teachers/${userId}`)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [userId]);

  if (error) return <main className="mx-auto max-w-3xl px-6 py-12 text-red-600">{error}</main>;
  if (!data) return <main className="mx-auto max-w-3xl px-6 py-12">Loading...</main>;

  const { user, profile } = data;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold">{user.displayName}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {profile.city ? `${profile.city}, ` : ""}
            {profile.country ?? ""} · {profile.yearsExperience} yrs experience
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            {profile.subjects.map((s) => (
              <span key={s} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">€{Math.round(profile.hourlyRateCents / 100)}</div>
          <div className="text-sm text-gray-500">per hour</div>
          {profile.ratingCount > 0 && (
            <div className="mt-2 text-sm">
              ★ {profile.ratingAvg.toFixed(1)} ({profile.ratingCount})
            </div>
          )}
        </div>
      </div>

      {profile.bio && <p className="mt-8 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>}

      <dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
        <Fact label="Languages" value={profile.languages.join(", ") || "—"} />
        <Fact label="Trial session" value={profile.trialSession ? "Yes" : "No"} />
        <Fact label="Group sessions" value={profile.groupSessions ? "Yes" : "No"} />
      </dl>

      <div className="mt-10 flex gap-3">
        {profile.trialSession && (
          <Link
            href={`/book/${userId}?type=trial`}
            className="rounded bg-black px-5 py-2 text-white dark:bg-white dark:text-black"
          >
            Book trial session
          </Link>
        )}
        <Link
          href={`/book/${userId}?type=single`}
          className="rounded border px-5 py-2"
        >
          Book a single session
        </Link>
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
