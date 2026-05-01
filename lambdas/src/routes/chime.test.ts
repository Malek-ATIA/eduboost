// Unit-test surface for the Chime route file. The route handlers themselves
// are AWS-SDK orchestration (CreateMeeting/Attendee/MediaPipeline) and
// can't be sensibly tested without mocking three SDKs + DDB — that's the
// integration suite's job. What we CAN unit-test cheaply:
//   1. the module loads (no top-level throws when env vars are absent)
//   2. the Hono router exposes the expected verb+path combinations
//
// If the route file ever drops `/sessions/:id/recording/start` or anyone
// renames the breakout endpoint, this catches it before deploy.

import { describe, it, expect } from "vitest";
import { chimeRoutes } from "./chime.js";

type Route = { method: string; path: string };

function listRoutes(): Route[] {
  // Hono exposes its registered routes via `.routes`. Each entry is
  // { method, path, handler }. We only need method+path for shape checks.
  // Cast through unknown because the public Hono type erases the array.
  const r = (chimeRoutes as unknown as { routes: Route[] }).routes;
  return r.map((x) => ({ method: x.method.toUpperCase(), path: x.path }));
}

describe("chimeRoutes — registered handlers", () => {
  const routes = listRoutes();
  // Hono inserts a wildcard middleware entry for `requireAuth`; we filter
  // it out for the path assertions but leave it for the auth check below.
  const handlers = routes.filter((r) => r.method !== "ALL");

  it("registers the meeting join + end endpoints", () => {
    expect(handlers).toContainEqual({
      method: "POST",
      path: "/sessions/:sessionId/join",
    });
    expect(handlers).toContainEqual({
      method: "POST",
      path: "/sessions/:sessionId/end",
    });
  });

  it("registers the recording start + stop endpoints", () => {
    expect(handlers).toContainEqual({
      method: "POST",
      path: "/sessions/:sessionId/recording/start",
    });
    expect(handlers).toContainEqual({
      method: "POST",
      path: "/sessions/:sessionId/recording/stop",
    });
  });

  it("registers the breakout CRUD endpoints", () => {
    expect(handlers).toContainEqual({
      method: "POST",
      path: "/sessions/:sessionId/breakouts",
    });
    expect(handlers).toContainEqual({
      method: "GET",
      path: "/sessions/:sessionId/breakouts",
    });
    expect(handlers).toContainEqual({
      method: "POST",
      path: "/sessions/:sessionId/breakouts/:breakoutId/join",
    });
    expect(handlers).toContainEqual({
      method: "DELETE",
      path: "/sessions/:sessionId/breakouts/:breakoutId",
    });
  });

  it("guards every route with the require-auth middleware (Hono `*` ALL handler)", () => {
    // The single `chimeRoutes.use("*", requireAuth)` registration shows up
    // as a wildcard. We don't assert on the handler reference (Hono wraps
    // it); we just confirm a wildcard middleware exists so the auth gate
    // is wired before any of the real verbs.
    const wildcards = routes.filter(
      (r) => r.path === "/*" || r.path === "*",
    );
    expect(wildcards.length).toBeGreaterThan(0);
  });
});
