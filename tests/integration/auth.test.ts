import { describe, it, expect } from "vitest";
import { api, session } from "./api";

describe("auth + /users/me", () => {
  it("global setup logged us in successfully", () => {
    const s = session();
    expect(s.accessToken).toBeTruthy();
    expect(s.idToken).toBeTruthy();
    expect(s.email).toBe(process.env.EDUBOOST_TEST_EMAIL);
  });

  it("GET /users/me returns the signed-in user with role + email", async () => {
    const r = await api<{
      userId: string;
      email: string;
      displayName: string;
      role: string;
    }>("/users/me");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.email).toBe(session().email);
    expect(r.data.userId).toBe(session().sub);
    expect(["parent", "student", "teacher", "org_admin", "admin"]).toContain(
      r.data.role,
    );
  });

  it("authed-only endpoint returns 401 when called anonymously", async () => {
    const r = await api("/users/me", { anonymous: true, expectError: true });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(401);
  });

  it("invalid bearer token is rejected with 401", async () => {
    const url = `${globalThis.__EDUBOOST_API_URL__}/users/me`;
    const res = await fetch(url, {
      headers: { authorization: "Bearer not-a-real-token" },
    });
    expect(res.status).toBe(401);
  });
});
