import { describe, it, expect, beforeEach } from "vitest";
import { displayCommandFor, applyRoleVisibility } from "../assets/remote.js";

describe("displayCommandFor", () => {
  it("maps a button value to a DISPLAY mode param", () => {
    expect(displayCommandFor("FS_ON")).toEqual({ mode: "FS_ON" });
    expect(displayCommandFor("ASPECT_43")).toEqual({ mode: "ASPECT_43" });
  });
});

describe("applyRoleVisibility", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button class="tab" data-tab="radio"></button>
      <button class="tab" data-tab="settings"></button>`;
  });
  it("hides the settings tab for a guest", () => {
    applyRoleVisibility("guest", new Set(["radio"]));
    expect(document.querySelector('[data-tab="settings"]').style.display).toBe("none");
    expect(document.querySelector('[data-tab="radio"]').style.display).not.toBe("none");
  });
  it("shows settings for an owner", () => {
    applyRoleVisibility("owner", new Set());
    expect(document.querySelector('[data-tab="settings"]').style.display).not.toBe("none");
  });
});
