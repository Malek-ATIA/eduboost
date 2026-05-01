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
} from "lucide-react";

const NAV_ALL = [
  { href: "/teachers", label: "Find a teacher", hideFor: ["teacher"] as string[], icon: Search },
  { href: "/classrooms", label: "Classrooms", hideFor: ["teacher"] as string[], icon: Monitor },
  { href: "/forum", label: "Community", hideFor: [] as string[], icon: Users },
  { href: "/marketplace", label: "Marketplace", hideFor: [] as string[], icon: ShoppingBag },
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
    <header className="sticky top-0 z-40 border-b border-ink-faded/25 bg-parchment/85 backdrop-blur supports-[backdrop-filter]:bg-parchment/70">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-2 hover:no-underline">
          <span
            aria-hidden
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-seal/40 bg-seal/10 text-lg font-bold text-seal"
          >
            E
          </span>
          <span className="text-xl font-bold tracking-tight text-ink">
            EduBoost
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {NAV_ALL.filter((l) => !role || !l.hideFor.includes(role)).map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href as never}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition hover:bg-parchment-dark ${
                  active ? "text-ink font-medium" : "text-ink-soft"
                }`}
              >
                <Icon size={16} />
                {l.label}
              </Link>
            );
          })}
        </nav>

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
                href="/signup?role=teacher"
                className="hidden text-sm text-ink-soft transition hover:text-ink lg:inline-flex"
              >
                Become a teacher
              </Link>
              <Link href="/login" className="btn-ghost hidden sm:inline-flex">
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-ink-faded/40 text-ink-soft transition hover:bg-parchment-dark md:hidden"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-ink-faded/20 bg-parchment/95 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col px-4 py-3 md:px-6">
            {NAV_ALL.filter((l) => !role || !l.hideFor.includes(role)).map((l) => {
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href as never}
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm text-ink-soft hover:bg-parchment-dark"
                >
                  <Icon size={16} />
                  {l.label}
                </Link>
              );
            })}
            {signedIn && (
              <>
                <div className="my-1 border-t border-ink-faded/20" />
                {[
                  { href: "/profile", label: "Profile" },
                  { href: "/orders", label: "My orders" },
                  { href: "/settings/sms", label: "Settings" },
                  { href: "/referrals", label: "Invite a friend" },
                ].map((l) => (
                  <Link
                    key={l.href}
                    href={l.href as never}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-md px-2 py-2 text-sm text-ink-soft hover:bg-parchment-dark"
                  >
                    {l.label}
                  </Link>
                ))}
                <button
                  onClick={() => { setMobileOpen(false); onSignOut(); }}
                  className="rounded-md px-2 py-2 text-left text-sm text-ink-soft hover:bg-parchment-dark"
                >
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
