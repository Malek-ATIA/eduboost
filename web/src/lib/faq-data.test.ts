import { describe, it, expect } from "vitest";
import { FAQ_GENERAL, FAQ_STUDENTS, FAQ_TEACHERS, FAQ_REFUNDS, type FAQ } from "./faq-data";

function validateFaqArray(name: string, items: FAQ[]) {
  describe(name, () => {
    it("is a non-empty array", () => {
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });

    it("every item has a non-empty question and answer", () => {
      for (const item of items) {
        expect(typeof item.q).toBe("string");
        expect(item.q.trim().length).toBeGreaterThan(0);
        expect(typeof item.a).toBe("string");
        expect(item.a.trim().length).toBeGreaterThan(0);
      }
    });

    it("every question ends with a question mark", () => {
      for (const item of items) {
        expect(item.q.endsWith("?")).toBe(true);
      }
    });

    it("has no duplicate questions", () => {
      const questions = items.map((i) => i.q);
      expect(new Set(questions).size).toBe(questions.length);
    });
  });
}

describe("faq-data", () => {
  validateFaqArray("FAQ_GENERAL", FAQ_GENERAL);
  validateFaqArray("FAQ_STUDENTS", FAQ_STUDENTS);
  validateFaqArray("FAQ_TEACHERS", FAQ_TEACHERS);
  validateFaqArray("FAQ_REFUNDS", FAQ_REFUNDS);

  it("has no duplicate questions across all categories", () => {
    const all = [...FAQ_GENERAL, ...FAQ_STUDENTS, ...FAQ_TEACHERS, ...FAQ_REFUNDS];
    const questions = all.map((i) => i.q);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it("FAQ_GENERAL covers core platform questions", () => {
    const questions = FAQ_GENERAL.map((f) => f.q.toLowerCase());
    expect(questions.some((q) => q.includes("what is eduboost"))).toBe(true);
    expect(questions.some((q) => q.includes("payment"))).toBe(true);
  });

  it("FAQ_REFUNDS covers cancellation and refund topics", () => {
    const questions = FAQ_REFUNDS.map((f) => f.q.toLowerCase());
    expect(questions.some((q) => q.includes("cancel") || q.includes("refund"))).toBe(true);
  });
});
