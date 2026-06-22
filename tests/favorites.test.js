import { describe, it, expect } from "vitest";
import { favKey, addFavorite, removeFavorite, serialize, deserialize } from "../assets/favorites.js";

const station = { type: "radio", id: "a1", name: "Lofi", url: "https://x/a", icon: "" };

describe("favKey", () => {
  it("is stable for type+id", () => {
    expect(favKey(station)).toBe("radio:a1");
  });
  it("falls back to url when id is missing", () => {
    expect(favKey({ type: "custom", url: "https://y" })).toBe("custom:https://y");
  });
});

describe("addFavorite", () => {
  it("adds an item", () => {
    const list = addFavorite([], station);
    expect(list).toHaveLength(1);
  });
  it("does not add duplicates", () => {
    const list = addFavorite(addFavorite([], station), station);
    expect(list).toHaveLength(1);
  });
  it("does not mutate the input list", () => {
    const a = [];
    addFavorite(a, station);
    expect(a).toHaveLength(0);
  });
});

describe("removeFavorite", () => {
  it("removes by key", () => {
    const list = addFavorite([], station);
    expect(removeFavorite(list, "radio:a1")).toHaveLength(0);
  });
});

describe("serialize/deserialize", () => {
  it("round-trips", () => {
    const list = addFavorite([], station);
    expect(deserialize(serialize(list))).toEqual(list);
  });
  it("deserialize tolerates junk", () => {
    expect(deserialize("not json")).toEqual([]);
  });
});
