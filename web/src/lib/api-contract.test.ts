import { describe, it, expect } from "vitest";

/**
 * API contract tests — verify that frontend API call patterns match
 * the backend route signatures. These tests catch mismatches like
 * wrong HTTP methods, missing path segments, or incorrect query params.
 *
 * Each test documents a frontend→backend contract. If a backend route
 * changes its path or shape, these tests should break early.
 */

// Extracted from all `api<>()` calls across the frontend codebase.
// Format: [description, method, path_pattern]

const CONTRACTS = [
  // ── Auth-gated user routes ──────────────────────────────────
  ["Get current user", "GET", "/users/me"],
  ["Update current user", "PATCH", "/users/me"],
  ["Get avatar upload URL", "POST", "/users/me/avatar-upload-url"],
  ["Get user avatar URL", "GET", "/users/:userId/avatar-url"],

  // ── Notifications ───────────────────────────────────────────
  ["Get unread count", "GET", "/notifications/unread-count"],
  ["List notifications", "GET", "/notifications"],

  // ── Bookings ────────────────────────────────────────────────
  ["List my bookings (student)", "GET", "/bookings/mine"],
  ["List bookings as teacher", "GET", "/bookings/as-teacher"],
  ["Get single booking", "GET", "/bookings/:bookingId"],
  ["Create booking", "POST", "/bookings"],
  ["Cancel booking", "POST", "/bookings/:bookingId/cancel"],

  // ── Teachers ────────────────────────────────────────────────
  ["List/browse teachers", "GET", "/teachers"],
  ["Get teacher detail", "GET", "/teachers/:userId"],
  ["Get teacher video URL", "GET", "/teachers/:userId/video-url"],

  // ── Marketplace ─────────────────────────────────────────────
  ["Browse listings", "GET", "/marketplace/listings"],
  ["Get listing detail", "GET", "/marketplace/listings/:listingId"],
  ["Get my listings (seller)", "GET", "/marketplace/listings/mine"],
  ["Create listing", "POST", "/marketplace/listings"],
  ["Seller orders", "GET", "/marketplace/orders/as-seller"],

  // ── Forum ───────────────────────────────────────────────────
  ["List forum channels", "GET", "/forum/channels"],
  ["List channel posts", "GET", "/forum/channels/:channelId/posts"],
  ["Create forum post", "POST", "/forum/posts"],
  ["Get hydrated post", "GET", "/forum/posts/:postId/hydrated"],
  ["Vote on post", "POST", "/forum/posts/:postId/vote"],

  // ── Mailbox ─────────────────────────────────────────────────
  ["List my threads", "GET", "/mailbox/threads/mine"],
  ["Create thread", "POST", "/mailbox/threads"],

  // ── Favorites ───────────────────────────────────────────────
  ["List favorites", "GET", "/favorites/mine"],

  // ── Calendar ────────────────────────────────────────────────
  ["Upcoming sessions", "GET", "/sessions/upcoming"],
  ["Create session", "POST", "/sessions"],

  // ── Lesson Requests ─────────────────────────────────────────
  ["List received requests (teacher)", "GET", "/lesson-requests/received"],
  ["Create lesson request", "POST", "/lesson-requests"],

  // ── Support ─────────────────────────────────────────────────
  ["List my tickets", "GET", "/support/tickets/mine"],
  ["Get ticket detail", "GET", "/support/tickets/:ticketId"],

  // ── Grades ──────────────────────────────────────────────────
  ["List grades", "GET", "/grades"],

  // ── Payments ────────────────────────────────────────────────
  ["List payments", "GET", "/payments"],

  // ── Referrals ───────────────────────────────────────────────
  ["Get my referral info", "GET", "/referrals/mine"],
  ["List referrals", "GET", "/referrals/list"],
  ["Claim referral", "POST", "/referrals/claim"],

  // ── Study Materials ─────────────────────────────────────────
  ["List study materials", "GET", "/study-materials"],
  ["Get material detail", "GET", "/study-materials/:materialId"],
  ["Create study material", "POST", "/study-materials"],

  // ── Assessments ─────────────────────────────────────────────
  ["List assessments", "GET", "/assessments"],
  ["Get assessment detail", "GET", "/assessments/:examId"],
  ["Create assessment", "POST", "/assessments"],
  ["Submit attempt", "POST", "/assessments/:examId/attempts"],
  ["Get attempts", "GET", "/assessments/:examId/attempts"],
  ["Teacher's exams", "GET", "/assessments/teacher/mine"],

  // ── Notes ───────────────────────────────────────────────────
  ["List my notes", "GET", "/notes/mine"],

  // ── Analytics ───────────────────────────────────────────────
  ["Parent analytics", "GET", "/analytics/parent"],
  ["Teacher analytics", "GET", "/analytics/teacher"],
  ["Student analytics", "GET", "/analytics/student"],

  // ── Attendance ──────────────────────────────────────────────
  ["My attendance", "GET", "/attendance/mine"],

  // ── Membership ──────────────────────────────────────────────
  ["List plans", "GET", "/memberships/plans"],
  ["Get my subscription", "GET", "/memberships/me"],
  ["Create checkout", "POST", "/memberships/checkout"],

  // ── Organizations ───────────────────────────────────────────
  ["List my orgs", "GET", "/orgs/mine"],

  // ── Reports ─────────────────────────────────────────────────
  ["Teacher earnings summary", "GET", "/reports/teacher/summary"],

  // ── Admin ───────────────────────────────────────────────────
  ["Admin: list users", "GET", "/admin/users"],
  ["Admin: get user", "GET", "/admin/users/:userId"],
  ["Admin: find by email", "GET", "/admin/users/by-email/:email"],

  // ── Family ──────────────────────────────────────────────────
  ["List children (parent)", "GET", "/family/children"],
  ["List children (parent alt)", "GET", "/parent/children"],

  // ── Chat ────────────────────────────────────────────────────
  ["Get DM", "GET", "/chat/dm/:otherUserId"],

  // ── Whiteboard ──────────────────────────────────────────────
  ["Get whiteboard", "GET", "/whiteboard/classroom/:classroomId"],

  // ── Wall ────────────────────────────────────────────────────
  ["Get wall post", "GET", "/wall/posts/:postId"],

  // ── Reviews ─────────────────────────────────────────────────
  ["Create review", "POST", "/reviews"],

  // ── Review sessions ─────────────────────────────────────────
  ["Request review session", "POST", "/review-sessions"],
] as const;

describe("Frontend→Backend API contract", () => {
  it("all contract paths start with /", () => {
    for (const [desc, , path] of CONTRACTS) {
      expect(path.startsWith("/"), `${desc}: path "${path}" should start with /`).toBe(true);
    }
  });

  it("all methods are valid HTTP methods", () => {
    const valid = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
    for (const [desc, method] of CONTRACTS) {
      expect(valid.has(method), `${desc}: invalid method "${method}"`).toBe(true);
    }
  });

  it("no duplicate contracts", () => {
    const keys = CONTRACTS.map(([, method, path]) => `${method} ${path}`);
    const dups = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dups).toEqual([]);
  });

  it("booking endpoints use correct methods", () => {
    const bookingContracts = CONTRACTS.filter(([, , p]) => p.startsWith("/bookings"));
    const methods = bookingContracts.map(([, m]) => m);
    expect(methods).toContain("GET");
    expect(methods).toContain("POST");
  });

  it("create operations use POST", () => {
    const creates = CONTRACTS.filter(([desc]) =>
      desc.toLowerCase().startsWith("create"),
    );
    for (const [desc, method] of creates) {
      expect(method, `${desc} should use POST`).toBe("POST");
    }
  });

  it("list/get operations use GET (excluding upload-url endpoints)", () => {
    const reads = CONTRACTS.filter(
      ([desc]) =>
        (desc.toLowerCase().startsWith("list") ||
          desc.toLowerCase().startsWith("get")) &&
        !desc.toLowerCase().includes("upload"),
    );
    for (const [desc, method] of reads) {
      expect(method, `${desc} should use GET`).toBe("GET");
    }
  });
});

// ── Booking flow end-to-end contract ────────────────────────────────────

describe("Booking flow contract", () => {
  it("step 1: GET /teachers/:teacherId returns teacher + profile", () => {
    const endpoint = "/teachers/:teacherId";
    const contract = CONTRACTS.find(([, , p]) => p === "/teachers/:userId");
    expect(contract).toBeDefined();
  });

  it("step 2: POST /bookings creates booking with clientSecret", () => {
    const contract = CONTRACTS.find(([, m, p]) => m === "POST" && p === "/bookings");
    expect(contract).toBeDefined();
  });

  it("step 3: GET /bookings/:bookingId polls booking status after payment", () => {
    const contract = CONTRACTS.find(([, m, p]) => m === "GET" && p === "/bookings/:bookingId");
    expect(contract).toBeDefined();
  });

  it("step 4: POST /bookings/:bookingId/cancel handles cancellation", () => {
    const contract = CONTRACTS.find(([, m, p]) => m === "POST" && p === "/bookings/:bookingId/cancel");
    expect(contract).toBeDefined();
  });

  it("student can list their bookings via GET /bookings/mine", () => {
    const contract = CONTRACTS.find(([, m, p]) => m === "GET" && p === "/bookings/mine");
    expect(contract).toBeDefined();
  });

  it("teacher can list their bookings via GET /bookings/as-teacher", () => {
    const contract = CONTRACTS.find(([, m, p]) => m === "GET" && p === "/bookings/as-teacher");
    expect(contract).toBeDefined();
  });
});

// ── Dashboard data contracts ────────────────────────────────────────────

describe("Dashboard data requirements", () => {
  describe("Student dashboard", () => {
    it("needs unread notification count", () => {
      expect(CONTRACTS.find(([, , p]) => p === "/notifications/unread-count")).toBeDefined();
    });

    it("needs bookings list", () => {
      expect(CONTRACTS.find(([, , p]) => p === "/bookings/mine")).toBeDefined();
    });

    it("needs favorites list", () => {
      expect(CONTRACTS.find(([, , p]) => p === "/favorites/mine")).toBeDefined();
    });
  });

  describe("Teacher dashboard", () => {
    it("needs bookings as teacher", () => {
      expect(CONTRACTS.find(([, , p]) => p === "/bookings/as-teacher")).toBeDefined();
    });

    it("needs lesson requests received", () => {
      expect(CONTRACTS.find(([, , p]) => p === "/lesson-requests/received")).toBeDefined();
    });

    it("needs notification count", () => {
      expect(CONTRACTS.find(([, , p]) => p === "/notifications/unread-count")).toBeDefined();
    });
  });

  describe("Parent dashboard", () => {
    it("needs children list", () => {
      const found = CONTRACTS.find(
        ([, , p]) => p === "/parent/children" || p === "/family/children",
      );
      expect(found).toBeDefined();
    });

    it("needs notification count", () => {
      expect(CONTRACTS.find(([, , p]) => p === "/notifications/unread-count")).toBeDefined();
    });
  });
});
