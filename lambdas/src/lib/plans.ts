import type { PlanId } from "@eduboost/db";
import { env } from "../env.js";

export type Plan = {
  id: PlanId;
  label: string;
  description: string;
  audience: "student" | "teacher";
  priceMonthlyCents: number;
  currency: string;
  stripePriceId: string;
  features: string[];
};

export function getPlans(): Plan[] {
  return [
    {
      id: "student_premium",
      label: "Student Premium",
      description: "Advanced search, priority support, exclusive study materials.",
      audience: "student",
      priceMonthlyCents: 999,
      currency: "EUR",
      stripePriceId: env.stripeStudentPremiumPriceId,
      features: [
        "Priority support",
        "Unlimited messages to teachers",
        "Exclusive marketplace discounts",
      ],
    },
    {
      id: "teacher_pro",
      label: "Teacher Pro",
      description: "Larger classrooms, featured placement, advanced analytics.",
      audience: "teacher",
      priceMonthlyCents: 2900,
      currency: "EUR",
      stripePriceId: env.stripeTeacherProPriceId,
      features: [
        "Host classrooms up to 25 students",
        "Featured placement in teacher search",
        "Advanced earnings analytics",
      ],
    },
  ];
}

export function getPlan(id: PlanId): Plan | undefined {
  return getPlans().find((p) => p.id === id);
}
