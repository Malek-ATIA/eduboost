"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

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
  pending: "text-yellow-700",
  confirmed: "text-green-700",
  cancelled: "text-gray-500",
  refunded: "text-gray-500",
  completed: "text-blue-700",
};

export default function BookingsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      try {
        const r = await api<{ items: Booking[] }>(`/bookings/mine`);
        setItems(r.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">My bookings</h1>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">
          No bookings yet. <Link className="underline" href="/teachers">Find a teacher</Link>.
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((b) => (
            <li key={b.bookingId} className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium capitalize">{b.type} session</div>
                <div className="text-sm text-gray-500">
                  {new Date(b.createdAt).toLocaleString()} ·{" "}
                  <Link className="underline" href={`/teachers/${b.teacherId}`}>
                    teacher
                  </Link>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">€{(b.amountCents / 100).toFixed(2)}</div>
                <div className={`text-xs uppercase ${STATUS_COLORS[b.status]}`}>{b.status}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
