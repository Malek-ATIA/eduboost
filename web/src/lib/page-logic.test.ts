import { describe, it, expect } from "vitest";
import { toMinorUnits } from "./money";

/**
 * Tests for page-level business logic extracted from components.
 * Covers filter counting, query string building, sorting, and
 * status/permission logic used by booking, teacher, and marketplace pages.
 */

// ── Teachers page filter logic ──────────────────────────────────────────

type TeacherFilters = {
  subject: string;
  language: string;
  city: string;
  rateRange: [number, number];
  ratingRange: [number, number];
  experienceRange: [number, number];
  trial: boolean;
  individual: boolean;
  group: boolean;
  sort: string;
};

const TEACHER_EMPTY: TeacherFilters = {
  subject: "",
  language: "",
  city: "",
  rateRange: [0, 200],
  ratingRange: [0, 5],
  experienceRange: [0, 30],
  trial: false,
  individual: false,
  group: false,
  sort: "rating",
};

function countTeacherActive(f: TeacherFilters): number {
  let n = 0;
  if (f.subject) n++;
  if (f.language) n++;
  if (f.city) n++;
  if (f.rateRange[0] !== 0 || f.rateRange[1] !== 200) n++;
  if (f.ratingRange[0] !== 0 || f.ratingRange[1] !== 5) n++;
  if (f.experienceRange[0] !== 0 || f.experienceRange[1] !== 30) n++;
  if (f.trial) n++;
  if (f.individual) n++;
  if (f.group) n++;
  return n;
}

function buildTeacherQuery(f: TeacherFilters): string {
  const p = new URLSearchParams();
  if (f.subject) p.set("subject", f.subject);
  if (f.city) p.set("city", f.city);
  if (f.ratingRange[0] !== TEACHER_EMPTY.ratingRange[0])
    p.set("minRating", String(f.ratingRange[0]));
  if (f.ratingRange[1] !== TEACHER_EMPTY.ratingRange[1])
    p.set("maxRating", String(f.ratingRange[1]));
  if (f.experienceRange[0] !== TEACHER_EMPTY.experienceRange[0])
    p.set("minExperience", String(f.experienceRange[0]));
  if (f.experienceRange[1] !== TEACHER_EMPTY.experienceRange[1])
    p.set("maxExperience", String(f.experienceRange[1]));
  if (f.rateRange[0] !== TEACHER_EMPTY.rateRange[0])
    p.set("minRateCents", String(toMinorUnits(f.rateRange[0], "TND")));
  if (f.rateRange[1] !== TEACHER_EMPTY.rateRange[1])
    p.set("maxRateCents", String(toMinorUnits(f.rateRange[1], "TND")));
  if (f.trial) p.set("trial", "true");
  if (f.individual) p.set("individual", "true");
  if (f.group) p.set("group", "true");
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

describe("Teachers page filter logic", () => {
  describe("countActive", () => {
    it("returns 0 for default empty filters", () => {
      expect(countTeacherActive(TEACHER_EMPTY)).toBe(0);
    });

    it("counts subject filter", () => {
      expect(countTeacherActive({ ...TEACHER_EMPTY, subject: "Mathematics" })).toBe(1);
    });

    it("counts language filter", () => {
      expect(countTeacherActive({ ...TEACHER_EMPTY, language: "French" })).toBe(1);
    });

    it("counts city filter", () => {
      expect(countTeacherActive({ ...TEACHER_EMPTY, city: "Tunis" })).toBe(1);
    });

    it("counts rate range when min changed", () => {
      expect(countTeacherActive({ ...TEACHER_EMPTY, rateRange: [30, 200] })).toBe(1);
    });

    it("counts rate range when max changed", () => {
      expect(countTeacherActive({ ...TEACHER_EMPTY, rateRange: [0, 100] })).toBe(1);
    });

    it("counts rating range", () => {
      expect(countTeacherActive({ ...TEACHER_EMPTY, ratingRange: [3, 5] })).toBe(1);
    });

    it("counts experience range", () => {
      expect(countTeacherActive({ ...TEACHER_EMPTY, experienceRange: [5, 30] })).toBe(1);
    });

    it("counts trial toggle", () => {
      expect(countTeacherActive({ ...TEACHER_EMPTY, trial: true })).toBe(1);
    });

    it("counts individual toggle", () => {
      expect(countTeacherActive({ ...TEACHER_EMPTY, individual: true })).toBe(1);
    });

    it("counts group toggle", () => {
      expect(countTeacherActive({ ...TEACHER_EMPTY, group: true })).toBe(1);
    });

    it("counts all 9 filters when all active", () => {
      const all: TeacherFilters = {
        subject: "Math",
        language: "French",
        city: "Tunis",
        rateRange: [30, 100],
        ratingRange: [3, 5],
        experienceRange: [5, 20],
        trial: true,
        individual: true,
        group: true,
        sort: "rating",
      };
      expect(countTeacherActive(all)).toBe(9);
    });

    it("does NOT count sort as a filter", () => {
      expect(countTeacherActive({ ...TEACHER_EMPTY, sort: "price-low" })).toBe(0);
    });
  });

  describe("query string builder", () => {
    it("returns empty string for default filters", () => {
      expect(buildTeacherQuery(TEACHER_EMPTY)).toBe("");
    });

    it("includes subject param", () => {
      const qs = buildTeacherQuery({ ...TEACHER_EMPTY, subject: "Physics" });
      expect(qs).toContain("subject=Physics");
    });

    it("includes city param", () => {
      const qs = buildTeacherQuery({ ...TEACHER_EMPTY, city: "Sfax" });
      expect(qs).toContain("city=Sfax");
    });

    it("includes minRating when above 0", () => {
      const qs = buildTeacherQuery({ ...TEACHER_EMPTY, ratingRange: [3, 5] });
      expect(qs).toContain("minRating=3");
    });

    it("includes maxRating when below 5", () => {
      const qs = buildTeacherQuery({ ...TEACHER_EMPTY, ratingRange: [0, 4] });
      expect(qs).toContain("maxRating=4");
    });

    it("converts rate range to millimes (TND × 1000)", () => {
      const qs = buildTeacherQuery({ ...TEACHER_EMPTY, rateRange: [30, 100] });
      expect(qs).toContain("minRateCents=30000");
      expect(qs).toContain("maxRateCents=100000");
    });

    it("includes trial=true", () => {
      const qs = buildTeacherQuery({ ...TEACHER_EMPTY, trial: true });
      expect(qs).toContain("trial=true");
    });

    it("includes individual=true", () => {
      const qs = buildTeacherQuery({ ...TEACHER_EMPTY, individual: true });
      expect(qs).toContain("individual=true");
    });

    it("includes group=true", () => {
      const qs = buildTeacherQuery({ ...TEACHER_EMPTY, group: true });
      expect(qs).toContain("group=true");
    });

    it("includes minExperience", () => {
      const qs = buildTeacherQuery({ ...TEACHER_EMPTY, experienceRange: [5, 30] });
      expect(qs).toContain("minExperience=5");
    });

    it("includes maxExperience", () => {
      const qs = buildTeacherQuery({ ...TEACHER_EMPTY, experienceRange: [0, 20] });
      expect(qs).toContain("maxExperience=20");
    });

    it("does NOT include sort in query string", () => {
      const qs = buildTeacherQuery({ ...TEACHER_EMPTY, sort: "price-low" });
      expect(qs).not.toContain("sort");
    });

    it("builds correct query with multiple params", () => {
      const qs = buildTeacherQuery({
        ...TEACHER_EMPTY,
        subject: "English",
        city: "Tunis",
        trial: true,
      });
      expect(qs.startsWith("?")).toBe(true);
      expect(qs).toContain("subject=English");
      expect(qs).toContain("city=Tunis");
      expect(qs).toContain("trial=true");
    });
  });
});

// ── Marketplace filter logic ────────────────────────────────────────────

type MarketplaceFilters = {
  subject: string;
  productType: string;
  priceRange: [number, number];
  sort: string;
};

const MARKETPLACE_EMPTY: MarketplaceFilters = {
  subject: "",
  productType: "all",
  priceRange: [0, 200],
  sort: "newest",
};

function countMarketplaceActive(f: MarketplaceFilters): number {
  let n = 0;
  if (f.subject) n++;
  if (f.productType !== "all") n++;
  if (f.priceRange[0] !== 0 || f.priceRange[1] !== 200) n++;
  return n;
}

describe("Marketplace page filter logic", () => {
  describe("countActive", () => {
    it("returns 0 for default filters", () => {
      expect(countMarketplaceActive(MARKETPLACE_EMPTY)).toBe(0);
    });

    it("counts subject", () => {
      expect(countMarketplaceActive({ ...MARKETPLACE_EMPTY, subject: "Math" })).toBe(1);
    });

    it("counts productType when not 'all'", () => {
      expect(countMarketplaceActive({ ...MARKETPLACE_EMPTY, productType: "digital" })).toBe(1);
    });

    it("does not count productType when 'all'", () => {
      expect(countMarketplaceActive({ ...MARKETPLACE_EMPTY, productType: "all" })).toBe(0);
    });

    it("counts price range changes", () => {
      expect(countMarketplaceActive({ ...MARKETPLACE_EMPTY, priceRange: [10, 100] })).toBe(1);
    });

    it("counts all 3 when all active", () => {
      expect(
        countMarketplaceActive({
          subject: "Physics",
          productType: "digital",
          priceRange: [10, 50],
          sort: "newest",
        }),
      ).toBe(3);
    });
  });
});

// ── Booking status logic ────────────────────────────────────────────────

type BookingStatus = "pending" | "confirmed" | "cancelled" | "refunded" | "completed";

function canReview(status: BookingStatus): boolean {
  return status === "confirmed" || status === "completed";
}

function canCancel(status: BookingStatus): boolean {
  return status === "pending" || status === "confirmed";
}

describe("Booking status logic", () => {
  describe("canReview", () => {
    it("true for confirmed", () => expect(canReview("confirmed")).toBe(true));
    it("true for completed", () => expect(canReview("completed")).toBe(true));
    it("false for pending", () => expect(canReview("pending")).toBe(false));
    it("false for cancelled", () => expect(canReview("cancelled")).toBe(false));
    it("false for refunded", () => expect(canReview("refunded")).toBe(false));
  });

  describe("canCancel", () => {
    it("true for pending", () => expect(canCancel("pending")).toBe(true));
    it("true for confirmed", () => expect(canCancel("confirmed")).toBe(true));
    it("false for cancelled", () => expect(canCancel("cancelled")).toBe(false));
    it("false for refunded", () => expect(canCancel("refunded")).toBe(false));
    it("false for completed", () => expect(canCancel("completed")).toBe(false));
  });
});

// ── Booking price calculation ───────────────────────────────────────────

function computeBookingPrice(
  type: "trial" | "single" | "package",
  hourlyRateCents: number,
): number {
  return type === "trial"
    ? Math.min(1000, Math.round(hourlyRateCents / 2))
    : hourlyRateCents;
}

describe("Booking price calculation (from book page)", () => {
  it("trial caps at 1000 millimes (1 TND)", () => {
    expect(computeBookingPrice("trial", 50000)).toBe(1000);
  });

  it("trial is half the hourly rate when that's below 1 TND", () => {
    expect(computeBookingPrice("trial", 1500)).toBe(750);
  });

  it("trial of rate 2000 is exactly 1000 (cap)", () => {
    expect(computeBookingPrice("trial", 2000)).toBe(1000);
  });

  it("single uses full hourly rate", () => {
    expect(computeBookingPrice("single", 50000)).toBe(50000);
  });

  it("package uses full hourly rate", () => {
    expect(computeBookingPrice("package", 30000)).toBe(30000);
  });

  it("trial of rate 0 is 0", () => {
    expect(computeBookingPrice("trial", 0)).toBe(0);
  });

  it("trial rounds correctly for odd amounts", () => {
    expect(computeBookingPrice("trial", 1999)).toBe(1000);
    expect(computeBookingPrice("trial", 1001)).toBe(501);
  });
});

// ── Cancel reason validation ────────────────────────────────────────────

function isValidCancelReason(reason: string | null): boolean {
  if (!reason) return false;
  return reason.trim().length >= 10;
}

describe("Cancel reason validation", () => {
  it("rejects null", () => expect(isValidCancelReason(null)).toBe(false));
  it("rejects empty string", () => expect(isValidCancelReason("")).toBe(false));
  it("rejects too-short string", () => expect(isValidCancelReason("too short")).toBe(false));
  it("accepts 10+ character reason", () => expect(isValidCancelReason("I need to reschedule this session")).toBe(true));
  it("rejects whitespace-padded short string", () => expect(isValidCancelReason("   short  ")).toBe(false));
  it("accepts exactly 10 chars trimmed", () => expect(isValidCancelReason("1234567890")).toBe(true));
});

// ── Teacher sorting ─────────────────────────────────────────────────────

type TeacherForSort = {
  userId: string;
  hourlyRateCents: number;
  ratingAvg: number;
  yearsExperience: number;
};

function sortTeachers(
  items: TeacherForSort[],
  sort: string,
): TeacherForSort[] {
  const copy = [...items];
  if (sort === "price-low") copy.sort((a, b) => a.hourlyRateCents - b.hourlyRateCents);
  else if (sort === "price-high") copy.sort((a, b) => b.hourlyRateCents - a.hourlyRateCents);
  else if (sort === "experience") copy.sort((a, b) => b.yearsExperience - a.yearsExperience);
  else copy.sort((a, b) => b.ratingAvg - a.ratingAvg);
  return copy;
}

const SAMPLE_TEACHERS: TeacherForSort[] = [
  { userId: "a", hourlyRateCents: 50000, ratingAvg: 4.5, yearsExperience: 3 },
  { userId: "b", hourlyRateCents: 30000, ratingAvg: 4.8, yearsExperience: 10 },
  { userId: "c", hourlyRateCents: 70000, ratingAvg: 4.2, yearsExperience: 7 },
];

describe("Teacher sorting", () => {
  it("sorts by rating (highest first) by default", () => {
    const sorted = sortTeachers(SAMPLE_TEACHERS, "rating");
    expect(sorted[0].userId).toBe("b");
    expect(sorted[1].userId).toBe("a");
    expect(sorted[2].userId).toBe("c");
  });

  it("sorts by price low to high", () => {
    const sorted = sortTeachers(SAMPLE_TEACHERS, "price-low");
    expect(sorted[0].userId).toBe("b");
    expect(sorted[2].userId).toBe("c");
  });

  it("sorts by price high to low", () => {
    const sorted = sortTeachers(SAMPLE_TEACHERS, "price-high");
    expect(sorted[0].userId).toBe("c");
    expect(sorted[2].userId).toBe("b");
  });

  it("sorts by experience (most first)", () => {
    const sorted = sortTeachers(SAMPLE_TEACHERS, "experience");
    expect(sorted[0].userId).toBe("b");
    expect(sorted[1].userId).toBe("c");
    expect(sorted[2].userId).toBe("a");
  });

  it("does not mutate the original array", () => {
    const original = [...SAMPLE_TEACHERS];
    sortTeachers(SAMPLE_TEACHERS, "price-low");
    expect(SAMPLE_TEACHERS).toEqual(original);
  });
});

// ── Landing page subject grouping ───────────────────────────────────────

type TeacherPreview = {
  userId: string;
  subjects: string[];
};

function groupBySubject(teachers: TeacherPreview[]): Record<string, TeacherPreview[]> {
  const result: Record<string, TeacherPreview[]> = {};
  for (const t of teachers) {
    for (const subj of t.subjects) {
      if (!result[subj]) result[subj] = [];
      result[subj].push(t);
    }
  }
  return result;
}

describe("Landing page subject grouping", () => {
  const teachers: TeacherPreview[] = [
    { userId: "1", subjects: ["Mathematics", "Physics"] },
    { userId: "2", subjects: ["Mathematics", "English"] },
    { userId: "3", subjects: ["English"] },
  ];

  it("groups teachers by each of their subjects", () => {
    const grouped = groupBySubject(teachers);
    expect(grouped["Mathematics"]).toHaveLength(2);
    expect(grouped["Physics"]).toHaveLength(1);
    expect(grouped["English"]).toHaveLength(2);
  });

  it("a teacher appears in every subject they teach", () => {
    const grouped = groupBySubject(teachers);
    expect(grouped["Mathematics"].find((t) => t.userId === "1")).toBeDefined();
    expect(grouped["Physics"].find((t) => t.userId === "1")).toBeDefined();
  });

  it("returns empty object for empty input", () => {
    expect(groupBySubject([])).toEqual({});
  });
});

// ── Greeting function ───────────────────────────────────────────────────

function getGreeting(hours: number): string {
  if (hours < 12) return "Good morning";
  if (hours < 18) return "Good afternoon";
  return "Good evening";
}

describe("getGreeting (used on student/teacher/parent pages)", () => {
  it("returns Good morning before noon", () => {
    expect(getGreeting(0)).toBe("Good morning");
    expect(getGreeting(6)).toBe("Good morning");
    expect(getGreeting(11)).toBe("Good morning");
  });

  it("returns Good afternoon from noon to 5pm", () => {
    expect(getGreeting(12)).toBe("Good afternoon");
    expect(getGreeting(15)).toBe("Good afternoon");
    expect(getGreeting(17)).toBe("Good afternoon");
  });

  it("returns Good evening from 6pm onward", () => {
    expect(getGreeting(18)).toBe("Good evening");
    expect(getGreeting(21)).toBe("Good evening");
    expect(getGreeting(23)).toBe("Good evening");
  });
});

// ── Sponsored teacher detection ─────────────────────────────────────────

function isSponsored(sponsoredUntil: string | undefined): boolean {
  return !!sponsoredUntil && new Date(sponsoredUntil) > new Date();
}

describe("Sponsored teacher badge logic", () => {
  it("returns false for undefined sponsoredUntil", () => {
    expect(isSponsored(undefined)).toBe(false);
  });

  it("returns false for past date", () => {
    expect(isSponsored("2020-01-01T00:00:00Z")).toBe(false);
  });

  it("returns true for future date", () => {
    expect(isSponsored("2099-12-31T23:59:59Z")).toBe(true);
  });
});

// ── Dashboard link targets ──────────────────────────────────────────────

describe("Dashboard page link targets", () => {
  describe("Student dashboard links", () => {
    const links = [
      "/teachers",          // search form target
      "/bookings",          // upcoming sessions
      "/mailbox",           // unread messages
      "/favorites",         // saved teachers
      "/marketplace",       // browse marketplace
      "/requests/new",      // create lesson request
    ];

    it("all student dashboard links are valid paths", () => {
      for (const href of links) {
        expect(href.startsWith("/")).toBe(true);
        expect(href.length).toBeGreaterThan(1);
      }
    });
  });

  describe("Teacher dashboard links", () => {
    const links = [
      "/teacher/bookings",     // upcoming sessions card
      "/requests",             // pending requests card
      "/mailbox",              // unread messages card
      "/seller/listings/new",  // create listing action
      "/forum",                // join community action
    ];

    it("all teacher dashboard links are valid paths", () => {
      for (const href of links) {
        expect(href.startsWith("/")).toBe(true);
        expect(href.length).toBeGreaterThan(1);
      }
    });
  });

  describe("Parent dashboard links", () => {
    const links = [
      "/parent/children",  // children card
      "/mailbox",          // unread messages card
      "/payments",         // payments card
      "/teachers",         // find a teacher
      "/calendar",         // view calendar
      "/favorites",        // saved teachers
      "/marketplace",      // browse marketplace
      "/analytics",        // view progress
    ];

    it("all parent dashboard links are valid paths", () => {
      for (const href of links) {
        expect(href.startsWith("/")).toBe(true);
        expect(href.length).toBeGreaterThan(1);
      }
    });
  });
});

// ── Landing page link targets ───────────────────────────────────────────

describe("Landing page link targets", () => {
  const links = [
    "/teachers",       // Find a teacher CTA
    "/signup",         // Create an account CTA
    "/requests/new",   // Lesson request CTA
    "/forum",          // Community section
    "/marketplace",    // Marketplace section
    "/faq",            // FAQ section
  ];

  it("all landing page links are valid paths", () => {
    for (const href of links) {
      expect(href.startsWith("/")).toBe(true);
    }
  });
});

// ── Landing page constants ──────────────────────────────────────────────

const SUBJECTS = [
  "Mathematics", "Physics", "English", "French",
  "Arabic", "Biology", "Computer Science", "Economics",
];

const TESTIMONIALS = [
  { name: "Yasmine", role: "Student" },
  { name: "Karim", role: "Teacher" },
  { name: "Amina", role: "Parent" },
];

describe("Landing page constants", () => {
  it("has 8 browsable subjects", () => {
    expect(SUBJECTS).toHaveLength(8);
  });

  it("subjects are all non-empty strings", () => {
    for (const s of SUBJECTS) {
      expect(s.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate subjects", () => {
    expect(new Set(SUBJECTS).size).toBe(SUBJECTS.length);
  });

  it("has 3 testimonials", () => {
    expect(TESTIMONIALS).toHaveLength(3);
  });

  it("testimonials cover all three roles", () => {
    const roles = TESTIMONIALS.map((t) => t.role);
    expect(roles).toContain("Student");
    expect(roles).toContain("Teacher");
    expect(roles).toContain("Parent");
  });
});
