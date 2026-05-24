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
  const [activeTab, setActiveTab] = useState<"about" | "reviews" | "materials" | "wall">("about");

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

  if (error)
    return (
      <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12 text-warn">
        {error}
      </main>
    );
  if (!data)
    return (
      <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12 text-ink-soft">
        Loading...
      </main>
    );

  const { user, profile } = data;
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const sessionTypes = [
    profile.individualSessions && "1-on-1",
    profile.groupSessions && "Group",
  ].filter(Boolean);

  const tabs = [
    { id: "about" as const, label: "About" },
    { id: "reviews" as const, label: `Reviews${reviews && reviews.length > 0 ? ` (${reviews.length})` : ""}` },
    { id: "materials" as const, label: "Materials" },
    { id: "wall" as const, label: "Wall" },
  ];

  return (
    <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
      {/* ── Back link ──────────────────────────────────────────── */}
      <Link
        href="/teachers"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-faded transition hover:text-accent"
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 12L6 8l4-4" />
        </svg>
        Back to teachers
      </Link>

      <div className="gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ══════════════════════════════════════════════════════════
            LEFT COLUMN
            ══════════════════════════════════════════════════════════ */}
        <div className="min-w-0">
          {/* ── Identity header ─────────────────────────────────── */}
          <div className="flex items-start gap-6">
            <div className="relative shrink-0">
              <Avatar userId={userId} size="xl" initial={user.displayName} />
              {profile.verificationStatus === "verified" && (
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white shadow-sm">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M6.5 12.5l-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4z" />
                  </svg>
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              {/* Chip tags */}
              <div className="mb-2 flex flex-wrap gap-1.5">
                {profile.trialSession && (
                  <span className="chip chip-accent text-[10px] font-medium">Free trial</span>
                )}
                {profile.verificationStatus === "verified" && (
                  <span className="chip chip-accent text-[10px] font-medium">Verified</span>
                )}
                {profile.ratingAvg >= 4.8 && profile.ratingCount >= 5 && (
                  <span className="chip text-[10px] font-medium">Top 1%</span>
                )}
              </div>

              {/* Name + favorite */}
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-5xl tracking-tight sm:text-6xl">
                  {user.displayName}
                </h1>
                {favorited !== null && viewerSub && viewerSub !== userId && (
                  <button
                    onClick={toggleFavorite}
                    disabled={favoriteSubmitting}
                    aria-pressed={favorited}
                    aria-label={favorited ? "Unsave teacher" : "Save teacher"}
                    className="text-xl leading-none text-ink-faded transition hover:text-accent"
                  >
                    {favorited ? "★" : "☆"}
                  </button>
                )}
              </div>

              {/* Meta line */}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
                {profile.subjects.length > 0 && (
                  <span>{profile.subjects.slice(0, 3).join(", ")}</span>
                )}
                {profile.yearsExperience > 0 && (
                  <span>{profile.yearsExperience} years experience</span>
                )}
                {location && <span>{location}</span>}
              </div>
            </div>
          </div>

          {/* ── Stats bar ──────────────────────────────────────── */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              value={profile.ratingCount > 0 ? profile.ratingAvg.toFixed(1) : "--"}
              label="Rating"
              extra={
                profile.ratingCount > 0 ? (
                  <div className="mt-0.5 flex gap-0.5 text-accent">
                    {Array.from({ length: 5 }, (_, i) => (
                      <svg
                        key={i}
                        className={`h-3 w-3 ${i < Math.round(profile.ratingAvg) ? "text-accent" : "text-ink-mute"}`}
                        viewBox="0 0 16 16"
                        fill="currentColor"
                      >
                        <path d="M8 .5l2.47 5 5.53.8-4 3.9.94 5.5L8 13.2l-4.94 2.5.94-5.5-4-3.9 5.53-.8z" />
                      </svg>
                    ))}
                  </div>
                ) : null
              }
            />
            <StatCard
              value={profile.ratingCount > 0 ? String(profile.ratingCount) : "0"}
              label={profile.ratingCount === 1 ? "Review" : "Reviews"}
            />
            <StatCard
              value={profile.languages.length > 0 ? profile.languages.slice(0, 2).join(", ") : "--"}
              label="Languages"
            />
            <StatCard
              value={sessionTypes.join(" & ") || "1-on-1"}
              label="Sessions"
            />
          </div>

          {/* ── Tabs ───────────────────────────────────────────── */}
          <div className="mt-8 flex gap-1 border-b border-rule">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 pb-3 pt-1 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent"
                    : "text-ink-faded hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab: About ─────────────────────────────────────── */}
          {activeTab === "about" && (
            <>
              <section className="mt-6">
                <h2 className="font-serif text-xl text-ink">About Me</h2>
                {profile.bio ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    {profile.bio}
                  </p>
                ) : (
                  <p className="mt-3 text-sm italic text-ink-faded">No biography yet.</p>
                )}
                {profile.subjects.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.subjects.map((s) => (
                      <span key={s} className="chip">{s}</span>
                    ))}
                  </div>
                )}
              </section>

              {/* Lessons */}
              <section className="mt-8">
                <h2 className="font-serif text-xl text-ink">Lessons</h2>
                <div className="mt-4 divide-y divide-rule">
                  {profile.trialSession && (
                    <LessonRow
                      title="Trial Lesson"
                      subtitle="Try a lesson before committing"
                      price="Free"
                      priceClass="text-accent"
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

              {/* Availability */}
              <section className="mt-8">
                <h2 className="font-serif text-xl text-ink">Availability</h2>
                <p className="mt-3 text-sm text-ink-soft">
                  Contact the teacher to check their availability and schedule a lesson at a time that works for both of you.
                </p>
              </section>

              {/* Activity */}
              <section className="mt-8">
                <h2 className="font-serif text-xl text-ink">Activity on EduBoost</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Link href="/forum" className="card-interactive p-4">
                    <div className="font-serif text-sm text-ink">Forum contributions</div>
                    <div className="mt-0.5 text-xs text-ink-faded">Posts and comments</div>
                  </Link>
                  <Link href="/marketplace" className="card-interactive p-4">
                    <div className="font-serif text-sm text-ink">Marketplace products</div>
                    <div className="mt-0.5 text-xs text-ink-faded">Study materials for sale</div>
                  </Link>
                </div>
              </section>
            </>
          )}

          {/* ── Tab: Reviews ───────────────────────────────────── */}
          {activeTab === "reviews" && (
            <section className="mt-6">
              {reviews === null && <p className="text-sm text-ink-soft">Loading reviews...</p>}
              {reviews && reviews.length === 0 && (
                <p className="text-sm text-ink-soft">No reviews yet.</p>
              )}
              {reviews && reviews.length > 0 && (
                <>
                  {/* Summary */}
                  <div className="mb-6 flex items-center gap-4">
                    <div className="font-serif text-4xl text-ink">
                      {profile.ratingAvg.toFixed(1)}
                    </div>
                    <div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }, (_, i) => (
                          <svg
                            key={i}
                            className={`h-4 w-4 ${i < Math.round(profile.ratingAvg) ? "text-accent" : "text-ink-mute"}`}
                            viewBox="0 0 16 16"
                            fill="currentColor"
                          >
                            <path d="M8 .5l2.47 5 5.53.8-4 3.9.94 5.5L8 13.2l-4.94 2.5.94-5.5-4-3.9 5.53-.8z" />
                          </svg>
                        ))}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-faded">
                        Based on {reviews.length} review{reviews.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {reviews.map((r) => {
                      const canDelete =
                        viewerIsAdmin || (viewerSub !== null && viewerSub === r.reviewerId);
                      return (
                        <li key={r.reviewId} className="card p-5">
                          <div className="flex items-center justify-between">
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }, (_, i) => (
                                <svg
                                  key={i}
                                  className={`h-3.5 w-3.5 ${i < r.rating ? "text-accent" : "text-ink-mute"}`}
                                  viewBox="0 0 16 16"
                                  fill="currentColor"
                                >
                                  <path d="M8 .5l2.47 5 5.53.8-4 3.9.94 5.5L8 13.2l-4.94 2.5.94-5.5-4-3.9 5.53-.8z" />
                                </svg>
                              ))}
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
                                  className="btn-ghost text-warn text-xs disabled:opacity-50"
                                >
                                  {deletingId === r.reviewId ? "Deleting..." : "Delete"}
                                </button>
                              )}
                            </div>
                          </div>
                          {r.comment && (
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                              {r.comment}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>
          )}

          {/* ── Tab: Materials ─────────────────────────────────── */}
          {activeTab === "materials" && (
            <section className="mt-6">
              <div className="flex flex-col items-center py-12 text-center">
                <p className="text-sm text-ink-soft">
                  No study materials available yet. Check the marketplace for resources.
                </p>
                <Link href="/marketplace" className="btn-secondary mt-4">
                  Browse marketplace
                </Link>
              </div>
            </section>
          )}

          {/* ── Tab: Wall ──────────────────────────────────────── */}
          {activeTab === "wall" && (
            <section className="mt-6">
              {viewerSub === userId && (
                <form onSubmit={postToWall} className="space-y-3">
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
                    <li key={p.postId} className="card-interactive p-5">
                      <Link href={`/wall/posts/${p.postId}` as never} className="block">
                        <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
                          {new Date(p.createdAt).toLocaleString()}
                        </div>
                        <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">
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
        </div>

        {/* ══════════════════════════════════════════════════════════
            RIGHT SIDEBAR -- Sticky booking card
            ══════════════════════════════════════════════════════════ */}
        <aside className="mt-8 lg:sticky lg:top-20 lg:mt-0 lg:self-start">
          <div className="card overflow-hidden">
            {/* Video player / avatar fallback */}
            {videoUrl ? (
              <video
                src={videoUrl}
                controls
                preload="metadata"
                className="aspect-video w-full bg-black object-cover"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-bg-soft">
                <Avatar userId={userId} size="xl" initial={user.displayName} />
              </div>
            )}

            {/* Booking card content */}
            <div className="p-6">
              {/* Hourly rate */}
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
                  {profile.trialSession ? "Trial lesson" : "Hourly rate"}
                </span>
                <span className="font-serif text-2xl text-ink">
                  {profile.trialSession
                    ? "Free"
                    : formatMoneySymbol(profile.hourlyRateCents, profile.currency, { trim: true })}
                </span>
              </div>

              {!profile.trialSession && (
                <div className="mt-1 text-right text-xs text-ink-faded">per hour</div>
              )}

              {/* CTA buttons */}
              <div className="mt-5 flex flex-col gap-2.5">
                <Link
                  href={
                    profile.trialSession
                      ? `/book/${userId}?type=trial`
                      : `/book/${userId}?type=single`
                  }
                  className="btn-seal w-full text-center"
                >
                  Book a session
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

              {/* Non-trial hourly rate detail */}
              {!profile.trialSession && (
                <div className="mt-4 border-t border-rule pt-4">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
                    Hourly rate
                  </div>
                  <div className="mt-1 font-serif text-lg text-ink">
                    {formatMoneySymbol(profile.hourlyRateCents, profile.currency, { trim: true })}
                  </div>
                </div>
              )}

              {/* Trust badges */}
              <div className="mt-4 border-t border-rule pt-4">
                <div className="space-y-2">
                  <TrustBadge icon="shield" label="Secure payments" />
                  <TrustBadge icon="clock" label="Free cancellation up to 24h before" />
                  {profile.trialSession && (
                    <TrustBadge icon="gift" label="Free trial lesson available" />
                  )}
                  {profile.verificationStatus === "verified" && (
                    <TrustBadge icon="check" label="Identity verified" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────── */

function StatCard({
  value,
  label,
  extra,
}: {
  value: string;
  label: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="card p-4 text-center">
      <div className="font-serif text-xl text-ink">{value}</div>
      {extra}
      <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
        {label}
      </div>
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
        <span className={`font-serif text-base ${priceClass ?? "text-ink"}`}>
          {price}
        </span>
        <Link
          href={href as never}
          className="btn-secondary py-1.5 text-xs"
        >
          Book
        </Link>
      </div>
    </div>
  );
}

function TrustBadge({
  icon,
  label,
}: {
  icon: "shield" | "clock" | "gift" | "check";
  label: string;
}) {
  const icons: Record<string, React.ReactNode> = {
    shield: (
      <svg className="h-4 w-4 text-accent" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 1.5L2.5 4v4c0 3.5 2.5 5.5 5.5 6.5 3-1 5.5-3 5.5-6.5V4z" />
      </svg>
    ),
    clock: (
      <svg className="h-4 w-4 text-accent" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6" />
        <path d="M8 4.5V8l2.5 1.5" />
      </svg>
    ),
    gift: (
      <svg className="h-4 w-4 text-accent" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="6" width="12" height="3" rx="0.5" />
        <rect x="3" y="9" width="10" height="5" rx="0.5" />
        <path d="M8 6v8M5 6c0-2 1.5-3 3-3s3 1 3 3" />
      </svg>
    ),
    check: (
      <svg className="h-4 w-4 text-accent" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6" />
        <path d="M5.5 8l2 2 3.5-3.5" />
      </svg>
    ),
  };

  return (
    <div className="flex items-center gap-2.5">
      {icons[icon]}
      <span className="text-xs text-ink-soft">{label}</span>
    </div>
  );
}
