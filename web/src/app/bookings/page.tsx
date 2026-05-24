"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { formatMoneySymbol } from "@/lib/money";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";

type Booking = {
  bookingId: string;
  teacherId: string;
  type: "trial" | "single" | "package";
  status: "pending" | "confirmed" | "cancelled" | "refunded" | "completed";
  amountCents: number;
  currency: string;
  createdAt: string;
};

const STATUS_COLORS: Record<Booking["status"], string> = {
  pending: "text-ink-faded",
  confirmed: "text-ink",
  cancelled: "text-ink-faded",
  refunded: "text-ink-faded",
  completed: "text-accent",
};

export default function BookingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { prompt: showPrompt } = useDialog();
  const [items, setItems] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api<{ items: Booking[] }>(`/bookings/mine`);
      setItems(r.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      await load();
    })();
  }, [router]);

  async function cancelBooking(bookingId: string) {
    const reason = await showPrompt({
      title: "Cancel booking",
      message: "Tell us briefly why — if the session is more than 24h away you'll be auto-refunded; otherwise this opens a support ticket.",
      inputLabel: "Reason",
      inputPlaceholder: "Why are you cancelling?",
      inputMinLength: 10,
    });
    if (!reason) return;
    setCancellingId(bookingId);
    setError(null);
    try {
      const r = await api<{ outcome: "auto_refunded" | "dispute_created"; ticketId?: string }>(
        `/bookings/${bookingId}/cancel`,
        { method: "POST", body: JSON.stringify({ reason: reason.trim() }) },
      );
      if (r.outcome === "auto_refunded") {
        toast("Booking cancelled and refund issued.", "success");
      } else {
        toast(`A dispute ticket was opened: ${r.ticketId}. An admin will review it.`, "info");
        if (r.ticketId) router.push(`/support/${r.ticketId}` as never);
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <main className="pb-8">
      <div className="eyebrow">Schedule</div>
      <h1 className="mt-3 text-[clamp(28px,3vw,40px)] font-bold tracking-[-0.018em]">My bookings</h1>
      {error && <p className="mt-4 text-sm text-accent">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-4 text-sm text-ink-soft">
          No bookings yet. <Link className="underline" href="/teachers">Find a teacher</Link>.
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-rule">
          {items.map((b) => {
            const canReview = b.status === "confirmed" || b.status === "completed";
            const canCancel = b.status === "pending" || b.status === "confirmed";
            return (
              <li key={b.bookingId} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[15px] text-ink capitalize">{b.type} session</div>
                    <div className="text-sm text-ink-soft">
                      {new Date(b.createdAt).toLocaleString()} ·{" "}
                      <Link className="underline" href={`/teachers/${b.teacherId}` as never}>
                        teacher
                      </Link>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-[15px] text-ink">{formatMoneySymbol(b.amountCents, b.currency, { trim: true })}</div>
                    <div className={`text-xs uppercase tracking-widest ${STATUS_COLORS[b.status]}`}>{b.status}</div>
                  </div>
                </div>
                {(canReview || canCancel) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canReview && (
                      <>
                        <Link
                          href={`/reviews/new?bookingId=${b.bookingId}`}
                          className="btn-secondary text-xs"
                        >
                          Review
                        </Link>
                        <Link
                          href={`/quiz/${b.bookingId}` as never}
                          className="btn-secondary text-xs"
                        >
                          Rate teacher
                        </Link>
                        <button
                          onClick={async () => {
                            const notes = await showPrompt({
                              title: "Request review session",
                              message: "Request a review session with the teacher. Add a note (optional).",
                              inputLabel: "Note",
                              inputPlaceholder: "Any details for the teacher...",
                            });
                            if (notes === null) return;
                            try {
                              await api(`/review-sessions`, {
                                method: "POST",
                                body: JSON.stringify({ bookingId: b.bookingId, notes: notes || undefined }),
                              });
                              toast("Review session requested.", "success");
                            } catch (err) {
                              toast((err as Error).message, "error");
                            }
                          }}
                          className="btn-secondary text-xs"
                        >
                          Review session
                        </button>
                      </>
                    )}
                    {canCancel && (
                      <button
                        onClick={() => cancelBooking(b.bookingId)}
                        disabled={cancellingId === b.bookingId}
                        className="btn-secondary text-xs text-accent"
                      >
                        {cancellingId === b.bookingId ? "..." : "Cancel"}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
