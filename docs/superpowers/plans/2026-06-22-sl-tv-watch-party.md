# SL TV — Watch Party + Idle Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the Watch Party tab (Kosmi / CyTube / paste-any-URL), the `players/watch.html` wrapper that enables synced fullscreen for embeddable rooms, and the `players/idle.html` standby screen.

**Architecture:** Pure helpers in `party.js` build room URLs (CyTube channel → `cytu.be/r/<ch>`) and wrap them in `players/watch.html?src=…&fs=…` so a relayed fullscreen toggle applies to everyone. The remote's Party tab relays a `LOAD` of the wrapper. Reuses relay/favorites/protocol from Plans 1–2.

**Tech Stack:** ES modules, Vitest + jsdom.

## File structure (this plan)

```
SLTVInterface/
├── assets/
│   ├── party.js             ← cytubeUrl / watchWrapperUrl / partyTarget / partyToFavorite (pure)
│   ├── remote.css           ← (modify) party-row styles
│   └── remote.js            ← (modify) enable Party tab + wiring + party favorites
├── remote.html              ← (modify) Party panel + enable tab
├── players/
│   ├── watch.html           ← iframe wrapper (?src, ?fs)
│   └── idle.html            ← standby screen (clock + branding)
└── tests/
    ├── party.test.js
    └── remote-party.test.js
```

---

## Task 1: Watch wrapper page

**Files:**
- Create: `players/watch.html`

- [ ] **Step 1: Create `players/watch.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SL TV — Watch Party</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; background: #000; overflow: hidden; }
    iframe { width: 100vw; height: 100vh; border: 0; display: block; }
    .msg {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      color: #fff; font-family: "Segoe UI", system-ui, sans-serif; font-size: 16px; opacity: 0.85;
    }
  </style>
</head>
<body>
  <div class="msg" id="msg">Loading room…</div>
  <iframe id="frame" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerpolicy="origin-when-cross-origin"></iframe>
  <script>
    const p = new URLSearchParams(location.search);
    const src = p.get("src") || "";
    // fs=1 currently has no extra effect here (the iframe already fills the surface),
    // but the param is honored so the relayed display state stays consistent across pages.
    const frame = document.getElementById("frame");
    const msg = document.getElementById("msg");
    if (!src) {
      msg.textContent = "No room selected.";
    } else {
      frame.src = src;
      frame.addEventListener("load", () => { msg.style.display = "none"; });
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify it serves**

Run: `npm run serve`, open
`http://localhost:8080/players/watch.html?src=https%3A%2F%2Fwww.youtube.com%2Fembed%2FjfKfPfyJRdk`
Expected: the embedded YouTube lo-fi stream loads inside the wrapper (proves the iframe wrapper works for an embeddable source).

- [ ] **Step 3: Commit**

```bash
git add players/watch.html
git commit -m "feat: add watch-party iframe wrapper"
```

---

## Task 2: Idle / standby screen

**Files:**
- Create: `players/idle.html`

- [ ] **Step 1: Create `players/idle.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SL TV</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      background: radial-gradient(circle at 50% 40%, #15203a 0%, #04060c 75%);
      color: #fff; font-family: "Segoe UI", system-ui, sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100vh; overflow: hidden;
    }
    .logo { font-size: 64px; letter-spacing: 4px; font-weight: 800; }
    .logo span { color: #ff8a00; }
    .clock { font-size: 56px; margin-top: 16px; font-variant-numeric: tabular-nums; }
    .date { color: #9aa0b4; margin-top: 6px; font-size: 18px; }
    .hint { position: absolute; bottom: 28px; color: #6b7286; font-size: 13px; }
  </style>
</head>
<body>
  <div class="logo">SL<span>TV</span></div>
  <div class="clock" id="clock">--:--</div>
  <div class="date" id="date"></div>
  <div class="hint">Pick a channel on your remote to begin.</div>
  <script>
    function tick() {
      const now = new Date();
      document.getElementById("clock").textContent =
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      document.getElementById("date").textContent =
        now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    }
    tick();
    setInterval(tick, 10000);
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify it serves**

Run: `npm run serve`, open `http://localhost:8080/players/idle.html`
Expected: SLTV logo, a live clock, and today's date.

- [ ] **Step 3: Commit**

```bash
git add players/idle.html
git commit -m "feat: add idle/standby screen"
```

---

## Task 3: Party helpers

**Files:**
- Create: `assets/party.js`
- Test: `tests/party.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from "vitest";
import { cytubeUrl, watchWrapperUrl, partyTarget, partyToFavorite } from "../assets/party.js";

describe("cytubeUrl", () => {
  it("builds a cytu.be room url", () => {
    expect(cytubeUrl("myroom")).toBe("https://cytu.be/r/myroom");
  });
  it("encodes the channel", () => {
    expect(cytubeUrl("a b")).toBe("https://cytu.be/r/a%20b");
  });
});

describe("watchWrapperUrl", () => {
  it("wraps a src in the watch player", () => {
    const u = watchWrapperUrl("https://x/y");
    expect(u).toContain("players/watch.html");
    expect(u).toContain("src=https%3A%2F%2Fx%2Fy");
  });
  it("adds fs=1 when fullscreen", () => {
    expect(watchWrapperUrl("https://x", { fs: true })).toContain("fs=1");
  });
});

describe("partyTarget", () => {
  it("wraps a cytube channel", () => {
    const u = partyTarget({ kind: "cytube", value: "lobby" });
    expect(u).toContain("players/watch.html");
    expect(u).toContain(encodeURIComponent("https://cytu.be/r/lobby"));
  });
  it("wraps a pasted room url as-is", () => {
    const u = partyTarget({ kind: "custom", value: "https://kosmi.io/room/abc" });
    expect(u).toContain(encodeURIComponent("https://kosmi.io/room/abc"));
  });
});

describe("partyToFavorite", () => {
  it("stores the room url (not the wrapper) with a party type", () => {
    expect(partyToFavorite({ kind: "cytube", value: "lobby" }))
      .toMatchObject({ type: "party", url: "https://cytu.be/r/lobby" });
    expect(partyToFavorite({ kind: "custom", value: "https://k/r" }).url).toBe("https://k/r");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/party.test.js`
Expected: FAIL — cannot resolve `../assets/party.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// assets/party.js
export function cytubeUrl(channel) {
  return `https://cytu.be/r/${encodeURIComponent(channel)}`;
}

export function watchWrapperUrl(src, { fs = false } = {}) {
  return `players/watch.html?src=${encodeURIComponent(src)}${fs ? "&fs=1" : ""}`;
}

function roomUrlFor({ kind, value }) {
  return kind === "cytube" ? cytubeUrl(value) : value;
}

export function partyTarget(input) {
  return watchWrapperUrl(roomUrlFor(input));
}

export function partyToFavorite({ kind, value, name } = {}) {
  const url = roomUrlFor({ kind, value });
  const label = name || (kind === "cytube" ? `CyTube: ${value}` : url);
  return { type: "party", id: url, name: label, url, icon: "" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/party.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/party.js tests/party.test.js
git commit -m "feat: add watch-party url helpers"
```

---

## Task 4: Party tab markup, styles, and wiring

**Files:**
- Modify: `remote.html` (Party panel + enable tab)
- Modify: `assets/remote.css` (party-row styles)
- Modify: `assets/remote.js` (Party wiring + party favorites)
- Test: `tests/remote-party.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from "vitest";
import { partyPlayUrl } from "../assets/remote.js";

describe("partyPlayUrl", () => {
  it("returns an absolute watch-wrapper url for a room", () => {
    const u = partyPlayUrl("https://cytu.be/r/lobby");
    expect(u).toContain("players/watch.html");
    expect(u).toContain(encodeURIComponent("https://cytu.be/r/lobby"));
    expect(u.startsWith("http")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/remote-party.test.js`
Expected: FAIL — `partyPlayUrl` not exported.

- [ ] **Step 3: Enable the Party tab and add the panel in `remote.html`**

Change the Party tab button (remove `disabled`):
```html
    <button class="tab" data-tab="party">🎉 Party</button>
```

Add this panel immediately after `panel-tv`'s closing `</section>` and before `panel-favorites`:
```html
  <section id="panel-party" class="panel">
    <div class="party-row">
      <input id="cytubeInput" type="text" placeholder="CyTube channel name" />
      <button id="cytubeGo">Go</button>
      <button id="cytubeFav" class="fav" title="Favorite">☆</button>
    </div>
    <div class="party-row">
      <input id="roomInput" type="text" placeholder="Paste room/video URL (Kosmi, YouTube…)" />
      <button id="roomGo">Go</button>
      <button id="roomFav" class="fav" title="Favorite">☆</button>
    </div>
    <div class="hint">Synced by the service — everyone sees the same playback. Fullscreen syncs from the remote.</div>
  </section>
```

- [ ] **Step 4: Add party-row styles to `assets/remote.css`** (append):

```css
.party-row { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
.party-row input {
  flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #2a2f48;
  background: #0b0d18; color: var(--text); font-size: 14px;
}
.party-row button:not(.fav) {
  padding: 10px 14px; border: none; border-radius: 8px;
  background: var(--accent); color: #1a1200; font-weight: 700; cursor: pointer;
}
.party-row .fav { background: none; border: none; color: var(--accent); font-size: 20px; cursor: pointer; }
```

- [ ] **Step 5: Add Party wiring to `assets/remote.js`**

Add to the import block:
```js
import { cytubeUrl, watchWrapperUrl, partyToFavorite } from "./party.js";
```

Add before the init calls (`initTabs(); …`):
```js
export function partyPlayUrl(roomUrl) {
  return new URL(watchWrapperUrl(roomUrl), window.location.href).href;
}

function playParty(roomUrl) {
  if (!roomUrl) return;
  sendCommand(cfg, CMD.LOAD, { url: partyPlayUrl(roomUrl) }, { onDev: (e) => relayDev(e.cmd, e.params) });
}

function initParty() {
  const cyIn = document.getElementById("cytubeInput");
  const cyGo = document.getElementById("cytubeGo");
  const cyFav = document.getElementById("cytubeFav");
  const roomIn = document.getElementById("roomInput");
  const roomGo = document.getElementById("roomGo");
  const roomFav = document.getElementById("roomFav");
  if (cyGo) cyGo.addEventListener("click", () => { if (cyIn.value.trim()) playParty(cytubeUrl(cyIn.value.trim())); });
  if (cyFav) cyFav.addEventListener("click", () => { if (cyIn.value.trim()) toggleFavorite(partyToFavorite({ kind: "cytube", value: cyIn.value.trim() })); });
  if (roomGo) roomGo.addEventListener("click", () => { if (roomIn.value.trim()) playParty(roomIn.value.trim()); });
  if (roomFav) roomFav.addEventListener("click", () => { if (roomIn.value.trim()) toggleFavorite(partyToFavorite({ kind: "custom", value: roomIn.value.trim() })); });
}
```

Add `initParty();` to the init calls:
```js
initTabs();
initDebug();
initRadio();
initTv();
initParty();
```

Update `renderFavorites()`'s `.meta` click handler to play party favorites — replace it with:
```js
    row.querySelector(".meta").addEventListener("click", () => {
      if (f.type === "radio") playStation({ url: f.url });
      else if (f.type === "tv") playChannel({ url: f.url, name: f.name, logo: f.icon, tvgId: f.id });
      else if (f.type === "party") playParty(f.url);
    });
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/remote-party.test.js`
Expected: PASS (1 test).

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: all suites green (target: 46 tests).

- [ ] **Step 8: Verify in a browser**

Run: `npm run serve`, open `http://localhost:8080/remote.html`, click **🎉 Party**:
- type a CyTube channel (e.g. `lobby`) → **Go** → debug logs `LOAD …players/watch.html?src=…cytu.be%2Fr%2Flobby`.
- paste a Kosmi/YouTube URL → **Go** → logs the wrapped LOAD.
- ☆ adds the room to **Favs**; reopening from Favs replays it.

- [ ] **Step 9: Commit**

```bash
git add remote.html assets/remote.css assets/remote.js tests/remote-party.test.js
git commit -m "feat: add Watch Party tab (Kosmi/CyTube/custom + favorites)"
```

---

## Self-Review

**Spec coverage:** Kosmi/CyTube/custom watch party (Tasks 3,4) ✓; embeddable rooms wrapped for synced fullscreen via watch.html (Tasks 1,3,4) ✓; idle/standby screen (Task 2) ✓; party favorites incl. "CyTube via Favorites or Custom" (Tasks 3,4) ✓.

**Placeholder scan:** none; complete code in every step. ✓

**Type/name consistency:** `cytubeUrl`/`watchWrapperUrl`/`partyToFavorite` defined in Task 3, imported in Task 4. `partyPlayUrl` exported in Task 4, asserted in its test. `toggleFavorite`/`favorites`/`favKey`/`sendCommand`/`CMD`/`relayDev` reused from earlier `remote.js`. Favorite `type:"party"` handled in `renderFavorites`. ✓

## Done criteria

- `npm test` → all suites green.
- Browser: Party tab relays wrapped LOADs for CyTube + pasted URLs; favorites work; watch.html embeds YouTube; idle.html shows a live clock.
