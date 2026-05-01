"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, type Role } from "@/lib/cognito";
import { api } from "@/lib/api";

type Classroom = {
  classroomId: string;
  teacherId: string;
  title: string;
  subject: string;
  description?: string;
  maxStudents?: number;
  status: string;
  myRole: "teacher" | "student" | "observer";
};

export default function MyClassroomsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [items, setItems] = useState<Classroom[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await currentSession();
      if (!s) return router.replace("/login");
      setRole(currentRole(s));
      setReady(true);
      try {
        const r = await api<{ items: Classroom[] }>(`/classrooms/mine`);
        setItems(r.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [router]);

  if (!ready)
    return <main className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-ink-soft">Loading…</main>;

  const teaching = (items ?? []).filter((c) => c.myRole === "teacher");
  const enrolled = (items ?? []).filter((c) => c.myRole !== "teacher");

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Classrooms</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">My classrooms</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Manage the courses you teach, or open a room you&apos;re enrolled in.
          </p>
        </div>
        {role === "teacher" && (
          <Link href="/classrooms/new" className="btn-seal shrink-0">
            Create a classroom
          </Link>
        )}
      </div>

      {error && <p className="mt-6 text-sm text-seal">{error}</p>}

      {items === null && !error && (
        <p className="mt-8 text-sm text-ink-soft">Loading…</p>
      )}

      {items && items.length === 0 && (
        <div className="card mt-10 p-6 text-sm text-ink-soft">
          You&apos;re not in any classrooms yet.
          {role === "teacher" && (
            <>
              {" "}
              <Link href="/classrooms/new" className="underline">
                Create your first one →
              </Link>
            </>
          )}
        </div>
      )}

      {teaching.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl text-ink">Teaching</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {teaching.map((c) => (
              <ClassroomCard key={c.classroomId} c={c} />
            ))}
          </ul>
        </section>
      )}

      {enrolled.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl text-ink">Enrolled</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {enrolled.map((c) => (
              <ClassroomCard key={c.classroomId} c={c} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function ClassroomCard({ c }: { c: Classroom }) {
  return (
    <li>
      <Link
        href={`/classrooms/${c.classroomId}` as never}
        className="card-interactive block p-5"
      >
        <div className="flex items-center justify-between">
          <div className="font-display text-lg text-ink">{c.title}</div>
          <span className="rounded-sm border border-ink-faded/40 bg-parchment-dark px-2 py-0.5 text-xs uppercase tracking-widest text-ink-soft">
            {c.status}
          </span>
        </div>
        <div className="mt-1 text-xs text-ink-faded">
          {c.subject} · {c.myRole}
          {typeof c.maxStudents === "number" ? ` · cap ${c.maxStudents}` : ""}
        </div>
        {c.description && (
          <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{c.description}</p>
        )}
      </Link>
    </li>
  );
}
