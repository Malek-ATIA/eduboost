"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

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
  pending: "text-yellow-700",
  confirmed: "text-green-700",
  cancelled: "text-gray-500",
  refunded: "text-gray-500",
  completed: "text-blue-700",
};

export default function TeacherBookingsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      if (currentRole(session) !== "teacher") return router.replace("/dashboard");
      try {
        const r = await api<{ items: Booking[] }>(`/bookings/as-teacher`);
        setItems(r.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Bookings (as teacher)</h1>
      <p className="mt-1 text-sm text-gray-500">
        Schedule a session against confirmed bookings.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No bookings yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((b) => {
            const canSchedule = b.status === "confirmed";
            return (
              <li key={b.bookingId} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium capitalize">{b.type} session</div>
                  <div className="text-xs text-gray-500">
                    #{b.bookingId} · booked {new Date(b.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="font-medium">€{(b.amountCents / 100).toFixed(2)}</div>
                    <div className={`text-xs uppercase ${STATUS_COLORS[b.status]}`}>
                      {b.status}
                    </div>
                  </div>
                  {canSchedule && (
                    <Link
                      href={`/sessions/new?bookingId=${b.bookingId}`}
                      className="rounded bg-black px-3 py-1 text-xs text-white dark:bg-white dark:text-black"
                    >
                      Schedule
                    </Link>
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
