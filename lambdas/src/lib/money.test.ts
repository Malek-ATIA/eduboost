import { describe, it, expect } from "vitest";
import { formatMoney, formatMoneySymbol } from "./money.js";

describe("lambdas/lib/money — formatMoney", () => {
  it("renders TND with 3 decimals", () => {
    expect(formatMoney(5000, "TND")).toBe("TND 5.000");
    expect(formatMoney(0, "TND")).toBe("TND 0.000");
    expect(formatMoney(1, "TND")).toBe("TND 0.001");
    expect(formatMoney(123456, "TND")).toBe("TND 123.456");
  });

  it("renders EUR with 2 decimals", () => {
    expect(formatMoney(500, "EUR")).toBe("EUR 5.00");
    expect(formatMoney(99, "EUR")).toBe("EUR 0.99");
  });

  it("renders other 3-decimal currencies (BHD, JOD, KWD, OMR)", () => {
    expect(formatMoney(1000, "BHD")).toBe("BHD 1.000");
    expect(formatMoney(1000, "JOD")).toBe("JOD 1.000");
    expect(formatMoney(1000, "KWD")).toBe("KWD 1.000");
    expect(formatMoney(1000, "OMR")).toBe("OMR 1.000");
  });

  it("falls back to 2 decimals for unknown currencies", () => {
    expect(formatMoney(500, "XYZ")).toBe("XYZ 5.00");
  });

  it("treats null/undefined as zero", () => {
    expect(formatMoney(null, "TND")).toBe("TND 0.000");
    expect(formatMoney(undefined, "TND")).toBe("TND 0.000");
  });

  it("uppercases lower-case input", () => {
    expect(formatMoney(5000, "tnd")).toBe("TND 5.000");
  });

  it("defaults to TND", () => {
    expect(formatMoney(5000)).toBe("TND 5.000");
  });

  it("matches the web/lib/money output for shared currency cases", () => {
    // Server emails and client UI must agree on formatting; if these drift,
    // an invoice email and the in-app display will disagree.
    expect(formatMoney(45000, "TND")).toBe("TND 45.000");
    expect(formatMoney(2999, "EUR")).toBe("EUR 29.99");
  });
});

describe("lambdas/lib/money — formatMoneySymbol", () => {
  it("places DT after the value for TND (Tunisian convention)", () => {
    expect(formatMoneySymbol(5000, "TND")).toBe("5.000 DT");
    expect(formatMoneySymbol(1, "TND")).toBe("0.001 DT");
  });

  it("places western symbols before the value", () => {
    expect(formatMoneySymbol(500, "EUR")).toBe("€5.00");
    expect(formatMoneySymbol(1234, "USD")).toBe("$12.34");
    expect(formatMoneySymbol(750, "GBP")).toBe("£7.50");
  });

  it("falls back to ISO code prefix for unknown currencies", () => {
    expect(formatMoneySymbol(1000, "CHF")).toBe("CHF10.00");
  });

  it("handles null/undefined", () => {
    expect(formatMoneySymbol(null, "TND")).toBe("0.000 DT");
    expect(formatMoneySymbol(undefined, "EUR")).toBe("€0.00");
  });
});
