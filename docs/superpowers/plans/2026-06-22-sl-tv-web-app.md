# SL TV — Web App (Foundation + Radio) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the browser-testable foundation of the SL TV remote — the shell + tab nav, the relay command layer (with a dev mock), the Radio tab wired to the Radio-Browser API, a favorites model, and the radio player page — all runnable and unit-tested without Second Life.

**Architecture:** Static site served by GitHub Pages. Vanilla ES modules, no framework. Pure-logic modules (`relay`, `radio-browser`, `favorites`) are unit-tested with Vitest + jsdom; HTML pages wire them together and are verified in a browser. Commands the remote emits use the exact protocol the later LSL plan consumes: fire-and-forget image-GET to a cap URL (`?cmd=…&tok=…`), and JSONP for reads. When no `relay` query param is present the app runs in **dev mode** (commands logged to an on-page debug panel + localStorage), so the whole thing works offline in a browser.

**Tech Stack:** HTML5, ES modules, CSS. Radio-Browser HTTP API. Dev tooling: Node + npm, Vitest, jsdom, http-server.

---

## Subsystem map (this plan = subsystem 1 of 4)

1. **Web App — Foundation + Radio** ← this plan
2. Web App — Live TV (IPTV-org + hls.js) + Watch Party + Settings + idle screen
3. In-world LSL — TV main + Owner HUD + pairing/token + display/power/memory
4. In-world LSL — Guest Experience auto-attach + permission enforcement + update notifications

Spec: `docs/superpowers/specs/2026-06-22-sl-tv-design.md`.

## File structure (this plan)

```
SLTVInterface/
├── package.json                 ← dev tooling (test + serve scripts)
├── vitest.config.js             ← jsdom test env
├── .gitignore                   ← node_modules
├── remote.html                  ← remote shell + Radio tab markup
├── assets/
│   ├── protocol.js              ← shared command/param constants (mirrored in LSL later)
│   ├── relay.js                 ← parse relay config, build + send commands (image-GET), dev mock
│   ├── radio-browser.js         ← Radio-Browser URL builder + result parser + stream picker
│   ├── favorites.js             ← favorites model: add/remove/key/serialize (pure)
│   ├── remote.css               ← remote UI styles
│   └── remote.js                ← wires shell: tabs + Radio search + favorites + relay
├── players/
│   └── radio.html               ← audio player (reads ?src & ?fs), now-playing, fullscreen state
└── tests/
    ├── relay.test.js
    ├── radio-browser.test.js
    └── favorites.test.js
```

All paths below are relative to `SLTVInterface/` (the GitHub Pages root and the git repo).

---

## Task 0: Project tooling

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
.DS_Store
*.log
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "sltv-interface",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "serve": "http-server -p 8080 -c-1 ."
  },
  "devDependencies": {
    "http-server": "^14.1.1",
    "jsdom": "^24.0.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Create `vitest.config.js`**

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.js"],
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `vitest` and `http-server` resolvable. (`package-lock.json` is created — commit it.)

- [ ] **Step 5: Verify the test runner starts (no tests yet)**

Run: `npm test`
Expected: Vitest runs and reports `No test files found` (exit non-zero is fine here) — confirms the runner is wired.

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json package-lock.json vitest.config.js
git commit -m "chore: add web app dev tooling (vitest + http-server)"
```

---

## Task 1: Shared protocol constants

A single source of truth for command names and param keys, so `relay.js` and the later LSL scripts agree. Pure data — no test needed, but it is imported by tested modules.

**Files:**
- Create: `assets/protocol.js`

- [ ] **Step 1: Create `assets/protocol.js`**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add assets/protocol.js
git commit -m "feat: add shared command protocol constants"
```

---

## Task 2: Relay command layer

Parses the relay config from the page URL, builds command/JSONP URLs, and sends fire-and-forget image-GET commands. In dev mode (no `relay` param) it records commands instead of hitting the network.

**Files:**
- Create: `assets/relay.js`
- Test: `tests/relay.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/relay.test.js`
Expected: FAIL — `Failed to resolve import "../assets/relay.js"`.

- [ ] **Step 3: Write minimal implementation**

```js
// assets/relay.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/relay.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/relay.js tests/relay.test.js
git commit -m "feat: add relay command layer with dev mock"
```

---

## Task 3: Radio-Browser client

Builds Radio-Browser search URLs, parses station results, and picks the playable stream URL. The network call is injected so the parser is tested deterministically.

**Files:**
- Create: `assets/radio-browser.js`
- Test: `tests/radio-browser.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/radio-browser.test.js`
Expected: FAIL — cannot resolve `../assets/radio-browser.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// assets/radio-browser.js
// Public mirror; a production build can resolve a live server from
// https://all.api.radio-browser.info/json/servers, but a stable mirror is fine to start.
export const RADIO_BROWSER_BASE = "https://de1.api.radio-browser.info";

export function buildSearchUrl(base, { name, tag, country, language, limit = 50, offset = 0 } = {}) {
  const params = {
    name, tag, country, language,
    limit, offset,
    hidebroken: "true",
    order: "clickcount",
    reverse: "true",
  };
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return `${base}/json/stations/search?${qs}`;
}

export function pickStreamUrl(station) {
  return station.url_resolved || station.url || "";
}

export function parseStations(raw) {
  return (raw || [])
    .map((s) => ({
      id: s.stationuuid,
      name: s.name,
      url: pickStreamUrl(s),
      icon: s.favicon || "",
      tags: s.tags || "",
      country: s.country || "",
      codec: s.codec || "",
      bitrate: s.bitrate || 0,
    }))
    .filter((s) => s.url);
}

export async function searchStations(base, query, fetchFn = fetch) {
  const res = await fetchFn(buildSearchUrl(base, query), {
    headers: { "User-Agent": "SLTV/2.0" },
  });
  if (!res.ok) throw new Error(`Radio-Browser HTTP ${res.status}`);
  return parseStations(await res.json());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/radio-browser.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/radio-browser.js tests/radio-browser.test.js
git commit -m "feat: add Radio-Browser search client"
```

---

## Task 4: Favorites model

Pure favorites logic: a stable key per item, add with dedupe, remove, and JSON (de)serialize. Persistence side-effects live in `remote.js`, not here.

**Files:**
- Create: `assets/favorites.js`
- Test: `tests/favorites.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/favorites.test.js`
Expected: FAIL — cannot resolve `../assets/favorites.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// assets/favorites.js
export function favKey(item) {
  return `${item.type}:${item.id || item.url}`;
}

export function addFavorite(list, item) {
  const key = favKey(item);
  if (list.some((f) => favKey(f) === key)) return list.slice();
  return [...list, item];
}

export function removeFavorite(list, key) {
  return list.filter((f) => favKey(f) !== key);
}

export function serialize(list) {
  return JSON.stringify(list);
}

export function deserialize(str) {
  try {
    const v = JSON.parse(str);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/favorites.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/favorites.js tests/favorites.test.js
git commit -m "feat: add favorites model"
```

---

## Task 5: Remote shell (HTML + CSS + tab nav)

The chromeless remote UI with a top tab bar (Radio active; TV/Party/Favorites/Settings as stubs) and a dev debug panel that shows relayed commands in dev mode.

**Files:**
- Create: `remote.html`
- Create: `assets/remote.css`
- Create: `assets/remote.js` (init + tab switching only in this task; Radio wiring in Task 6)

- [ ] **Step 1: Create `assets/remote.css`**

```css
:root {
  --bg: #0d0f1a; --panel: #171a2b; --accent: #ff8a00; --text: #f2f3f7; --muted: #9aa0b4;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  font-family: "Segoe UI", system-ui, sans-serif;
  background: var(--bg); color: var(--text);
  display: flex; flex-direction: column; height: 100vh; overflow: hidden;
}
.tabs { display: flex; background: var(--panel); border-bottom: 1px solid #000; }
.tab {
  flex: 1; padding: 12px 6px; text-align: center; cursor: pointer;
  font-size: 13px; color: var(--muted); border: none; background: none;
}
.tab.active { color: var(--text); box-shadow: inset 0 -3px 0 var(--accent); }
.tab:disabled { opacity: 0.4; cursor: default; }
.panel { flex: 1; overflow-y: auto; padding: 12px; display: none; }
.panel.active { display: block; }
.search-row { display: flex; gap: 8px; margin-bottom: 12px; }
.search-row input {
  flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #2a2f48;
  background: #0b0d18; color: var(--text); font-size: 14px;
}
.search-row button {
  padding: 10px 14px; border: none; border-radius: 8px;
  background: var(--accent); color: #1a1200; font-weight: 700; cursor: pointer;
}
.station {
  display: flex; align-items: center; gap: 10px; padding: 10px;
  border-radius: 10px; background: var(--panel); margin-bottom: 8px; cursor: pointer;
}
.station:hover { outline: 1px solid var(--accent); }
.station img { width: 32px; height: 32px; border-radius: 6px; object-fit: cover; background: #000; }
.station .meta { flex: 1; min-width: 0; }
.station .name { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.station .sub { font-size: 11px; color: var(--muted); }
.station .fav { font-size: 18px; padding: 4px 8px; }
.hint, .empty { color: var(--muted); font-size: 13px; padding: 8px 2px; }
#debug {
  position: fixed; bottom: 0; left: 0; right: 0; max-height: 28%; overflow-y: auto;
  background: #000a; border-top: 1px solid var(--accent); padding: 6px 10px;
  font: 11px/1.4 monospace; color: #7CFC00; display: none;
}
#debug.show { display: block; }
```

- [ ] **Step 2: Create `remote.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SL TV Remote</title>
  <link rel="stylesheet" href="assets/remote.css" />
</head>
<body>
  <nav class="tabs">
    <button class="tab active" data-tab="radio">📻 Radio</button>
    <button class="tab" data-tab="tv" disabled>📺 TV</button>
    <button class="tab" data-tab="party" disabled>🎉 Party</button>
    <button class="tab" data-tab="favorites">⭐ Favs</button>
    <button class="tab" data-tab="settings" disabled>⚙️ Settings</button>
  </nav>

  <section id="panel-radio" class="panel active">
    <div class="search-row">
      <input id="radioSearch" type="text" placeholder="Search stations (name, genre)…" />
      <button id="radioSearchBtn">Search</button>
    </div>
    <div id="radioResults"><div class="hint">Search the Radio-Browser directory to begin.</div></div>
  </section>

  <section id="panel-favorites" class="panel">
    <div id="favList"><div class="empty">No favorites yet — tap ⭐ on a station.</div></div>
  </section>

  <div id="debug"></div>

  <script type="module" src="assets/remote.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `assets/remote.js` (init + tabs only)**

```js
import { parseRelayConfig } from "./relay.js";

const cfg = parseRelayConfig(window.location.search);

function showTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${name}`));
}

function initTabs() {
  document.querySelectorAll(".tab").forEach((t) => {
    if (t.disabled) return;
    t.addEventListener("click", () => showTab(t.dataset.tab));
  });
}

function initDebug() {
  if (!cfg.isDev) return;
  document.getElementById("debug").classList.add("show");
  logDebug(`dev mode — role=${cfg.role}; commands are logged, not sent.`);
}

export function logDebug(msg) {
  const el = document.getElementById("debug");
  if (!el) return;
  const line = document.createElement("div");
  line.textContent = `» ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

initTabs();
initDebug();
// Radio + favorites wiring added in Task 6.
export { cfg, showTab };
```

- [ ] **Step 4: Verify in a browser**

Run: `npm run serve`
Then open `http://localhost:8080/remote.html`.
Expected: tab bar renders; clicking **Favs** switches panels and back to **Radio**; a green dev-mode banner appears at the bottom reading "dev mode — role=guest…". (Disabled tabs do nothing.)

- [ ] **Step 5: Commit**

```bash
git add remote.html assets/remote.css assets/remote.js
git commit -m "feat: remote shell with tab nav and dev debug panel"
```

---

## Task 6: Radio tab wiring + favorites persistence

Wire the Radio search to the Radio-Browser client, render results, send a `LOAD` command on click (radio player URL), and toggle favorites (persisted to localStorage in dev, relayed via `FAV_ADD`/`FAV_DEL` in real mode).

**Files:**
- Modify: `assets/remote.js`
- Test: `tests/remote-radio.test.js` (DOM render test with injected search)

- [ ] **Step 1: Write the failing test**

```js
// tests/remote-radio.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/remote-radio.test.js`
Expected: FAIL — `renderStations` / `stationToFavorite` / `radioPlayerUrl` are not exported.

- [ ] **Step 3: Extend `assets/remote.js`**

Replace the final two lines (`// Radio + favorites wiring added in Task 6.` and the `export { cfg, showTab };` line) with:

```js
import { sendCommand } from "./relay.js";
import { CMD } from "./protocol.js";
import { RADIO_BROWSER_BASE, searchStations } from "./radio-browser.js";
import { favKey, addFavorite, removeFavorite, serialize, deserialize } from "./favorites.js";

const FAV_STORE = "sltv.favorites";

function loadFavorites() {
  return deserialize(localStorage.getItem(FAV_STORE) || "[]");
}
function saveFavorites(list) {
  localStorage.setItem(FAV_STORE, serialize(list));
}
let favorites = loadFavorites();

export function radioPlayerUrl(streamUrl, { fs = false } = {}) {
  const base = "players/radio.html";
  const qs = `src=${encodeURIComponent(streamUrl)}${fs ? "&fs=1" : ""}`;
  return `${base}?${qs}`;
}

export function stationToFavorite(station) {
  return { type: "radio", id: station.id, name: station.name, url: station.url, icon: station.icon || "" };
}

function relayDev(cmd, params) {
  logDebug(`${cmd} ${JSON.stringify(params)}`);
}

function playStation(station) {
  const playerUrl = radioPlayerUrl(station.url, { fs: false });
  // The TV serves the player page from the same Pages origin as the remote.
  const absolute = new URL(playerUrl, window.location.href).href;
  sendCommand(cfg, CMD.LOAD, { url: absolute }, { onDev: (e) => relayDev(e.cmd, e.params) });
}

function toggleFavorite(item) {
  const key = favKey(item);
  const exists = favorites.some((f) => favKey(f) === key);
  if (exists) {
    favorites = removeFavorite(favorites, key);
    if (cfg.isDev) relayDev(CMD.FAV_DEL, { key });
    else sendCommand(cfg, CMD.FAV_DEL, { key });
  } else {
    favorites = addFavorite(favorites, item);
    if (cfg.isDev) relayDev(CMD.FAV_ADD, item);
    else sendCommand(cfg, CMD.FAV_ADD, item);
  }
  saveFavorites(favorites);
  renderFavorites();
}

export function renderStations(stations, isFav) {
  const root = document.getElementById("radioResults");
  root.innerHTML = "";
  if (!stations.length) {
    root.innerHTML = `<div class="empty">No stations found.</div>`;
    return;
  }
  for (const s of stations) {
    const row = document.createElement("div");
    row.className = "station";
    row.innerHTML = `
      <img src="${s.icon || ""}" alt="" onerror="this.style.visibility='hidden'" />
      <div class="meta">
        <div class="name"></div>
        <div class="sub"></div>
      </div>
      <button class="fav" title="Favorite">${isFav(s) ? "★" : "☆"}</button>`;
    row.querySelector(".name").textContent = s.name;
    row.querySelector(".sub").textContent = [s.country, s.codec, s.bitrate ? `${s.bitrate}kbps` : ""].filter(Boolean).join(" · ");
    row.querySelector(".meta").addEventListener("click", () => playStation(s));
    row.querySelector("img").addEventListener("click", () => playStation(s));
    row.querySelector(".fav").addEventListener("click", (ev) => {
      ev.stopPropagation();
      toggleFavorite(stationToFavorite(s));
      const fresh = favorites.some((f) => favKey(f) === favKey(stationToFavorite(s)));
      ev.target.textContent = fresh ? "★" : "☆";
    });
    root.appendChild(row);
  }
}

function renderFavorites() {
  const root = document.getElementById("favList");
  if (!root) return;
  if (!favorites.length) {
    root.innerHTML = `<div class="empty">No favorites yet — tap ⭐ on a station.</div>`;
    return;
  }
  root.innerHTML = "";
  for (const f of favorites) {
    const row = document.createElement("div");
    row.className = "station";
    row.innerHTML = `<div class="meta"><div class="name"></div><div class="sub">${f.type}</div></div><button class="fav">★</button>`;
    row.querySelector(".name").textContent = f.name;
    row.querySelector(".meta").addEventListener("click", () => {
      if (f.type === "radio") playStation({ url: f.url });
    });
    row.querySelector(".fav").addEventListener("click", () => toggleFavorite(f));
    root.appendChild(row);
  }
}

async function runRadioSearch() {
  const term = document.getElementById("radioSearch").value.trim();
  const root = document.getElementById("radioResults");
  root.innerHTML = `<div class="hint">Searching…</div>`;
  try {
    const stations = await searchStations(RADIO_BROWSER_BASE, { name: term, limit: 50 });
    renderStations(stations, (s) => favorites.some((f) => favKey(f) === `radio:${s.id}`));
  } catch (e) {
    root.innerHTML = `<div class="empty">Search failed: ${e.message}</div>`;
  }
}

function initRadio() {
  document.getElementById("radioSearchBtn").addEventListener("click", runRadioSearch);
  document.getElementById("radioSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runRadioSearch();
  });
  renderFavorites();
}

initRadio();

export { cfg, showTab };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/remote-radio.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all suites pass (relay, radio-browser, favorites, remote-radio).

- [ ] **Step 6: Verify in a browser**

Run: `npm run serve` and open `http://localhost:8080/remote.html`.
Expected: type "lofi" → Search → station rows appear; clicking a row logs `LOAD {"url":".../players/radio.html?src=…"}` in the green debug panel; clicking ☆ flips to ★, logs `FAV_ADD …`, and the station appears under the **Favs** tab. Reload → favorites persist.

- [ ] **Step 7: Commit**

```bash
git add assets/remote.js tests/remote-radio.test.js
git commit -m "feat: wire Radio tab to Radio-Browser with favorites + relay"
```

---

## Task 7: Radio player page

The page the TV loads as media. Reads `?src` (stream URL) and `?fs` (fullscreen state), plays the audio, shows a now-playing card, and applies the synced fullscreen CSS state.

**Files:**
- Create: `players/radio.html`

- [ ] **Step 1: Create `players/radio.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SL TV — Radio</title>
  <style>
    :root { --accent: #ff8a00; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      background: radial-gradient(circle at 50% 30%, #1a1f3a 0%, #05060c 70%);
      color: #fff; font-family: "Segoe UI", system-ui, sans-serif;
      display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden;
    }
    .card { text-align: center; padding: 24px; }
    .disc {
      width: 180px; height: 180px; border-radius: 50%; margin: 0 auto 24px;
      background: conic-gradient(from 0deg, #222, #444, #222); border: 6px solid #111;
      display: flex; align-items: center; justify-content: center; font-size: 64px;
      animation: spin 6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .title { font-size: 22px; font-weight: 700; }
    .sub { color: #9aa0b4; margin-top: 6px; font-size: 14px; }
    .err { color: #ff6b6b; margin-top: 12px; font-size: 13px; }
    /* Synced fullscreen state (fs=1): hide chrome, maximize the visualizer. */
    body.fs .sub, body.fs .title { display: none; }
    body.fs .disc { width: 60vh; height: 60vh; font-size: 22vh; margin-bottom: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="disc">🎵</div>
    <div class="title" id="title">Radio</div>
    <div class="sub" id="sub">Connecting…</div>
    <div class="err" id="err"></div>
    <audio id="audio" autoplay></audio>
  </div>
  <script>
    const p = new URLSearchParams(location.search);
    const src = p.get("src") || "";
    if (p.get("fs") === "1") document.body.classList.add("fs");
    const audio = document.getElementById("audio");
    const sub = document.getElementById("sub");
    const err = document.getElementById("err");
    if (!src) {
      sub.textContent = "No stream selected.";
    } else {
      audio.src = src;
      audio.play().catch(() => { err.textContent = "Tap the screen to start audio."; });
      audio.addEventListener("playing", () => { sub.textContent = "● Live"; });
      audio.addEventListener("error", () => { err.textContent = "Stream unavailable."; sub.textContent = ""; });
      // SL media surfaces sometimes need a user gesture; clicking the prim provides it.
      document.body.addEventListener("click", () => audio.play().catch(() => {}));
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in a browser**

Run: `npm run serve` and open
`http://localhost:8080/players/radio.html?src=https%3A%2F%2Fstream.example%2Ftest` (or paste a real stream from a Radio-Browser result).
Expected: spinning disc; with a valid stream, audio plays and the subtitle shows "● Live". Add `&fs=1` to the URL → chrome hides and the disc fills the screen.

- [ ] **Step 3: End-to-end check (remote → player)**

Open `http://localhost:8080/remote.html`, search and click a real station. Copy the `LOAD` URL from the debug panel, open it in a new tab — the radio player should load that stream. (In-world this hop is done by the TV automatically.)

- [ ] **Step 4: Commit**

```bash
git add players/radio.html
git commit -m "feat: add radio player page with synced fullscreen state"
```

---

## Self-Review

**Spec coverage (this subsystem):**
- Radio tab + Radio-Browser search + station playback → Tasks 3, 6, 7 ✓
- Favorites (custom system, persisted) → Tasks 4, 6 ✓
- Relay command protocol (image-GET, dev mock, token) → Tasks 1, 2 ✓
- Synced fullscreen state on a player page → Task 7 (`fs=1`) ✓
- Remote shell / tabs (TV/Party/Settings stubbed for later plans) → Task 5 ✓
- **Deferred to later plans (intentionally):** Live TV/IPTV, Watch Party, Settings, idle screen, physical aspect, owner/guest enforcement, update notifications, all LSL. Listed in the subsystem map.

**Placeholder scan:** No TBD/TODO; every code step contains complete code; commands and expected outputs are concrete. ✓

**Type/name consistency:** `CMD.*` names match between `protocol.js` (Task 1) and usage in Tasks 2/6. `favKey/addFavorite/removeFavorite/serialize/deserialize` consistent across Tasks 4 and 6. `radioPlayerUrl/stationToFavorite/renderStations` defined and exported in Task 6 and asserted in its test. `searchStations/parseStations/pickStreamUrl/buildSearchUrl` consistent across Tasks 3 and 6. ✓

## Done criteria

- `npm test` → all four suites green.
- `npm run serve` → search radio, play a station, favorite it, favorites persist across reload, fullscreen param works on the player.
- Nothing references Second Life yet; the dev relay mock stands in for the TV.
