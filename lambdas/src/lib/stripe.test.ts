import { describe, it, expect } from "vitest";
import { computePlatformFeeCents, PLATFORM_FEE_BPS, MIN_PRICE_CENTS, assertAboveMinimum } from "./stripe.js";

describe("computePlatformFeeCents", () => {
  it("computes 15% fee on 50 TND (50000 millimes)", () => {
    expect(computePlatformFeeCents(50000)).toBe(7500);
  });

  it("computes 15% fee on 100 TND", () => {
    expect(computePlatformFeeCents(100000)).toBe(15000);
  });

  it("computes 15% fee on 5 TND (minimum)", () => {
    expect(computePlatformFeeCents(5000)).toBe(750);
  });

  it("returns 0 for 0 amount", () => {
    expect(computePlatformFeeCents(0)).toBe(0);
  });

  it("rounds to nearest millime", () => {
    // 1 millime * 1500 / 10000 = 0.15 → rounds to 0
    expect(computePlatformFeeCents(1)).toBe(0);
    // 7 * 1500 / 10000 = 1.05 → rounds to 1
    expect(computePlatformFeeCents(7)).toBe(1);
  });

  it("handles large amounts", () => {
    // 1000 TND = 1_000_000 millimes
    expect(computePlatformFeeCents(1_000_000)).toBe(150_000);
  });
});

describe("PLATFORM_FEE_BPS", () => {
  it("is 1500 (15%)", () => {
    expect(PLATFORM_FEE_BPS).toBe(1500);
  });
});

describe("MIN_PRICE_CENTS", () => {
  it("is 5000 millimes (5 TND)", () => {
    expect(MIN_PRICE_CENTS).toBe(5000);
  });
});

describe("assertAboveMinimum", () => {
  it("does not throw for amount equal to minimum", () => {
    expect(() => assertAboveMinimum(5000)).not.toThrow();
  });

  it("does not throw for amount above minimum", () => {
    expect(() => assertAboveMinimum(10000)).not.toThrow();
  });

  it("throws for amount below minimum", () => {
    expect(() => assertAboveMinimum(4999)).toThrow("price_below_minimum");
  });

  it("throws for zero", () => {
    expect(() => assertAboveMinimum(0)).toThrow("price_below_minimum");
  });

  it("throws for negative", () => {
    expect(() => assertAboveMinimum(-1000)).toThrow("price_below_minimum");
  });
});
