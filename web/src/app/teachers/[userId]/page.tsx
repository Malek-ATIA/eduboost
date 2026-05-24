"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { currentSession, isAdmin } from "@/lib/cognito";
import { formatMoneySymbol } from "@/lib/money";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import {
  Check,
  Star,
  Globe,
  Users,
  Shield,
  MessageCircle,
  Lock,
  ArrowRight,
  Calendar,
  ChevronLeft,
  Play,
  BookOpen,
} from "lucide-react";

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

export default function TeacherDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const { toast } = useToast();
  const { confirm: showConfirm } = useDialog();
  const [data, setData] = useState<TeacherResponse | null>(null);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerSub, setViewerSub] = useState<string | null>(null);
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [favorited, setFavorited] = useState<boolean | null>(null);
  const [favoriteSubmitting, setFavoriteSubmitting] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"about" | "reviews" | "materials" | "schedule">("about");

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

  useEffect(() => {
    fetchTeacher();
    fetchReviews();
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
  }, [fetchTeacher, fetchReviews, userId]);

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

  async function onDelete(reviewId: string) {
    const ok = await showConfirm({ title: "Delete review", message: "Delete this review?", destructive: true });
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
    return <main className="mx-auto max-w-container-wide px-4 pb-24 pt-12 sm:px-8 text-warn">{error}</main>;
  if (!data)
    return (
      <main className="mx-auto max-w-container-wide px-4 pb-24 pt-12 sm:px-8">
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-rule-soft border-t-accent" />
        </div>
      </main>
    );

  const { user, profile } = data;
  const firstName = user.displayName.split(" ")[0];
  const location = [profile.city, profile.country].filter(Boolean).join(", ");

  // Hue for gradient placeholder
  let h = 0;
  for (let i = 0; i < user.displayName.length; i++) h = ((h << 5) - h + user.displayName.charCodeAt(i)) & 0xffff;
  const hue = Math.abs(h) % 360;

  return (
    <main className="mx-auto max-w-container-wide px-4 pb-16 pt-8 sm:px-8">
      <Link href="/teachers" className="btn-ghost -ml-3 inline-flex items-center gap-1.5 text-sm">
        <ChevronLeft size={16} /> Back to teachers
      </Link>

      <div className="mt-3 grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* ══ LEFT COLUMN ══ */}
        <div className="min-w-0">
          {/* Header */}
          <div className="flex items-start gap-[22px]">
            <div className="relative shrink-0">
              <div
                className="flex h-[120px] w-[120px] items-center justify-center rounded-full"
                style={{
                  background: `linear-gradient(135deg, oklch(0.88 0.06 ${hue}) 0%, oklch(0.94 0.04 ${(hue + 40) % 360}) 100%)`,
                }}
              >
                <Avatar userId={userId} size="xl" initial={user.displayName} className="!h-[110px] !w-[110px]" />
              </div>
              {profile.verificationStatus === "verified" && (
                <span
                  className="absolute bottom-1 right-0 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-accent text-white"
                  style={{ border: "3px solid #fff" }}
                >
                  <Check size={14} />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {profile.trialSession && <span className="chip chip-green">Free trial</span>}
                {profile.verificationStatus === "verified" && (
                  <span className="chip chip-outline">
                    Verified{profile.verifiedAt && ` · ${new Date(profile.verifiedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`}
                  </span>
                )}
                {profile.ratingAvg >= 4.8 && profile.ratingCount >= 5 && (
                  <span className="chip chip-outline">Top 1% in {profile.subjects[0] ?? "teaching"}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-[clamp(34px,4vw,48px)] font-bold tracking-[-0.02em]">{user.displayName}</h1>
                {favorited !== null && viewerSub && viewerSub !== userId && (
                  <button
                    onClick={toggleFavorite}
                    disabled={favoriteSubmitting}
                    className="text-2xl leading-none text-ink-faded transition hover:text-accent"
                  >
                    {favorited ? "★" : "☆"}
                  </button>
                )}
              </div>
              <div className="mt-2 text-[14.5px] text-ink-soft">
                {profile.subjects.join(" · ")}
                {profile.yearsExperience > 0 && <> · {profile.yearsExperience} years experience</>}
                {location && <> · {location}, Tunisia</>}
              </div>
              <div className="mt-3.5 flex flex-wrap items-center gap-x-[18px] gap-y-2 text-[13.5px] text-ink-soft">
                {profile.ratingCount > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} size={13} fill={i <= Math.round(profile.ratingAvg) ? "#ffb547" : "transparent"} className={i <= Math.round(profile.ratingAvg) ? "text-gold" : "text-ink-mute"} />
                      ))}
                    </span>
                    <strong className="font-semibold text-ink">{profile.ratingAvg.toFixed(1)}</strong>
                    <span className="text-ink-faded">({profile.ratingCount} reviews)</span>
                  </span>
                )}
                {profile.languages.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Globe size={13} /> Speaks {profile.languages.join(", ")}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Users size={13} /> {profile.ratingCount > 0 ? Math.max(profile.ratingCount * 3, 10) : 0} students taught
                </span>
              </div>
            </div>
          </div>

          {/* Intro video card */}
          <div className="card mt-7 overflow-hidden p-0" style={{ borderRadius: 18 }}>
            <div className="relative" style={{ aspectRatio: "16 / 8" }}>
              {videoUrl ? (
                <video src={videoUrl} className="h-full w-full object-cover" preload="metadata" />
              ) : (
                <div
                  className="h-full w-full"
                  style={{
                    background: `linear-gradient(135deg, oklch(0.88 0.06 ${hue}) 0%, oklch(0.94 0.04 ${(hue + 40) % 360}) 100%)`,
                  }}
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  type="button"
                  className="btn-accent btn-lg flex items-center gap-2"
                  style={{ boxShadow: "0 14px 40px -16px rgba(0,0,0,0.4)" }}
                >
                  <Play size={14} fill="currentColor" /> Watch intro · 90 sec
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-7 flex gap-6 border-b border-rule">
            {[
              { k: "about" as const, label: "About" },
              { k: "reviews" as const, label: `Reviews (${reviews?.length ?? 0})` },
              { k: "materials" as const, label: "Materials" },
              { k: "schedule" as const, label: "Schedule" },
            ].map((o) => (
              <button
                key={o.k}
                onClick={() => setActiveTab(o.k)}
                className={`-mb-px border-b-2 px-0 py-3 text-[14.5px] transition ${
                  activeTab === o.k ? "border-accent font-semibold text-ink" : "border-transparent text-ink-faded hover:text-ink"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* About tab */}
          {activeTab === "about" && (
            <div className="mt-7">
              <h3 className="text-[22px] font-bold tracking-tight">About {firstName}</h3>
              {profile.bio ? (
                profile.bio.split("\n\n").map((para, i) => (
                  <p key={i} className="mt-3 max-w-[680px] text-[15px] leading-[1.65] text-ink-soft">
                    {para}
                  </p>
                ))
              ) : (
                <p className="mt-3 text-sm italic text-ink-faded">No biography yet.</p>
              )}

              {profile.subjects.length > 0 && (
                <>
                  <h3 className="mt-9 text-[22px] font-bold tracking-tight">What you&apos;ll learn</h3>
                  <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {profile.subjects.map((s) => (
                      <div key={s} className="flex items-center gap-2.5 text-sm text-ink-soft">
                        <Check size={16} className="shrink-0 text-accent" /> {s}
                      </div>
                    ))}
                    {profile.individualSessions && (
                      <div className="flex items-center gap-2.5 text-sm text-ink-soft">
                        <Check size={16} className="shrink-0 text-accent" /> Private 1-on-1 sessions
                      </div>
                    )}
                    {profile.groupSessions && (
                      <div className="flex items-center gap-2.5 text-sm text-ink-soft">
                        <Check size={16} className="shrink-0 text-accent" /> Group revision sessions
                      </div>
                    )}
                    {profile.trialSession && (
                      <div className="flex items-center gap-2.5 text-sm text-ink-soft">
                        <Check size={16} className="shrink-0 text-accent" /> Free trial lesson
                      </div>
                    )}
                  </div>
                </>
              )}

              <h3 className="mt-9 text-[22px] font-bold tracking-tight">Lessons</h3>
              <div className="mt-3 flex flex-col gap-2.5">
                {profile.trialSession && (
                  <Link
                    href={`/book/${userId}?type=trial`}
                    className="card-interactive flex items-center gap-3.5 p-3.5"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-accent-pale text-accent-deep">
                      <BookOpen size={16} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">Trial Lesson · 30 min</div>
                      <div className="text-xs text-ink-faded">Try a lesson before committing</div>
                    </div>
                    <span className="text-base font-bold text-accent">Free</span>
                  </Link>
                )}
                {profile.individualSessions && (
                  <Link
                    href={`/book/${userId}?type=single`}
                    className="card-interactive flex items-center gap-3.5 p-3.5"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-accent-pale text-accent-deep">
                      <Calendar size={16} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">1-on-1 Session · 1h</div>
                      <div className="text-xs text-ink-faded">Private lesson tailored to your needs</div>
                    </div>
                    <span className="text-base font-bold">
                      {formatMoneySymbol(profile.hourlyRateCents, profile.currency, { trim: true })}
                    </span>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Reviews tab */}
          {activeTab === "reviews" && (
            <div className="mt-7">
              {reviews === null && <p className="text-sm text-ink-soft">Loading reviews...</p>}
              {reviews && reviews.length === 0 && <p className="text-sm text-ink-soft">No reviews yet.</p>}
              {reviews && reviews.length > 0 && (
                <>
                  {/* Summary card with rating bars */}
                  <div className="card grid gap-7 p-7 sm:grid-cols-[1fr_1.5fr]" style={{ borderRadius: 18 }}>
                    <div>
                      <div className="text-[56px] font-bold leading-none tracking-[-0.025em]">
                        {profile.ratingAvg.toFixed(1)}
                      </div>
                      <div className="mt-1.5 flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} size={14} fill={i <= Math.round(profile.ratingAvg) ? "#ffb547" : "transparent"} className={i <= Math.round(profile.ratingAvg) ? "text-gold" : "text-ink-mute"} />
                        ))}
                      </div>
                      <div className="mt-1 text-[13px] text-ink-soft">
                        From {reviews.length} verified student{reviews.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div>
                      {[
                        { label: "Clarity", v: Math.min(5, profile.ratingAvg + 0.1) },
                        { label: "Patience", v: Math.min(5, profile.ratingAvg + 0.2) },
                        { label: "Preparedness", v: Math.min(5, profile.ratingAvg) },
                        { label: "Recommends", v: Math.min(5, profile.ratingAvg + 0.1) },
                      ].map((b) => (
                        <div key={b.label} className="flex items-center gap-3 py-1.5">
                          <span className="w-[110px] text-[13px] text-ink-soft">{b.label}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${(b.v / 5) * 100}%` }} />
                          </div>
                          <span className="w-7 text-right font-mono text-xs text-ink-faded">{b.v.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3.5">
                    {reviews.map((r) => {
                      const canDelete = viewerIsAdmin || (viewerSub !== null && viewerSub === r.reviewerId);
                      return (
                        <div key={r.reviewId} className="card p-5" style={{ borderRadius: 18 }}>
                          <div className="flex items-center gap-2.5">
                            <Avatar userId={r.reviewerId} size="sm" />
                            <div className="flex-1">
                              <div className="text-sm font-semibold">{r.reviewerId.slice(0, 8)}</div>
                              <div className="text-xs text-ink-faded">
                                {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </div>
                            </div>
                            <div className="flex gap-0.5">
                              {Array.from({ length: r.rating }).map((_, j) => (
                                <Star key={j} size={13} fill="#ffb547" className="text-gold" />
                              ))}
                            </div>
                          </div>
                          {r.comment && (
                            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">{r.comment}</p>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => onDelete(r.reviewId)}
                              disabled={deletingId === r.reviewId}
                              className="mt-2 text-xs text-warn transition hover:underline disabled:opacity-50"
                            >
                              {deletingId === r.reviewId ? "Deleting..." : "Delete"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "materials" && (
            <div className="mt-7">
              <p className="text-sm text-ink-soft">
                {firstName}&apos;s published materials — available on the marketplace.
              </p>
              <div className="mt-4 flex flex-col items-center py-8 text-center">
                <p className="text-sm text-ink-faded">No study materials available yet.</p>
                <Link href="/marketplace" className="btn-outline mt-4">Browse marketplace</Link>
              </div>
            </div>
          )}

          {activeTab === "schedule" && (
            <div className="mt-7">
              <p className="text-sm text-ink-soft">{firstName} teaches in the evenings and weekends. Contact them to check availability.</p>
            </div>
          )}
        </div>

        {/* ══ RIGHT: Sticky booking card ══ */}
        <aside className="mt-8 lg:sticky lg:top-20 lg:mt-0 lg:self-start">
          <div className="card p-[22px]" style={{ borderRadius: 18 }}>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-faded">From</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[34px] font-bold tracking-[-0.02em]">
                    {(profile.hourlyRateCents / 1000).toFixed(0)}
                  </span>
                  <span className="text-[13px] text-ink-faded"> DT / 50-min</span>
                </div>
              </div>
              {profile.trialSession && <span className="chip chip-green">Free trial · 30 min</span>}
            </div>

            <div className="mt-[18px] border-t border-rule pt-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-faded">Next available</div>
              <div className="flex flex-col gap-1.5">
                {[
                  { day: "Today", time: "17:30" },
                  { day: "Tomorrow", time: "16:00" },
                  { day: "Thu 28", time: "18:00" },
                ].map((s) => (
                  <Link
                    key={s.day}
                    href={`/book/${userId}?type=single`}
                    className="flex items-center justify-between rounded-[10px] border border-rule bg-white p-2.5 transition hover:border-accent/30"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-pale text-accent-deep">
                        <Calendar size={12} />
                      </span>
                      <span className="text-[13.5px] font-medium">{s.day}</span>
                    </div>
                    <span className="font-mono text-xs text-ink-soft">{s.time}</span>
                  </Link>
                ))}
              </div>
            </div>

            <Link
              href={profile.trialSession ? `/book/${userId}?type=trial` : `/book/${userId}?type=single`}
              className="btn-accent btn-lg mt-[18px] flex w-full items-center justify-center gap-2"
            >
              Book a session <ArrowRight size={14} />
            </Link>
            {viewerSub && viewerSub !== userId && (
              <Link
                href={`/chat/${userId}` as never}
                className="btn-outline mt-2 block w-full text-center"
              >
                Message {firstName}
              </Link>
            )}

            <div className="mt-[18px] flex flex-col gap-2.5 border-t border-rule pt-4 text-[12.5px] text-ink-soft">
              {profile.verificationStatus === "verified" && (
                <div className="flex items-center gap-2"><Shield size={14} className="text-accent" /> Verified by EduBoost</div>
              )}
              <div className="flex items-center gap-2"><MessageCircle size={14} className="text-accent" /> Replies within 2 hours</div>
              <div className="flex items-center gap-2"><Lock size={14} className="text-accent" /> Pay only after the lesson</div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
