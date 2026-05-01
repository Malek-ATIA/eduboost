import { describe, it, expect } from "vitest";
import { getPlans, getPlan, type Plan } from "./plans.js";

describe("getPlans", () => {
  const plans: Plan[] = getPlans();

  it("ships exactly two plans (student + teacher)", () => {
    expect(plans).toHaveLength(2);
  });

  it("plan ids are stable and match the PlanId enum", () => {
    const ids = plans.map((p) => p.id).sort();
    expect(ids).toEqual(["student_premium", "teacher_pro"]);
  });

  it("every plan has a label, description, audience, price, currency, features", () => {
    for (const p of plans) {
      expect(p.label).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(["student", "teacher"]).toContain(p.audience);
      expect(p.priceMonthlyCents).toBeGreaterThan(0);
      expect(p.currency).toBe("TND");
      expect(p.features.length).toBeGreaterThan(0);
    }
  });

  it("audience aligns with plan id (student_premium → student, teacher_pro → teacher)", () => {
    const student = plans.find((p) => p.id === "student_premium");
    const teacher = plans.find((p) => p.id === "teacher_pro");
    expect(student?.audience).toBe("student");
    expect(teacher?.audience).toBe("teacher");
  });

  it("teacher_pro is more expensive than student_premium (sanity)", () => {
    const student = plans.find((p) => p.id === "student_premium");
    const teacher = plans.find((p) => p.id === "teacher_pro");
    expect(teacher!.priceMonthlyCents).toBeGreaterThan(student!.priceMonthlyCents);
  });
});

describe("getPlan", () => {
  it("returns the matching plan for a known id", () => {
    expect(getPlan("student_premium")?.label).toBe("Student Premium");
    expect(getPlan("teacher_pro")?.label).toBe("Teacher Pro");
  });

  it("returns undefined for an unknown id", () => {
    expect(getPlan("not_a_plan" as never)).toBeUndefined();
  });

  it("returned plan is the same instance shape as getPlans entries", () => {
    const single = getPlan("student_premium")!;
    const fromAll = getPlans().find((p) => p.id === "student_premium")!;
    expect(single.id).toBe(fromAll.id);
    expect(single.priceMonthlyCents).toBe(fromAll.priceMonthlyCents);
    expect(single.audience).toBe(fromAll.audience);
  });
});
