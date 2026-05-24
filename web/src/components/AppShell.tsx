"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { currentSession } from "@/lib/cognito";
import { SideNav } from "./SideNav";

const NO_SHELL_PREFIXES = [
  "/login",
  "/signup",
  "/classroom/",
  "/whiteboard/",
];

function isShellHidden(pathname: string): boolean {
  if (pathname === "/") return true;
  return NO_SHELL_PREFIXES.some((p) => pathname.startsWith(p));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    currentSession().then((s) => setSignedIn(!!s));
  }, [pathname]);

  if (isShellHidden(pathname) || signedIn !== true) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto grid max-w-container-wide gap-8 px-8 md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden md:sticky md:top-16 md:block md:max-h-[calc(100vh-4rem)] md:self-start md:overflow-y-auto md:border-r md:border-rule md:py-5 md:pr-3.5">
        <SideNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
