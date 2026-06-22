// Relay command layer: turns remote actions into commands the TV receives.
// Real mode fires fire-and-forget image-GET requests at the TV cap URL
// (cross-origin-safe, no CORS). Dev mode (no relay param) records commands.
import { RELAY_PARAMS } from "./protocol.js";

export function parseRelayConfig(search) {
  const p = new URLSearchParams(search || "");
  const relay = p.get(RELAY_PARAMS.RELAY) || "";
  return {
    relay,
    role: p.get(RELAY_PARAMS.ROLE) || "guest",
    tok: p.get(RELAY_PARAMS.TOKEN) || "",
    isDev: relay === "",
  };
}

function appendParams(base, obj) {
  const qs = Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `${base}?${qs}` : base;
}

export function buildCommandUrl(relayBase, cmd, params = {}, tok = "") {
  return appendParams(relayBase, { cmd, tok, ...params });
}

export function buildJsonpUrl(relayBase, get, cbName, tok = "") {
  return appendParams(relayBase, { get, cb: cbName, tok });
}

export function sendCommand(cfg, cmd, params = {}, opts = {}) {
  if (cfg.isDev) {
    const evt = { cmd, params, ts: undefined };
    if (typeof opts.onDev === "function") opts.onDev(evt);
    return null;
  }
  const url = buildCommandUrl(cfg.relay, cmd, params, cfg.tok);
  const img = (opts.imageFactory || (() => new Image()))();
  img.src = url;
  return url;
}
