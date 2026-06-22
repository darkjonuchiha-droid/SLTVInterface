import { describe, it, expect } from "vitest";
import { buildSearchUrl, parseStations, pickStreamUrl, searchStations } from "../assets/radio-browser.js";

const BASE = "https://de1.api.radio-browser.info";

describe("buildSearchUrl", () => {
  it("builds a search url with encoded name and sane defaults", () => {
    const url = buildSearchUrl(BASE, { name: "lofi beats", limit: 30 });
    expect(url).toContain(`${BASE}/json/stations/search?`);
    expect(url).toContain("name=lofi%20beats");
    expect(url).toContain("limit=30");
    expect(url).toContain("hidebroken=true");
    expect(url).toContain("order=clickcount");
  });

  it("supports tag, country and language filters", () => {
    const url = buildSearchUrl(BASE, { tag: "jazz", country: "Italy", language: "english" });
    expect(url).toContain("tag=jazz");
    expect(url).toContain("country=Italy");
    expect(url).toContain("language=english");
  });
});

describe("parseStations", () => {
  it("maps raw stations and prefers url_resolved", () => {
    const raw = [
      { stationuuid: "a1", name: "Lofi", url: "http://x/a", url_resolved: "https://x/a", favicon: "f", tags: "lofi,chill", country: "US", codec: "MP3", bitrate: 128 },
    ];
    const out = parseStations(raw);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "a1", name: "Lofi", url: "https://x/a", icon: "f", country: "US", codec: "MP3", bitrate: 128 });
  });

  it("drops entries with no usable stream url", () => {
    const out = parseStations([{ stationuuid: "b", name: "Bad", url: "", url_resolved: "" }]);
    expect(out).toHaveLength(0);
  });
});

describe("pickStreamUrl", () => {
  it("returns url_resolved when present, else url", () => {
    expect(pickStreamUrl({ url: "u", url_resolved: "r" })).toBe("r");
    expect(pickStreamUrl({ url: "u", url_resolved: "" })).toBe("u");
  });
});

describe("searchStations", () => {
  it("fetches, parses and returns stations", async () => {
    const fakeFetch = async () => ({ ok: true, json: async () => ([{ stationuuid: "z", name: "Z", url_resolved: "https://z" }]) });
    const out = await searchStations(BASE, { name: "z" }, fakeFetch);
    expect(out[0].id).toBe("z");
  });
});
