"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentRole, currentSession, isAdmin, signOut, type Role } from "@/lib/cognito";
import { NotificationBell } from "@/components/NotificationBell";
import { api } from "@/lib/api";

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

      // Auto-claim referral code captured from ?ref= on the signup page.
      // sessionStorage persists across the signup → confirm → login → dashboard
      // flow within a single tab. We consume the key best-effort: success is
      // silent (the user will see the referrer on /referrals), and we drop the
      // key regardless of outcome so we never retry (the backend endpoint is
      // one-shot anyway — a second POST would just return already_claimed).
      if (typeof window !== "undefined") {
        let pendingRef: string | null = null;
        try {
          pendingRef = sessionStorage.getItem("eduboost_pending_ref");
        } catch {
          /* storage disabled */
        }
        if (pendingRef) {
          try {
            sessionStorage.removeItem("eduboost_pending_ref");
          } catch {
            /* ignore */
          }
          api<{ referrerDisplayName: string }>(`/referrals/claim`, {
            method: "POST",
            body: JSON.stringify({ code: pendingRef }),
          }).catch(() => {
            /* swallow: already_claimed, unknown_code, self-referral, etc. */
          });
        }
      }
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
      { href: "/marketplace", label: "Marketplace", description: "Browse study materials for sale" },
      { href: "/orders", label: "My orders", description: "Digital tutorials you've purchased" },
      { href: "/grades", label: "My grades", description: "Feedback from AI-graded submissions" },
      { href: "/analytics", label: "Analytics", description: "Your spend, attendance, grades, and activity" },
      { href: "/notes", label: "My notes", description: "Personal notes from classroom sessions" },
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
      { href: "/seller/listings", label: "Marketplace listings", description: "Sell digital study materials" },
      { href: "/seller/orders", label: "Marketplace sales", description: "Orders on your listings" },
      { href: "/teacher/earnings", label: "Earnings", description: "Gross, fee, and net income across sessions and marketplace" },
      { href: "/teacher/grader", label: "AI grader", description: "Score submissions with Claude + a rubric" },
      { href: "/grades", label: "Grades given", description: "History of your AI-graded submissions" },
      { href: "/orgs", label: "Organizations", description: "Manage teams and linked classrooms" },
    );
  }
  if (admin) {
    links.push(
      { href: "/admin", label: "Admin console", description: "Users, bans, and all support tickets" },
    );
  }
  links.push({
    href: "/forum",
    label: "Forum",
    description: "Community Q&A and discussion",
  });
  links.push({
    href: "/events",
    label: "Events",
    description: "Upcoming workshops, meetups and ticketed sessions",
  });
  links.push({
    href: "/referrals",
    label: "Invite a friend",
    description: "Share your referral code",
  });
  links.push({
    href: "/settings/sms",
    label: "SMS notifications",
    description: "Get texted for time-sensitive updates",
  });
  links.push({
    href: "/settings/google",
    label: "Google Calendar",
    description: "Sync your scheduled sessions to Google Calendar",
  });
  links.push({
    href: "/membership",
    label: "Membership",
    description: "Upgrade your account for extra features",
  });
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
