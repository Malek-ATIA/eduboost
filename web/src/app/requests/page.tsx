"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, type Role } from "@/lib/cognito";
import { api } from "@/lib/api";

type LessonRequest = {
  requestId: string;
  studentId: string;
  teacherId: string;
  subject: string;
  status: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
  createdAt: string;
};

const STATUS_COLORS: Record<LessonRequest["status"], string> = {
  pending: "text-yellow-700",
  accepted: "text-green-700",
  rejected: "text-red-700",
  expired: "text-gray-500",
  cancelled: "text-gray-500",
};

export default function RequestsPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [items, setItems] = useState<LessonRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await currentSession();
      if (!session) return router.replace("/login");
      const r = currentRole(session);
      setRole(r);
      const endpoint = r === "teacher" ? "/lesson-requests/inbox" : "/lesson-requests/mine";
      try {
        const res = await api<{ items: LessonRequest[] }>(endpoint);
        setItems(res.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  const title = role === "teacher" ? "Lesson requests (inbox)" : "My lesson requests";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">{title}</h1>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="mt-4 text-sm text-gray-500">Loading...</p>}
      {items && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">
          {role === "teacher" ? "No requests yet." : "No requests sent yet."}
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-6 divide-y rounded border">
          {items.map((r) => (
            <li key={r.requestId}>
              <Link
                href={`/requests/${r.requestId}` as never}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <div>
                  <div className="font-medium">{r.subject}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {new Date(r.createdAt).toLocaleString()}
                  </div>
                </div>
                <span className={`text-xs uppercase ${STATUS_COLORS[r.status]}`}>
                  {r.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
