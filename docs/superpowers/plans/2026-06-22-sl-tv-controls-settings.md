# SL TV — Controls & Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the Settings/controls tab — power, display modes, the synced-fullscreen toggle, aspect, volume, adult toggle — plus role/permission gating (guest vs owner) and an update-availability check. Completes the web app.

**Architecture:** A pure `settings.js` holds version/permission/update logic. The remote's Settings tab relays `POWER`/`DISPLAY`/`VOL`/`SET` commands (all already in the protocol). Role gating hides the Settings tab and any disallowed tabs from guests; in dev mode the remote is treated as owner so everything is testable. Update check fetches `data/version.json` and compares to the built-in `APP_VERSION`.

**Tech Stack:** ES modules, Vitest + jsdom.

## Design notes

- **Enforcement is LSL-side** (subsystem 4). The web role/permission gating is a UX layer; the TV still validates every command against the avatar's permission, so a guest editing the URL gains nothing.
- **Adult content browsing** isn't wired in this phase (no adult source built yet) — the Settings adult *toggle* relays `SET adult` so the in-world side and a later content source can honor it.

## File structure (this plan)

```
SLTVInterface/
├── assets/
│   ├── settings.js          ← APP_VERSION, isNewer, parsePerms, canUse, checkForUpdate (pure)
│   ├── remote.css           ← (modify) settings control styles
│   └── remote.js            ← (modify) Settings wiring + role/perms gating
├── remote.html              ← (modify) Settings panel + enable tab
├── data/
│   └── version.json         ← update-notification source
└── tests/
    ├── settings.test.js
    └── remote-settings.test.js
```

---

## Task 1: Settings logic

**Files:**
- Create: `assets/settings.js`
- Test: `tests/settings.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from "vitest";
import { APP_VERSION, isNewer, parsePerms, canUse, checkForUpdate } from "../assets/settings.js";

describe("APP_VERSION", () => {
  it("is a semver string", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("isNewer", () => {
  it("compares semver", () => {
    expect(isNewer("2.1.0", "2.0.0")).toBe(true);
    expect(isNewer("2.0.1", "2.0.0")).toBe(true);
    expect(isNewer("2.0.0", "2.0.0")).toBe(false);
    expect(isNewer("1.9.9", "2.0.0")).toBe(false);
  });
});

describe("parsePerms", () => {
  it("defaults guests to radio/tv/party (no adult/settings)", () => {
    const { role, perms } = parsePerms("");
    expect(role).toBe("guest");
    expect(perms.has("radio")).toBe(true);
    expect(perms.has("tv")).toBe(true);
    expect(perms.has("party")).toBe(true);
    expect(perms.has("adult")).toBe(false);
    expect(perms.has("settings")).toBe(false);
  });
  it("honors an explicit perms list", () => {
    const { perms } = parsePerms("?role=guest&perms=radio");
    expect(perms.has("radio")).toBe(true);
    expect(perms.has("tv")).toBe(false);
  });
  it("reads the role", () => {
    expect(parsePerms("?role=owner").role).toBe("owner");
  });
});

describe("canUse", () => {
  it("owner can do anything", () => {
    expect(canUse("owner", new Set(), "settings")).toBe(true);
  });
  it("guest limited to their perms", () => {
    const perms = new Set(["radio"]);
    expect(canUse("guest", perms, "radio")).toBe(true);
    expect(canUse("guest", perms, "settings")).toBe(false);
  });
});

describe("checkForUpdate", () => {
  it("reports availability by comparing version.json to current", async () => {
    const fakeFetch = async () => ({ ok: true, json: async () => ({ version: "2.5.0", notes: "n", url: "u" }) });
    const r = await checkForUpdate(fakeFetch, "2.0.0");
    expect(r).toMatchObject({ available: true, version: "2.5.0", notes: "n", url: "u" });
  });
  it("reports none when equal", async () => {
    const fakeFetch = async () => ({ ok: true, json: async () => ({ version: "2.0.0" }) });
    expect((await checkForUpdate(fakeFetch, "2.0.0")).available).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/settings.test.js`
Expected: FAIL — cannot resolve `../assets/settings.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// assets/settings.js
export const APP_VERSION = "2.0.0";

const GUEST_DEFAULT = ["radio", "tv", "party"];

export function isNewer(remote, local) {
  const a = String(remote).split(".").map(Number);
  const b = String(local).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

export function parsePerms(search) {
  const p = new URLSearchParams(search || "");
  const role = p.get("role") || "guest";
  const raw = p.get("perms");
  const perms = raw !== null
    ? new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))
    : new Set(GUEST_DEFAULT);
  return { role, perms };
}

export function canUse(role, perms, cap) {
  if (role === "owner") return true;
  return perms.has(cap);
}

export async function checkForUpdate(fetchFn = fetch, current = APP_VERSION) {
  const res = await fetchFn("data/version.json");
  if (!res.ok) throw new Error(`version.json HTTP ${res.status}`);
  const j = await res.json();
  return {
    available: isNewer(j.version, current),
    version: j.version,
    notes: j.notes || "",
    url: j.url || "",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/settings.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Create `data/version.json`**

```json
{
  "version": "2.0.0",
  "notes": "Initial 2.0 release: Radio, Live TV, Watch Party, Favorites.",
  "url": "https://github.com/darkjonuchiha-droid/SLTVInterface"
}
```

- [ ] **Step 6: Commit**

```bash
git add assets/settings.js tests/settings.test.js data/version.json
git commit -m "feat: add settings logic (version, perms, update check)"
```

---

## Task 2: Settings panel, styles, wiring + role gating

**Files:**
- Modify: `remote.html` (Settings panel + enable tab)
- Modify: `assets/remote.css` (control styles)
- Modify: `assets/remote.js` (Settings wiring + gating)
- Test: `tests/remote-settings.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/remote-settings.test.js`
Expected: FAIL — `displayCommandFor`/`applyRoleVisibility` not exported.

- [ ] **Step 3: Enable Settings tab + add panel in `remote.html`**

Change the Settings tab (remove `disabled`):
```html
    <button class="tab" data-tab="settings">⚙️ Settings</button>
```

Add this panel immediately after `panel-party`'s closing `</section>` and before `panel-favorites`:
```html
  <section id="panel-settings" class="panel">
    <div class="set-group">
      <div class="set-title">Power</div>
      <div class="btn-row">
        <button class="ctl" data-power="ON">⏻ On</button>
        <button class="ctl" data-power="OFF">⏾ Standby</button>
      </div>
    </div>
    <div class="set-group">
      <div class="set-title">Display</div>
      <div class="btn-row">
        <button class="ctl" data-disp="FIT">Fit</button>
        <button class="ctl" data-disp="FILL">Fill</button>
        <button class="ctl" data-disp="STRETCH">Stretch</button>
        <button class="ctl" data-disp="CINEMA">Cinema</button>
      </div>
      <div class="btn-row">
        <button class="ctl" data-disp="FS_ON">⛶ Fullscreen (all)</button>
        <button class="ctl" data-disp="FS_OFF">Windowed</button>
      </div>
      <div class="set-title">Aspect</div>
      <div class="btn-row">
        <button class="ctl" data-disp="ASPECT_169">16:9</button>
        <button class="ctl" data-disp="ASPECT_43">4:3</button>
        <button class="ctl" data-disp="ASPECT_219">21:9</button>
      </div>
    </div>
    <div class="set-group">
      <div class="set-title">Volume</div>
      <input id="volSlider" type="range" min="0" max="100" value="80" />
    </div>
    <div class="set-group">
      <div class="set-title">Content</div>
      <label class="toggle"><input type="checkbox" id="adultToggle" /> Enable adult category</label>
    </div>
    <div class="set-group">
      <div class="set-title">System</div>
      <div id="updateStatus" class="hint"></div>
      <div class="btn-row"><button class="ctl" id="checkUpdateBtn">Check for updates</button></div>
    </div>
  </section>
```

- [ ] **Step 4: Add control styles to `assets/remote.css`** (append):

```css
.set-group { margin-bottom: 16px; }
.set-title { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
.btn-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.ctl {
  flex: 1; min-width: 64px; padding: 10px 8px; border-radius: 8px; cursor: pointer;
  border: 1px solid #2a2f48; background: #0b0d18; color: var(--text); font-size: 13px;
}
.ctl:hover { border-color: var(--accent); }
.ctl:active { background: var(--accent); color: #1a1200; }
#volSlider { width: 100%; accent-color: var(--accent); }
.toggle { display: flex; align-items: center; gap: 8px; font-size: 14px; }
```

- [ ] **Step 5: Add Settings wiring + gating to `assets/remote.js`**

Add to the import block:
```js
import { APP_VERSION, parsePerms, canUse, checkForUpdate } from "./settings.js";
```

Add before the init calls:
```js
export function displayCommandFor(mode) {
  return { mode };
}

export function applyRoleVisibility(role, perms) {
  const capForTab = { radio: "radio", tv: "tv", party: "party", settings: "settings", favorites: null };
  document.querySelectorAll(".tab").forEach((t) => {
    const cap = capForTab[t.dataset.tab];
    const allowed = cap === null ? true : canUse(role, perms, cap);
    t.style.display = allowed ? "" : "none";
  });
}

function initSettings() {
  document.querySelectorAll("[data-power]").forEach((b) =>
    b.addEventListener("click", () => sendCommand(cfg, CMD.POWER, { state: b.dataset.power }, { onDev: (e) => relayDev(e.cmd, e.params) })));
  document.querySelectorAll("[data-disp]").forEach((b) =>
    b.addEventListener("click", () => sendCommand(cfg, CMD.DISPLAY, displayCommandFor(b.dataset.disp), { onDev: (e) => relayDev(e.cmd, e.params) })));
  const vol = document.getElementById("volSlider");
  if (vol) vol.addEventListener("change", () => sendCommand(cfg, CMD.VOL, { level: vol.value }, { onDev: (e) => relayDev(e.cmd, e.params) }));
  const adult = document.getElementById("adultToggle");
  if (adult) adult.addEventListener("change", () => sendCommand(cfg, CMD.SET, { key: "adult", value: adult.checked ? "on" : "off" }, { onDev: (e) => relayDev(e.cmd, e.params) }));
  const status = document.getElementById("updateStatus");
  if (status) status.textContent = `Version ${APP_VERSION}`;
  const btn = document.getElementById("checkUpdateBtn");
  if (btn && status) btn.addEventListener("click", async () => {
    status.textContent = "Checking…";
    try {
      const r = await checkForUpdate();
      status.textContent = r.available ? `Update available: v${r.version} — ${r.notes}` : `Up to date (v${APP_VERSION}).`;
    } catch (e) {
      status.textContent = `Update check failed: ${e.message}`;
    }
  });
}
```

Add `initSettings();` and the gating call to the init block (treat dev mode as owner so everything is testable):
```js
initTabs();
initDebug();
initRadio();
initTv();
initParty();
initSettings();
{
  const { perms } = parsePerms(window.location.search);
  applyRoleVisibility(cfg.isDev ? "owner" : cfg.role, perms);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/remote-settings.test.js`
Expected: PASS (3 tests).

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: all suites green (target: 57 tests).

- [ ] **Step 8: Verify in a browser**

Run: `npm run serve`, open `http://localhost:8080/remote.html`, click **⚙️ Settings**:
- Power/Display/Aspect buttons log `POWER`/`DISPLAY` commands in the debug panel.
- Volume slider logs `VOL`; adult toggle logs `SET {adult}`.
- "Check for updates" → "Up to date (v2.0.0)."
- Open `http://localhost:8080/remote.html?role=guest&perms=radio` → only **Radio** + **Favs** tabs show; **Settings** is hidden.

- [ ] **Step 9: Commit**

```bash
git add remote.html assets/remote.css assets/remote.js tests/remote-settings.test.js
git commit -m "feat: add Settings/controls tab with role gating and update check"
```

---

## Self-Review

**Spec coverage:** display modes incl. content-fit + aspect + synced fullscreen button (Task 2) ✓; power/standby (Task 2) ✓; volume (Task 2) ✓; adult owner-toggle relay (Task 2) ✓; owner/guest gating (Tasks 1,2) ✓; update notification surfaced in Settings + version.json (Task 1,2) ✓.

**Placeholder scan:** none; complete code each step. ✓

**Type/name consistency:** `displayCommandFor`/`applyRoleVisibility` exported in Task 2, asserted in its test. `canUse`/`parsePerms`/`checkForUpdate`/`APP_VERSION` from Task 1 used in Task 2. `sendCommand`/`CMD`/`relayDev`/`cfg` reused. ✓

## Done criteria

- `npm test` → all suites green (57 tests).
- Browser: Settings relays POWER/DISPLAY/VOL/SET; update check works; guest URL hides Settings + disallowed tabs.
- The web app is now feature-complete for browser testing; remaining work is the in-world LSL (subsystems 4–5).
