import { describe, it, expect } from "vitest";
import { currentRole, currentGroups, isAdmin } from "./cognito";
import type { CognitoUserSession } from "amazon-cognito-identity-js";

function mockSession(payload: Record<string, unknown>): CognitoUserSession {
  return {
    getIdToken: () => ({ payload }),
  } as unknown as CognitoUserSession;
}

describe("currentRole", () => {
  it("returns null for null session", () => {
    expect(currentRole(null)).toBe(null);
  });

  it('returns "student" when custom:role is student', () => {
    const s = mockSession({ "custom:role": "student" });
    expect(currentRole(s)).toBe("student");
  });

  it('returns "teacher" when custom:role is teacher', () => {
    const s = mockSession({ "custom:role": "teacher" });
    expect(currentRole(s)).toBe("teacher");
  });

  it('returns "parent" when custom:role is parent', () => {
    const s = mockSession({ "custom:role": "parent" });
    expect(currentRole(s)).toBe("parent");
  });

  it("returns null for an unrecognized role", () => {
    const s = mockSession({ "custom:role": "admin" });
    expect(currentRole(s)).toBe(null);
  });

  it("returns null when custom:role is missing", () => {
    const s = mockSession({});
    expect(currentRole(s)).toBe(null);
  });

  it("returns null when custom:role is a number", () => {
    const s = mockSession({ "custom:role": 42 });
    expect(currentRole(s)).toBe(null);
  });

  it("returns null when custom:role is an empty string", () => {
    const s = mockSession({ "custom:role": "" });
    expect(currentRole(s)).toBe(null);
  });
});

describe("currentGroups", () => {
  it("returns empty array for null session", () => {
    expect(currentGroups(null)).toEqual([]);
  });

  it("returns empty array when cognito:groups is missing", () => {
    const s = mockSession({});
    expect(currentGroups(s)).toEqual([]);
  });

  it("returns the groups array when present", () => {
    const s = mockSession({ "cognito:groups": ["admin", "beta"] });
    expect(currentGroups(s)).toEqual(["admin", "beta"]);
  });

  it("returns empty array when cognito:groups is not an array", () => {
    const s = mockSession({ "cognito:groups": "admin" });
    expect(currentGroups(s)).toEqual([]);
  });
});

describe("isAdmin", () => {
  it("returns false for null session", () => {
    expect(isAdmin(null)).toBe(false);
  });

  it("returns false when groups is empty", () => {
    const s = mockSession({ "cognito:groups": [] });
    expect(isAdmin(s)).toBe(false);
  });

  it('returns true when groups includes "admin"', () => {
    const s = mockSession({ "cognito:groups": ["admin"] });
    expect(isAdmin(s)).toBe(true);
  });

  it('returns true when "admin" is one of several groups', () => {
    const s = mockSession({ "cognito:groups": ["beta", "admin", "support"] });
    expect(isAdmin(s)).toBe(true);
  });

  it('returns false when "admin" is not in groups', () => {
    const s = mockSession({ "cognito:groups": ["beta", "support"] });
    expect(isAdmin(s)).toBe(false);
  });
});
