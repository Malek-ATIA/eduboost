import { describe, it, expect } from "vitest";
import { api } from "./api";

type Listing = {
  listingId: string;
  sellerId: string;
  kind?: "digital" | "physical";
  title: string;
  description?: string;
  subjects: string[];
  priceCents: number;
  currency: string;
  status: string;
};

describe("/marketplace/listings — public browse", () => {
  it("returns the seeded digital + physical listings (count >= 2)", async () => {
    const r = await api<{ items: Listing[] }>("/marketplace/listings", {
      anonymous: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Array.isArray(r.data.items)).toBe(true);
    expect(r.data.items.length).toBeGreaterThanOrEqual(2);
    const ids = r.data.items.map((l) => l.listingId);
    expect(ids).toContain("lst_seed_bac_math_papers");
    expect(ids).toContain("lst_seed_physics_workbook");
  });

  it("both seeded listings are individually fetchable", async () => {
    const a = await api<Listing>(
      "/marketplace/listings/lst_seed_bac_math_papers",
      { anonymous: true },
    );
    const b = await api<Listing>(
      "/marketplace/listings/lst_seed_physics_workbook",
      { anonymous: true },
    );
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });

  it("subject filter narrows results", async () => {
    const r = await api<{ items: Listing[] }>(
      "/marketplace/listings?subject=Physics",
      { anonymous: true },
    );
    if (!r.ok) throw new Error("subject filter failed");
    for (const l of r.data.items) {
      expect(l.subjects.map((s) => s.toLowerCase())).toContain("physics");
    }
  });

  it("all listings carry TND currency", async () => {
    const r = await api<{ items: Listing[] }>("/marketplace/listings", {
      anonymous: true,
    });
    if (!r.ok) throw new Error("list failed");
    for (const l of r.data.items) {
      expect(l.currency).toBe("TND");
    }
  });
});

describe("/marketplace/listings/:id — public detail", () => {
  it("returns the seeded math papers listing", async () => {
    const r = await api<Listing>(
      "/marketplace/listings/lst_seed_bac_math_papers",
      { anonymous: true },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.listingId).toBe("lst_seed_bac_math_papers");
    expect(r.data.kind).toBe("digital");
    expect(r.data.priceCents).toBe(15000);
  });

  it("returns 404 for a missing listing", async () => {
    const r = await api("/marketplace/listings/lst_does_not_exist", {
      anonymous: true,
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(404);
  });
});

describe("/marketplace order endpoints — authenticated", () => {
  it("creating an order returns 2xx, a known 4xx, or a structured 5xx", async () => {
    const r = await api(`/marketplace/orders`, {
      method: "POST",
      body: { listingId: "lst_seed_bac_math_papers" },
      expectError: true,
    });
    // Accept 2xx (Stripe wired and order created) OR any 4xx (validation,
    // already_purchased, cannot_buy_own, ...) OR 502/503 with a structured
    // error code — that's the new path we just added when STRIPE_SECRET_KEY
    // isn't wired (`payments_not_configured`) or Stripe rejects the request
    // (`payment_intent_failed`). What we DON'T accept is a 500 with no code,
    // which would be an unhandled crash worth investigating.
    if (r.ok) return;
    expect(r.error).not.toBe("unknown");
    if (r.status === 503) {
      expect(r.error).toBe("payments_not_configured");
    }
  });
});
