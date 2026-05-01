import { describe, it, expect } from "vitest";
import { api } from "./api";

type Teacher = {
  userId: string;
  bio?: string;
  subjects: string[];
  yearsExperience: number;
  hourlyRateCents: number;
  currency: string;
  ratingAvg: number;
  ratingCount: number;
  city?: string;
  country?: string;
  trialSession: boolean;
  individualSessions: boolean;
  groupSessions: boolean;
  verificationStatus?: string;
};

describe("/teachers — public directory", () => {
  it("public list works without auth and returns demo seed teachers", async () => {
    const r = await api<{ items: Teacher[] }>("/teachers", { anonymous: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Array.isArray(r.data.items)).toBe(true);
    expect(r.data.items.length).toBeGreaterThanOrEqual(3);
    // The seeded Tunisia teachers should all be present.
    const ids = r.data.items.map((t) => t.userId);
    expect(ids).toContain("seed_teacher_leila");
    expect(ids).toContain("seed_teacher_ahmed");
    expect(ids).toContain("seed_teacher_sana");
  });

  it("returns TND currency on every Tunisia-seeded teacher", async () => {
    const r = await api<{ items: Teacher[] }>("/teachers", { anonymous: true });
    if (!r.ok) throw new Error("list failed");
    const seeded = r.data.items.filter((t) => t.userId.startsWith("seed_teacher_"));
    expect(seeded.length).toBeGreaterThanOrEqual(10);
    for (const t of seeded) {
      expect(t.currency).toBe("TND");
    }
  });

  it("subject filter narrows the list", async () => {
    const r = await api<{ items: Teacher[] }>(
      "/teachers?subject=Mathematics",
      { anonymous: true },
    );
    if (!r.ok) throw new Error("subject filter failed");
    expect(r.data.items.length).toBeGreaterThan(0);
    for (const t of r.data.items) {
      const hasSubject = t.subjects.some((s) =>
        s.toLowerCase().includes("mathematics"),
      );
      expect(hasSubject).toBe(true);
    }
  });

  it("city filter narrows to that city", async () => {
    const r = await api<{ items: Teacher[] }>("/teachers?city=Tunis", {
      anonymous: true,
    });
    if (!r.ok) throw new Error("city filter failed");
    expect(r.data.items.length).toBeGreaterThan(0);
    for (const t of r.data.items) {
      expect(t.city).toBe("Tunis");
    }
  });

  it("trial filter returns only trial-offering teachers", async () => {
    const r = await api<{ items: Teacher[] }>("/teachers?trial=true", {
      anonymous: true,
    });
    if (!r.ok) throw new Error("trial filter failed");
    expect(r.data.items.length).toBeGreaterThan(0);
    for (const t of r.data.items) {
      expect(t.trialSession).toBe(true);
    }
  });

  it("min rating filter respects the threshold", async () => {
    const r = await api<{ items: Teacher[] }>("/teachers?minRating=4.7", {
      anonymous: true,
    });
    if (!r.ok) throw new Error("rating filter failed");
    for (const t of r.data.items) {
      expect(t.ratingAvg).toBeGreaterThanOrEqual(4.7);
    }
  });

  it("min rate filter (millimes) respects the threshold", async () => {
    const r = await api<{ items: Teacher[] }>(
      "/teachers?minRateCents=50000",
      { anonymous: true },
    );
    if (!r.ok) throw new Error("rate filter failed");
    for (const t of r.data.items) {
      expect(t.hourlyRateCents).toBeGreaterThanOrEqual(50000);
    }
  });

  it("invalid country code is rejected with 400", async () => {
    const r = await api("/teachers?country=TUNISIA", {
      anonymous: true,
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(400);
  });
});

describe("/teachers/:userId — public detail", () => {
  it("returns the teacher + profile bundle for a known seed teacher", async () => {
    const r = await api<{
      user: { userId: string; displayName: string; email: string };
      profile: Teacher;
    }>("/teachers/seed_teacher_leila", { anonymous: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.user.userId).toBe("seed_teacher_leila");
    expect(r.data.user.displayName).toBe("Leila Ben Ali");
    expect(r.data.profile.city).toBe("Tunis");
    expect(r.data.profile.subjects).toContain("Mathematics");
  });

  it("returns 404 for an unknown teacher id", async () => {
    const r = await api("/teachers/does_not_exist_xyz", {
      anonymous: true,
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(404);
  });
});
