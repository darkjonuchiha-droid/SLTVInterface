import { describe, it, expect } from "vitest";
import { IPTV_BASE, CATEGORIES, categoryUrl, fetchCategory } from "../assets/iptv.js";

describe("CATEGORIES", () => {
  it("exposes a curated, non-empty list with key+label", () => {
    expect(CATEGORIES.length).toBeGreaterThan(3);
    expect(CATEGORIES[0]).toHaveProperty("key");
    expect(CATEGORIES[0]).toHaveProperty("label");
  });
});

describe("categoryUrl", () => {
  it("builds the IPTV-org category playlist url", () => {
    expect(categoryUrl(IPTV_BASE, "news")).toBe(`${IPTV_BASE}/categories/news.m3u`);
  });
});

describe("fetchCategory", () => {
  it("fetches playlist text and parses it, capped by limit", async () => {
    const m3u = `#EXTM3U\n#EXTINF:-1 group-title="News",A\nhttp://a\n#EXTINF:-1,B\nhttp://b`;
    const fakeFetch = async () => ({ ok: true, text: async () => m3u });
    const out = await fetchCategory(IPTV_BASE, "news", { fetchFn: fakeFetch, limit: 1 });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("A");
  });
  it("throws on a non-ok response", async () => {
    const fakeFetch = async () => ({ ok: false, status: 404 });
    await expect(fetchCategory(IPTV_BASE, "news", { fetchFn: fakeFetch })).rejects.toThrow();
  });
});
