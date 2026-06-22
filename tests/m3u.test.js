import { describe, it, expect } from "vitest";
import { parseM3U } from "../assets/m3u.js";

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-id="CNN.us" tvg-logo="https://logo/cnn.png" group-title="News",CNN International
https://example.com/cnn.m3u8
#EXTINF:-1 group-title="Music",MTV Hits
https://example.com/mtv.m3u8
#EXTINF:-1 tvg-logo="",No Group Channel
https://example.com/x.m3u8`;

describe("parseM3U", () => {
  it("parses name, logo, group and url", () => {
    const ch = parseM3U(SAMPLE);
    expect(ch).toHaveLength(3);
    expect(ch[0]).toMatchObject({
      name: "CNN International",
      logo: "https://logo/cnn.png",
      group: "News",
      url: "https://example.com/cnn.m3u8",
      tvgId: "CNN.us",
    });
  });
  it("handles missing logo/group", () => {
    const ch = parseM3U(SAMPLE);
    expect(ch[2].name).toBe("No Group Channel");
    expect(ch[2].logo).toBe("");
    expect(ch[2].group).toBe("");
  });
  it("ignores entries without a following url", () => {
    const ch = parseM3U(`#EXTM3U\n#EXTINF:-1,Dangling`);
    expect(ch).toHaveLength(0);
  });
  it("returns [] for empty input", () => {
    expect(parseM3U("")).toEqual([]);
  });
});
