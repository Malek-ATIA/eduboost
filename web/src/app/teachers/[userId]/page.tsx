"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { currentSession, isAdmin } from "@/lib/cognito";

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
    individualSessions: boolean;
    groupSessions: boolean;
    city?: string;
    country?: string;
    verificationStatus?: "unsubmitted" | "pending" | "verified" | "rejected";
    verifiedAt?: string;
  };
};

type Review = {
  reviewId: string;
  reviewerId: string;
  rating: number;
  comment?: string;
  createdAt: string;
};

type WallPost = {
  postId: string;
  teacherId: string;
  body: string;
  commentCount: number;
  createdAt: string;
};

export default function TeacherDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const [data, setData] = useState<TeacherResponse | null>(null);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [wall, setWall] = useState<WallPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerSub, setViewerSub] = useState<string | null>(null);
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [wallDraft, setWallDraft] = useState("");
  const [wallSubmitting, setWallSubmitting] = useState(false);

  const fetchTeacher = useCallback(() => {
    return api<TeacherResponse>(`/teachers/${userId}`)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [userId]);

  const fetchReviews = useCallback(() => {
    return api<{ items: Review[] }>(`/reviews/teachers/${userId}`)
      .then((r) => setReviews(r.items))
      .catch(() => setReviews([]));
  }, [userId]);

  const fetchWall = useCallback(() => {
    return api<{ items: WallPost[] }>(`/wall/${userId}`)
      .then((r) => setWall(r.items))
      .catch(() => setWall([]));
  }, [userId]);

  useEffect(() => {
    fetchTeacher();
    fetchReviews();
    fetchWall();
    // Identify viewer for delete-button visibility. Anonymous visitors get
    // viewerSub === null and viewerIsAdmin === false, so no delete UI renders.
    currentSession().then((s) => {
      if (!s) return;
      setViewerSub((s.getIdToken().payload.sub as string) ?? null);
      setViewerIsAdmin(isAdmin(s));
    });
  }, [fetchTeacher, fetchReviews, fetchWall]);

  async function postToWall(e: React.FormEvent) {
    e.preventDefault();
    if (!wallDraft.trim()) return;
    setWallSubmitting(true);
    try {
      await api(`/wall/posts`, {
        method: "POST",
        body: JSON.stringify({ body: wallDraft.trim() }),
      });
      setWallDraft("");
      await fetchWall();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setWallSubmitting(false);
    }
  }

  async function onDelete(reviewId: string) {
    if (!confirm("Delete this review? This cannot be undone.")) return;
    setDeletingId(reviewId);
    try {
      await api(`/reviews/${reviewId}`, { method: "DELETE" });
      // Refetch both the reviews list AND the teacher profile so the rating
      // header (ratingAvg / ratingCount) reflects the recomputed aggregate.
      await Promise.all([fetchReviews(), fetchTeacher()]);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  if (error) return <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-seal">{error}</main>;
  if (!data) return <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  const { user, profile } = data;

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="eyebrow">Teacher</p>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="font-display text-4xl tracking-tight text-ink">{user.displayName}</h1>
            {profile.verificationStatus === "verified" && (
              <span
                title="Verified by EduBoost"
                className="rounded-sm border border-seal/40 bg-seal/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-widest text-seal"
              >
                Verified
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {profile.city ? `${profile.city}, ` : ""}
            {profile.country ?? ""} · {profile.yearsExperience} yrs experience
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            {profile.subjects.map((s) => (
              <span key={s} className="rounded-sm border border-ink-faded/50 bg-parchment/40 px-2 py-0.5 text-xs text-ink-soft">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl text-ink">€{Math.round(profile.hourlyRateCents / 100)}</div>
          <div className="text-sm text-ink-soft">per hour</div>
          {profile.ratingCount > 0 && (
            <div className="mt-2 text-sm text-ink">
              ★ {profile.ratingAvg.toFixed(1)} ({profile.ratingCount})
            </div>
          )}
        </div>
      </div>

      {profile.bio && <p className="mt-8 whitespace-pre-wrap leading-relaxed text-ink">{profile.bio}</p>}

      <dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
        <Fact label="Languages" value={profile.languages.join(", ") || "—"} />
        <Fact label="Trial session" value={profile.trialSession ? "Yes" : "No"} />
        <Fact label="Group sessions" value={profile.groupSessions ? "Yes" : "No"} />
      </dl>

      <div className="mt-10 flex flex-wrap gap-3">
        {profile.trialSession && (
          <Link
            href={`/book/${userId}?type=trial`}
            className="btn-seal"
          >
            Book trial session
          </Link>
        )}
        <Link
          href={`/book/${userId}?type=single`}
          className="btn-secondary"
        >
          Book a single session
        </Link>
        <Link
          href={`/requests/new?teacherId=${userId}`}
          className="btn-secondary"
        >
          Request a lesson
        </Link>
      </div>

      <section id="wall" className="mt-16">
        <h2 className="font-display text-xl text-ink">Wall</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Updates, achievements, and posts from {user.displayName}.
        </p>

        {viewerSub === userId && (
          <form onSubmit={postToWall} className="mt-4 space-y-2">
            <textarea
              rows={3}
              maxLength={4000}
              className="input"
              value={wallDraft}
              onChange={(e) => setWallDraft(e.target.value)}
              placeholder="Share an update with your students..."
            />
            <button
              type="submit"
              disabled={wallSubmitting || !wallDraft.trim()}
              className="btn-seal"
            >
              {wallSubmitting ? "Posting..." : "Post to wall"}
            </button>
          </form>
        )}

        {wall === null && <p className="mt-4 text-sm text-ink-soft">Loading wall...</p>}
        {wall && wall.length === 0 && (
          <p className="mt-4 text-sm text-ink-soft">No posts yet.</p>
        )}
        {wall && wall.length > 0 && (
          <ul className="mt-4 space-y-3">
            {wall.map((p) => (
              <li key={p.postId} className="card-interactive p-4">
                <Link
                  href={`/wall/posts/${p.postId}` as never}
                  className="block"
                >
                  <div className="text-xs text-ink-faded">
                    {new Date(p.createdAt).toLocaleString()}
                  </div>
                  <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-ink">{p.body}</p>
                  <div className="mt-2 text-xs text-ink-faded">
                    {p.commentCount} comment{p.commentCount === 1 ? "" : "s"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="reviews" className="mt-16">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">Reviews</h2>
          {reviews && reviews.length > 0 && profile.ratingCount > 0 && (
            <span className="text-sm text-ink-soft">
              ★ {profile.ratingAvg.toFixed(1)} · {profile.ratingCount}
              {profile.ratingCount === 1 ? " review" : " reviews"}
            </span>
          )}
        </div>

        {reviews === null && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
        {reviews && reviews.length === 0 && (
          <p className="mt-4 text-sm text-ink-soft">No reviews yet.</p>
        )}
        {reviews && reviews.length > 0 && (
          <ul className="mt-4 space-y-4">
            {reviews.map((r) => {
              const canDelete = viewerIsAdmin || (viewerSub !== null && viewerSub === r.reviewerId);
              return (
                <li key={r.reviewId} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-seal" aria-label={`${r.rating} of 5 stars`}>
                      {"★".repeat(r.rating)}
                      <span className="text-ink-faded/40">{"★".repeat(5 - r.rating)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-ink-faded">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(r.reviewId)}
                          disabled={deletingId === r.reviewId}
                          className="btn-ghost text-seal disabled:opacity-50"
                        >
                          {deletingId === r.reviewId ? "Deleting..." : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>
                  {r.comment && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{r.comment}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}
