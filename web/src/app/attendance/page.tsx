"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/cognito";
import { api } from "@/lib/api";

type AttendanceRecord = {
  sessionId: string;
  userId: string;
  status: "present" | "absent" | "excused" | "late";
  markedAt: string;
  notes?: string;
};

const STATUS_COLORS: Record<AttendanceRecord["status"], string> = {
  present: "text-green-700",
  late: "text-yellow-700",
  absent: "text-red-700",
  excused: "text-blue-700",
};

export default function AttendancePage() {
  const router = useRouter();
  const [items, setItems] = useState<AttendanceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      try {
        const r = await api<{ items: AttendanceRecord[] }>(`/attendance/mine`);
        setItems(r.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">My attendance</h1>
      <p className="mt-1 text-sm text-gray-500">Your attendance record across all sessions.</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No attendance records yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((r) => (
            <li key={`${r.sessionId}-${r.userId}`} className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">
                  Session{" "}
                  <Link
                    href={`/classroom/${r.sessionId}` as never}
                    className="font-mono underline"
                  >
                    {r.sessionId.slice(0, 16)}...
                  </Link>
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  Marked {new Date(r.markedAt).toLocaleString()}
                  {r.notes ? ` · ${r.notes}` : ""}
                </div>
              </div>
              <span className={`text-xs uppercase ${STATUS_COLORS[r.status]}`}>{r.status}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
