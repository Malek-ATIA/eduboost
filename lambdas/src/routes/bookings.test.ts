import { describe, it, expect } from "vitest";
import { z } from "zod";
import { MIN_PRICE_CENTS } from "../lib/stripe.js";

/**
 * Booking route validation tests. These test the Zod schemas and business
 * logic that gate booking creation and cancellation, without needing to
 * start an HTTP server or mock DynamoDB.
 */

// ── Booking creation schema (mirror of bookings.ts createSchema) ────────

const createSchema = z.object({
  teacherId: z.string().min(1),
  classroomId: z.string().optional(),
  type: z.enum(["trial", "single", "package"]),
  amountCents: z
    .number()
    .int()
    .refine((v) => v === 0 || v >= MIN_PRICE_CENTS, {
      message: `amountCents below platform minimum of ${MIN_PRICE_CENTS}`,
    }),
  currency: z.string().length(3).default("TND"),
});

// ── Cancel reason schema (mirror of bookings.ts cancelSchema) ───────────

const cancelSchema = z.object({
  reason: z.string().trim().min(10).max(1000),
});

describe("Booking creation schema", () => {
  describe("teacherId", () => {
    it("accepts a non-empty string", () => {
      const body = { teacherId: "t_abc123", type: "single", amountCents: 50000, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(true);
    });

    it("rejects empty teacherId", () => {
      const body = { teacherId: "", type: "single", amountCents: 50000, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(false);
    });

    it("rejects missing teacherId", () => {
      const body = { type: "single", amountCents: 50000, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(false);
    });
  });

  describe("classroomId", () => {
    it("is optional", () => {
      const body = { teacherId: "t_1", type: "single", amountCents: 50000, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(true);
    });

    it("accepts a string when provided", () => {
      const body = { teacherId: "t_1", classroomId: "cls_1", type: "single", amountCents: 50000, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(true);
    });
  });

  describe("type", () => {
    it("accepts trial", () => {
      const body = { teacherId: "t_1", type: "trial", amountCents: 0, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(true);
    });

    it("accepts single", () => {
      const body = { teacherId: "t_1", type: "single", amountCents: 50000, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(true);
    });

    it("accepts package", () => {
      const body = { teacherId: "t_1", type: "package", amountCents: 50000, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(true);
    });

    it("rejects unknown type", () => {
      const body = { teacherId: "t_1", type: "group", amountCents: 50000, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(false);
    });

    it("rejects missing type", () => {
      const body = { teacherId: "t_1", amountCents: 50000, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(false);
    });
  });

  describe("amountCents", () => {
    it("accepts 0 (free trial)", () => {
      const body = { teacherId: "t_1", type: "trial", amountCents: 0, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(true);
    });

    it(`accepts exactly ${MIN_PRICE_CENTS} (minimum)`, () => {
      const body = { teacherId: "t_1", type: "single", amountCents: MIN_PRICE_CENTS, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(true);
    });

    it("accepts amount above minimum", () => {
      const body = { teacherId: "t_1", type: "single", amountCents: 100000, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(true);
    });

    it("rejects amount between 1 and minimum (non-zero below floor)", () => {
      const body = { teacherId: "t_1", type: "single", amountCents: MIN_PRICE_CENTS - 1, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(false);
    });

    it("rejects 1 millime (below minimum, non-zero)", () => {
      const body = { teacherId: "t_1", type: "single", amountCents: 1, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(false);
    });

    it("rejects floating point amounts", () => {
      const body = { teacherId: "t_1", type: "single", amountCents: 5000.5, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(false);
    });

    it("rejects negative amounts", () => {
      const body = { teacherId: "t_1", type: "single", amountCents: -1000, currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(false);
    });

    it("rejects string amounts", () => {
      const body = { teacherId: "t_1", type: "single", amountCents: "50000", currency: "TND" };
      expect(createSchema.safeParse(body).success).toBe(false);
    });
  });

  describe("currency", () => {
    it("defaults to TND when omitted", () => {
      const body = { teacherId: "t_1", type: "single", amountCents: 50000 };
      const parsed = createSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.currency).toBe("TND");
    });

    it("accepts 3-letter currency code", () => {
      const body = { teacherId: "t_1", type: "single", amountCents: 50000, currency: "EUR" };
      expect(createSchema.safeParse(body).success).toBe(true);
    });

    it("rejects 2-letter code", () => {
      const body = { teacherId: "t_1", type: "single", amountCents: 50000, currency: "EU" };
      expect(createSchema.safeParse(body).success).toBe(false);
    });

    it("rejects 4-letter code", () => {
      const body = { teacherId: "t_1", type: "single", amountCents: 50000, currency: "EURO" };
      expect(createSchema.safeParse(body).success).toBe(false);
    });
  });
});

describe("Booking cancel reason schema", () => {
  it("accepts a 10+ character reason", () => {
    const result = cancelSchema.safeParse({ reason: "I need to reschedule this session" });
    expect(result.success).toBe(true);
  });

  it("rejects reason under 10 chars", () => {
    const result = cancelSchema.safeParse({ reason: "too short" });
    expect(result.success).toBe(false);
  });

  it("trims whitespace before checking length", () => {
    const result = cancelSchema.safeParse({ reason: "   short  " });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 10 trimmed chars", () => {
    const result = cancelSchema.safeParse({ reason: "1234567890" });
    expect(result.success).toBe(true);
  });

  it("rejects reason over 1000 chars", () => {
    const result = cancelSchema.safeParse({ reason: "x".repeat(1001) });
    expect(result.success).toBe(false);
  });

  it("accepts reason at exactly 1000 chars", () => {
    const result = cancelSchema.safeParse({ reason: "x".repeat(1000) });
    expect(result.success).toBe(true);
  });

  it("rejects empty reason", () => {
    const result = cancelSchema.safeParse({ reason: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing reason", () => {
    const result = cancelSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ── Booking auto-refund window logic ────────────────────────────────────

const BOOKING_AUTO_REFUND_WINDOW_HOURS = 24;

function shouldAutoRefund(sessionStartsAt: string | undefined): boolean {
  if (!sessionStartsAt) return true;
  const startsMs = new Date(sessionStartsAt).getTime();
  const windowMs = BOOKING_AUTO_REFUND_WINDOW_HOURS * 3600 * 1000;
  return startsMs - Date.now() >= windowMs;
}

describe("Auto-refund window logic", () => {
  it("auto-refunds when no session is scheduled", () => {
    expect(shouldAutoRefund(undefined)).toBe(true);
  });

  it("auto-refunds when session is >24h away", () => {
    const future = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    expect(shouldAutoRefund(future)).toBe(true);
  });

  it("does NOT auto-refund when session is <24h away", () => {
    const soon = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
    expect(shouldAutoRefund(soon)).toBe(false);
  });

  it("does NOT auto-refund when session is in the past", () => {
    const past = new Date(Date.now() - 3600 * 1000).toISOString();
    expect(shouldAutoRefund(past)).toBe(false);
  });

  it("boundary: exactly 24h away triggers auto-refund", () => {
    const exactly = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    expect(shouldAutoRefund(exactly)).toBe(true);
  });
});

// ── Booking status transitions ──────────────────────────────────────────

type BookingStatus = "pending" | "confirmed" | "cancelled" | "refunded" | "completed";

function canCancelBooking(status: BookingStatus): boolean {
  return status !== "cancelled" && status !== "refunded" && status !== "completed";
}

describe("Booking status transitions", () => {
  it("pending bookings can be cancelled", () => {
    expect(canCancelBooking("pending")).toBe(true);
  });

  it("confirmed bookings can be cancelled", () => {
    expect(canCancelBooking("confirmed")).toBe(true);
  });

  it("already cancelled bookings cannot be cancelled again", () => {
    expect(canCancelBooking("cancelled")).toBe(false);
  });

  it("refunded bookings cannot be cancelled", () => {
    expect(canCancelBooking("refunded")).toBe(false);
  });

  it("completed bookings cannot be cancelled", () => {
    expect(canCancelBooking("completed")).toBe(false);
  });
});

// ── escapeHtml (used in notification emails) ────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

describe("escapeHtml for notification emails", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes quotes", () => {
    expect(escapeHtml('He said "hi"')).toBe("He said &quot;hi&quot;");
  });

  it("handles mixed special characters", () => {
    expect(escapeHtml('<b>"Tom & Jerry"</b>')).toBe(
      "&lt;b&gt;&quot;Tom &amp; Jerry&quot;&lt;/b&gt;",
    );
  });

  it("leaves normal text unchanged", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});
