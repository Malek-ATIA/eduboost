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
  cancelled: { label: "Cancelled", color: "text-red-600 bg-red-50 border-red-200", icon: XCircle },
  refunded: { label: "Refunded", color: "text-ink-faded bg-parchment-dark border-ink-faded/30", icon: RefreshCw },
  completed: { label: "Completed", color: "text-seal bg-seal/10 border-seal/30", icon: CheckCircle2 },
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
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
        <Link href="/bookings" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft size={16} /> Back to bookings
        </Link>
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={16} className="mb-1 inline" /> {error}
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
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
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
      <Link href="/bookings" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Back to bookings
      </Link>

      <div className="mt-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl tracking-tight text-ink">{TYPE_LABELS[booking.type]}</h1>
            <p className="mt-1 text-sm text-ink-faded">Booking {booking.bookingId.slice(0, 8)}...</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${st.color}`}>
            <StatusIcon size={14} />
            {st.label}
          </span>
        </div>

        <div className="card mt-6 divide-y divide-ink-faded/20">
          <div className="flex items-center gap-4 p-4">
            <Avatar userId={booking.teacherId} size="md" />
            <div>
              <div className="flex items-center gap-1.5 text-sm text-ink-faded">
                <User size={14} /> Teacher
              </div>
              <Link href={`/teachers/${booking.teacherId}` as never} className="text-sm font-medium text-ink underline hover:text-seal">
                View profile
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4">
            <div className="flex items-start gap-2">
              <Calendar size={16} className="mt-0.5 text-ink-faded" />
              <div>
                <div className="text-xs text-ink-faded">Booked on</div>
                <div className="text-sm text-ink">
                  {created.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock size={16} className="mt-0.5 text-ink-faded" />
              <div>
                <div className="text-xs text-ink-faded">Time</div>
                <div className="text-sm text-ink">
                  {created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Tag size={16} className="mt-0.5 text-ink-faded" />
              <div>
                <div className="text-xs text-ink-faded">Type</div>
                <div className="text-sm text-ink capitalize">{booking.type}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CreditCard size={16} className="mt-0.5 text-ink-faded" />
              <div>
                <div className="text-xs text-ink-faded">Amount</div>
                <div className="text-sm font-medium text-ink">
                  {formatMoneySymbol(booking.amountCents, booking.currency, { trim: true })}
                </div>
              </div>
            </div>
          </div>

          {booking.classroomId && (
            <div className="p-4">
              <div className="text-xs text-ink-faded">Classroom</div>
              <Link href={`/classrooms/${booking.classroomId}` as never} className="text-sm text-ink underline hover:text-seal">
                {booking.classroomId.slice(0, 12)}...
              </Link>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {canReview && (
            <>
              <Link href={`/reviews/new?bookingId=${booking.bookingId}`} className="btn-secondary">
                Write a review
              </Link>
              <Link href={`/quiz/${booking.bookingId}` as never} className="btn-secondary">
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
              className="btn-ghost text-red-600 hover:bg-red-50"
            >
              {cancelling ? "Cancelling..." : "Cancel booking"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
