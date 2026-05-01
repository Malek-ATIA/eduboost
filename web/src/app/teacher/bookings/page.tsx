"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { formatMoneySymbol } from "@/lib/money";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";

type Booking = {
  bookingId: string;
  studentId: string;
  type: "trial" | "single" | "package";
  status: "pending" | "confirmed" | "cancelled" | "refunded" | "completed";
  amountCents: number;
  currency: string;
  classroomId?: string;
  createdAt: string;
};

const STATUS_COLORS: Record<Booking["status"], string> = {
  pending: "text-ink-faded",
  confirmed: "text-ink",
  cancelled: "text-ink-faded",
  refunded: "text-ink-faded",
  completed: "text-seal",
};

export default function TeacherBookingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { prompt: showPrompt } = useDialog();
  const [items, setItems] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api<{ items: Booking[] }>(`/bookings/as-teacher`);
      setItems(r.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (currentRole(session) !== "teacher") return router.replace("/dashboard");
      await load();
    })();
  }, [router]);

  async function cancelBooking(bookingId: string) {
    const reason = await showPrompt({
      title: "Cancel booking",
      message: "The student will be notified and auto-refunded. Please provide a reason.",
      inputLabel: "Reason",
      inputPlaceholder: "Why are you cancelling?",
      inputMinLength: 10,
    });
    if (!reason) return;
    setCancellingId(bookingId);
    try {
      await api(`/bookings/${bookingId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      toast("Booking cancelled and student refunded.", "success");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Teacher</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">Bookings (as teacher)</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Schedule a session against confirmed bookings.
      </p>

      {error && <p className="mt-4 text-sm text-seal">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-ink-soft">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">No bookings yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="card mt-6 divide-y divide-ink-faded/30">
          {items.map((b) => {
            const canSchedule = b.status === "confirmed";
            return (
              <li key={b.bookingId} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-display text-base text-ink capitalize">{b.type} session</div>
                  <div className="text-xs text-ink-faded">
                    <span className="font-mono">#{b.bookingId}</span> · booked {new Date(b.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="font-display text-base text-ink">{formatMoneySymbol(b.amountCents, b.currency, { trim: true })}</div>
                    <div className={`text-xs uppercase tracking-widest ${STATUS_COLORS[b.status]}`}>
                      {b.status}
                    </div>
                  </div>
                  {canSchedule && (
                    <>
                      <Link
                        href={`/sessions/new?bookingId=${b.bookingId}`}
                        className="btn-seal"
                      >
                        Schedule
                      </Link>
                      <button
                        onClick={() => cancelBooking(b.bookingId)}
                        disabled={cancellingId === b.bookingId}
                        className="rounded-md border border-ink-faded/30 px-3 py-1.5 text-xs text-red-500 transition hover:border-red-200 hover:bg-red-50"
                      >
                        {cancellingId === b.bookingId ? "..." : "Cancel"}
                      </button>
                    </>
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
