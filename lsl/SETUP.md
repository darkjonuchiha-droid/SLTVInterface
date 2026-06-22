# SLTV — In-World Setup Guide

This is the human-run setup for the in-world objects. The web app lives on
GitHub Pages; the LSL scripts point at it via `PAGE_BASE` (set identically in
`tv_main.lsl`, `hud_remote.lsl`).

## You build three objects

### 1. The TV (screen)
- Rez a box; pick the face that will be the screen.
- Edit `tv_main.lsl`: set `SCREEN_FACE` to that face index and confirm `PAGE_BASE`.
- Drop `tv_main.lsl` into the prim (root).
- Put the two HUD objects (below) into the TV's inventory, named exactly
  **"SLTV Owner Remote"** and **"SLTV Guest Remote"**.
- Add `guest_dispenser.lsl` to the TV (or to a child prim that is the
  "Get Remote" button). It rezzes/gives the HUDs on touch.
- The region must allow **HTTP-in** (`llRequestURL`). On rez the TV owner-says
  "TV online" — if it says the control link failed, HTTP-in is off.

### 2. Owner Remote HUD
- A small prim; pick the face that shows the UI.
- Edit `hud_remote.lsl`: set `HUD_FACE` and confirm `PAGE_BASE`. Drop it in.
- Name the object **"SLTV Owner Remote"** and place a copy in the TV.

### 3. Guest Remote HUD
- Same as the Owner HUD but ALSO drop in `guest_attach.lsl`.
- Name it **"SLTV Guest Remote"** and place a copy in the TV.

## Experience (for silent guest auto-attach)

`guest_attach.lsl` uses an SL **Experience** so a guest who clicks the TV gets
the remote attached with no popup.

1. Have/obtain an Experience you can contribute to (Premium accounts can create
   grid-wide ones; land owners can scope one to their parcel).
2. In the script editor, compile `guest_attach.lsl` (and the other scripts is
   optional) **with that Experience selected** (Experience dropdown in the
   editor → your Experience → Save).
3. **Enable the Experience on the parcel** where the TV sits
   (World ▸ Parcel/Region ▸ Experiences ▸ Allowed).
4. Guests then click the TV → remote attaches silently.

**No Experience?** It still works — the guest is handed the HUD and clicks
**Wear** once (automatic fallback in `guest_dispenser.lsl`).

## Quick test

1. Rez the TV → you get "TV online".
2. Wear the Owner Remote → its face shows the remote UI (it auto-pairs).
3. Search a radio station → the TV screen plays it.
4. Settings → Fullscreen (all) → screen goes edge-to-edge for everyone.
5. Have a friend (or alt) click the TV → they get a Guest Remote; it can change
   channels but the Settings tab is hidden.
6. Reset the TV script, then tap your HUD → it re-pairs.

## Updating

Bump `TV_VERSION` in `tv_main.lsl` per release and publish a matching
`data/version.json` on the site. Existing TVs owner-say an "Update available"
notice when the hosted version is newer.
