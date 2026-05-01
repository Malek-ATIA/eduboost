import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, ApiError } from "./api";

vi.mock("./env", () => ({
  env: {
    apiUrl: "https://api.test.com",
    userPoolId: "",
    userPoolClientId: "",
    region: "eu-west-1",
    stripePublishableKey: "",
  },
}));

vi.mock("./cognito", () => ({
  currentSession: vi.fn().mockResolvedValue(null),
}));

const fetchSpy = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("api client", () => {
  it("sends GET request to the correct URL", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    });

    await api("/teachers");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.test.com/teachers",
      expect.objectContaining({
        headers: expect.objectContaining({ "content-type": "application/json" }),
      }),
    );
  });

  it("returns parsed JSON on success", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [{ id: 1 }] }),
    });

    const result = await api<{ items: { id: number }[] }>("/test");
    expect(result.items).toEqual([{ id: 1 }]);
  });

  it("sends POST with body", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ created: true }),
    });

    await api("/bookings", {
      method: "POST",
      body: JSON.stringify({ teacherId: "t1" }),
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.test.com/bookings",
      expect.objectContaining({
        method: "POST",
        body: '{"teacherId":"t1"}',
      }),
    );
  });

  it("throws ApiError on 404 with JSON body", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('{"error":"user_not_found"}'),
    });

    try {
      await api("/users/me");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const e = err as ApiError;
      expect(e.status).toBe(404);
      expect(e.code).toBe("user_not_found");
      expect(e.message).toContain("No user with that email");
    }
  });

  it("throws ApiError on 403 with banned code", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('{"error":"banned","reason":"TOS violation"}'),
    });

    try {
      await api("/something");
      expect.unreachable("should have thrown");
    } catch (err) {
      const e = err as ApiError;
      expect(e.status).toBe(403);
      expect(e.code).toBe("banned");
      expect(e.message).toContain("suspended");
    }
  });

  it("throws ApiError on 500 with non-JSON body", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("<html>Internal Server Error</html>"),
    });

    try {
      await api("/broken");
      expect.unreachable("should have thrown");
    } catch (err) {
      const e = err as ApiError;
      expect(e.status).toBe(500);
      expect(e.code).toBeUndefined();
      expect(e.message).toContain("on our side");
      expect(e.bodyText).toContain("Internal Server Error");
    }
  });

  it("throws ApiError on network failure", async () => {
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"));

    try {
      await api("/offline");
      expect.unreachable("should have thrown");
    } catch (err) {
      const e = err as ApiError;
      expect(e.status).toBe(0);
      expect(e.message).toContain("reach the server");
    }
  });

  it("throws ApiError on 409 conflict", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 409,
      text: () => Promise.resolve('{"error":"already_purchased"}'),
    });

    try {
      await api("/marketplace/buy");
      expect.unreachable("should have thrown");
    } catch (err) {
      const e = err as ApiError;
      expect(e.status).toBe(409);
      expect(e.code).toBe("already_purchased");
      expect(e.message).toContain("already own this");
    }
  });

  it("throws ApiError on 401 unauthorized", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('{"error":"unauthorized"}'),
    });

    try {
      await api("/protected");
      expect.unreachable("should have thrown");
    } catch (err) {
      const e = err as ApiError;
      expect(e.status).toBe(401);
      expect(e.message).toContain("signed in");
    }
  });

  it("passes through custom headers merged with defaults", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await api("/test", { headers: { "x-custom": "value" } });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.test.com/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-custom": "value",
          "content-type": "application/json",
        }),
      }),
    );
  });

  it("handles 429 rate limit", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("{}"),
    });

    try {
      await api("/rate-limited");
      expect.unreachable("should have thrown");
    } catch (err) {
      const e = err as ApiError;
      expect(e.status).toBe(429);
      expect(e.message).toContain("too fast");
    }
  });

  it("handles 413 payload too large", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 413,
      text: () => Promise.resolve("{}"),
    });

    try {
      await api("/upload");
      expect.unreachable("should have thrown");
    } catch (err) {
      const e = err as ApiError;
      expect(e.status).toBe(413);
      expect(e.message).toContain("too large");
    }
  });
});
