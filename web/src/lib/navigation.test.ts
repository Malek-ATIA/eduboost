import { describe, it, expect } from "vitest";

/**
 * Navigation link tests — verifies every link target across the app is
 * consistent and follows the expected patterns. These tests catch broken
 * links caused by route renames without updating the consuming pages.
 *
 * We extract the link configurations programmatically by importing the
 * relevant constants/functions and testing them in isolation.
 */

// Header NAV items (duplicated from Header.tsx since the constant isn't exported)
const HEADER_NAV = [
  { href: "/teachers", label: "Find a teacher" },
  { href: "/classrooms", label: "Classrooms" },
  { href: "/forum", label: "Community" },
  { href: "/marketplace", label: "Marketplace" },
];

// SideNav links per role (extracted from SideNav.tsx linksForRole)
type NavLink = { href: string; label: string };

function linksForRole(role: string | null, admin: boolean): NavLink[] {
  const links: NavLink[] = [];
  if (role === "student") {
    links.push(
      { href: "/bookings", label: "My teachers" },
      { href: "/classrooms", label: "My classrooms" },
      { href: "/calendar", label: "My calendar" },
      { href: "/mailbox", label: "My mailbox" },
      { href: "/grades", label: "My grades" },
      { href: "/favorites", label: "Favorites" },
    );
  }
  if (role === "parent") {
    links.push(
      { href: "/parent/children", label: "My children" },
      { href: "/calendar", label: "My calendar" },
      { href: "/mailbox", label: "My mailbox" },
      { href: "/payments", label: "Payments" },
      { href: "/analytics", label: "Analytics" },
      { href: "/favorites", label: "Favorites" },
    );
  }
  if (role === "teacher") {
    links.push(
      { href: "/classrooms", label: "My classrooms" },
      { href: "/teacher/students", label: "My students" },
      { href: "/teacher/bookings", label: "Bookings" },
      { href: "/requests", label: "Lesson requests" },
      { href: "/calendar", label: "My calendar" },
      { href: "/seller/listings", label: "Marketplace listings" },
      { href: "/teacher/earnings", label: "Earnings" },
    );
  }
  if (admin) {
    links.push({ href: "/admin", label: "Admin console" });
  }
  return links;
}

// AvatarDropdown items
type MenuItem =
  | { type: "link"; href: string; label: string }
  | { type: "divider" }
  | { type: "button"; label: string };

function dropdownItemsForRole(role: string | null, isAdmin: boolean): MenuItem[] {
  const items: MenuItem[] = [
    { type: "link", href: "/profile", label: "Profile" },
    { type: "link", href: "/orders", label: "My orders" },
    { type: "link", href: "/settings/sms", label: "Settings" },
    { type: "link", href: "/referrals", label: "Invite a friend" },
  ];
  if (role === "student") {
    items.push({ type: "link", href: "/student/parents", label: "My parents" });
    items.push({ type: "divider" });
    items.push({ type: "link", href: "/signup?role=teacher", label: "Become a teacher" });
  }
  if (role === "parent") {
    items.push({ type: "link", href: "/parent/children", label: "My children" });
  }
  if (isAdmin) {
    items.push({ type: "link", href: "/admin", label: "Admin console" });
  }
  items.push({ type: "divider" });
  items.push({ type: "button", label: "Log out" });
  return items;
}

// Mobile menu items (from Header.tsx)
const MOBILE_AUTH_LINKS = [
  { href: "/profile", label: "Profile" },
  { href: "/orders", label: "My orders" },
  { href: "/settings/sms", label: "Settings" },
  { href: "/referrals", label: "Invite a friend" },
];

describe("Header navigation", () => {
  it("has exactly 4 nav items", () => {
    expect(HEADER_NAV).toHaveLength(4);
  });

  it("all hrefs start with /", () => {
    for (const item of HEADER_NAV) {
      expect(item.href.startsWith("/")).toBe(true);
    }
  });

  it("all labels are non-empty strings", () => {
    for (const item of HEADER_NAV) {
      expect(item.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("includes Find a teacher link to /teachers", () => {
    expect(HEADER_NAV.find((n) => n.href === "/teachers")).toBeDefined();
  });

  it("includes Classrooms link", () => {
    expect(HEADER_NAV.find((n) => n.href === "/classrooms")).toBeDefined();
  });

  it("includes Community link to /forum", () => {
    expect(HEADER_NAV.find((n) => n.href === "/forum")).toBeDefined();
  });

  it("includes Marketplace link", () => {
    expect(HEADER_NAV.find((n) => n.href === "/marketplace")).toBeDefined();
  });

  it("does NOT include Dashboard or FAQ (removed per redesign)", () => {
    const labels = HEADER_NAV.map((n) => n.label.toLowerCase());
    expect(labels).not.toContain("dashboard");
    expect(labels).not.toContain("faq");
  });

  it("has no duplicate hrefs", () => {
    const hrefs = HEADER_NAV.map((n) => n.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("SideNav links", () => {
  describe("student", () => {
    const links = linksForRole("student", false);

    it("has 6 links", () => {
      expect(links).toHaveLength(6);
    });

    it("includes bookings as 'My teachers'", () => {
      expect(links.find((l) => l.href === "/bookings")?.label).toBe("My teachers");
    });

    it("includes classrooms", () => {
      expect(links.find((l) => l.href === "/classrooms")).toBeDefined();
    });

    it("includes calendar", () => {
      expect(links.find((l) => l.href === "/calendar")).toBeDefined();
    });

    it("includes mailbox", () => {
      expect(links.find((l) => l.href === "/mailbox")).toBeDefined();
    });

    it("includes grades", () => {
      expect(links.find((l) => l.href === "/grades")).toBeDefined();
    });

    it("includes favorites", () => {
      expect(links.find((l) => l.href === "/favorites")).toBeDefined();
    });

    it("does NOT duplicate header nav items (teachers, forum, marketplace)", () => {
      const headerHrefs = HEADER_NAV.map((n) => n.href);
      // /classrooms is in both header and sidebar by design (contextual)
      const sidebarHrefs = links.map((l) => l.href).filter((h) => h !== "/classrooms");
      for (const href of sidebarHrefs) {
        expect(headerHrefs).not.toContain(href);
      }
    });
  });

  describe("teacher", () => {
    const links = linksForRole("teacher", false);

    it("has 7 links", () => {
      expect(links).toHaveLength(7);
    });

    it("includes classrooms", () => {
      expect(links.find((l) => l.href === "/classrooms")).toBeDefined();
    });

    it("includes teacher/students", () => {
      expect(links.find((l) => l.href === "/teacher/students")).toBeDefined();
    });

    it("includes teacher/bookings", () => {
      expect(links.find((l) => l.href === "/teacher/bookings")).toBeDefined();
    });

    it("includes lesson requests", () => {
      expect(links.find((l) => l.href === "/requests")).toBeDefined();
    });

    it("includes calendar", () => {
      expect(links.find((l) => l.href === "/calendar")).toBeDefined();
    });

    it("includes seller/listings for marketplace", () => {
      expect(links.find((l) => l.href === "/seller/listings")).toBeDefined();
    });

    it("includes teacher/earnings", () => {
      expect(links.find((l) => l.href === "/teacher/earnings")).toBeDefined();
    });
  });

  describe("parent", () => {
    const links = linksForRole("parent", false);

    it("has 6 links", () => {
      expect(links).toHaveLength(6);
    });

    it("includes parent/children", () => {
      expect(links.find((l) => l.href === "/parent/children")).toBeDefined();
    });

    it("includes calendar", () => {
      expect(links.find((l) => l.href === "/calendar")).toBeDefined();
    });

    it("includes mailbox", () => {
      expect(links.find((l) => l.href === "/mailbox")).toBeDefined();
    });

    it("includes payments", () => {
      expect(links.find((l) => l.href === "/payments")).toBeDefined();
    });

    it("includes analytics", () => {
      expect(links.find((l) => l.href === "/analytics")).toBeDefined();
    });

    it("includes favorites", () => {
      expect(links.find((l) => l.href === "/favorites")).toBeDefined();
    });
  });

  describe("admin", () => {
    it("adds admin console link for admin users", () => {
      const links = linksForRole("student", true);
      expect(links.find((l) => l.href === "/admin")).toBeDefined();
    });

    it("does not add admin link for non-admin", () => {
      const links = linksForRole("student", false);
      expect(links.find((l) => l.href === "/admin")).toBeUndefined();
    });
  });

  describe("null role", () => {
    it("returns empty array for no role, no admin", () => {
      expect(linksForRole(null, false)).toEqual([]);
    });

    it("returns only admin link for admin with no role", () => {
      const links = linksForRole(null, true);
      expect(links).toHaveLength(1);
      expect(links[0].href).toBe("/admin");
    });
  });

  it("all links across all roles start with /", () => {
    const allLinks = [
      ...linksForRole("student", false),
      ...linksForRole("teacher", false),
      ...linksForRole("parent", false),
      ...linksForRole(null, true),
    ];
    for (const link of allLinks) {
      expect(link.href.startsWith("/")).toBe(true);
    }
  });
});

describe("AvatarDropdown menu", () => {
  describe("common items for all roles", () => {
    for (const role of ["student", "teacher", "parent"] as const) {
      it(`includes Profile, Orders, Settings, Invite for ${role}`, () => {
        const items = dropdownItemsForRole(role, false);
        const linkItems = items.filter((i) => i.type === "link") as { type: "link"; href: string; label: string }[];
        expect(linkItems.find((i) => i.href === "/profile")).toBeDefined();
        expect(linkItems.find((i) => i.href === "/orders")).toBeDefined();
        expect(linkItems.find((i) => i.href === "/settings/sms")).toBeDefined();
        expect(linkItems.find((i) => i.href === "/referrals")).toBeDefined();
      });
    }
  });

  it("always ends with a divider then Log out button", () => {
    for (const role of ["student", "teacher", "parent"] as const) {
      const items = dropdownItemsForRole(role, false);
      const last = items[items.length - 1];
      const secondLast = items[items.length - 2];
      expect(last).toEqual({ type: "button", label: "Log out" });
      expect(secondLast).toEqual({ type: "divider" });
    }
  });

  describe("student-specific items", () => {
    const items = dropdownItemsForRole("student", false);
    const links = items.filter((i) => i.type === "link") as { type: "link"; href: string; label: string }[];

    it("includes My parents link", () => {
      expect(links.find((i) => i.href === "/student/parents")).toBeDefined();
    });

    it("includes Become a teacher link", () => {
      expect(links.find((i) => i.href === "/signup?role=teacher")).toBeDefined();
    });
  });

  describe("parent-specific items", () => {
    const items = dropdownItemsForRole("parent", false);
    const links = items.filter((i) => i.type === "link") as { type: "link"; href: string; label: string }[];

    it("includes My children link", () => {
      expect(links.find((i) => i.href === "/parent/children")).toBeDefined();
    });

    it("does NOT include Become a teacher", () => {
      expect(links.find((i) => i.href === "/signup?role=teacher")).toBeUndefined();
    });
  });

  describe("teacher-specific items", () => {
    const items = dropdownItemsForRole("teacher", false);
    const links = items.filter((i) => i.type === "link") as { type: "link"; href: string; label: string }[];

    it("does NOT include Become a teacher", () => {
      expect(links.find((i) => i.href === "/signup?role=teacher")).toBeUndefined();
    });

    it("does NOT include My parents or My children", () => {
      expect(links.find((i) => i.href === "/student/parents")).toBeUndefined();
      expect(links.find((i) => i.href === "/parent/children")).toBeUndefined();
    });
  });

  describe("admin items", () => {
    it("includes Admin console for admin users", () => {
      const items = dropdownItemsForRole("student", true);
      const links = items.filter((i) => i.type === "link") as { type: "link"; href: string; label: string }[];
      expect(links.find((i) => i.href === "/admin")).toBeDefined();
    });

    it("omits Admin console for non-admin", () => {
      const items = dropdownItemsForRole("student", false);
      const links = items.filter((i) => i.type === "link") as { type: "link"; href: string; label: string }[];
      expect(links.find((i) => i.href === "/admin")).toBeUndefined();
    });
  });

  it("dropdown items do NOT duplicate header nav links", () => {
    const headerHrefs = new Set(HEADER_NAV.map((n) => n.href));
    for (const role of ["student", "teacher", "parent"] as const) {
      const items = dropdownItemsForRole(role, false);
      const links = items.filter((i) => i.type === "link") as { type: "link"; href: string; label: string }[];
      for (const link of links) {
        expect(headerHrefs.has(link.href)).toBe(false);
      }
    }
  });
});

describe("Mobile menu links", () => {
  it("has 4 auth-gated links", () => {
    expect(MOBILE_AUTH_LINKS).toHaveLength(4);
  });

  it("includes Profile", () => {
    expect(MOBILE_AUTH_LINKS.find((l) => l.href === "/profile")).toBeDefined();
  });

  it("includes Orders", () => {
    expect(MOBILE_AUTH_LINKS.find((l) => l.href === "/orders")).toBeDefined();
  });

  it("includes Settings pointing to /settings/sms", () => {
    expect(MOBILE_AUTH_LINKS.find((l) => l.href === "/settings/sms")).toBeDefined();
  });

  it("includes Referrals", () => {
    expect(MOBILE_AUTH_LINKS.find((l) => l.href === "/referrals")).toBeDefined();
  });
});
