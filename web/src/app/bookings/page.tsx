"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { formatMoneySymbol } from "@/lib/money";

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
  completed: "text-seal",
};

export default function BookingsPage() {
  const router = useRouter();
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
    const reason = prompt(
      "Cancel this booking. Tell us briefly why — if the session is more than 24h away you'll be auto-refunded; otherwise this opens a support ticket.",
    );
    if (!reason || reason.trim().length < 10) {
      if (reason !== null) alert("Please provide a reason of at least 10 characters.");
      return;
    }
    setCancellingId(bookingId);
    setError(null);
    try {
      const r = await api<{ outcome: "auto_refunded" | "dispute_created"; ticketId?: string }>(
        `/bookings/${bookingId}/cancel`,
        { method: "POST", body: JSON.stringify({ reason: reason.trim() }) },
      );
      if (r.outcome === "auto_refunded") {
        alert("Booking cancelled and refund issued.");
      } else {
        alert(`A dispute ticket was opened: ${r.ticketId}. An admin will review it.`);
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
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Schedule</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">My bookings</h1>
      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-4 text-sm text-ink-soft">
          No bookings yet. <Link className="underline" href="/teachers">Find a teacher</Link>.
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-ink-faded/30">
          {items.map((b) => {
            const canReview = b.status === "confirmed" || b.status === "completed";
            const canCancel = b.status === "pending" || b.status === "confirmed";
            return (
              <li key={b.bookingId} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-display text-base text-ink capitalize">{b.type} session</div>
                  <div className="text-sm text-ink-soft">
                    {new Date(b.createdAt).toLocaleString()} ·{" "}
                    <Link className="underline" href={`/teachers/${b.teacherId}` as never}>
                      teacher
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="font-display text-base text-ink">{formatMoneySymbol(b.amountCents, b.currency, { trim: true })}</div>
                    <div className={`text-xs uppercase tracking-widest ${STATUS_COLORS[b.status]}`}>{b.status}</div>
                  </div>
                  {canReview && (
                    <>
                      <Link
                        href={`/reviews/new?bookingId=${b.bookingId}`}
                        className="btn-secondary"
                      >
                        Review
                      </Link>
                      <Link
                        href={`/quiz/${b.bookingId}` as never}
                        className="btn-secondary"
                      >
                        Rate teacher
                      </Link>
                      <button
                        onClick={async () => {
                          const notes = prompt("Request a review session with the teacher. Add a note (optional).") ?? "";
                          try {
                            await api(`/review-sessions`, {
                              method: "POST",
                              body: JSON.stringify({ bookingId: b.bookingId, notes: notes || undefined }),
                            });
                            alert("Review session requested.");
                          } catch (err) {
                            alert((err as Error).message);
                          }
                        }}
                        className="btn-secondary"
                      >
                        Review session
                      </button>
                    </>
                  )}
                  {canCancel && (
                    <button
                      onClick={() => cancelBooking(b.bookingId)}
                      disabled={cancellingId === b.bookingId}
                      className="btn-secondary text-seal"
                    >
                      {cancellingId === b.bookingId ? "..." : "Cancel"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
