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
    return <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12 text-ink-soft">Loading…</main>;

  const teaching = (items ?? []).filter((c) => c.myRole === "teacher");
  const enrolled = (items ?? []).filter((c) => c.myRole !== "teacher");

  return (
    <main className="mx-auto max-w-container-wide px-8 pb-24 pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Classroom</div>
          <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl lg:text-7xl">
            {role === "student" && <>Return to your <span className="italic">studies</span>.</>}
            {role === "teacher" && <>Open your <span className="italic">classroom</span>.</>}
            {role !== "student" && role !== "teacher" && <>My <span className="italic">classrooms</span>.</>}
          </h1>
          <p className="mt-3 max-w-[560px] text-base leading-relaxed text-ink-soft">
            {role === "student" && "Pick up the lesson you left, review notes, and join the next session — all from one room."}
            {role === "teacher" && "Manage your students, schedule, and live sessions."}
            {role !== "student" && role !== "teacher" && "Manage the courses you teach, or open a room you're enrolled in."}
          </p>
        </div>
        {role === "teacher" && (
          <Link href="/classrooms/new" className="btn-primary shrink-0">
            Create a classroom
          </Link>
        )}
      </div>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

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
          <h2 className="font-serif text-xl text-ink">Teaching</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {teaching.map((c) => (
              <ClassroomCard key={c.classroomId} c={c} />
            ))}
          </ul>
        </section>
      )}

      {enrolled.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-xl text-ink">Enrolled</h2>
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
          <div className="font-serif text-lg text-ink">{c.title}</div>
          <span className="rounded-md border border-rule bg-bg-soft px-2 py-0.5 text-xs uppercase tracking-widest text-ink-soft">
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
