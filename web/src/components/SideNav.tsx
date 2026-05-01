"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { currentRole, currentSession, isAdmin, type Role } from "@/lib/cognito";
import {
  Users,
  Monitor,
  CalendarDays,
  Mail,
  GraduationCap,
  BookOpen,
  Heart,
  Baby,
  CreditCard,
  BarChart3,
  BookMarked,
  ClipboardList,
  DollarSign,
  ShoppingBag,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

type NavLink = { href: string; label: string; icon: LucideIcon };

function linksForRole(role: Role | null, admin: boolean): NavLink[] {
  const links: NavLink[] = [];

  if (role === "student") {
    links.push(
      { href: "/bookings", label: "My teachers", icon: Users },
      { href: "/classrooms", label: "My classrooms", icon: Monitor },
      { href: "/calendar", label: "My calendar", icon: CalendarDays },
      { href: "/mailbox", label: "My mailbox", icon: Mail },
      { href: "/grades", label: "My grades", icon: GraduationCap },
      { href: "/study-materials", label: "Study materials", icon: BookOpen },
      { href: "/favorites", label: "Favorites", icon: Heart },
    );
  }
  if (role === "parent") {
    links.push(
      { href: "/parent/children", label: "My children", icon: Baby },
      { href: "/calendar", label: "My calendar", icon: CalendarDays },
      { href: "/mailbox", label: "My mailbox", icon: Mail },
      { href: "/payments", label: "Payments", icon: CreditCard },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/favorites", label: "Favorites", icon: Heart },
    );
  }
  if (role === "teacher") {
    links.push(
      { href: "/classrooms", label: "My classrooms", icon: Monitor },
      { href: "/teacher/students", label: "My students", icon: Users },
      { href: "/teacher/bookings", label: "Bookings", icon: BookMarked },
      { href: "/requests", label: "Lesson requests", icon: ClipboardList },
      { href: "/calendar", label: "My calendar", icon: CalendarDays },
      { href: "/study-materials", label: "Study materials", icon: BookOpen },
      { href: "/seller/listings", label: "Marketplace listings", icon: ShoppingBag },
      { href: "/teacher/earnings", label: "Earnings", icon: DollarSign },
    );
  }
  if (admin) {
    links.push({ href: "/admin", label: "Admin console", icon: ShieldCheck });
  }

  return links;
}

export function SideNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);
  const [admin, setAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    currentSession().then((s) => {
      setRole(currentRole(s));
      setAdmin(isAdmin(s));
      setReady(true);
    });
  }, []);

  if (ready && !role && !admin) return null;

  const links = linksForRole(role, admin);

  return (
    <nav
      aria-label="App navigation"
      className="space-y-0.5 bg-parchment pb-6 text-sm"
    >
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href as never}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
              active
                ? "bg-parchment-shade font-medium text-ink"
                : "text-ink-soft hover:bg-parchment-shade hover:text-ink"
            }`}
          >
            <Icon size={16} className={active ? "text-seal" : ""} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
