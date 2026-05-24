"use client";
import Link from "next/link";
import { Mail, Phone, MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { currentSession } from "@/lib/cognito";

const HIDE_FOOTER_PREFIXES = [
  "/student", "/teacher", "/parent", "/admin",
  "/calendar", "/mailbox", "/notifications", "/profile", "/dashboard",
  "/classrooms", "/bookings", "/favorites", "/grades", "/study-materials",
  "/seller", "/requests", "/support", "/payments", "/analytics",
  "/orgs", "/wall", "/chat", "/breakout", "/quiz", "/assessments",
  "/notes", "/reviews", "/referrals", "/sessions", "/book",
  "/login", "/signup", "/forgot-password",
  "/classroom/", "/whiteboard/", "/settings", "/mailbox/", "/classroom-chat",
  "/teachers", "/marketplace", "/forum", "/blog",
];

function useShowFooter(): boolean {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    currentSession().then((s) => setSignedIn(!!s));
  }, [pathname]);
  if (signedIn === true && HIDE_FOOTER_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return false;
  }
  if (pathname.startsWith("/classroom/") || pathname.startsWith("/whiteboard/")) return false;
  return true;
}

const COLS = [
  {
    title: "Platform",
    links: [
      { href: "/teachers", label: "Find a teacher" },
      { href: "/classrooms", label: "Classroom" },
      { href: "/marketplace", label: "Marketplace" },
      { href: "/forum", label: "Community" },
      { href: "/events", label: "Events" },
    ],
  },
  {
    title: "Learn more",
    links: [
      { href: "/faq", label: "How it works" },
      { href: "/faq", label: "Blog" },
      { href: "/faq", label: "FAQ" },
      { href: "/support/new", label: "Contact support" },
      { href: "/", label: "About EduBoost" },
    ],
  },
  {
    title: "For teachers",
    links: [
      { href: "/signup?role=teacher", label: "Teach on EduBoost" },
      { href: "/faq", label: "Teacher resources" },
      { href: "/faq", label: "Earnings guide" },
      { href: "/terms", label: "Community guidelines" },
    ],
  },
];

export function Footer() {
  const show = useShowFooter();
  if (!show) return null;
  return (
    <footer className="mt-24 border-t border-rule bg-bg-soft">
      <div className="mx-auto max-w-container-wide px-8 pb-7 pt-14">
        <div className="grid gap-12 sm:grid-cols-2 md:grid-cols-[1.6fr_repeat(3,1fr)]">
          {/* Brand column */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 hover:no-underline">
              <span
                aria-hidden
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ink font-serif text-[22px] font-medium italic text-white"
              >
                E
              </span>
              <span className="font-serif text-[26px] font-medium tracking-tight text-ink">
                EduBoost
              </span>
            </Link>
            <p className="mt-4 max-w-[340px] text-sm leading-relaxed text-ink-soft">
              Verified Tunisian tutors, online and in-person. Book trial lessons, learn in our classroom, and pay safely in TND.
            </p>
            <div className="mt-5 flex flex-col gap-2 text-[13px] text-ink-faded">
              <a href="mailto:hello@eduboost.tn" className="inline-flex items-center gap-2 hover:text-ink">
                <Mail size={14} /> hello@eduboost.tn
              </a>
              <a href="https://wa.me/21655555555" className="inline-flex items-center gap-2 hover:text-ink">
                <MessageCircle size={14} /> WhatsApp +216 55 555 555
              </a>
              <a href="tel:+21670555555" className="inline-flex items-center gap-2 hover:text-ink">
                <Phone size={14} /> +216 70 555 555
              </a>
            </div>
          </div>

          {/* Link columns */}
          {COLS.map((col) => (
            <div key={col.title}>
              <div className="text-[12.5px] font-medium tracking-wide text-ink">
                {col.title}
              </div>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href as never}
                      className="text-sm text-ink-soft transition hover:text-ink"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
          <div className="text-[12.5px] text-ink-faded">
            &copy; {new Date().getFullYear()} EduBoost &middot; Made in Tunisia
          </div>
          <div className="flex gap-[18px] text-xs text-legal">
            <span className="cursor-default">Terms of service</span>
            <span className="cursor-default">Privacy policy</span>
            <span className="cursor-default">Code of conduct</span>
            <span className="cursor-default">Cookies</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
