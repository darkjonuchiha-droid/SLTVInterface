# SL TV — Guest Experience Attach + Update Notifications Plan

> LSL is **not unit-testable in this repo** — design + in-world checklist. Scripts in `lsl/`.

**Goal:** Click the TV → a Guest HUD silently temp-attaches via an SL Experience (with a Wear fallback); the TV periodically checks `data/version.json` and IMs the owner when a newer release exists.

## Files

```
SLTVInterface/lsl/
├── guest_dispenser.lsl   ← in the TV "Get Remote" face: rez/give HUDs on touch
├── guest_attach.lsl      ← in the Guest HUD: Experience temp-attach + fallback
├── tv_main.lsl           ← (modified) version-check timer + http_response + owner IM
└── SETUP.md              ← human in-world assembly + Experience steps
```

## Flow

- **Owner touches TV** → handed "SLTV Owner Remote" to wear.
- **Guest touches TV** → TV rezzes "SLTV Guest Remote"; the rezzed `guest_attach.lsl`
  is told the toucher's key on channel `-748292`, requests Experience permission,
  and `llAttachToAvatarTemp`s silently. On denial it pings the dispenser, which
  hands over the HUD for a manual Wear. A 12s timer cleans up an orphaned rez.
- **Updates** → `tv_main` fires a timer (≈6h, first at 60s), `llHTTPRequest`s
  `data/version.json`, compares `version` to `TV_VERSION`, and owner-says once if newer.

## In-world verification checklist (human)

- [ ] Owner clicks TV → receives Owner Remote.
- [ ] Alt/friend clicks TV with the Experience enabled → Guest Remote attaches, no popup.
- [ ] Disable the Experience → guest click hands over the HUD with a "please Wear" message.
- [ ] Guest Remote: Settings tab hidden; can change channel; can't power/settings.
- [ ] Publish `data/version.json` with a higher `version` → within the timer window the TV owner-says "Update available".

## Notes

- Temp-attach ownership/wearer identity and Experience compilation are in-world-only behaviors — verify per the SETUP.md steps.
- Update IM fires once per script run (resets on rez/region restart), so it won't nag.
