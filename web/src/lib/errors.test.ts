import { describe, it, expect } from "vitest";
import { ApiError, friendlyMessage, humanizeError } from "./errors";

describe("ApiError", () => {
  it("stores status, code, message, and bodyText", () => {
    const err = new ApiError(403, "forbidden", "You don't have permission.", '{"error":"forbidden"}');
    expect(err.status).toBe(403);
    expect(err.code).toBe("forbidden");
    expect(err.message).toBe("You don't have permission.");
    expect(err.bodyText).toBe('{"error":"forbidden"}');
    expect(err.name).toBe("ApiError");
  });

  it("is an Error subclass (instanceof checks pass)", () => {
    const err = new ApiError(500, undefined, "boom", "");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });

  it("allows undefined code (when body wasn't JSON)", () => {
    const err = new ApiError(502, undefined, "Bad gateway", "<html>...</html>");
    expect(err.code).toBeUndefined();
  });
});

describe("friendlyMessage", () => {
  describe("Known backend codes", () => {
    it("maps unauthorized → sign-in prompt", () => {
      expect(friendlyMessage(401, "unauthorized")).toBe("You need to be signed in to do that.");
    });
    it("maps forbidden → permission denied", () => {
      expect(friendlyMessage(403, "forbidden")).toBe("You don't have permission to do that.");
    });
    it("maps banned → suspension message", () => {
      expect(friendlyMessage(403, "banned")).toBe(
        "Your account has been suspended. Check your email for details.",
      );
    });
    it("maps user_not_found → no-such-email", () => {
      expect(friendlyMessage(404, "user_not_found")).toBe("No user with that email.");
    });
    it("maps classroom_full → capacity error", () => {
      expect(friendlyMessage(409, "classroom_full")).toBe("This classroom is at capacity.");
    });
    it("maps below_minimum_wage → rate-floor explanation", () => {
      expect(friendlyMessage(400, "below_minimum_wage")).toBe(
        "Your hourly rate is below the platform minimum.",
      );
    });
    it("maps already_purchased → ownership note", () => {
      expect(friendlyMessage(409, "already_purchased")).toBe("You already own this.");
    });
    it("maps cognito_disable_failed → retry prompt", () => {
      expect(friendlyMessage(500, "cognito_disable_failed")).toBe(
        "We couldn't complete that action. Try again in a moment.",
      );
    });
    it("known code wins over status fallback", () => {
      // 500 fallback is "Something went wrong on our side", but a known code
      // should override it.
      expect(friendlyMessage(500, "cognito_disable_failed")).not.toContain(
        "Something went wrong on our side",
      );
    });
  });

  describe("Status-based fallbacks (no known code)", () => {
    it("400 → form check", () => {
      expect(friendlyMessage(400, undefined)).toContain("check the form");
    });
    it("401 → sign in", () => {
      expect(friendlyMessage(401, undefined)).toContain("signed in");
    });
    it("403 → permission denied", () => {
      expect(friendlyMessage(403, undefined)).toContain("permission");
    });
    it("404 → not found", () => {
      expect(friendlyMessage(404, undefined)).toContain("couldn't find");
    });
    it("409 → conflict / refresh", () => {
      expect(friendlyMessage(409, undefined)).toContain("clashes");
    });
    it("413 → file too large", () => {
      expect(friendlyMessage(413, undefined)).toContain("too large");
    });
    it("429 → slow down", () => {
      expect(friendlyMessage(429, undefined)).toContain("too fast");
    });
    it("500 → server error", () => {
      expect(friendlyMessage(500, undefined)).toContain("on our side");
    });
    it("502/503/504 also use the 5xx server message", () => {
      expect(friendlyMessage(502, undefined)).toContain("on our side");
      expect(friendlyMessage(503, undefined)).toContain("on our side");
    });
    it("anything weird falls back to a generic try-again", () => {
      expect(friendlyMessage(418, undefined)).toBe("Something went wrong. Please try again.");
    });
  });

  it("unknown code with known status falls back to status-based message", () => {
    // The mapping is "code wins if known, status falls back otherwise".
    expect(friendlyMessage(404, "totally_made_up_code")).toContain("couldn't find");
  });
});

describe("humanizeError", () => {
  it("uses ApiError.message when given an ApiError", () => {
    const err = new ApiError(403, "forbidden", "Custom forbidden msg", "");
    expect(humanizeError(err)).toBe("Custom forbidden msg");
  });

  it("translates legacy 'api 403: {json}' Errors to friendly text", () => {
    const err = new Error('api 403: {"error":"only_teachers_or_admins"}');
    expect(humanizeError(err)).toBe("Only teachers can create or manage this.");
  });

  it("translates legacy 'api 500: ...' to the 5xx fallback", () => {
    const err = new Error("api 500: <html>internal error</html>");
    // Body isn't JSON; falls back to status-only friendly message.
    expect(humanizeError(err)).toContain("on our side");
  });

  it("translates fetch TypeError to a network message", () => {
    const err = new TypeError("Failed to fetch");
    expect(humanizeError(err)).toContain("Couldn't reach the server");
  });

  it("passes through arbitrary Error.message untouched (non-API)", () => {
    const err = new Error("Database is locked");
    expect(humanizeError(err)).toBe("Database is locked");
  });

  it("returns a generic fallback for unknown thrown values", () => {
    expect(humanizeError("plain string")).toBe("Something went wrong. Please try again.");
    expect(humanizeError(null)).toBe("Something went wrong. Please try again.");
    expect(humanizeError(undefined)).toBe("Something went wrong. Please try again.");
    expect(humanizeError(42)).toBe("Something went wrong. Please try again.");
  });

  it("doesn't crash on legacy 'api 4xx:' with malformed JSON body", () => {
    const err = new Error("api 400: not json at all");
    // No code extracted; falls back to 400 friendly message.
    expect(humanizeError(err)).toContain("check the form");
  });
});
