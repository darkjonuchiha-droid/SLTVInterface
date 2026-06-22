# SL TV — Full-Fledged Second Life Television System

**Date:** 2026-06-22
**Status:** Design approved, pending spec review
**Repo:** `SLTVInterface` (existing) — keeps the GitHub Pages domain `darkjonuchiha-droid.github.io/SLTVInterface/`

## 1. Summary

A complete, self-contained Second Life TV product: a screen object (prim) plus
Owner and Guest remote HUDs, driven by a static web app hosted on GitHub Pages.
No external server/backend.

Headline features:

- Synced watch parties via **Kosmi** (and **CyTube** via Favorites/Custom)
- **Radio-Browser** directory (tens of thousands of live stations) with search
- **IPTV-org** live-TV channels, categorized into a guide grid
- Custom Favorites system (any station / channel / room / URL)
- Owner remote HUD + auto-attached Guest remote HUD
- Multiple display modes (content-fit + optional physical aspect)
- Smart memory (per-category last selection, power, display, volume, settings)
- Built-in update notifications (owner-only, via hosted `version.json`)

## 2. Key decisions (locked during brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Build scope | **Web + LSL, no backend** (self-contained) |
| 2 | Control model | **Rich web HUD remote**: browse/search on the HUD, relay selection to TV |
| 3 | Distribution | **Distributable product** (rez-time config, owner/guest, updates, light copy-friendliness) — superset, also fine for personal use |
| 4 | Guest HUD attach | **Experience-based silent auto-attach** on TV click, with hand-to-Wear fallback where the Experience isn't enabled |
| 5 | Adult content | **Kept, owner-gated** (off by default; separate guest toggle) |
| 6 | Display modes | **Content-fit** (Fit/Fill/Stretch/Cinema) default + **optional physical aspect** (16:9/4:3/21:9) |
| 7 | Synced fullscreen | One-tap **Fullscreen relayed through the TV** → edge-to-edge video for **everyone at once** (not a per-viewer native click) |

## 3. Architecture

Three in-world objects (LSL) + static web pages (GitHub Pages). No server.

```
   IN-WORLD (LSL)                         WEB (GitHub Pages, static)
   ─────────────                          ──────────────────────────
  ┌─────────────┐   regionsay pairing    ┌────────────────────────┐
  │  Owner HUD  │◄──────────────────────►│  remote.html (the UI)  │
  │ (worn prim, │   loads UI w/ ?relay   │  Radio │ TV │ Party │   │
  │  media face)│───────────────────────►│  Favorites │ Settings  │
  └─────┬───────┘                        └───────────┬────────────┘
        │ image-GET commands (no CORS)               │ Radio-Browser API
        │ JSONP reads favorites/state                │ IPTV-org playlists
        ▼                                            │ Kosmi/CyTube/YouTube
  ┌─────────────┐   llRequestURL (http-in)           ▼
  │   TV PRIM   │◄───────────────────────  sets media-on-prim URL ──┐
  │  (screen)   │   • power / standby screen                        │
  │  main script│   • display modes                                 ▼
  │  +LinksetData   • favorites + smart memory (LinksetData)  ┌──────────────┐
  │  +update check  • update check vs version.json            │ player pages │
  └─────┬───────┘                                             │ radio / live │
        │ Experience temp-attach on "Get Remote" face         │ idle screen  │
        ▼                                                     └──────────────┘
  ┌─────────────┐
  │  Guest HUD  │  remote.html?role=guest (restricted by TV-side enforcement)
  └─────────────┘
```

### 3.1 Web → LSL command path (the real mechanism)

1. **TV prim** calls `llRequestURL()` → temporary in-world HTTP "cap URL". Re-requested
   on script start; cap URL changes on reset/region restart.
2. **HUD ↔ TV pairing** over a fixed LSL channel (`llRegionSay`/`llRegionSayTo`): HUD
   broadcasts a pair request; the TV replies with its cap URL **and a per-session token**.
3. HUD LSL loads `remote.html?relay=<capURL>&role=owner|guest&tok=<token>` onto its media face.
4. **Commands** (LOAD url, POWER, DISPLAY, FAV add/del, SETTING …) are sent as
   fire-and-forget **image-GET** requests to `<capURL>?cmd=…&tok=…` — cross-origin-safe
   (no CORS), no readable response needed.
5. **Reads** (favorites list, current state) use **JSONP** (`<script src=capURL?get=…&cb=…>`)
   to sidestep CORS.
6. TV's `http_request` handler **validates the token + avatar permission**, then acts
   (e.g. `llSetPrimMediaParams` with `PRIM_MEDIA_CURRENT_URL`/`HOME_URL`/`AUTO_PLAY`).

**Constraints designed around:** cap URL volatility → HUD auto re-pairs on attach and on a
"reconnect" tap; HUD + TV must be same region; watch-party sync is provided by the service
(Kosmi/CyTube), media-on-prim only guarantees everyone loads the same room URL.

### 3.2 Guest auto-attach (Experience)

- The TV linkset has a dedicated **"Get Remote" face / child prim**.
- Touching it runs an **SL Experience** (`llRequestExperiencePermissions` →
  `llAttachToAvatarTemp`) to **temp-attach** the guest HUD silently (no dialog).
- Temp-attach means the HUD auto-removes on detach/logout and never enters guest inventory.
- **Fallback:** on parcels where the Experience isn't enabled or perms are declined, the TV
  hands the HUD via `llGiveInventory` with a one-click Wear prompt.
- Setup: owner enables the Experience on their parcel once (documented in the setup notecard).

## 4. Components

### In-world (LSL)

- **`tv_main.lsl`** — root TV script. Media-on-prim control, `llRequestURL` server +
  command/JSONP handler, token issuing, Linkset Data store (memory + favorites + settings),
  power/standby, display modes, update check, pairing replies, guest dispenser trigger.
- **`hud_remote.lsl`** — worn HUD script (owner & guest share it, role differs). Pairing
  handshake, loads `remote.html` with relay/role/token, re-pair on attach/reconnect.
- **`guest_dispenser.lsl`** — handles the "Get Remote" face: Experience temp-attach + fallback.
- **`protocol.lsl`** — shared constants (channel numbers, command names, LSD keys).

### Web (GitHub Pages, served at repo root)

- **`remote.html`** + `assets/remote.js`/`remote.css` — the HUD UI. Tabs:
  - **Radio** — Radio-Browser search/browse (name/genre/country/language).
  - **Live TV** — IPTV-org guide grid, categorized, with a stream liveness check.
  - **Watch Party** — Kosmi create/join, CyTube channel, paste-any-URL. Embeddable
    rooms load through `players/watch.html` (enables synced fullscreen); rooms that
    refuse iframing navigate the prim directly (fullscreen then limited to their URL params).
  - **Favorites** — saved items of any type (source of truth = TV LinksetData).
  - **Settings** (owner only) — display mode, guest permissions, adult toggle, update badge, re-pair.
  - Reads `relay`/`role`/`tok` from query string; writes via image-GET, reads via JSONP.
- **`players/radio.html`** — audio player + now-playing art/visualizer.
- **`players/livetv.html`** — hls.js HLS player.
- **`players/watch.html`** — wrapper that iframes embeddable watch-party rooms so display
  state (incl. **synced fullscreen**) is controllable across all viewers.
- **`players/idle.html`** — standby screen (clock + branding).

All player pages accept a `&fs=1` (fullscreen) state from the relayed display command, so
the toggle is part of the shared media URL and applies to everyone at once.
- **`assets/`** — `radio-browser.js`, `iptv.js`, `hls.min.js`, shared CSS.
- **`data/version.json`** — `{ version, notes, url }` for update notifications.

## 5. Content sources

| Tab | Source | Notes |
|---|---|---|
| Radio | Radio-Browser API (no key) | Live catalog ~tens of thousands; real count is whatever the API returns |
| Live TV | IPTV-org public playlists (HLS) | Some streams geo-block/go offline → liveness check + Custom/Favorites escape hatch |
| Watch Party | Kosmi, CyTube (`cytu.be/r/<channel>`), any URL | Sync handled by the service |
| Favorites/Custom | User-defined | Also the home for CyTube channels and any arbitrary URL |

## 6. Smart memory (Linkset Data on TV)

Persists across rez / region restart: last channel overall, **last selection per category**,
power state, display mode, volume, favorites, adult-enabled flag, guest-permission settings,
pairing/setup state. Owner option: on power-on, auto-resume last channel or show idle screen.

## 7. Display modes

- **Content-fit** (default, no furniture resize): Fit / Fill / Stretch / Cinema (letterbox) —
  CSS class on the player pages toggled by command.
- **Physical aspect** (optional, owner): reshape screen prim to 16:9 / 4:3 / 21:9.
- **Power/Standby:** clean idle screen instead of a frozen frame.
- **Fullscreen (synced):** one tap on the remote relays a `fs=1` display state through the TV
  so the video goes edge-to-edge (chrome hidden, video fills 100%) on **every viewer's screen
  simultaneously**. It is a relayed command, *not* the player's native fullscreen button (that
  would only affect the clicker's own render). Perfect for our hosted players and chromeless
  embeds; best-effort for third-party apps we can't reach into across origins (e.g. Kosmi's
  internal sidebar). Owner-driven by default; can be added to the guest-permission toggles.

## 8. Permissions (TV-side enforced)

- **Owner:** full — settings, favorites add/edit/delete, adult toggle, guest-permission
  config, display, power, updates, re-pair.
- **Guest:** browse & select within owner-allowed categories; favorites read-only. Owner
  toggles per capability (change channel? Live TV? Radio? Party? adult?).
- **Security:** per-session token issued at pairing; every command carries it; TV validates
  token + avatar permission before acting (prevents cap-URL command spoofing).

## 9. Update notifications

On rez + every few hours the TV `llHTTPRequest`s `data/version.json`, compares to its built-in
version, and if newer **IMs the owner only** with notes + update location. Also surfaced as an
"Update available" badge in the remote's Settings. Non-intrusive.

## 10. Repo structure

```
SLTVInterface/                 ← GitHub Pages root (unchanged domain)
├── index.html                 ← marketing/launcher (kept)
├── remote.html                ← the HUD web app
├── players/  radio.html · livetv.html · idle.html
├── assets/   remote.css · remote.js · radio-browser.js · iptv.js · hls.min.js
├── data/     version.json
├── lsl/      tv_main.lsl · hud_remote.lsl · guest_dispenser.lsl · protocol.lsl
└── docs/superpowers/specs/2026-06-22-sl-tv-design.md
```

## 11. Build order (each phase independently testable)

1. Remote shell + tabs + **Radio** tab (Radio-Browser) + `radio.html` player.
2. **Live TV** tab + `livetv.html` (hls.js) + IPTV-org integration + liveness check.
3. **Watch Party** tab (Kosmi/CyTube/custom) + `idle.html`.
4. **`tv_main.lsl`**: media-on-prim, `llRequestURL` server, command handler, LSD memory,
   power, display modes.
5. **`hud_remote.lsl`**: pairing handshake + token + loads `remote.html?role=owner`.
6. **Guest auto-attach**: Experience temp-attach via `guest_dispenser.lsl` + permission
   enforcement + fallback.
7. **Favorites + smart memory** wiring (image-GET writes, JSONP reads, LSD store).
8. **Settings** (owner): guest perms, adult toggle, display modes, re-pair.
9. **Update notifications** (`version.json` + `llHTTPRequest`).
10. Polish, light copy-friendliness, setup notecard + landmarks.

## 12. Out of scope (YAGNI)

- No external/cloud backend or database.
- No cross-region control (HUD and TV are same-region).
- No DRM-restricted services (Netflix/Hulu etc. cannot be synced or framed; not pursued).
- No client-perfect frame sync beyond what Kosmi/CyTube provide.

## 13. Risks / open items

- **Radio-Browser / IPTV-org availability**: third-party, can change; mitigated by Custom/Favorites.
- **Experience requirement** for silent guest attach: buyers must enable on their parcel;
  mitigated by Wear fallback.
- **Cap URL volatility**: mitigated by auto re-pair.
- **Media-on-prim audio** is per-viewer (not synced) for radio/live TV — acceptable for live
  streams; on-demand sync is delegated to Kosmi/CyTube.
- **Native in-player fullscreen does not sync** across viewers (each renders independently) —
  mitigated by making fullscreen a relayed display command via our player wrapper; third-party
  app internal chrome is best-effort only.
