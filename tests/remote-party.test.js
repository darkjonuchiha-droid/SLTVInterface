import { describe, it, expect } from "vitest";
import { partyPlayUrl } from "../assets/remote.js";

describe("partyPlayUrl", () => {
  it("returns an absolute watch-wrapper url for a room", () => {
    const u = partyPlayUrl("https://cytu.be/r/lobby");
    expect(u).toContain("players/watch.html");
    expect(u).toContain(encodeURIComponent("https://cytu.be/r/lobby"));
    expect(u.startsWith("http")).toBe(true);
  });
});
