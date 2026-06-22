// Command vocabulary shared by the web remote and the in-world LSL scripts.
// Keep in sync with lsl/protocol.lsl (subsystem 3).
export const CMD = {
  LOAD: "LOAD",       // params: { url }
  POWER: "POWER",     // params: { state: "ON" | "OFF" }
  DISPLAY: "DISPLAY", // params: { mode: "FIT"|"FILL"|"STRETCH"|"CINEMA"|"FS_ON"|"FS_OFF"|"ASPECT_169"|"ASPECT_43"|"ASPECT_219" }
  VOL: "VOL",         // params: { level: 0..100 }
  FAV_ADD: "FAV_ADD", // params: { type, id, name, url, icon }
  FAV_DEL: "FAV_DEL", // params: { key }
  SET: "SET",         // params: { key, value }
};

// JSONP read endpoints (params: { get })
export const GET = {
  FAVORITES: "favorites",
  STATE: "state",
};

// Query param names on the remote page URL (set by the HUD LSL).
export const RELAY_PARAMS = {
  RELAY: "relay", // TV cap URL
  ROLE: "role",   // "owner" | "guest"
  TOKEN: "tok",   // per-session token
};
