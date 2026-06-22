# SL TV — Live TV (IPTV-org + hls.js) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the Live TV tab — browse IPTV-org category playlists as a channel guide grid and play HLS channels on the TV, with favorites and the synced-fullscreen state.

**Architecture:** A pure M3U parser (`m3u.js`) feeds an IPTV-org source module (`iptv.js`) that fetches category playlists. The remote's TV tab renders a logo grid; selecting a channel relays a `LOAD` of `players/livetv.html`, which plays HLS via vendored hls.js. Reuses the relay/favorites/protocol layers from Plan 1.

**Tech Stack:** ES modules, hls.js (vendored), IPTV-org public playlists, Vitest + jsdom.

---

## Design notes / honest deviations from the spec

- **No grid-level liveness check.** The spec floated a "is this stream alive?" check in the guide. Pre-checking arbitrary stream hosts from `github.io` is blocked by CORS, so a reliable grid pre-check isn't feasible. Instead the **player** detects load failure and shows "Channel unavailable", and the Custom/Favorites path is the escape hatch. This is the realistic, honest implementation.
- **hls.js is vendored** to `assets/hls.min.js` (not a CDN) so the player has no third-party runtime dependency when rendered as SL media.

## File structure (this plan)

```
SLTVInterface/
├── assets/
│   ├── m3u.js               ← parse M3U playlists → channel objects (pure)
│   ├── iptv.js              ← IPTV-org category list + playlist URLs + fetch/parse
│   ├── hls.min.js           ← vendored hls.js runtime
│   ├── remote.css           ← (modify) add channel-grid styles
│   └── remote.js            ← (modify) enable TV tab + Live TV wiring
├── remote.html              ← (modify) add TV panel markup, enable TV tab
├── players/
│   └── livetv.html          ← hls.js player (?src, ?fs)
└── tests/
    ├── m3u.test.js
    ├── iptv.test.js
    └── remote-tv.test.js
```

---

## Task 1: M3U parser

**Files:**
- Create: `assets/m3u.js`
- Test: `tests/m3u.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/m3u.test.js`
Expected: FAIL — cannot resolve `../assets/m3u.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// assets/m3u.js
// Minimal M3U/M3U8 playlist parser → [{ name, logo, group, url, tvgId }].
function attr(line, key) {
  const m = line.match(new RegExp(`${key}="([^"]*)"`));
  return m ? m[1] : "";
}

export function parseM3U(text) {
  const lines = (text || "").split(/\r?\n/);
  const channels = [];
  let pending = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#EXTINF")) {
      const name = line.slice(line.indexOf(",") + 1).trim();
      pending = {
        name,
        logo: attr(line, "tvg-logo"),
        group: attr(line, "group-title"),
        tvgId: attr(line, "tvg-id"),
      };
    } else if (line && !line.startsWith("#")) {
      if (pending) {
        channels.push({ ...pending, url: line });
        pending = null;
      }
    }
  }
  return channels;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/m3u.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/m3u.js tests/m3u.test.js
git commit -m "feat: add M3U playlist parser"
```

---

## Task 2: IPTV-org source

**Files:**
- Create: `assets/iptv.js`
- Test: `tests/iptv.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/iptv.test.js`
Expected: FAIL — cannot resolve `../assets/iptv.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// assets/iptv.js
import { parseM3U } from "./m3u.js";

export const IPTV_BASE = "https://iptv-org.github.io/iptv";

// Curated category subset (IPTV-org exposes more under /categories/<key>.m3u).
export const CATEGORIES = [
  { key: "news", label: "News" },
  { key: "sports", label: "Sports" },
  { key: "movies", label: "Movies" },
  { key: "entertainment", label: "Entertainment" },
  { key: "music", label: "Music" },
  { key: "documentary", label: "Documentary" },
  { key: "comedy", label: "Comedy" },
  { key: "kids", label: "Kids" },
  { key: "science", label: "Science" },
  { key: "travel", label: "Travel" },
];

export function categoryUrl(base, key) {
  return `${base}/categories/${key}.m3u`;
}

export async function fetchCategory(base, key, { fetchFn = fetch, limit = 200 } = {}) {
  const res = await fetchFn(categoryUrl(base, key));
  if (!res.ok) throw new Error(`IPTV-org HTTP ${res.status}`);
  const channels = parseM3U(await res.text());
  return channels.slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/iptv.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/iptv.js tests/iptv.test.js
git commit -m "feat: add IPTV-org category source"
```

---

## Task 3: Vendor hls.js + livetv player

**Files:**
- Create: `assets/hls.min.js` (downloaded)
- Create: `players/livetv.html`

- [ ] **Step 1: Vendor hls.js**

Run:
```bash
curl -sL "https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js" -o assets/hls.min.js
node -e "const s=require('fs').statSync('assets/hls.min.js').size; if(s<100000) throw new Error('hls.min.js too small: '+s); console.log('hls.min.js bytes:', s)"
```
Expected: prints a byte count > 100000 (the real minified library, ~300KB).

- [ ] **Step 2: Create `players/livetv.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SL TV — Live TV</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; background: #000; }
    body { display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
    video { width: 100%; height: 100%; object-fit: contain; background: #000; }
    body.fs video { object-fit: cover; }   /* synced fullscreen: fill, crop bars */
    .msg {
      position: absolute; color: #fff; font-family: "Segoe UI", system-ui, sans-serif;
      font-size: 16px; text-align: center; opacity: 0.85;
    }
  </style>
</head>
<body>
  <video id="v" autoplay playsinline controls></video>
  <div class="msg" id="msg">Tuning…</div>
  <script src="../assets/hls.min.js"></script>
  <script>
    const p = new URLSearchParams(location.search);
    const src = p.get("src") || "";
    if (p.get("fs") === "1") document.body.classList.add("fs");
    const v = document.getElementById("v");
    const msg = document.getElementById("msg");
    function fail(t) { msg.textContent = t; msg.style.display = "block"; }
    function ok() { msg.style.display = "none"; }
    v.addEventListener("playing", ok);
    if (!src) {
      fail("No channel selected.");
    } else if (window.Hls && window.Hls.isSupported() && /\.m3u8(\?|$)/i.test(src)) {
      const hls = new window.Hls({ maxBufferLength: 10 });
      hls.loadSource(src);
      hls.attachMedia(v);
      hls.on(window.Hls.Events.ERROR, (_e, data) => {
        if (data && data.fatal) fail("Channel unavailable.");
      });
    } else {
      // Native HLS (Safari) or a direct media URL.
      v.src = src;
      v.addEventListener("error", () => fail("Channel unavailable."));
    }
    document.body.addEventListener("click", () => v.play().catch(() => {}));
  </script>
</body>
</html>
```

- [ ] **Step 3: Verify the player serves**

Run: `npm run serve` then open
`http://localhost:8080/players/livetv.html?src=https%3A%2F%2Ftest-streams.mux.dev%2Fx36xhzz%2Fx36xhzz.m3u8`
Expected: a public test HLS stream plays (proves hls.js is wired). A bogus `?src=https://nope/x.m3u8` shows "Channel unavailable."

- [ ] **Step 4: Commit**

```bash
git add assets/hls.min.js players/livetv.html
git commit -m "feat: add vendored hls.js and live-TV player"
```

---

## Task 4: TV tab markup, styles, and wiring

**Files:**
- Modify: `remote.html` (add TV panel, enable TV tab)
- Modify: `assets/remote.css` (channel grid styles)
- Modify: `assets/remote.js` (Live TV wiring)
- Test: `tests/remote-tv.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/remote-tv.test.js`
Expected: FAIL — `livePlayerUrl`/`channelToFavorite`/`renderChannels` not exported.

- [ ] **Step 3: Enable the TV tab and add the panel in `remote.html`**

Change the TV tab button (remove `disabled`):
```html
    <button class="tab" data-tab="tv">📺 TV</button>
```

Add this panel immediately after the closing `</section>` of `panel-radio` and before `panel-favorites`:
```html
  <section id="panel-tv" class="panel">
    <div id="tvCategories" class="chips"></div>
    <div id="tvResults"><div class="hint">Pick a category to load channels.</div></div>
  </section>
```

- [ ] **Step 4: Add grid/chip styles to `assets/remote.css`**

Append:
```css
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.chip {
  padding: 6px 12px; border-radius: 999px; border: 1px solid #2a2f48;
  background: #0b0d18; color: var(--text); font-size: 12px; cursor: pointer;
}
.chip.active { background: var(--accent); color: #1a1200; border-color: var(--accent); font-weight: 700; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.tile {
  background: var(--panel); border-radius: 10px; padding: 8px; text-align: center;
  cursor: pointer; position: relative;
}
.tile:hover { outline: 1px solid var(--accent); }
.tile img { width: 100%; height: 48px; object-fit: contain; background: #000; border-radius: 6px; }
.tile-name { font-size: 11px; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile .fav { position: absolute; top: 2px; right: 4px; font-size: 14px; background: none; border: none; color: var(--accent); cursor: pointer; }
</style>
```
(Replace the existing trailing `</style>`? No — `remote.css` is a plain stylesheet with no `</style>` tag; just append the rules above WITHOUT the `</style>` line.)

- [ ] **Step 5: Add Live TV wiring to `assets/remote.js`**

Add these imports to the existing import block at the top:
```js
import { IPTV_BASE, CATEGORIES, fetchCategory } from "./iptv.js";
```

Add before the final `initTabs(); initDebug(); initRadio();` calls:
```js
export function livePlayerUrl(streamUrl, { fs = false } = {}) {
  const qs = `src=${encodeURIComponent(streamUrl)}${fs ? "&fs=1" : ""}`;
  return `players/livetv.html?${qs}`;
}

export function channelToFavorite(ch) {
  return { type: "tv", id: ch.tvgId || ch.url, name: ch.name, url: ch.url, icon: ch.logo || "" };
}

function playChannel(ch) {
  const absolute = new URL(livePlayerUrl(ch.url, { fs: false }), window.location.href).href;
  sendCommand(cfg, CMD.LOAD, { url: absolute }, { onDev: (e) => relayDev(e.cmd, e.params) });
}

export function renderChannels(channels, isFav) {
  const root = document.getElementById("tvResults");
  root.innerHTML = "";
  if (!channels.length) {
    root.innerHTML = `<div class="empty">No channels found.</div>`;
    return;
  }
  const grid = document.createElement("div");
  grid.className = "grid";
  for (const ch of channels) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.innerHTML = `
      <img src="${ch.logo || ""}" alt="" onerror="this.style.visibility='hidden'" />
      <div class="tile-name"></div>
      <button class="fav">${isFav(ch) ? "★" : "☆"}</button>`;
    tile.querySelector(".tile-name").textContent = ch.name;
    tile.querySelector("img").addEventListener("click", () => playChannel(ch));
    tile.querySelector(".tile-name").addEventListener("click", () => playChannel(ch));
    tile.querySelector(".fav").addEventListener("click", (ev) => {
      ev.stopPropagation();
      toggleFavorite(channelToFavorite(ch));
      ev.target.textContent = favorites.some((f) => favKey(f) === favKey(channelToFavorite(ch))) ? "★" : "☆";
    });
    grid.appendChild(tile);
  }
  root.appendChild(grid);
}

async function loadCategory(key, chipEl) {
  document.querySelectorAll("#tvCategories .chip").forEach((c) => c.classList.toggle("active", c === chipEl));
  const root = document.getElementById("tvResults");
  root.innerHTML = `<div class="hint">Loading channels…</div>`;
  try {
    const channels = await fetchCategory(IPTV_BASE, key, { limit: 120 });
    renderChannels(channels, (ch) => favorites.some((f) => favKey(f) === `tv:${ch.tvgId || ch.url}`));
  } catch (e) {
    root.innerHTML = `<div class="empty">Failed to load: ${e.message}</div>`;
  }
}

function initTv() {
  const bar = document.getElementById("tvCategories");
  if (!bar) return;
  for (const cat of CATEGORIES) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = cat.label;
    chip.addEventListener("click", () => loadCategory(cat.key, chip));
    bar.appendChild(chip);
  }
}
```

Then add `initTv();` to the init calls so the block reads:
```js
initTabs();
initDebug();
initRadio();
initTv();
```

Also update `renderFavorites()` so a `tv` favorite plays the live player. Replace its `.meta` click handler block:
```js
    row.querySelector(".meta").addEventListener("click", () => {
      if (f.type === "radio") playStation({ url: f.url });
      else if (f.type === "tv") playChannel({ url: f.url, name: f.name, logo: f.icon, tvgId: f.id });
    });
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/remote-tv.test.js`
Expected: PASS (6 tests).

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: all suites pass (relay, radio-browser, favorites, remote-radio, m3u, iptv, remote-tv).

- [ ] **Step 8: Verify in a browser**

Run: `npm run serve`, open `http://localhost:8080/remote.html`, click **📺 TV**, click **News** → channel tiles with logos load; clicking a tile logs a `LOAD …players/livetv.html?src=…` in the debug panel; ★ adds it to **Favs**.

- [ ] **Step 9: Commit**

```bash
git add remote.html assets/remote.css assets/remote.js tests/remote-tv.test.js
git commit -m "feat: add Live TV tab (IPTV-org guide + favorites)"
```

---

## Self-Review

**Spec coverage:** Live TV channels categorized into a guide grid (Tasks 1,2,4) ✓; HLS playback (Task 3) ✓; favorites for TV (Task 4) ✓; synced fullscreen via `fs=1` (Task 3 player + Task 4 url builder) ✓; liveness handled in player, not grid (documented deviation) ✓.

**Placeholder scan:** No TBD/TODO; complete code in every step. ✓

**Type/name consistency:** `parseM3U` (Task 1) used by `fetchCategory` (Task 2) and consumed by `renderChannels`/`loadCategory` (Task 4). `channelToFavorite`/`livePlayerUrl`/`renderChannels` defined+exported in Task 4, asserted in its test. `favKey`/`toggleFavorite`/`favorites`/`relayDev`/`sendCommand`/`CMD` reused from Plan 1's `remote.js`. ✓

## Done criteria

- `npm test` → all suites green (target: 35 tests total).
- Browser: TV tab → category → real channel grid; play relays a livetv `LOAD`; favorite persists; test HLS stream plays in the player.
