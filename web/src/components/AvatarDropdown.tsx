"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import type { Role } from "@/lib/cognito";
import {
  User,
  Package,
  Settings,
  UserPlus,
  Users,
  Baby,
  ShieldCheck,
  LogOut,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

type Props = {
  userId: string;
  role: Role | null;
  displayName?: string;
  isAdmin: boolean;
  onSignOut: () => void;
};

type MenuItem =
  | { type: "link"; href: string; label: string; icon: LucideIcon }
  | { type: "divider" }
  | { type: "button"; label: string; icon: LucideIcon; onClick: () => void };

export function AvatarDropdown({ userId, role, displayName, isAdmin, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const items: MenuItem[] = [
    { type: "link", href: "/profile", label: "Profile", icon: User },
    { type: "link", href: "/orders", label: "My orders", icon: Package },
    { type: "link", href: "/settings/sms", label: "Settings", icon: Settings },
    { type: "link", href: "/referrals", label: "Invite a friend", icon: UserPlus },
  ];
  if (role === "student") {
    items.push({ type: "link", href: "/student/parents", label: "My parents", icon: Users });
    items.push({ type: "divider" });
    items.push({ type: "link", href: "/signup?role=teacher", label: "Become a teacher", icon: GraduationCap });
  }
  if (role === "parent") {
    items.push({ type: "link", href: "/parent/children", label: "My children", icon: Baby });
  }
  if (isAdmin) {
    items.push({ type: "link", href: "/admin", label: "Admin console", icon: ShieldCheck });
  }
  items.push({ type: "divider" });
  items.push({ type: "button", label: "Log out", icon: LogOut, onClick: onSignOut });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex items-center gap-1.5 rounded-full transition hover:ring-2 hover:ring-seal/30 focus-visible:ring-2 focus-visible:ring-seal"
      >
        <Avatar userId={userId} size="sm" initial={displayName?.[0]} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-lg border border-ink-faded/25 bg-white shadow-lg"
        >
          {items.map((item, i) => {
            if (item.type === "divider") {
              return <div key={i} className="border-t border-ink-faded/15" />;
            }
            const Icon = item.icon;
            if (item.type === "link") {
              return (
                <Link
                  key={item.href}
                  href={item.href as never}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-soft transition hover:bg-parchment-shade hover:text-ink"
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink-soft transition hover:bg-parchment-shade hover:text-ink"
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
