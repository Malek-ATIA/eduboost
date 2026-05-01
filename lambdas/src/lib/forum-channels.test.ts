import { describe, it, expect } from "vitest";
import { FORUM_CHANNELS, getChannel, type ForumChannel } from "./forum-channels.js";

describe("forum channels", () => {
  it("ships at least the six MVP channels", () => {
    const expected = [
      "general",
      "mathematics",
      "sciences",
      "languages",
      "test-prep",
      "teachers-lounge",
    ];
    for (const id of expected) {
      expect(FORUM_CHANNELS.find((c) => c.id === id)).toBeDefined();
    }
  });

  it("every channel has unique id, name, and description", () => {
    const ids = new Set<string>();
    for (const c of FORUM_CHANNELS as ForumChannel[]) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.description).toBeTruthy();
      // ids must be unique — duplicates would silently merge posts in DDB
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
    }
  });

  it("ids are url-safe slugs (lowercase, alphanumeric + dashes)", () => {
    for (const c of FORUM_CHANNELS as ForumChannel[]) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe("getChannel", () => {
  it("returns the channel for a known id", () => {
    expect(getChannel("general")?.name).toBe("General");
    expect(getChannel("mathematics")?.name).toBe("Mathematics");
  });

  it("returns undefined for an unknown id", () => {
    expect(getChannel("does-not-exist")).toBeUndefined();
    expect(getChannel("")).toBeUndefined();
  });

  it("is case-sensitive (intentional — ids are lowercase)", () => {
    expect(getChannel("General")).toBeUndefined();
    expect(getChannel("MATHEMATICS")).toBeUndefined();
  });
});
