import { describe, it, expect } from "vitest";
import { APP_VERSION, isNewer, parsePerms, canUse, checkForUpdate } from "../assets/settings.js";

describe("APP_VERSION", () => {
  it("is a semver string", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("isNewer", () => {
  it("compares semver", () => {
    expect(isNewer("2.1.0", "2.0.0")).toBe(true);
    expect(isNewer("2.0.1", "2.0.0")).toBe(true);
    expect(isNewer("2.0.0", "2.0.0")).toBe(false);
    expect(isNewer("1.9.9", "2.0.0")).toBe(false);
  });
});

describe("parsePerms", () => {
  it("defaults guests to radio/tv/party (no adult/settings)", () => {
    const { role, perms } = parsePerms("");
    expect(role).toBe("guest");
    expect(perms.has("radio")).toBe(true);
    expect(perms.has("tv")).toBe(true);
    expect(perms.has("party")).toBe(true);
    expect(perms.has("adult")).toBe(false);
    expect(perms.has("settings")).toBe(false);
  });
  it("honors an explicit perms list", () => {
    const { perms } = parsePerms("?role=guest&perms=radio");
    expect(perms.has("radio")).toBe(true);
    expect(perms.has("tv")).toBe(false);
  });
  it("reads the role", () => {
    expect(parsePerms("?role=owner").role).toBe("owner");
  });
});

describe("canUse", () => {
  it("owner can do anything", () => {
    expect(canUse("owner", new Set(), "settings")).toBe(true);
  });
  it("guest limited to their perms", () => {
    const perms = new Set(["radio"]);
    expect(canUse("guest", perms, "radio")).toBe(true);
    expect(canUse("guest", perms, "settings")).toBe(false);
  });
});

describe("checkForUpdate", () => {
  it("reports availability by comparing version.json to current", async () => {
    const fakeFetch = async () => ({ ok: true, json: async () => ({ version: "2.5.0", notes: "n", url: "u" }) });
    const r = await checkForUpdate(fakeFetch, "2.0.0");
    expect(r).toMatchObject({ available: true, version: "2.5.0", notes: "n", url: "u" });
  });
  it("reports none when equal", async () => {
    const fakeFetch = async () => ({ ok: true, json: async () => ({ version: "2.0.0" }) });
    expect((await checkForUpdate(fakeFetch, "2.0.0")).available).toBe(false);
  });
});
