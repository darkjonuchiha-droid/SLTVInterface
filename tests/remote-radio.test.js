import { describe, it, expect, beforeEach } from "vitest";
import { renderStations, stationToFavorite, radioPlayerUrl } from "../assets/remote.js";

beforeEach(() => {
  document.body.innerHTML = `<div id="radioResults"></div>`;
});

describe("radioPlayerUrl", () => {
  it("points at the radio player with the stream as src", () => {
    const url = radioPlayerUrl("https://stream/x", { fs: false });
    expect(url).toContain("players/radio.html");
    expect(url).toContain("src=https%3A%2F%2Fstream%2Fx");
  });
  it("adds fs=1 when fullscreen", () => {
    expect(radioPlayerUrl("https://s", { fs: true })).toContain("fs=1");
  });
});

describe("stationToFavorite", () => {
  it("maps a station into a favorite item", () => {
    const fav = stationToFavorite({ id: "a", name: "N", url: "https://u", icon: "i" });
    expect(fav).toEqual({ type: "radio", id: "a", name: "N", url: "https://u", icon: "i" });
  });
});

describe("renderStations", () => {
  it("renders one row per station with a name", () => {
    renderStations([{ id: "a", name: "Alpha", url: "https://u", icon: "" }], () => false);
    const rows = document.querySelectorAll("#radioResults .station");
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelector(".name").textContent).toBe("Alpha");
  });
  it("shows an empty state for no results", () => {
    renderStations([], () => false);
    expect(document.querySelector("#radioResults .empty")).not.toBeNull();
  });
});
