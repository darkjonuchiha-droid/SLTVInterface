import { describe, it, expect, vi } from "vitest";
import { parseRelayConfig, buildCommandUrl, buildJsonpUrl, sendCommand } from "../assets/relay.js";
import { CMD } from "../assets/protocol.js";

describe("parseRelayConfig", () => {
  it("reads relay, role and token from a query string", () => {
    const cfg = parseRelayConfig("?relay=https%3A%2F%2Fsim%2Fcap%2Fabc&role=owner&tok=xyz");
    expect(cfg.relay).toBe("https://sim/cap/abc");
    expect(cfg.role).toBe("owner");
    expect(cfg.tok).toBe("xyz");
    expect(cfg.isDev).toBe(false);
  });

  it("flags dev mode and defaults role to guest when relay is absent", () => {
    const cfg = parseRelayConfig("");
    expect(cfg.isDev).toBe(true);
    expect(cfg.role).toBe("guest");
  });
});

describe("buildCommandUrl", () => {
  it("appends cmd, token and encoded params", () => {
    const url = buildCommandUrl("https://sim/cap/abc", CMD.LOAD, { url: "https://x.tv/a b" }, "tok1");
    expect(url).toContain("https://sim/cap/abc?");
    expect(url).toContain("cmd=LOAD");
    expect(url).toContain("tok=tok1");
    expect(url).toContain("url=https%3A%2F%2Fx.tv%2Fa%20b");
  });
});

describe("buildJsonpUrl", () => {
  it("builds a get URL with a callback name", () => {
    const url = buildJsonpUrl("https://sim/cap/abc", "favorites", "cb7", "tok1");
    expect(url).toContain("get=favorites");
    expect(url).toContain("cb=cb7");
    expect(url).toContain("tok=tok1");
  });
});

describe("sendCommand", () => {
  it("in real mode sets an image src to the command URL", () => {
    const fake = { src: "" };
    const cfg = { relay: "https://sim/cap/abc", role: "owner", tok: "t", isDev: false };
    const url = sendCommand(cfg, CMD.POWER, { state: "ON" }, { imageFactory: () => fake });
    expect(fake.src).toBe(url);
    expect(url).toContain("cmd=POWER");
    expect(url).toContain("state=ON");
  });

  it("in dev mode records the command and does not build an image", () => {
    const log = [];
    const cfg = { relay: "", role: "guest", tok: "", isDev: true };
    const spy = vi.fn();
    sendCommand(cfg, CMD.LOAD, { url: "https://x.tv" }, { imageFactory: spy, onDev: (e) => log.push(e) });
    expect(spy).not.toHaveBeenCalled();
    expect(log[0].cmd).toBe("LOAD");
    expect(log[0].params.url).toBe("https://x.tv");
  });
});
