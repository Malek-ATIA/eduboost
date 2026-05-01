"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { currentSession, isAdmin } from "@/lib/cognito";
import { formatMoneySymbol } from "@/lib/money";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";

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
    introVideoUrl?: string;
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
  const { toast } = useToast();
  const { confirm: showConfirm } = useDialog();
  const [data, setData] = useState<TeacherResponse | null>(null);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [wall, setWall] = useState<WallPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerSub, setViewerSub] = useState<string | null>(null);
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [wallDraft, setWallDraft] = useState("");
  const [wallSubmitting, setWallSubmitting] = useState(false);
  const [favorited, setFavorited] = useState<boolean | null>(null);
  const [favoriteSubmitting, setFavoriteSubmitting] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"about" | "wall">("about");

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
    api<{ url: string }>(`/teachers/${userId}/video-url`)
      .then((r) => setVideoUrl(r.url))
      .catch(() => setVideoUrl(null));
    currentSession().then((s) => {
      if (!s) return;
      setViewerSub((s.getIdToken().payload.sub as string) ?? null);
      setViewerIsAdmin(isAdmin(s));
      api<{ favorited: boolean }>(`/favorites/check/${userId}`)
        .then((r) => setFavorited(r.favorited))
        .catch(() => setFavorited(null));
    });
  }, [fetchTeacher, fetchReviews, fetchWall, userId]);

  async function toggleFavorite() {
    if (favorited === null) return;
    setFavoriteSubmitting(true);
    try {
      if (favorited) {
        await api(`/favorites/${userId}`, { method: "DELETE" });
        setFavorited(false);
      } else {
        await api(`/favorites`, {
          method: "POST",
          body: JSON.stringify({ favoriteId: userId, kind: "teacher" }),
        });
        setFavorited(true);
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setFavoriteSubmitting(false);
    }
  }

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
      toast((err as Error).message, "error");
    } finally {
      setWallSubmitting(false);
    }
  }

  async function onDelete(reviewId: string) {
    const ok = await showConfirm({ title: "Delete review", message: "Delete this review? This cannot be undone.", destructive: true });
    if (!ok) return;
    setDeletingId(reviewId);
    try {
      await api(`/reviews/${reviewId}`, { method: "DELETE" });
      await Promise.all([fetchReviews(), fetchTeacher()]);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setDeletingId(null);
    }
  }

  if (error) return <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-seal">{error}</main>;
  if (!data) return <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-ink-soft">Loading...</main>;

  const { user, profile } = data;
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const sessionTypes = [
    profile.individualSessions && "1-on-1",
    profile.groupSessions && "Group",
  ].filter(Boolean);

  return (
    <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
      <div className="gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ══════════════════════════════════════════════════════════
            LEFT COLUMN — Identity, bio, stats, lessons, reviews
            ══════════════════════════════════════════════════════════ */}
        <div className="min-w-0">
          {/* ── Identity header ─────────────────────────────────── */}
          <div className="flex items-start gap-5">
            <Avatar userId={userId} size="xl" initial={user.displayName} />
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl leading-tight text-ink sm:text-3xl">
                  {user.displayName}
                </h1>
                {profile.verificationStatus === "verified" && (
                  <span className="rounded-sm border border-seal/40 bg-seal/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-seal">
                    Verified
                  </span>
                )}
                {profile.trialSession && (
                  <span className="rounded-sm bg-ink/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Trial
                  </span>
                )}
                {favorited !== null && viewerSub && viewerSub !== userId && (
                  <button
                    onClick={toggleFavorite}
                    disabled={favoriteSubmitting}
                    aria-pressed={favorited}
                    aria-label={favorited ? "Unsave teacher" : "Save teacher"}
                    className="ml-1 text-xl leading-none text-ink-faded transition hover:text-seal"
                  >
                    {favorited ? "★" : "☆"}
                  </button>
                )}
              </div>

              <div className="mt-1.5 space-y-1 text-sm">
                <div className="text-ink-soft">
                  <span className="text-ink-faded">Teaches:</span>{" "}
                  {profile.subjects.slice(0, 4).join(", ") || "—"}
                </div>
                {profile.languages.length > 0 && (
                  <div className="text-ink-soft">
                    <span className="text-ink-faded">Speaks:</span>{" "}
                    {profile.languages.join(", ")}
                  </div>
                )}
                <div className="text-ink-soft">
                  {profile.yearsExperience > 0
                    ? `${profile.yearsExperience} years experience`
                    : "New teacher"}
                  {location ? ` · ${location}` : ""}
                </div>
              </div>
            </div>
          </div>

          {/* ── Tabs: About Me / Wall ──────────────────────────── */}
          <div className="mt-8 flex gap-6 border-b border-ink-faded/20">
            <button
              type="button"
              onClick={() => setActiveTab("about")}
              className={`pb-3 text-sm font-medium transition ${
                activeTab === "about"
                  ? "border-b-2 border-ink text-ink"
                  : "text-ink-faded hover:text-ink"
              }`}
            >
              About Me
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("wall")}
              className={`pb-3 text-sm font-medium transition ${
                activeTab === "wall"
                  ? "border-b-2 border-ink text-ink"
                  : "text-ink-faded hover:text-ink"
              }`}
            >
              Wall
            </button>
          </div>

          {activeTab === "about" && (
            <>
              {/* ── About Me ──────────────────────────────────── */}
              <section className="mt-6">
                <h2 className="font-display text-lg text-ink">About Me</h2>
                {profile.bio ? (
                  <p className="mt-3 whitespace-pre-wrap leading-relaxed text-sm text-ink">
                    {profile.bio}
                  </p>
                ) : (
                  <p className="mt-3 text-sm italic text-ink-faded">No biography yet.</p>
                )}
                {profile.subjects.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.subjects.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-parchment-dark px-3 py-1 text-xs text-ink-soft"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Stats bar ─────────────────────────────────── */}
              <section className="mt-8 flex flex-wrap gap-6 border-y border-ink-faded/20 py-5">
                <Stat
                  value={profile.ratingCount > 0 ? `★ ${profile.ratingAvg.toFixed(1)}` : "—"}
                  label="Rating"
                />
                <Stat
                  value={profile.ratingCount > 0 ? String(profile.ratingCount) : "0"}
                  label={profile.ratingCount === 1 ? "Student" : "Students"}
                />
                <Stat
                  value={`${profile.yearsExperience}`}
                  label="Yrs exp."
                />
                <Stat
                  value={sessionTypes.join(" & ") || "1-on-1"}
                  label="Sessions"
                />
              </section>

              {/* ── Lessons ───────────────────────────────────── */}
              <section className="mt-8">
                <h2 className="font-display text-lg text-ink">Lessons</h2>
                <div className="mt-4 divide-y divide-ink-faded/15">
                  {profile.trialSession && (
                    <LessonRow
                      title="Trial Lesson"
                      subtitle="Try a lesson before committing"
                      price="Free"
                      priceClass="text-seal"
                      href={`/book/${userId}?type=trial`}
                    />
                  )}
                  {profile.individualSessions && (
                    <LessonRow
                      title="1-on-1 Session"
                      subtitle="Private lesson tailored to your needs"
                      price={formatMoneySymbol(profile.hourlyRateCents, profile.currency, { trim: true })}
                      href={`/book/${userId}?type=single`}
                    />
                  )}
                  {profile.groupSessions && (
                    <LessonRow
                      title="Group Session"
                      subtitle="Learn alongside other students"
                      price={formatMoneySymbol(profile.hourlyRateCents, profile.currency, { trim: true })}
                      href={`/book/${userId}?type=group`}
                    />
                  )}
                </div>
              </section>

              {/* ── Availability ────────────────────────────── */}
              <section className="mt-8">
                <h2 className="font-display text-lg text-ink">Availability</h2>
                <p className="mt-3 text-sm text-ink-soft">
                  Contact the teacher to check their availability and schedule a lesson at a time that works for both of you.
                </p>
              </section>

              {/* ── Activity ──────────────────────────────────── */}
              <section className="mt-8">
                <h2 className="font-display text-lg text-ink">Activity on EduBoost</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Link href="/forum" className="card-interactive p-4">
                    <div className="font-display text-sm text-ink">Forum contributions</div>
                    <div className="mt-0.5 text-xs text-ink-soft">Posts and comments</div>
                  </Link>
                  <Link href="/marketplace" className="card-interactive p-4">
                    <div className="font-display text-sm text-ink">Marketplace products</div>
                    <div className="mt-0.5 text-xs text-ink-soft">Study materials for sale</div>
                  </Link>
                </div>
              </section>
            </>
          )}

          {activeTab === "wall" && (
            <section className="mt-6">
              {viewerSub === userId && (
                <form onSubmit={postToWall} className="space-y-2">
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
                      <Link href={`/wall/posts/${p.postId}` as never} className="block">
                        <div className="text-xs text-ink-faded">
                          {new Date(p.createdAt).toLocaleString()}
                        </div>
                        <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-ink">
                          {p.body}
                        </p>
                        <div className="mt-2 text-xs text-ink-faded">
                          {p.commentCount} comment{p.commentCount === 1 ? "" : "s"}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ── Reviews (always visible) ──────────────────────── */}
          <section id="reviews" className="mt-10 border-t border-ink-faded/20 pt-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">
                {reviews && reviews.length > 0
                  ? `${reviews.length} Review${reviews.length === 1 ? "" : "s"}`
                  : "Reviews"}
              </h2>
              {reviews && reviews.length > 0 && profile.ratingCount > 0 && (
                <span className="text-sm text-ink-soft">
                  ★ {profile.ratingAvg.toFixed(1)}
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
                  const canDelete =
                    viewerIsAdmin || (viewerSub !== null && viewerSub === r.reviewerId);
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
        </div>

        {/* ══════════════════════════════════════════════════════════
            RIGHT SIDEBAR — Sticky video + booking card
            ══════════════════════════════════════════════════════════ */}
        <aside className="mt-8 lg:sticky lg:top-20 lg:mt-0 lg:self-start">
          <div className="card overflow-hidden">
            {/* Video player */}
            {videoUrl ? (
              <video
                src={videoUrl}
                controls
                preload="metadata"
                className="aspect-video w-full bg-black object-cover"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-parchment-dark">
                <Avatar userId={userId} size="xl" initial={user.displayName} />
              </div>
            )}

            {/* Booking card */}
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  {profile.trialSession && (
                    <div className="text-xs text-ink-faded">Trial Lesson</div>
                  )}
                  {!profile.trialSession && (
                    <div className="text-xs text-ink-faded">Lesson from</div>
                  )}
                </div>
                <div className="font-display text-xl text-ink">
                  {profile.trialSession
                    ? "Free"
                    : formatMoneySymbol(profile.hourlyRateCents, profile.currency, { trim: true })}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href={
                    profile.trialSession
                      ? `/book/${userId}?type=trial`
                      : `/book/${userId}?type=single`
                  }
                  className="btn-seal w-full text-center"
                >
                  Book lesson
                </Link>
                {viewerSub && viewerSub !== userId && (
                  <Link
                    href={`/chat/${userId}` as never}
                    className="btn-secondary w-full text-center"
                  >
                    Contact teacher
                  </Link>
                )}
                <Link
                  href={`/requests/new?teacherId=${userId}`}
                  className="btn-ghost w-full text-center"
                >
                  Request a lesson
                </Link>
              </div>

              {!profile.trialSession && (
                <div className="mt-3 border-t border-ink-faded/20 pt-3">
                  <div className="text-xs text-ink-faded">Hourly rate</div>
                  <div className="font-display text-lg text-ink">
                    {formatMoneySymbol(profile.hourlyRateCents, profile.currency, { trim: true })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-xl text-ink">{value}</div>
      <div className="text-[11px] text-ink-faded">{label}</div>
    </div>
  );
}

function LessonRow({
  title,
  subtitle,
  price,
  priceClass,
  href,
}: {
  title: string;
  subtitle: string;
  price: string;
  priceClass?: string;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between py-4">
      <div>
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-xs text-ink-faded">{subtitle}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`font-display text-base ${priceClass ?? "text-ink"}`}>
          {price}
        </span>
        <Link
          href={href as never}
          className="rounded-md border border-ink-faded/40 px-3 py-1 text-xs font-medium text-ink transition hover:border-ink hover:bg-parchment-dark"
        >
          Book
        </Link>
      </div>
    </div>
  );
}
