import { describe, it, expect } from "vitest";
import { z } from "zod";
import { MIN_PRICE_CENTS } from "../lib/stripe.js";

/**
 * Marketplace route validation tests — Zod schemas and business logic.
 */

// ── List query schema ───────────────────────────────────────────────────

const listQuery = z.object({
  subject: z.string().trim().min(1).max(100).optional(),
  minPriceCents: z.coerce.number().int().nonnegative().optional(),
  maxPriceCents: z.coerce.number().int().nonnegative().optional(),
  sellerId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(200),
});

describe("Marketplace list query schema", () => {
  it("accepts empty query", () => {
    const result = listQuery.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(200);
  });

  it("accepts subject filter", () => {
    const result = listQuery.safeParse({ subject: "Mathematics" });
    expect(result.success).toBe(true);
  });

  it("trims subject", () => {
    const result = listQuery.safeParse({ subject: " Physics " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.subject).toBe("Physics");
  });

  it("accepts price range", () => {
    const result = listQuery.safeParse({ minPriceCents: "5000", maxPriceCents: "100000" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minPriceCents).toBe(5000);
      expect(result.data.maxPriceCents).toBe(100000);
    }
  });

  it("rejects negative price", () => {
    const result = listQuery.safeParse({ minPriceCents: "-1" });
    expect(result.success).toBe(false);
  });

  it("accepts sellerId filter", () => {
    const result = listQuery.safeParse({ sellerId: "user_123" });
    expect(result.success).toBe(true);
  });

  it("rejects limit of 0", () => {
    const result = listQuery.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects limit above 200", () => {
    const result = listQuery.safeParse({ limit: "201" });
    expect(result.success).toBe(false);
  });
});

// ── Create listing schema ───────────────────────────────────────────────

const createListingSchema = z.object({
  kind: z.enum(["digital", "physical"]).default("digital"),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).optional(),
  subjects: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
  priceCents: z.number().int().min(MIN_PRICE_CENTS, {
    message: `priceCents below platform minimum of ${MIN_PRICE_CENTS}`,
  }),
  currency: z.string().length(3).default("TND"),
  inStockCount: z.number().int().min(0).max(100_000).optional(),
  shippingCostCents: z.number().int().min(0).max(1_000_00).optional(),
  shipsFrom: z.string().trim().length(2).optional(),
  weightGrams: z.number().int().min(1).max(100_000).optional(),
  sellerOrgId: z.string().trim().min(1).optional(),
});

describe("Create listing schema", () => {
  const minimal = { title: "Math Notes", priceCents: MIN_PRICE_CENTS };

  it("accepts minimal listing", () => {
    const result = createListingSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("digital");
      expect(result.data.currency).toBe("TND");
      expect(result.data.subjects).toEqual([]);
    }
  });

  it("accepts digital kind", () => {
    const result = createListingSchema.safeParse({ ...minimal, kind: "digital" });
    expect(result.success).toBe(true);
  });

  it("accepts physical kind", () => {
    const result = createListingSchema.safeParse({ ...minimal, kind: "physical" });
    expect(result.success).toBe(true);
  });

  it("rejects unknown kind", () => {
    const result = createListingSchema.safeParse({ ...minimal, kind: "service" });
    expect(result.success).toBe(false);
  });

  it("rejects title under 3 chars", () => {
    const result = createListingSchema.safeParse({ ...minimal, title: "Ab" });
    expect(result.success).toBe(false);
  });

  it("rejects title over 200 chars", () => {
    const result = createListingSchema.safeParse({ ...minimal, title: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("trims title", () => {
    const result = createListingSchema.safeParse({ ...minimal, title: "  Study Guide  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Study Guide");
  });

  it("rejects priceCents below minimum", () => {
    const result = createListingSchema.safeParse({ title: "Notes", priceCents: MIN_PRICE_CENTS - 1 });
    expect(result.success).toBe(false);
  });

  it("accepts priceCents at minimum", () => {
    const result = createListingSchema.safeParse({ title: "Notes", priceCents: MIN_PRICE_CENTS });
    expect(result.success).toBe(true);
  });

  it("rejects 0 priceCents (marketplace items must be paid)", () => {
    const result = createListingSchema.safeParse({ title: "Free Notes", priceCents: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects description over 4000 chars", () => {
    const result = createListingSchema.safeParse({
      ...minimal,
      description: "x".repeat(4001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 subjects", () => {
    const result = createListingSchema.safeParse({
      ...minimal,
      subjects: Array.from({ length: 11 }, (_, i) => `Subject ${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("accepts currency code", () => {
    const result = createListingSchema.safeParse({ ...minimal, currency: "EUR" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid currency code length", () => {
    const result = createListingSchema.safeParse({ ...minimal, currency: "EURO" });
    expect(result.success).toBe(false);
  });

  it("accepts physical listing with stock count and shipping", () => {
    const result = createListingSchema.safeParse({
      ...minimal,
      kind: "physical",
      inStockCount: 50,
      shippingCostCents: 5000,
      shipsFrom: "TN",
      weightGrams: 500,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative stock count", () => {
    const result = createListingSchema.safeParse({
      ...minimal,
      inStockCount: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative shipping cost", () => {
    const result = createListingSchema.safeParse({
      ...minimal,
      shippingCostCents: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects weightGrams of 0", () => {
    const result = createListingSchema.safeParse({
      ...minimal,
      weightGrams: 0,
    });
    expect(result.success).toBe(false);
  });
});
