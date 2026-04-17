"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, isAdmin, signOut, type Role } from "@/lib/cognito";
import { NotificationBell } from "@/components/NotificationBell";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    currentSession().then((s) => {
      if (!s) {
        router.replace("/login");
        return;
      }
      setEmail(s.getIdToken().payload.email as string);
      setRole(currentRole(s));
      setAdmin(isAdmin(s));
    });
  }, [router]);

  const links: { href: string; label: string; description: string }[] = [];
  if (role === "student" || role === "parent") {
    links.push(
      { href: "/teachers", label: "Find a teacher", description: "Browse verified tutors and book a trial session" },
      { href: "/bookings", label: "My bookings", description: "Upcoming and past sessions" },
      { href: "/requests", label: "My lesson requests", description: "Requests you've sent to teachers" },
      { href: "/calendar", label: "Calendar", description: "Upcoming scheduled sessions" },
      { href: "/payments", label: "Payment history", description: "Download invoices for past payments" },
      { href: "/attendance", label: "My attendance", description: "Your attendance record across sessions" },
    );
  }
  if (role === "parent") {
    links.push({
      href: "/parent/children",
      label: "My children",
      description: "Manage linked student accounts",
    });
  }
  if (role === "student") {
    links.push({
      href: "/student/parents",
      label: "My parents / guardians",
      description: "Accept or view parent link requests",
    });
  }
  if (role === "teacher") {
    links.push(
      { href: "/teacher/profile", label: "Edit your profile", description: "Bio, subjects, hourly rate" },
      { href: "/teacher/bookings", label: "My bookings (teacher)", description: "Schedule sessions against bookings" },
      { href: "/requests", label: "Lesson requests", description: "Accept or decline incoming requests" },
      { href: "/calendar", label: "Calendar", description: "Upcoming scheduled sessions" },
      { href: "/payments", label: "Payments received", description: "Session payouts and invoices you can reference" },
    );
  }
  if (admin) {
    links.push(
      { href: "/admin", label: "Admin console", description: "Users, bans, and all support tickets" },
    );
  }
  links.push({
    href: "/support",
    label: "Support & disputes",
    description: "File a dispute, report an issue, or contact the team",
  });
  links.push({
    href: "/faq",
    label: "FAQ & contact",
    description: "Common questions and how to reach us",
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {email ?? "..."} · <span className="capitalize">{role ?? ""}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={() => {
              signOut();
              router.replace("/");
            }}
            className="rounded border px-3 py-1 text-sm"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href as never}
            className="block rounded border p-4 transition hover:border-black dark:hover:border-white"
          >
            <div className="font-medium">{l.label}</div>
            <div className="mt-1 text-sm text-gray-500">{l.description}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
