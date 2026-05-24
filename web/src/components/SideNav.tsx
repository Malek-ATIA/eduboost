"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { currentRole, currentSession, isAdmin, type Role } from "@/lib/cognito";
import { api } from "@/lib/api";
import { Avatar } from "./Avatar";
import {
  Home,
  CalendarDays,
  Monitor,
  Mail,
  Bell,
  Search,
  Settings,
  Wallet,
  ShieldCheck,
  Users,
  BookOpen,
  Heart,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

type NavLink = { href: string; label: string; icon: LucideIcon; count?: number };

export function linksForRole(role: Role | null, admin: boolean, unreadMsg: number, unreadNotif: number): NavLink[] {
  if (admin && !role) {
    return [
      { href: "/admin", label: "Admin home", icon: ShieldCheck },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/verifications", label: "Verifications", icon: ShieldCheck },
      { href: "/admin/tickets", label: "Tickets", icon: Mail },
      { href: "/profile", label: "Settings", icon: Settings },
    ];
  }
  if (role === "student") {
    return [
      { href: "/student", label: "Home", icon: Home },
      { href: "/calendar", label: "Schedule", icon: CalendarDays },
      { href: "/classrooms", label: "Classroom", icon: Monitor },
      { href: "/mailbox", label: "Messages", icon: Mail, count: unreadMsg },
      { href: "/notifications", label: "Notifications", icon: Bell, count: unreadNotif },
      { href: "/teachers", label: "Find a teacher", icon: Search },
      { href: "/favorites", label: "Favorites", icon: Heart },
      { href: "/study-materials", label: "Study materials", icon: BookOpen },
      { href: "/profile", label: "Settings", icon: Settings },
    ];
  }
  if (role === "teacher") {
    return [
      { href: "/teacher", label: "Home", icon: Home },
      { href: "/calendar", label: "Schedule", icon: CalendarDays },
      { href: "/classrooms", label: "Classroom", icon: Monitor },
      { href: "/mailbox", label: "Messages", icon: Mail, count: unreadMsg },
      { href: "/notifications", label: "Notifications", icon: Bell, count: unreadNotif },
      { href: "/teacher/students", label: "Students", icon: Users },
      { href: "/teacher/bookings", label: "Bookings", icon: CalendarDays },
      { href: "/teacher/earnings", label: "Earnings", icon: Wallet },
      { href: "/seller/listings", label: "Marketplace", icon: ShoppingBag },
      { href: "/profile", label: "Settings", icon: Settings },
    ];
  }
  if (role === "parent") {
    return [
      { href: "/parent", label: "Home", icon: Home },
      { href: "/parent/children", label: "Children", icon: Users },
      { href: "/calendar", label: "Schedule", icon: CalendarDays },
      { href: "/mailbox", label: "Messages", icon: Mail, count: unreadMsg },
      { href: "/notifications", label: "Notifications", icon: Bell, count: unreadNotif },
      { href: "/profile", label: "Settings", icon: Settings },
    ];
  }
  return [];
}

export function SideNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);
  const [admin, setAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{ userId: string; displayName: string; email: string } | null>(null);
  const [unreadMsg, setUnreadMsg] = useState(0);
  const [unreadNotif, setUnreadNotif] = useState(0);

  useEffect(() => {
    currentSession().then((s) => {
      setRole(currentRole(s));
      setAdmin(isAdmin(s));
      setReady(true);
      if (!s) return;
      const payload = s.getIdToken().payload;
      const userId = (payload.sub as string) ?? "";
      const email = (payload.email as string) ?? "";
      const displayName = (payload.name as string) ?? email.split("@")[0] ?? "User";
      setUser({ userId, displayName, email });
      api<{ count: number }>("/notifications/unread-count")
        .then((r) => setUnreadNotif(r.count))
        .catch(() => {});
    });
  }, []);

  if (ready && !role && !admin) return null;
  if (!ready) return null;

  const links = linksForRole(role, admin, unreadMsg, unreadNotif);
  const roleLabel = admin && !role
    ? "Platform team"
    : role === "student"
      ? "Student"
      : role === "teacher"
        ? "Teacher"
        : role === "parent"
          ? "Parent"
          : "";

  return (
    <nav aria-label="App navigation" className="flex h-full flex-col">
      {/* User card */}
      {user && (
        <div className="border-b border-rule px-2.5 pb-3.5 pt-1.5">
          <Link href="/profile" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-white">
            <Avatar userId={user.userId} size="sm" initial={user.displayName} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium text-ink">{user.displayName}</div>
              <div className="truncate text-[11.5px] text-ink-faded">{roleLabel}</div>
            </div>
          </Link>
        </div>
      )}

      {/* Nav links */}
      <div className="mt-2 flex flex-1 flex-col gap-1">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href as never}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition ${
                active
                  ? "border border-rule bg-white font-medium text-ink"
                  : "border border-transparent text-ink-soft hover:bg-white/60 hover:text-ink"
              }`}
            >
              <Icon size={17} className={active ? "text-accent" : "text-ink-faded"} />
              <span className="flex-1">{l.label}</span>
              {l.count !== undefined && l.count > 0 && (
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-medium text-white">
                  {l.count > 99 ? "99+" : l.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
