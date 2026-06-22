import { describe, it, expect } from "vitest";
import { cytubeUrl, watchWrapperUrl, partyTarget, partyToFavorite } from "../assets/party.js";

describe("cytubeUrl", () => {
  it("builds a cytu.be room url", () => {
    expect(cytubeUrl("myroom")).toBe("https://cytu.be/r/myroom");
  });
  it("encodes the channel", () => {
    expect(cytubeUrl("a b")).toBe("https://cytu.be/r/a%20b");
  });
});

describe("watchWrapperUrl", () => {
  it("wraps a src in the watch player", () => {
    const u = watchWrapperUrl("https://x/y");
    expect(u).toContain("players/watch.html");
    expect(u).toContain("src=https%3A%2F%2Fx%2Fy");
  });
  it("adds fs=1 when fullscreen", () => {
    expect(watchWrapperUrl("https://x", { fs: true })).toContain("fs=1");
  });
});

describe("partyTarget", () => {
  it("wraps a cytube channel", () => {
    const u = partyTarget({ kind: "cytube", value: "lobby" });
    expect(u).toContain("players/watch.html");
    expect(u).toContain(encodeURIComponent("https://cytu.be/r/lobby"));
  });
  it("wraps a pasted room url as-is", () => {
    const u = partyTarget({ kind: "custom", value: "https://kosmi.io/room/abc" });
    expect(u).toContain(encodeURIComponent("https://kosmi.io/room/abc"));
  });
});

describe("partyToFavorite", () => {
  it("stores the room url (not the wrapper) with a party type", () => {
    expect(partyToFavorite({ kind: "cytube", value: "lobby" }))
      .toMatchObject({ type: "party", url: "https://cytu.be/r/lobby" });
    expect(partyToFavorite({ kind: "custom", value: "https://k/r" }).url).toBe("https://k/r");
  });
});
