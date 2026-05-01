import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Teacher route validation tests — Zod schemas and business logic.
 */

// ── List query schema (mirror of teachers.ts) ───────────────────────────

const listQuerySchema = z.object({
  subject: z.string().trim().min(1).max(100).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  country: z
    .string()
    .trim()
    .length(2)
    .transform((s) => s.toUpperCase())
    .optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  minExperience: z.coerce.number().int().min(0).max(80).optional(),
  minRateCents: z.coerce.number().int().nonnegative().optional(),
  maxRateCents: z.coerce.number().int().nonnegative().optional(),
  trial: z
    .enum(["true", "false"])
    .transform((s) => s === "true")
    .optional(),
  individual: z
    .enum(["true", "false"])
    .transform((s) => s === "true")
    .optional(),
  group: z
    .enum(["true", "false"])
    .transform((s) => s === "true")
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(200),
});

describe("Teacher list query schema", () => {
  it("accepts empty query (all defaults)", () => {
    const result = listQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(200);
  });

  it("accepts subject filter", () => {
    const result = listQuerySchema.safeParse({ subject: "Mathematics" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.subject).toBe("Mathematics");
  });

  it("trims subject whitespace", () => {
    const result = listQuerySchema.safeParse({ subject: "  Physics  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.subject).toBe("Physics");
  });

  it("rejects empty subject after trim", () => {
    const result = listQuerySchema.safeParse({ subject: "   " });
    expect(result.success).toBe(false);
  });

  it("accepts city filter", () => {
    const result = listQuerySchema.safeParse({ city: "Tunis" });
    expect(result.success).toBe(true);
  });

  it("uppercases country code", () => {
    const result = listQuerySchema.safeParse({ country: "tn" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.country).toBe("TN");
  });

  it("rejects 3-letter country code", () => {
    const result = listQuerySchema.safeParse({ country: "TUN" });
    expect(result.success).toBe(false);
  });

  it("coerces minRating from string", () => {
    const result = listQuerySchema.safeParse({ minRating: "3.5" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.minRating).toBe(3.5);
  });

  it("rejects minRating above 5", () => {
    const result = listQuerySchema.safeParse({ minRating: "6" });
    expect(result.success).toBe(false);
  });

  it("rejects negative minRating", () => {
    const result = listQuerySchema.safeParse({ minRating: "-1" });
    expect(result.success).toBe(false);
  });

  it("coerces minExperience from string", () => {
    const result = listQuerySchema.safeParse({ minExperience: "5" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.minExperience).toBe(5);
  });

  it("rejects minExperience above 80", () => {
    const result = listQuerySchema.safeParse({ minExperience: "81" });
    expect(result.success).toBe(false);
  });

  it("coerces minRateCents from string", () => {
    const result = listQuerySchema.safeParse({ minRateCents: "30000" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.minRateCents).toBe(30000);
  });

  it("rejects negative minRateCents", () => {
    const result = listQuerySchema.safeParse({ minRateCents: "-1" });
    expect(result.success).toBe(false);
  });

  it("transforms trial='true' to boolean true", () => {
    const result = listQuerySchema.safeParse({ trial: "true" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.trial).toBe(true);
  });

  it("transforms trial='false' to boolean false", () => {
    const result = listQuerySchema.safeParse({ trial: "false" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.trial).toBe(false);
  });

  it("rejects trial='yes' (only true/false)", () => {
    const result = listQuerySchema.safeParse({ trial: "yes" });
    expect(result.success).toBe(false);
  });

  it("transforms group='true' to boolean true", () => {
    const result = listQuerySchema.safeParse({ group: "true" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.group).toBe(true);
  });

  it("accepts custom limit", () => {
    const result = listQuerySchema.safeParse({ limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(50);
  });

  it("rejects limit of 0", () => {
    const result = listQuerySchema.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects limit above 200", () => {
    const result = listQuerySchema.safeParse({ limit: "201" });
    expect(result.success).toBe(false);
  });

  it("accepts complex combined query", () => {
    const result = listQuerySchema.safeParse({
      subject: "Mathematics",
      city: "Tunis",
      minRating: "4",
      minExperience: "3",
      minRateCents: "30000",
      maxRateCents: "100000",
      trial: "true",
      group: "false",
      limit: "50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subject).toBe("Mathematics");
      expect(result.data.city).toBe("Tunis");
      expect(result.data.minRating).toBe(4);
      expect(result.data.minExperience).toBe(3);
      expect(result.data.minRateCents).toBe(30000);
      expect(result.data.maxRateCents).toBe(100000);
      expect(result.data.trial).toBe(true);
      expect(result.data.group).toBe(false);
      expect(result.data.limit).toBe(50);
    }
  });
});

// ── Profile update schema (mirror of teachers.ts profileSchema) ─────────

const profileSchema = z.object({
  bio: z.string().max(2000).optional(),
  subjects: z.array(z.string().min(1).max(100)).max(20).default([]),
  languages: z.array(z.string().min(1).max(50)).max(10).default([]),
  yearsExperience: z.number().int().min(0).max(80).default(0),
  hourlyRateCents: z.number().int().positive(),
  trialSession: z.boolean().default(false),
  individualSessions: z.boolean().default(true),
  groupSessions: z.boolean().default(false),
  city: z.string().max(100).optional(),
  country: z
    .string()
    .length(2)
    .transform((s) => s.toUpperCase())
    .optional(),
});

describe("Teacher profile update schema", () => {
  const minimal = { hourlyRateCents: 50000 };

  it("accepts minimal profile (just hourlyRateCents)", () => {
    const result = profileSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subjects).toEqual([]);
      expect(result.data.languages).toEqual([]);
      expect(result.data.yearsExperience).toBe(0);
      expect(result.data.trialSession).toBe(false);
      expect(result.data.individualSessions).toBe(true);
      expect(result.data.groupSessions).toBe(false);
    }
  });

  it("rejects zero hourlyRateCents", () => {
    const result = profileSchema.safeParse({ hourlyRateCents: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative hourlyRateCents", () => {
    const result = profileSchema.safeParse({ hourlyRateCents: -1000 });
    expect(result.success).toBe(false);
  });

  it("rejects missing hourlyRateCents", () => {
    const result = profileSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts full profile", () => {
    const result = profileSchema.safeParse({
      bio: "I teach math",
      subjects: ["Mathematics", "Physics"],
      languages: ["Arabic", "French"],
      yearsExperience: 10,
      hourlyRateCents: 50000,
      trialSession: true,
      individualSessions: true,
      groupSessions: true,
      city: "Tunis",
      country: "tn",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.country).toBe("TN");
    }
  });

  it("rejects bio over 2000 chars", () => {
    const result = profileSchema.safeParse({
      ...minimal,
      bio: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 20 subjects", () => {
    const result = profileSchema.safeParse({
      ...minimal,
      subjects: Array.from({ length: 21 }, (_, i) => `Subject ${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 languages", () => {
    const result = profileSchema.safeParse({
      ...minimal,
      languages: Array.from({ length: 11 }, (_, i) => `Lang ${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("rejects yearsExperience above 80", () => {
    const result = profileSchema.safeParse({
      ...minimal,
      yearsExperience: 81,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative yearsExperience", () => {
    const result = profileSchema.safeParse({
      ...minimal,
      yearsExperience: -1,
    });
    expect(result.success).toBe(false);
  });
});

// ── Video upload schema ─────────────────────────────────────────────────

const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const videoUploadSchema = z.object({
  mimeType: z.enum(VIDEO_MIME_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_VIDEO_BYTES),
});

describe("Video upload schema", () => {
  it("accepts video/mp4", () => {
    const result = videoUploadSchema.safeParse({ mimeType: "video/mp4", sizeBytes: 5000000 });
    expect(result.success).toBe(true);
  });

  it("accepts video/webm", () => {
    const result = videoUploadSchema.safeParse({ mimeType: "video/webm", sizeBytes: 1000 });
    expect(result.success).toBe(true);
  });

  it("accepts video/quicktime", () => {
    const result = videoUploadSchema.safeParse({ mimeType: "video/quicktime", sizeBytes: 1000 });
    expect(result.success).toBe(true);
  });

  it("rejects unsupported mime type", () => {
    const result = videoUploadSchema.safeParse({ mimeType: "video/avi", sizeBytes: 1000 });
    expect(result.success).toBe(false);
  });

  it("rejects image mime types", () => {
    const result = videoUploadSchema.safeParse({ mimeType: "image/png", sizeBytes: 1000 });
    expect(result.success).toBe(false);
  });

  it("rejects 0 bytes", () => {
    const result = videoUploadSchema.safeParse({ mimeType: "video/mp4", sizeBytes: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects over 100MB", () => {
    const result = videoUploadSchema.safeParse({
      mimeType: "video/mp4",
      sizeBytes: MAX_VIDEO_BYTES + 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 100MB", () => {
    const result = videoUploadSchema.safeParse({
      mimeType: "video/mp4",
      sizeBytes: MAX_VIDEO_BYTES,
    });
    expect(result.success).toBe(true);
  });
});

// ── Sponsored teacher sorting logic ─────────────────────────────────────

type Teacher = {
  userId: string;
  sponsoredUntil?: string;
};

function sortSponsoredFirst(items: Teacher[]): Teacher[] {
  const now = new Date().toISOString();
  const sponsored: Teacher[] = [];
  const regular: Teacher[] = [];
  for (const t of items) {
    if (t.sponsoredUntil && t.sponsoredUntil > now) sponsored.push(t);
    else regular.push(t);
  }
  return [...sponsored, ...regular];
}

describe("Sponsored teacher sorting", () => {
  it("puts sponsored teachers first", () => {
    const items: Teacher[] = [
      { userId: "regular1" },
      { userId: "sponsored1", sponsoredUntil: "2099-12-31T00:00:00Z" },
      { userId: "regular2" },
    ];
    const sorted = sortSponsoredFirst(items);
    expect(sorted[0].userId).toBe("sponsored1");
    expect(sorted[1].userId).toBe("regular1");
    expect(sorted[2].userId).toBe("regular2");
  });

  it("expired sponsor goes to regular list", () => {
    const items: Teacher[] = [
      { userId: "expired", sponsoredUntil: "2020-01-01T00:00:00Z" },
      { userId: "regular" },
    ];
    const sorted = sortSponsoredFirst(items);
    expect(sorted[0].userId).toBe("expired");
    expect(sorted[1].userId).toBe("regular");
  });

  it("preserves order within each group", () => {
    const items: Teacher[] = [
      { userId: "r1" },
      { userId: "r2" },
      { userId: "s1", sponsoredUntil: "2099-01-01T00:00:00Z" },
      { userId: "s2", sponsoredUntil: "2099-06-01T00:00:00Z" },
    ];
    const sorted = sortSponsoredFirst(items);
    expect(sorted.map((t) => t.userId)).toEqual(["s1", "s2", "r1", "r2"]);
  });

  it("handles empty list", () => {
    expect(sortSponsoredFirst([])).toEqual([]);
  });
});
