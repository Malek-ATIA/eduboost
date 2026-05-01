"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { currentSession } from "@/lib/cognito";
import { SideNav } from "./SideNav";

// Paths where the global left nav should NOT render — either because
// they're public marketing/auth screens, or because the page needs full
// width (video room, whiteboard). Matched as prefixes so dynamic segments
// under these roots are excluded too.
const NO_SHELL_PREFIXES = [
  "/login",
  "/signup",
  "/classroom/", // live video room — full-screen
  "/whiteboard/", // shared canvas
];

function isShellHidden(pathname: string): boolean {
  if (pathname === "/") return true; // marketing home
  return NO_SHELL_PREFIXES.some((p) => pathname.startsWith(p));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    currentSession().then((s) => setSignedIn(!!s));
  }, [pathname]);

  // While the session probe is in-flight, render children without the shell
  // so we don't flash a sidebar that disappears when the user turns out to
  // be anonymous.
  if (isShellHidden(pathname) || signedIn !== true) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 md:grid-cols-[240px_minmax(0,1fr)] md:px-6">
      <aside className="hidden md:sticky md:top-20 md:block md:max-h-[calc(100vh-5rem)] md:self-start md:overflow-y-auto md:py-6">
        <SideNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
