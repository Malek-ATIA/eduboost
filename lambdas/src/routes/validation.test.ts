import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Validation tests for support tickets, lesson requests, and other
 * critical route schemas. Verifies input validation before requests
 * reach the database.
 */

// ── Support ticket schemas ──────────────────────────────────────────────

const TICKET_CATEGORIES = [
  "payment_dispute",
  "review_dispute",
  "booking_issue",
  "account",
  "technical",
  "abuse_report",
  "other",
] as const;

const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const attachmentSchema = z.object({
  s3Key: z.string().min(1).max(512),
  filename: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().max(200).optional(),
  sizeBytes: z.number().int().min(1).max(25 * 1024 * 1024).optional(),
});

const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES).default("normal"),
  body: z.string().trim().min(10).max(8000),
  bookingId: z.string().trim().min(1).optional(),
  relatedPaymentId: z.string().trim().min(1).optional(),
  relatedReviewId: z.string().trim().min(1).optional(),
  attachments: z.array(attachmentSchema).max(5).default([]),
});

describe("Support ticket creation schema", () => {
  const minimal = {
    subject: "Payment issue",
    category: "payment_dispute" as const,
    body: "I was charged twice for the same booking",
  };

  it("accepts minimal ticket", () => {
    const result = createTicketSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("normal");
      expect(result.data.attachments).toEqual([]);
    }
  });

  it("rejects subject under 3 chars", () => {
    expect(createTicketSchema.safeParse({ ...minimal, subject: "Hi" }).success).toBe(false);
  });

  it("rejects subject over 200 chars", () => {
    expect(createTicketSchema.safeParse({ ...minimal, subject: "x".repeat(201) }).success).toBe(false);
  });

  it("rejects body under 10 chars", () => {
    expect(createTicketSchema.safeParse({ ...minimal, body: "too short" }).success).toBe(false);
  });

  it("rejects body over 8000 chars", () => {
    expect(createTicketSchema.safeParse({ ...minimal, body: "x".repeat(8001) }).success).toBe(false);
  });

  it("accepts all valid categories", () => {
    for (const cat of TICKET_CATEGORIES) {
      expect(createTicketSchema.safeParse({ ...minimal, category: cat }).success).toBe(true);
    }
  });

  it("rejects invalid category", () => {
    expect(createTicketSchema.safeParse({ ...minimal, category: "refund" }).success).toBe(false);
  });

  it("accepts all valid priorities", () => {
    for (const p of TICKET_PRIORITIES) {
      expect(createTicketSchema.safeParse({ ...minimal, priority: p }).success).toBe(true);
    }
  });

  it("accepts bookingId reference", () => {
    const result = createTicketSchema.safeParse({ ...minimal, bookingId: "bk_abc123" });
    expect(result.success).toBe(true);
  });

  it("accepts attachments (up to 5)", () => {
    const result = createTicketSchema.safeParse({
      ...minimal,
      attachments: [
        { s3Key: "uploads/file1.pdf", filename: "receipt.pdf" },
        { s3Key: "uploads/file2.png", filename: "screenshot.png", mimeType: "image/png", sizeBytes: 500000 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 5 attachments", () => {
    const attachments = Array.from({ length: 6 }, (_, i) => ({
      s3Key: `uploads/file${i}.pdf`,
      filename: `file${i}.pdf`,
    }));
    expect(createTicketSchema.safeParse({ ...minimal, attachments }).success).toBe(false);
  });

  it("rejects attachment with empty s3Key", () => {
    expect(
      createTicketSchema.safeParse({
        ...minimal,
        attachments: [{ s3Key: "", filename: "test.pdf" }],
      }).success,
    ).toBe(false);
  });

  it("rejects attachment over 25MB", () => {
    expect(
      createTicketSchema.safeParse({
        ...minimal,
        attachments: [{ s3Key: "key", filename: "big.pdf", sizeBytes: 26 * 1024 * 1024 }],
      }).success,
    ).toBe(false);
  });
});

// ── Lesson request schema ───────────────────────────────────────────────

const lessonRequestSchema = z.object({
  teacherId: z.string().min(1),
  subject: z.string().trim().min(1).max(200),
  preferredTime: z.string().trim().max(200).optional(),
  message: z.string().trim().max(2000).optional(),
});

describe("Lesson request creation schema", () => {
  const minimal = { teacherId: "t_123", subject: "Mathematics" };

  it("accepts minimal request", () => {
    expect(lessonRequestSchema.safeParse(minimal).success).toBe(true);
  });

  it("rejects missing teacherId", () => {
    expect(lessonRequestSchema.safeParse({ subject: "Math" }).success).toBe(false);
  });

  it("rejects empty teacherId", () => {
    expect(lessonRequestSchema.safeParse({ teacherId: "", subject: "Math" }).success).toBe(false);
  });

  it("rejects empty subject", () => {
    expect(lessonRequestSchema.safeParse({ teacherId: "t_1", subject: "" }).success).toBe(false);
  });

  it("rejects subject over 200 chars", () => {
    expect(
      lessonRequestSchema.safeParse({ teacherId: "t_1", subject: "x".repeat(201) }).success,
    ).toBe(false);
  });

  it("accepts preferredTime", () => {
    const result = lessonRequestSchema.safeParse({
      ...minimal,
      preferredTime: "Weekday evenings",
    });
    expect(result.success).toBe(true);
  });

  it("accepts message", () => {
    const result = lessonRequestSchema.safeParse({
      ...minimal,
      message: "I need help with calculus for my bac exam",
    });
    expect(result.success).toBe(true);
  });

  it("rejects message over 2000 chars", () => {
    expect(
      lessonRequestSchema.safeParse({ ...minimal, message: "x".repeat(2001) }).success,
    ).toBe(false);
  });
});

// ── SLA deadline calculation ────────────────────────────────────────────

type TicketPriority = "low" | "normal" | "high" | "urgent";

const SLA_HOURS: Record<TicketPriority, number> = {
  urgent: 4,
  high: 24,
  normal: 48,
  low: 168,
};

function computeSlaDeadline(priority: TicketPriority, fromIso?: string): string {
  const base = fromIso ? new Date(fromIso).getTime() : Date.now();
  return new Date(base + SLA_HOURS[priority] * 3600 * 1000).toISOString();
}

describe("SLA deadline calculation", () => {
  const baseDate = "2026-04-30T10:00:00.000Z";

  it("urgent = 4 hours", () => {
    const deadline = computeSlaDeadline("urgent", baseDate);
    expect(deadline).toBe("2026-04-30T14:00:00.000Z");
  });

  it("high = 24 hours", () => {
    const deadline = computeSlaDeadline("high", baseDate);
    expect(deadline).toBe("2026-05-01T10:00:00.000Z");
  });

  it("normal = 48 hours", () => {
    const deadline = computeSlaDeadline("normal", baseDate);
    expect(deadline).toBe("2026-05-02T10:00:00.000Z");
  });

  it("low = 168 hours (7 days)", () => {
    const deadline = computeSlaDeadline("low", baseDate);
    expect(deadline).toBe("2026-05-07T10:00:00.000Z");
  });

  it("uses current time when fromIso is not provided", () => {
    const before = Date.now();
    const deadline = new Date(computeSlaDeadline("normal")).getTime();
    const after = Date.now();
    const expected48h = 48 * 3600 * 1000;
    expect(deadline).toBeGreaterThanOrEqual(before + expected48h);
    expect(deadline).toBeLessThanOrEqual(after + expected48h);
  });
});

// ── Forum post validation ───────────────────────────────────────────────

const forumPostSchema = z.object({
  channelId: z.string().min(1),
  title: z.string().trim().min(3).max(300),
  body: z.string().trim().min(10).max(10_000),
});

describe("Forum post creation schema", () => {
  const minimal = { channelId: "ch_1", title: "Study tips", body: "Here are my top 10 study tips for the bac exam" };

  it("accepts valid post", () => {
    expect(forumPostSchema.safeParse(minimal).success).toBe(true);
  });

  it("rejects title under 3 chars", () => {
    expect(forumPostSchema.safeParse({ ...minimal, title: "Hi" }).success).toBe(false);
  });

  it("rejects title over 300 chars", () => {
    expect(forumPostSchema.safeParse({ ...minimal, title: "x".repeat(301) }).success).toBe(false);
  });

  it("rejects body under 10 chars", () => {
    expect(forumPostSchema.safeParse({ ...minimal, body: "short" }).success).toBe(false);
  });

  it("rejects body over 10000 chars", () => {
    expect(forumPostSchema.safeParse({ ...minimal, body: "x".repeat(10001) }).success).toBe(false);
  });

  it("rejects missing channelId", () => {
    expect(forumPostSchema.safeParse({ title: "Title", body: "long enough body text here" }).success).toBe(false);
  });
});

// ── Mailbox thread creation ─────────────────────────────────────────────

const createThreadSchema = z.object({
  recipientId: z.string().min(1),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});

describe("Mailbox thread creation schema", () => {
  const minimal = { recipientId: "u_456", subject: "Question about your sessions", body: "Hi, I wanted to ask about your availability" };

  it("accepts valid thread", () => {
    expect(createThreadSchema.safeParse(minimal).success).toBe(true);
  });

  it("rejects missing recipientId", () => {
    expect(createThreadSchema.safeParse({ subject: "Hi", body: "Hello there" }).success).toBe(false);
  });

  it("rejects empty subject", () => {
    expect(createThreadSchema.safeParse({ ...minimal, subject: "" }).success).toBe(false);
  });

  it("rejects subject over 200 chars", () => {
    expect(createThreadSchema.safeParse({ ...minimal, subject: "x".repeat(201) }).success).toBe(false);
  });

  it("rejects empty body", () => {
    expect(createThreadSchema.safeParse({ ...minimal, body: "" }).success).toBe(false);
  });

  it("rejects body over 5000 chars", () => {
    expect(createThreadSchema.safeParse({ ...minimal, body: "x".repeat(5001) }).success).toBe(false);
  });
});
