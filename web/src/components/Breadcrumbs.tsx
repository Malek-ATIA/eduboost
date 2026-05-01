"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Path segment → readable label. Add new rows here when top-level routes land.
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  teacher: "Teacher space",
  teachers: "Teachers",
  parent: "Parent space",
  student: "Student space",
  profile: "My profile",
  classrooms: "Classrooms",
  classroom: "Classroom session",
  "classroom-chat": "Classroom chat",
  whiteboard: "Whiteboard",
  bookings: "Bookings",
  calendar: "Calendar",
  attendance: "Attendance",
  notes: "Notes",
  mailbox: "Mailbox",
  chat: "Chat",
  events: "Events",
  marketplace: "Marketplace",
  seller: "Seller",
  listings: "Listings",
  orders: "Orders",
  buy: "Buy",
  "study-materials": "Study materials",
  assessments: "Assessments",
  grades: "Grades",
  grader: "AI grader",
  forum: "Forum",
  posts: "Posts",
  reviews: "Reviews",
  requests: "Lesson requests",
  sessions: "Sessions",
  favorites: "Favorites",
  referrals: "Referrals",
  payments: "Payments",
  earnings: "Earnings",
  analytics: "Analytics",
  membership: "Membership",
  notifications: "Notifications",
  support: "Support",
  new: "New",
  admin: "Admin",
  users: "Users",
  tickets: "Tickets",
  verifications: "Verifications",
  settings: "Settings",
  sms: "SMS",
  google: "Google Calendar",
  signup: "Sign up",
  login: "Log in",
  faq: "FAQ",
  terms: "Terms",
  privacy: "Privacy",
  "code-of-conduct": "Code of conduct",
  orgs: "Organizations",
  wall: "Wall",
  quiz: "Quiz",
  book: "Book",
  children: "Children",
  parents: "Parents",
  results: "Results",
  students: "Students",
  recordings: "Recordings",
};

// Routes where we don't render or record breadcrumbs.
const HIDDEN = new Set<string>(["/", "/login", "/signup"]);

function isLikelyId(segment: string): boolean {
  return /^[a-z]{2,6}_[a-z0-9_-]+$/i.test(segment) || segment.length > 20;
}

function labelFromPathname(pathname: string): string {
  if (pathname === "/") return "Home";
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (last && SEGMENT_LABELS[last]) return SEGMENT_LABELS[last];

  // Dynamic id at the tail? Label it "<parent entity> detail" so the user
  // can tell what they're looking at without reading the URL.
  if (last && isLikelyId(last)) {
    for (let i = segments.length - 2; i >= 0; i--) {
      const known = SEGMENT_LABELS[segments[i] ?? ""];
      if (known) {
        // Naive de-pluralise for readability ("Teachers" → "Teacher detail").
        const singular = known.replace(/s\b/i, "");
        return `${singular} detail`;
      }
    }
    return "Detail";
  }

  return last
    ? last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, " ")
    : "Page";
}

type Crumb = { href: string; label: string };

// Trail lives in sessionStorage so it survives navigations within a tab but
// doesn't leak across tabs or browsing sessions. Capped at 10 crumbs — no
// unbounded growth, and the oldest entry drops off the left when exceeded.
const TRAIL_KEY = "eduboost_bc_trail";
const TRAIL_CAP = 10;

function readTrail(): Crumb[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(TRAIL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is Crumb =>
        typeof c?.href === "string" && typeof c?.label === "string",
    );
  } catch {
    return [];
  }
}

function writeTrail(trail: Crumb[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail));
  } catch {
    /* quota exceeded or disabled storage — fail quiet */
  }
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const [trail, setTrail] = useState<Crumb[]>([]);

  useEffect(() => {
    if (HIDDEN.has(pathname)) {
      // Don't record the page, but also don't reset the trail — the user
      // might hop to /login from a deep page and we want the rest intact.
      setTrail(readTrail());
      return;
    }

    const existing = readTrail();
    const currentLabel = labelFromPathname(pathname);
    const idx = existing.findIndex((c) => c.href === pathname);

    let next: Crumb[];
    if (idx >= 0) {
      // Returning to a page already in the trail (user clicked a crumb or
      // hit the back button) — truncate everything after it so the trail
      // always ends at "where I am now".
      next = existing.slice(0, idx + 1);
      // Refresh the label in case it evolved (e.g., known route added).
      const last = next[next.length - 1];
      if (last) last.label = currentLabel;
    } else {
      next = [...existing, { href: pathname, label: currentLabel }];
    }

    if (next.length > TRAIL_CAP) {
      next = next.slice(next.length - TRAIL_CAP);
    }

    writeTrail(next);
    setTrail(next);
  }, [pathname]);

  if (HIDDEN.has(pathname)) return null;

  // Breadcrumb UI intentionally hidden — the trail logic above still runs
  // (kept for future re-enable without a rewrite), but the bar renders only
  // as a spacer so there's air between the sticky header and the page
  // content. Height roughly matches what the visible breadcrumb used to
  // occupy so re-enabling is a one-liner.
  void trail;
  return <div aria-hidden className="h-8" />;
}
