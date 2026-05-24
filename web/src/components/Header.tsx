"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { currentRole, currentSession, isAdmin, signOut, type Role } from "@/lib/cognito";
import {
  Search,
  Monitor,
  Users,
  ShoppingBag,
  Menu,
  X,
  BookOpen,
} from "lucide-react";

const NAV_ALL = [
  { href: "/teachers", label: "Find a teacher", icon: Search },
  { href: "/classrooms", label: "Classroom", icon: Monitor },
  { href: "/forum", label: "Community", icon: Users },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/blog", label: "Blog", icon: BookOpen },
];

const HIDE_ON_PREFIXES = [
  "/student",
  "/teacher",
  "/parent",
  "/admin",
  "/calendar",
  "/mailbox",
  "/notifications",
  "/profile",
  "/dashboard",
  "/classrooms",
  "/bookings",
  "/favorites",
  "/grades",
  "/study-materials",
  "/seller",
  "/requests",
  "/support",
  "/payments",
  "/analytics",
  "/orgs",
  "/wall",
  "/chat",
  "/breakout",
  "/quiz",
  "/assessments",
  "/notes",
  "/reviews",
  "/referrals",
  "/sessions",
  "/book",
  "/login",
  "/signup",
  "/forgot-password",
  "/classroom/",
  "/whiteboard/",
  "/settings",
  "/mailbox/",
  "/classroom-chat",
  "/teachers",
  "/marketplace",
  "/forum",
  "/blog",
];

function shouldHideOnSignedIn(pathname: string, signedIn: boolean | null): boolean {
  if (!signedIn) return false;
  return HIDE_ON_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [admin, setAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    currentSession().then((s) => {
      setSignedIn(!!s);
      setRole(currentRole(s));
      setAdmin(isAdmin(s));
    });
  }, [pathname]);

  // Hide the marketing header entirely on signed-in app pages (the AppShell has its own header)
  if (shouldHideOnSignedIn(pathname, signedIn)) return null;

  // Also hide on the live classroom and whiteboard pages (full-bleed)
  if (pathname.startsWith("/classroom/") || pathname.startsWith("/whiteboard/")) return null;

  function onSignOut() {
    signOut();
    setSignedIn(false);
    setRole(null);
    setAdmin(false);
    router.push("/");
    router.refresh();
  }

  const showNav = !signedIn;

  return (
    <header
      className="sticky top-0 z-40 border-b border-rule-soft"
      style={{ background: "color-mix(in oklab, var(--bg) 92%, transparent)", backdropFilter: "blur(10px)" }}
    >
      <div className="mx-auto flex h-16 max-w-container-wide items-center gap-7 px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg font-bold text-lg text-white"
            style={{ background: "var(--ink)" }}
          >
            E
          </span>
          <span className="text-[22px] font-bold tracking-[-0.02em] text-ink">EduBoost</span>
        </Link>

        {showNav && (
          <nav className="ml-4 hidden items-center gap-5 md:flex">
            {NAV_ALL.map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <Link
                  key={l.href}
                  href={l.href as never}
                  className={`relative whitespace-nowrap px-0 py-2 text-[14.5px] transition ${
                    active ? "font-semibold text-ink" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {l.label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-[14px] h-0.5 rounded bg-accent" />
                  )}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          {signedIn === null ? null : signedIn ? (
            <button onClick={onSignOut} className="btn-ghost text-sm">
              Sign out
            </button>
          ) : (
            <>
              <Link href="/login" className="btn-ghost hidden text-sm sm:inline-flex">
                Log in
              </Link>
              <Link href="/signup" className="btn-accent btn-sm">
                Sign up
              </Link>
            </>
          )}
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-rule text-ink-soft transition hover:bg-bg-soft md:hidden"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && showNav && (
        <nav className="border-t border-rule-soft bg-white md:hidden">
          <div className="mx-auto flex max-w-container-wide flex-col px-8 py-3">
            {NAV_ALL.map((l) => (
              <Link
                key={l.href}
                href={l.href as never}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-2 py-2.5 text-[14px] text-ink-soft transition hover:bg-bg-soft hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
