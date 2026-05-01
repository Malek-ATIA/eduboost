"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";

type Material = {
  materialId: string;
  authorId: string;
  kind: string;
  title: string;
  subject: string;
  description?: string;
  premium?: boolean;
  fileS3Key?: string;
  fileMimeType?: string;
  fileSizeBytes?: number;
  createdAt: string;
};

type AuthorInfo = {
  displayName?: string;
  userId: string;
};

const KIND_META: Record<string, { icon: string; label: string; color: string }> = {
  exam: { icon: "📝", label: "Practice Exam", color: "bg-red-50 text-red-700 border-red-200" },
  notes: { icon: "📒", label: "Study Notes", color: "bg-green-50 text-green-700 border-green-200" },
  answers: { icon: "✅", label: "Answer Key", color: "bg-blue-50 text-blue-700 border-blue-200" },
  other: { icon: "📎", label: "Resource", color: "bg-parchment-dark text-ink-soft border-ink-faded/30" },
};

export default function MaterialDetailPage({
  params,
}: {
  params: Promise<{ materialId: string }>;
}) {
  const { materialId } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<Material | null>(null);
  const [author, setAuthor] = useState<AuthorInfo | null>(null);
  const [viewerSub, setViewerSub] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [premiumGate, setPremiumGate] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [related, setRelated] = useState<Material[]>([]);

  useEffect(() => {
    currentSession().then((s) => {
      if (s) setViewerSub((s.getIdToken().payload.sub as string) ?? null);
    });
    api<Material>(`/study-materials/${materialId}`)
      .then((m) => {
        setItem(m);
        api<AuthorInfo>(`/users/${m.authorId}/public`)
          .then(setAuthor)
          .catch(() => setAuthor({ userId: m.authorId }));
        api<{ items: Material[] }>(`/study-materials?subject=${encodeURIComponent(m.subject)}&limit=10`)
          .then((r) => setRelated(r.items.filter((x) => x.materialId !== materialId).slice(0, 4)))
          .catch(() => {});
      })
      .catch((e) => setError((e as Error).message));
  }, [materialId]);

  async function download() {
    setDownloading(true);
    setPremiumGate(false);
    setError(null);
    try {
      const r = await api<{ downloadUrl: string }>(
        `/study-materials/${materialId}/download-url`,
      );
      window.open(r.downloadUrl, "_blank");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("premium_required") || msg.includes("402")) {
        setPremiumGate(true);
      } else {
        setError(msg);
      }
    } finally {
      setDownloading(false);
    }
  }

  async function deleteMaterial() {
    if (!confirm("Delete this study material? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api(`/study-materials/${materialId}`, { method: "DELETE" });
      router.push("/study-materials");
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  }

  if (error && !item) {
    return <main className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-sm text-seal">{error}</main>;
  }
  if (!item) {
    return (
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faded border-t-seal" />
        </div>
      </main>
    );
  }

  const km = KIND_META[item.kind] ?? KIND_META.other;
  const fileSize = item.fileSizeBytes
    ? item.fileSizeBytes > 1_048_576
      ? `${(item.fileSizeBytes / 1_048_576).toFixed(1)} MB`
      : `${Math.round(item.fileSizeBytes / 1024)} KB`
    : null;

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
      {/* Breadcrumb */}
      <nav className="text-sm text-ink-faded">
        <Link href="/study-materials" className="hover:text-ink">
          Study materials
        </Link>
        <span className="mx-2">›</span>
        <span className="text-ink">{item.title}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* Main */}
        <div>
          {/* Kind + premium badges */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${km.color}`}>
              <span>{km.icon}</span>
              <span>{km.label}</span>
            </span>
            {item.premium && (
              <span className="rounded-md border border-seal/40 bg-seal/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-seal">
                Premium
              </span>
            )}
          </div>

          <h1 className="mt-3 font-display text-3xl tracking-tight text-ink lg:text-4xl">
            {item.title}
          </h1>

          <div className="mt-2 flex items-center gap-3 text-sm text-ink-soft">
            <span className="capitalize">{item.subject}</span>
            <span>·</span>
            <span>
              Shared {new Date(item.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>

          {/* Description */}
          {item.description ? (
            <div className="mt-6">
              <h2 className="eyebrow mb-2">About this material</h2>
              <div className="whitespace-pre-wrap leading-relaxed text-ink">
                {item.description}
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm italic text-ink-faded">No description provided.</p>
          )}

          {/* File info */}
          {item.fileS3Key && (
            <div className="mt-8">
              <h2 className="eyebrow mb-3">File information</h2>
              <div className="card divide-y divide-ink-faded/20">
                {item.fileMimeType && (
                  <div className="flex items-center justify-between p-3">
                    <span className="text-sm text-ink-soft">Format</span>
                    <span className="text-sm font-medium text-ink">{item.fileMimeType}</span>
                  </div>
                )}
                {fileSize && (
                  <div className="flex items-center justify-between p-3">
                    <span className="text-sm text-ink-soft">Size</span>
                    <span className="text-sm font-medium text-ink">{fileSize}</span>
                  </div>
                )}
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-ink-soft">Access</span>
                  <span className={`text-sm font-medium ${item.premium ? "text-seal" : "text-green-700"}`}>
                    {item.premium ? "Premium only" : "Free"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Download card */}
          <div className="card sticky top-24 space-y-4 p-5">
            <div className="flex items-center gap-3 rounded-md bg-parchment-dark p-3">
              <span className="text-3xl">{km.icon}</span>
              <div>
                <div className="text-sm font-medium text-ink">{km.label}</div>
                <div className="text-xs text-ink-faded">{item.subject}</div>
              </div>
            </div>

            {item.premium && !premiumGate && (
              <div className="flex items-center gap-2 rounded-md bg-seal/10 p-2.5 text-xs text-seal">
                <span>⭐</span>
                <span>Premium content — subscription required to download</span>
              </div>
            )}

            <button
              onClick={download}
              disabled={downloading || !item.fileS3Key}
              className="btn-seal w-full"
            >
              {downloading
                ? "Preparing download..."
                : !item.fileS3Key
                  ? "No file attached"
                  : item.premium
                    ? "Download (Premium)"
                    : "Download for free"}
            </button>

            {error && <p className="text-sm text-seal">{error}</p>}
            {premiumGate && (
              <div className="rounded-md border border-seal/30 bg-seal/5 p-3 text-sm">
                <p className="font-medium text-seal">Premium subscription required</p>
                <p className="mt-1 text-xs text-ink-soft">
                  Subscribe to access exclusive study materials, get priority support, and more.
                </p>
                <Link href="/membership" className="btn-seal mt-3 inline-block text-xs">
                  View plans
                </Link>
              </div>
            )}

            <div className="border-t border-ink-faded/20 pt-3">
              <div className="flex items-center gap-2 text-xs text-ink-faded">
                <span>✓</span>
                <span>Peer-verified content</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-ink-faded">
                <span>✓</span>
                <span>Report inappropriate content</span>
              </div>
            </div>
          </div>

          {/* Author actions */}
          {viewerSub === item.authorId && (
            <div className="card p-4">
              <h3 className="eyebrow mb-3">Manage material</h3>
              <button
                onClick={deleteMaterial}
                disabled={deleting}
                className="w-full rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
              >
                {deleting ? "Deleting..." : "Delete material"}
              </button>
            </div>
          )}

          {/* Author card */}
          <div className="card p-4">
            <h3 className="eyebrow mb-3">Shared by</h3>
            <div className="flex items-center gap-3">
              <Avatar userId={item.authorId} size="md" initial={author?.displayName?.charAt(0)} />
              <div>
                <div className="font-display text-sm text-ink">
                  {author?.displayName || "EduBoost User"}
                </div>
                <div className="text-xs text-ink-faded">
                  {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related materials */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="eyebrow mb-4">More in {item.subject}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((m) => {
              const mk = KIND_META[m.kind] ?? KIND_META.other;
              return (
                <Link
                  key={m.materialId}
                  href={`/study-materials/${m.materialId}` as never}
                  className="card block p-3 transition hover:shadow-md"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{mk.icon}</span>
                    <span className="text-[10px] uppercase tracking-widest text-ink-faded">{mk.label}</span>
                    {m.premium && (
                      <span className="ml-auto rounded border border-seal/40 bg-seal/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-seal">
                        Premium
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 font-display text-sm text-ink">{m.title}</h3>
                  <div className="mt-1 text-xs text-ink-faded">
                    {m.subject} · {new Date(m.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
