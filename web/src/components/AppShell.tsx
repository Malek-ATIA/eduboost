"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { currentSession, currentRole, isAdmin, type Role, signOut } from "@/lib/cognito";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import {
  Home,
  CalendarDays,
  Monitor,
  MessageCircle,
  Search,
  ShoppingBag,
  Settings,
  Wallet,
  ShieldCheck,
  Users,
  Bell,
  ChevronDown,
  User as UserIcon,
  LogOut,
  HelpCircle,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

const NO_SHELL_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/classroom/",
  "/whiteboard/",
];

const PUBLIC_PATHS = new Set<string>([
  "/",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
]);

function isShellHidden(pathname: string): boolean {
  if (NO_SHELL_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (PUBLIC_PATHS.has(pathname)) return true;
  return false;
}

type NavLink = { href: string; label: string; icon: LucideIcon; count?: number };

function linksFor(role: Role | null, admin: boolean, unreadMsg: number): NavLink[] {
  if (admin && !role) {
    return [
      { href: "/admin", label: "Admin home", icon: ShieldCheck },
      { href: "/calendar", label: "Schedule", icon: CalendarDays },
      { href: "/mailbox", label: "Messages", icon: MessageCircle, count: unreadMsg },
      { href: "/profile", label: "Settings", icon: Settings },
    ];
  }
  if (role === "student") {
    return [
      { href: "/student", label: "Home", icon: Home },
      { href: "/calendar", label: "Schedule", icon: CalendarDays },
      { href: "/classrooms", label: "Classroom", icon: Monitor },
      { href: "/mailbox", label: "Messages", icon: MessageCircle, count: unreadMsg },
      { href: "/teachers", label: "Find a teacher", icon: Search },
      { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
      { href: "/forum", label: "Community", icon: MessageSquare },
      { href: "/profile", label: "Settings", icon: Settings },
    ];
  }
  if (role === "teacher") {
    return [
      { href: "/teacher", label: "Home", icon: Home },
      { href: "/calendar", label: "Schedule", icon: CalendarDays },
      { href: "/classrooms", label: "Classroom", icon: Monitor },
      { href: "/mailbox", label: "Messages", icon: MessageCircle, count: unreadMsg },
      { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
      { href: "/forum", label: "Community", icon: MessageSquare },
      { href: "/teacher/earnings", label: "Earnings", icon: Wallet },
      { href: "/profile", label: "Settings", icon: Settings },
    ];
  }
  if (role === "parent") {
    return [
      { href: "/parent", label: "Home", icon: Home },
      { href: "/calendar", label: "Schedule", icon: CalendarDays },
      { href: "/mailbox", label: "Messages", icon: MessageCircle, count: unreadMsg },
      { href: "/forum", label: "Community", icon: MessageSquare },
      { href: "/profile", label: "Settings", icon: Settings },
    ];
  }
  return [];
}

function roleLabel(role: Role | null, admin: boolean): string {
  if (admin && !role) return "Admin";
  if (role === "student") return "Student";
  if (role === "teacher") return "Teacher";
  if (role === "parent") return "Parent";
  return "";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [admin, setAdmin] = useState(false);
  const [user, setUser] = useState<{ userId: string; displayName: string; email: string } | null>(null);
  const [unreadMsg, setUnreadMsg] = useState(0);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [showAvatar, setShowAvatar] = useState(false);

  useEffect(() => {
    currentSession().then((s) => {
      if (!s) {
        setSignedIn(false);
        return;
      }
      setSignedIn(true);
      setRole(currentRole(s));
      setAdmin(isAdmin(s));
      const payload = s.getIdToken().payload;
      const userId = (payload.sub as string) ?? "";
      const email = (payload.email as string) ?? "";
      const displayName = (payload.name as string) ?? email.split("@")[0] ?? "User";
      setUser({ userId, displayName, email });
      api<{ count: number }>("/notifications/unread-count")
        .then((r) => setUnreadNotif(r.count))
        .catch(() => {});
    });
  }, [pathname]);

  if (isShellHidden(pathname) || signedIn !== true) {
    return <>{children}</>;
  }

  const links = linksFor(role, admin, unreadMsg);
  const currentLink = links.find((l) => pathname === l.href || pathname.startsWith(`${l.href}/`));
  const rLabel = roleLabel(role, admin);

  function onSignOut() {
    signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-bg-soft">
      {/* Dark icon rail — 56px mobile / 72px desktop, icon-only */}
      <aside
        className="fixed left-0 top-0 bottom-0 z-30 flex w-14 flex-col sm:w-[72px]"
        style={{
          background: "#0e1116",
          color: "#dadde3",
        }}
      >
        {/* Brand */}
        <Link href="/" className="flex items-center justify-center pt-5 pb-4">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] font-bold text-lg"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            E
          </span>
        </Link>

        <div className="mx-3 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

        {/* Nav (icons only) */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
          {links.map((l) => {
            const Icon = l.icon;
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href as never}
                title={l.label}
                aria-label={l.label}
                className="relative flex h-[44px] items-center justify-center rounded-[10px] transition-colors"
                style={{
                  background: active ? "rgba(44,91,255,0.16)" : "transparent",
                  color: active ? "#ffffff" : "#a4abb7",
                }}
              >
                <Icon
                  size={20}
                  style={{
                    color: active ? "var(--accent)" : "currentColor",
                    filter: active ? "drop-shadow(0 0 8px rgba(44,91,255,0.5))" : "none",
                  }}
                />
                {l.count !== undefined && l.count > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                    style={{ background: "var(--accent)", color: "#fff", border: "2px solid #0e1116" }}
                  >
                    {l.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Content column */}
      <div className="ml-14 sm:ml-[72px]">
        {/* In-page header — sticky to viewport top */}
        <header
          className="sticky top-0 z-20 flex items-center gap-3.5 border-b border-rule px-[22px] py-3"
          style={{ background: "rgba(246, 247, 249, 0.92)", backdropFilter: "blur(14px)" }}
        >
          {/* Breadcrumb / title */}
          <div className="min-w-0 shrink-0">
            <div className="flex items-center gap-2 text-[13px] text-ink-faded">
              {rLabel && <span>{rLabel}</span>}
              <span className="text-ink-mute">/</span>
              <span className="font-semibold text-ink">{currentLink?.label ?? "Home"}</span>
            </div>
          </div>

          {/* Command bar */}
          <div className="relative mx-auto hidden max-w-[560px] flex-1 sm:block">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faded"
            />
            <input
              placeholder="Search anything — teachers, materials, sessions…"
              className="w-full rounded-full border-[1.5px] border-rule bg-white py-2.5 pl-10 pr-16 text-[13.5px] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/[0.12]"
            />
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-rule bg-bg-soft px-2 py-0.5 font-mono text-[11px] font-medium text-ink-faded"
            >
              ⌘K
            </span>
          </div>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-1">
            <IconButton title="Notifications" href="/notifications" badge={unreadNotif}>
              <Bell size={17} />
            </IconButton>
            <IconButton title="Messages" href="/mailbox" badge={unreadMsg}>
              <MessageCircle size={17} />
            </IconButton>
            <IconButton title="Calendar" href="/calendar">
              <CalendarDays size={17} />
            </IconButton>
            <div className="mx-1.5 h-5 w-px bg-rule" />
            <div className="relative">
              <button
                onClick={() => setShowAvatar((v) => !v)}
                className="flex items-center gap-2 rounded-full p-1 pr-2.5 transition hover:bg-bg-soft"
                style={{ background: showAvatar ? "var(--bg-soft)" : "transparent" }}
              >
                {user && <Avatar userId={user.userId} size="sm" initial={user.displayName} />}
                <span className="hidden flex-col items-start sm:flex">
                  <span className="text-[12.5px] font-semibold leading-tight">
                    {user?.displayName.split(" ")[0]}
                  </span>
                  <span className="text-[11px] leading-tight text-ink-faded">{rLabel}</span>
                </span>
                <ChevronDown size={12} className="text-ink-faded" />
              </button>
              {showAvatar && (
                <div className="card absolute right-0 top-[calc(100%+8px)] min-w-[240px] p-1.5 shadow-lift">
                  {user && (
                    <div className="flex items-center gap-2.5 border-b border-rule px-3 pb-2.5 pt-3">
                      <Avatar userId={user.userId} size="md" initial={user.displayName} />
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-semibold">{user.displayName}</div>
                        <div className="truncate text-[11.5px] text-ink-faded">{user.email}</div>
                      </div>
                    </div>
                  )}
                  <div className="py-1.5">
                    <Link
                      href="/profile"
                      onClick={() => setShowAvatar(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] text-ink-soft transition hover:bg-bg-soft"
                    >
                      <UserIcon size={14} /> Profile
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setShowAvatar(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] text-ink-soft transition hover:bg-bg-soft"
                    >
                      <Settings size={14} /> Settings
                    </Link>
                    <Link
                      href="/support"
                      onClick={() => setShowAvatar(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] text-ink-soft transition hover:bg-bg-soft"
                    >
                      <HelpCircle size={14} /> Help & support
                    </Link>
                  </div>
                  <div className="border-t border-rule pt-1.5">
                    <button
                      onClick={() => { setShowAvatar(false); onSignOut(); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] text-warn transition hover:bg-bg-soft"
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content card */}
        <div
          className="flex-1"
          style={{
            background: "var(--bg)",
            borderTopLeftRadius: 22,
            minWidth: 0,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function IconButton({
  children,
  title,
  href,
  badge,
}: {
  children: React.ReactNode;
  title: string;
  href?: string;
  badge?: number;
}) {
  const body = (
    <span className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-bg-soft hover:text-ink">
      {children}
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute right-1 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
          style={{ background: "var(--warn)", border: "2px solid var(--bg-soft)" }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </span>
  );
  if (href) {
    return (
      <Link href={href as never} title={title}>
        {body}
      </Link>
    );
  }
  return <button title={title}>{body}</button>;
}
