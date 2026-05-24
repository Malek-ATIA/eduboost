"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { currentRole, currentSession, isAdmin, signOut, type Role } from "@/lib/cognito";
import { NotificationBell } from "./NotificationBell";
import { AvatarDropdown } from "./AvatarDropdown";
import {
  Search,
  Monitor,
  Users,
  ShoppingBag,
  Menu,
  X,
  User,
  Package,
  Settings,
  Gift,
  LogOut,
  BookOpen,
} from "lucide-react";
import { linksForRole } from "./SideNav";

const NAV_ALL = [
  { href: "/teachers", label: "Find a teacher", hideFor: ["teacher"] as string[], icon: Search },
  { href: "/classrooms", label: "Classroom", hideFor: ["teacher"] as string[], icon: Monitor },
  { href: "/forum", label: "Community", hideFor: [] as string[], icon: Users },
  { href: "/marketplace", label: "Marketplace", hideFor: [] as string[], icon: ShoppingBag },
  { href: "/faq", label: "Blog", hideFor: [] as string[], icon: BookOpen },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [admin, setAdmin] = useState(false);
  const [sub, setSub] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | undefined>();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    currentSession().then((s) => {
      setSignedIn(!!s);
      setRole(currentRole(s));
      setAdmin(isAdmin(s));
      if (s) {
        const payload = s.getIdToken().payload;
        setSub((payload.sub as string) ?? null);
        setDisplayName((payload.name as string) ?? (payload.email as string) ?? undefined);
      }
    });
  }, [pathname]);

  function onSignOut() {
    signOut();
    setSignedIn(false);
    setRole(null);
    setAdmin(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-rule-soft bg-white/92 backdrop-blur-[10px]">
      <div className="mx-auto flex h-16 max-w-container-wide items-center gap-7 px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 hover:no-underline">
          <span
            aria-hidden
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-ink font-serif text-lg font-medium italic text-white"
          >
            E
          </span>
          <span className="font-serif text-[22px] font-medium tracking-tight text-ink">
            EduBoost
          </span>
        </Link>

        {/* Nav links */}
        <nav className="ml-4 hidden items-center gap-5 md:flex">
          {NAV_ALL.filter((l) => !role || !l.hideFor.includes(role)).map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href as never}
                className={`relative whitespace-nowrap px-0 py-2 text-sm transition ${
                  active ? "text-ink font-medium" : "text-ink-soft hover:text-ink"
                }`}
              >
                {l.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-[14px] h-0.5 bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          {signedIn === null ? null : signedIn ? (
            <>
              <NotificationBell />
              <AvatarDropdown
                userId={sub ?? ""}
                role={role}
                displayName={displayName}
                isAdmin={admin}
                onSignOut={onSignOut}
              />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="btn-ghost hidden text-sm sm:inline-flex"
              >
                Log in
              </Link>
              <Link href="/signup" className="btn-seal">
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

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t border-rule-soft bg-white/95 md:hidden">
          <div className="mx-auto flex max-w-container-wide flex-col px-8 py-3 max-h-[calc(100vh-60px)] overflow-y-auto">
            <div className="eyebrow px-2 pb-1">Navigate</div>
            {NAV_ALL.filter((l) => !role || !l.hideFor.includes(role)).map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href as never}
                  onClick={() => setMobileOpen(false)}
                  className={`inline-flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm transition ${
                    active ? "bg-bg-soft font-medium text-ink" : "text-ink-soft"
                  }`}
                >
                  <Icon size={16} className={active ? "text-accent" : ""} />
                  {l.label}
                </Link>
              );
            })}

            {signedIn && role && (
              <>
                <div className="my-2 border-t border-rule" />
                <div className="eyebrow px-2 pb-1">
                  {role === "student" ? "My space" : role === "teacher" ? "Teacher tools" : role === "parent" ? "Family" : "Dashboard"}
                </div>
                {linksForRole(role, admin).map((l) => {
                  const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
                  const Icon = l.icon;
                  return (
                    <Link
                      key={l.href}
                      href={l.href as never}
                      onClick={() => setMobileOpen(false)}
                      className={`inline-flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm transition ${
                        active ? "bg-bg-soft font-medium text-ink" : "text-ink-soft"
                      }`}
                    >
                      <Icon size={16} className={active ? "text-accent" : ""} />
                      {l.label}
                    </Link>
                  );
                })}
              </>
            )}

            {signedIn && (
              <>
                <div className="my-2 border-t border-rule" />
                <div className="eyebrow px-2 pb-1">Account</div>
                {[
                  { href: "/profile", label: "Profile", icon: User },
                  { href: "/orders", label: "My orders", icon: Package },
                  { href: "/settings/sms", label: "Settings", icon: Settings },
                  { href: "/referrals", label: "Invite a friend", icon: Gift },
                ].map((l) => {
                  const Icon = l.icon;
                  return (
                    <Link
                      key={l.href}
                      href={l.href as never}
                      onClick={() => setMobileOpen(false)}
                      className="inline-flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm text-ink-soft"
                    >
                      <Icon size={16} />
                      {l.label}
                    </Link>
                  );
                })}
                <button
                  onClick={() => { setMobileOpen(false); onSignOut(); }}
                  className="inline-flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-sm text-ink-soft"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
