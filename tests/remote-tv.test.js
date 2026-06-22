import { describe, it, expect, beforeEach } from "vitest";
import { livePlayerUrl, channelToFavorite, renderChannels } from "../assets/remote.js";

beforeEach(() => {
  document.body.innerHTML = `<div id="tvResults"></div>`;
});

describe("livePlayerUrl", () => {
  it("targets the livetv player with the stream", () => {
    const url = livePlayerUrl("https://s/x.m3u8", { fs: false });
    expect(url).toContain("players/livetv.html");
    expect(url).toContain("src=https%3A%2F%2Fs%2Fx.m3u8");
  });
  it("adds fs=1 when fullscreen", () => {
    expect(livePlayerUrl("https://s/x.m3u8", { fs: true })).toContain("fs=1");
  });
});

describe("channelToFavorite", () => {
  it("maps a channel to a tv favorite, id falls back to url", () => {
    expect(channelToFavorite({ name: "CNN", url: "https://u", logo: "l", tvgId: "CNN.us" }))
      .toEqual({ type: "tv", id: "CNN.us", name: "CNN", url: "https://u", icon: "l" });
    expect(channelToFavorite({ name: "X", url: "https://u", logo: "", tvgId: "" }).id).toBe("https://u");
  });
});

describe("renderChannels", () => {
  it("renders a tile per channel", () => {
    renderChannels([{ name: "CNN", url: "https://u", logo: "", tvgId: "CNN.us" }], () => false);
    const tiles = document.querySelectorAll("#tvResults .tile");
    expect(tiles).toHaveLength(1);
    expect(tiles[0].querySelector(".tile-name").textContent).toBe("CNN");
  });
  it("shows an empty state", () => {
    renderChannels([], () => false);
    expect(document.querySelector("#tvResults .empty")).not.toBeNull();
  });
});
