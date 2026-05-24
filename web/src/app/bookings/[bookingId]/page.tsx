"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";
import { formatMoneySymbol } from "@/lib/money";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { Avatar } from "@/components/Avatar";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  CreditCard,
  Tag,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";

type Booking = {
  bookingId: string;
  studentId: string;
  teacherId: string;
  classroomId?: string;
  sessionId?: string;
  type: "trial" | "single" | "package";
  status: "pending" | "confirmed" | "cancelled" | "refunded" | "completed";
  amountCents: number;
  currency: string;
  createdAt: string;
  updatedAt?: string;
};

const STATUS_CONFIG: Record<Booking["status"], { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", color: "text-amber-600 bg-amber-50 border-amber-200", icon: Clock },
  confirmed: { label: "Confirmed", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "text-red-600 bg-red-50 border-accent/20", icon: XCircle },
  refunded: { label: "Refunded", color: "text-ink-faded bg-bg-soft border-rule", icon: RefreshCw },
  completed: { label: "Completed", color: "text-accent bg-accent-pale border-accent/20", icon: CheckCircle2 },
};

const TYPE_LABELS: Record<Booking["type"], string> = {
  trial: "Trial session",
  single: "Single session",
  package: "Package",
};

export default function BookingDetailPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { prompt: showPrompt } = useDialog();
  const params = useParams();
  const bookingId = params.bookingId as string;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      try {
        const data = await api<Booking>(`/bookings/${bookingId}`);
        setBooking(data);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router, bookingId]);

  async function cancelBooking() {
    const reason = await showPrompt({
      title: "Cancel booking",
      message: "Tell us briefly why — if the session is more than 24h away you'll be auto-refunded; otherwise this opens a support ticket.",
      inputLabel: "Reason",
      inputPlaceholder: "Why are you cancelling?",
      inputMinLength: 10,
    });
    if (!reason) return;
    setCancelling(true);
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
      const data = await api<Booking>(`/bookings/${bookingId}`);
      setBooking(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancelling(false);
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
        <Link href="/bookings" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft size={16} /> Back to bookings
        </Link>
        <div className="mt-6 rounded-lg border border-accent/20 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={16} className="mb-1 inline" /> {error}
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          <Loader2 size={16} className="animate-spin" /> Loading booking...
        </div>
      </main>
    );
  }

  const st = STATUS_CONFIG[booking.status];
  const StatusIcon = st.icon;
  const canCancel = booking.status === "pending" || booking.status === "confirmed";
  const canReview = booking.status === "confirmed" || booking.status === "completed";
  const created = new Date(booking.createdAt);

  return (
    <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
      <Link href="/bookings" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Back to bookings
      </Link>

      <div className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Booking</div>
            <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">{TYPE_LABELS[booking.type]}</h1>
            <p className="mt-3 text-sm text-ink-soft">
              #{booking.bookingId.slice(0, 8)} · booked {created.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${st.color}`}>
            <StatusIcon size={14} />
            {st.label}
          </span>
        </div>

        <div className="mt-8 gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Left: details */}
          <div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="card p-5">
                <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-faded">Type</div>
                <div className="mt-1 font-serif text-xl capitalize text-ink">{booking.type}</div>
              </div>
              <div className="card p-5">
                <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-faded">Amount</div>
                <div className="mt-1 font-serif text-xl text-ink">
                  {formatMoneySymbol(booking.amountCents, booking.currency, { trim: true })}
                </div>
              </div>
              <div className="card p-5">
                <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-faded">Date</div>
                <div className="mt-1 font-serif text-xl text-ink">
                  {created.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </div>
              <div className="card p-5">
                <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-faded">Time</div>
                <div className="mt-1 font-serif text-xl text-ink">
                  {created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>

            <div className="card mt-6 p-5">
              <div className="flex items-center gap-4">
                <Avatar userId={booking.teacherId} size="md" />
                <div className="flex-1">
                  <div className="font-serif text-lg text-ink">Teacher</div>
                  <Link href={`/teachers/${booking.teacherId}` as never} className="text-sm text-ink-soft underline hover:text-accent">
                    View profile →
                  </Link>
                </div>
              </div>
            </div>

            {booking.classroomId && (
              <div className="card mt-3 flex items-center justify-between p-5">
                <div>
                  <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-faded">Classroom</div>
                  <Link href={`/classrooms/${booking.classroomId}` as never} className="mt-1 block text-sm text-ink underline hover:text-accent">
                    {booking.classroomId.slice(0, 12)}…
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {canReview && (
                <>
                  <Link href={`/reviews/new?bookingId=${booking.bookingId}`} className="btn-primary">
                    Write a review
                  </Link>
                  <Link href={`/quiz/${booking.bookingId}` as never} className="btn-ghost">
                    Rate teacher
                  </Link>
                </>
              )}
              <Link href={`/mailbox?to=${booking.teacherId}` as never} className="btn-ghost">
                Message teacher
              </Link>
              {canCancel && (
                <button
                  onClick={cancelBooking}
                  disabled={cancelling}
                  className="rounded-full border border-rule px-4 py-2 text-sm text-red-600 transition hover:border-red-200 hover:bg-red-50"
                >
                  {cancelling ? "Cancelling..." : "Cancel booking"}
                </button>
              )}
            </div>
          </div>

          {/* Right: summary card */}
          <aside className="mt-8 lg:sticky lg:top-20 lg:mt-0 lg:self-start">
            <div className="card p-6">
              <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-faded">Summary</div>
              <div className="mt-4 space-y-3 text-[13px]">
                <div className="flex justify-between"><span className="text-ink-faded">Type</span><span className="capitalize text-ink">{booking.type}</span></div>
                <div className="flex justify-between"><span className="text-ink-faded">Status</span><span className="capitalize text-ink">{booking.status}</span></div>
                <div className="flex justify-between"><span className="text-ink-faded">Booked</span><span className="text-ink">{created.toLocaleDateString()}</span></div>
              </div>
              <div className="mt-4 border-t border-rule pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-ink-soft">Total</span>
                  <div>
                    <span className="font-serif text-[28px] tracking-tight text-ink">
                      {formatMoneySymbol(booking.amountCents, booking.currency, { trim: true })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
