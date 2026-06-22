# SL TV — In-World LSL Core (TV + Owner HUD) Plan

> Unlike the web plans, LSL is **not unit-testable in this repo**. This plan is a design + in-world verification checklist. Scripts live in `lsl/` and are pasted into in-world objects.

**Goal:** The TV prim receives token-validated commands over its `llRequestURL` HTTP cap and drives media-on-prim; the HUD pairs with it and shows `remote.html`. Power, display modes (incl. synced fullscreen), and smart memory (Linkset Data) work.

**Architecture:** HUD ↔ TV pair over a fixed `llRegionSay` channel; the TV replies with its cap URL + a per-session token (+ role + guest perms). The HUD loads `remote.html?relay=<cap>&role=&tok=&perms=` on its media face. The web remote fires image-GET commands to the cap; `tv_main` validates the token and acts. State persists in Linkset Data.

## Files

```
SLTVInterface/lsl/
├── protocol.lsl        ← reference: channel, command names, LSD keys (LSL has no #include; copy values)
├── tv_main.lsl         ← TV prim root script
└── hud_remote.lsl      ← HUD script (same script for Owner + Guest; role decided at runtime)
SLTVInterface/players/
├── radio.html          ← (no change needed; already reads fs)
└── livetv.html         ← (modify) honor &mode (fit/fill/stretch/cinema)
```

## Command protocol (must match assets/protocol.js)

- Transport: web → TV is fire-and-forget image-GET to `cap?cmd=…&tok=…&<params>`; reads are JSONP `cap?get=…&cb=…&tok=…`.
- Commands: `LOAD{url}`, `POWER{state}`, `DISPLAY{mode}`, `VOL{level}`, `FAV_ADD{type,id,name,url,icon}`, `FAV_DEL{key}`, `SET{key,value}`.
- Pairing (chat, channel `-748291`): HUD says `SLTV_PAIR|<wearerKey>`; TV replies `SLTV_ACK|<capURL>|<token>|<role>|<permsCSV>`.

## Permission model (TV-enforced)

- `role=owner` → every command allowed.
- `role=guest` → allowed by `permsCSV` (default `radio,tv,party`): may `LOAD`; `DISPLAY` needs `display`/`fullscreen`; `POWER`/`SET`/`FAV_*`/`VOL` owner-only unless listed. Token is issued by the TV at pair time and is unguessable, so editing the cap URL gains a guest nothing.

## Smart memory (Linkset Data keys)

`last_url`, `last_radio`, `last_tv`, `last_party`, `power`, `display`, `vol`, `adult`, `perms`, `favorites` (JSON array).

## Build steps

1. Create `lsl/protocol.lsl`, `lsl/tv_main.lsl`, `lsl/hud_remote.lsl` (full code in the implementation).
2. Modify `players/livetv.html` to honor `&mode`.
3. Set `PAGE_BASE` and `SCREEN_FACE`/`HUD_FACE` constants per build (documented at the top of each script).
4. Commit.

## In-world verification checklist (run by the human in Second Life)

- [ ] Rez a box, set a face to be the screen, paste `tv_main.lsl`. On rez, owner gets an IM/owner-say with the TV's cap URL (confirms `llRequestURL` granted; HTTP-in must be enabled on the region).
- [ ] Create a HUD prim, paste `hud_remote.lsl`, wear it. Its face should show the remote UI (confirms pairing + media load). If blank, check the HUD `HUD_FACE`.
- [ ] In the remote, pick a radio station → the TV screen loads the radio player and audio plays (confirms LOAD + media-on-prim; viewers may need media enabled).
- [ ] Pick a Live TV channel → video plays (hls.js on the prim).
- [ ] Settings → Fullscreen (all) → the screen reloads edge-to-edge for everyone nearby (confirms synced display reload).
- [ ] Settings → Standby → idle screen; On → resumes last channel (confirms power + memory).
- [ ] Reset the TV script → re-wear/own touch the HUD → it re-pairs automatically (confirms cap-URL re-issue + re-pair).

## Notes / known limits (honest)

- **Media audio is per-viewer** in SL; live streams are fine, on-demand sync is delegated to Kosmi/CyTube.
- **Favorites read-back**: `tv_main` stores favorites in LSD and serves them via JSONP, but wiring the remote to *read* them back (so a fresh HUD shows existing favorites) is a documented refinement; today the remote also keeps a local copy.
- **VOL**: SL media master volume is viewer-controlled; the command is stored as a preference and passed to our own player pages via `&vol` where applicable.
- **Physical aspect resize** is left as an optional, build-specific tweak; default display modes are content-fit + fullscreen handled by the player pages.
- Guest auto-attach (Experience) + the update-notification IM are **Plan 6**.
