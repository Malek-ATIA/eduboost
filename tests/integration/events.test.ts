import { describe, it, expect } from "vitest";
import { api, session } from "./api";

type EventRow = {
  eventId: string;
  organizerId: string;
  title: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  priceCents: number;
  currency: string;
  status: string;
};

describe("/events — public browse", () => {
  it("returns the seeded Tunis workshop", async () => {
    const r = await api<{ items: EventRow[] }>("/events", { anonymous: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Array.isArray(r.data.items)).toBe(true);
    // Seed includes "Atelier révision — Maths Bac, Tunis Centre-ville".
    expect(
      r.data.items.some(
        (e) => e.venue.includes("Tunis") || e.title.includes("Maths Bac"),
      ),
    ).toBe(true);
  });
});

describe("/events — create + publish", () => {
  const isTeacher = () =>
    session().role === "teacher" || session().groups.includes("admin");

  let eventId: string | null = null;

  it("teacher can create a draft event", async () => {
    if (!isTeacher()) {
      console.log("[skip] test user isn't a teacher, event-create test skipped");
      return;
    }
    const ts = Date.now();
    const startsAt = new Date(ts + 24 * 3600 * 1000).toISOString();
    const endsAt = new Date(ts + 26 * 3600 * 1000).toISOString();
    const r = await api<{ eventId: string }>("/events", {
      method: "POST",
      body: {
        title: `[INT-TEST ${ts}] Workshop`,
        description: "Created by integration tests.",
        venue: "Online",
        startsAt,
        endsAt,
        capacity: 5,
        priceCents: 0,
        currency: "TND",
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.eventId).toBeTruthy();
    eventId = r.data.eventId;
  });

  it("created event is fetchable", async () => {
    if (!eventId) return;
    const r = await api<EventRow>(`/events/${eventId}`, { anonymous: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.eventId).toBe(eventId);
    expect(r.data.title).toContain("[INT-TEST");
  });

  it("PATCH publishes the event", async () => {
    if (!eventId) return;
    const r = await api(`/events/${eventId}`, {
      method: "PATCH",
      body: { status: "published" },
    });
    expect(r.ok).toBe(true);
    const fetched = await api<EventRow>(`/events/${eventId}`, {
      anonymous: true,
    });
    if (!fetched.ok) throw new Error("readback failed");
    expect(fetched.data.status).toBe("published");
  });

  it("rejects creation with end before start", async () => {
    if (!isTeacher()) return;
    const startsAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 23 * 3600 * 1000).toISOString();
    const r = await api("/events", {
      method: "POST",
      body: {
        title: "[INT-TEST] bad window",
        venue: "Online",
        startsAt,
        endsAt,
        capacity: 1,
        priceCents: 0,
        currency: "TND",
      },
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(400);
  });
});
