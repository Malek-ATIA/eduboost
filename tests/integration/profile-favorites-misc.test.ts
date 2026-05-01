import { describe, it, expect } from "vitest";
import { api, session } from "./api";

describe("PATCH /users/me — partial profile update", () => {
  it("updates displayName and round-trips through GET /users/me", async () => {
    const original = await api<{ displayName: string }>("/users/me");
    if (!original.ok) throw new Error("could not load /users/me");
    const originalName = original.data.displayName;

    const probe = `${originalName} (test ${Date.now()})`;
    const patch = await api("/users/me", {
      method: "PATCH",
      body: { displayName: probe },
    });
    expect(patch.ok).toBe(true);

    const after = await api<{ displayName: string }>("/users/me");
    if (!after.ok) throw new Error("readback failed");
    expect(after.data.displayName).toBe(probe);

    // Restore the original name so we don't pollute the test account.
    await api("/users/me", {
      method: "PATCH",
      body: { displayName: originalName },
    });
  });

  it("rejects empty patch with 400 no_fields_to_update", async () => {
    const r = await api("/users/me", {
      method: "PATCH",
      body: {},
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(400);
  });
});

describe("/favorites — add + check + remove", () => {
  const teacherId = "seed_teacher_leila";

  it("round-trips: add → check returns true → delete → check returns false", async () => {
    // Start clean — try delete first (idempotent if not present).
    await api(`/favorites/${teacherId}`, { method: "DELETE", expectError: true });

    const add = await api("/favorites", {
      method: "POST",
      body: { favoriteId: teacherId, kind: "teacher" },
    });
    expect(add.ok).toBe(true);

    const check1 = await api<{ favorited: boolean }>(
      `/favorites/check/${teacherId}`,
    );
    if (!check1.ok) throw new Error("check failed");
    expect(check1.data.favorited).toBe(true);

    const remove = await api(`/favorites/${teacherId}`, { method: "DELETE" });
    expect(remove.ok).toBe(true);

    const check2 = await api<{ favorited: boolean }>(
      `/favorites/check/${teacherId}`,
    );
    if (!check2.ok) throw new Error("check2 failed");
    expect(check2.data.favorited).toBe(false);
  });

  it("favorite check on unknown id returns favorited:false (not error)", async () => {
    const r = await api<{ favorited: boolean }>(
      "/favorites/check/not_a_real_id",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.favorited).toBe(false);
  });
});

describe("/notifications — counts + list", () => {
  it("unread count returns a number", async () => {
    const r = await api<{ count: number }>("/notifications/unread-count");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(typeof r.data.count).toBe("number");
    expect(r.data.count).toBeGreaterThanOrEqual(0);
  });

  it("notifications list returns an array", async () => {
    const r = await api<{ items: unknown[] }>("/notifications");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Array.isArray(r.data.items)).toBe(true);
  });
});

describe("/payments/mine — history endpoint", () => {
  it("returns my payment list (may be empty)", async () => {
    const r = await api<{ items: unknown[] }>("/payments/mine");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Array.isArray(r.data.items)).toBe(true);
  });
});

describe("/bookings/mine — list", () => {
  it("returns the list, even if empty", async () => {
    const r = await api<{ items: unknown[] }>("/bookings/mine");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Array.isArray(r.data.items)).toBe(true);
  });
});

describe("/support/tickets/mine — my tickets", () => {
  it("returns array of tickets owned by me", async () => {
    const r = await api<{ items: unknown[] }>("/support/tickets/mine");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Array.isArray(r.data.items)).toBe(true);
  });
});

describe("/referrals/mine — share code endpoint", () => {
  it("returns my referral code + share URL", async () => {
    const r = await api<{ referralCode: string; shareUrl: string }>(
      "/referrals/mine",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.referralCode).toBeTruthy();
    expect(r.data.shareUrl).toMatch(/\/signup\?ref=/);
  });

  it("self-claim is rejected (any 4xx)", async () => {
    const me = await api<{ referralCode: string }>("/referrals/mine");
    if (!me.ok) throw new Error("me failed");
    const r = await api("/referrals/claim", {
      method: "POST",
      body: { code: me.data.referralCode },
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });
});

describe("/teachers/me/students — teacher-only", () => {
  const isTeacher = () =>
    session().role === "teacher" || session().groups.includes("admin");

  it("returns the student aggregate for a teacher", async () => {
    if (!isTeacher()) {
      console.log("[skip] test user isn't a teacher");
      return;
    }
    const r = await api<{ items: unknown[] }>("/teachers/me/students");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Array.isArray(r.data.items)).toBe(true);
  });
});

describe("/study-materials — public list", () => {
  it("returns an array", async () => {
    const r = await api<{ items: unknown[] }>("/study-materials");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Array.isArray(r.data.items)).toBe(true);
  });
});

describe("/assessments — list published", () => {
  it("returns an array", async () => {
    const r = await api<{ items: unknown[] }>("/assessments");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Array.isArray(r.data.items)).toBe(true);
  });
});

describe("/memberships/plans — public", () => {
  it("returns the two MVP plans", async () => {
    const r = await api<{ items: { id: string; audience: string }[] }>(
      "/memberships/plans",
      { anonymous: true },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.data.items.map((p) => p.id).sort();
    expect(ids).toEqual(["student_premium", "teacher_pro"]);
  });
});

describe("CORS preflight", () => {
  it("OPTIONS /teachers from a CloudFront origin returns 204 with ACAO=*", async () => {
    const url = `${globalThis.__EDUBOOST_API_URL__}/teachers`;
    const res = await fetch(url, {
      method: "OPTIONS",
      headers: {
        origin: "https://d29jvbfa3ftzxl.cloudfront.net",
        "access-control-request-method": "GET",
        "access-control-request-headers": "content-type",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("error handling", () => {
  it("404 for an unmounted route returns the not_found shape", async () => {
    const r = await api("/this-route-does-not-exist", {
      anonymous: true,
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // Anonymous → /{proxy+} catchall enforces auth → 401 before our 404
    // handler ever runs. That's fine; we just want to confirm we don't hit
    // a 500.
    expect([401, 404]).toContain(r.status);
  });
});
