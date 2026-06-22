// ===========================================================================
// SLTV protocol reference  —  NOT a compiled object script.
// LSL has no #include, so copy these constants into tv_main.lsl / hud_remote.lsl
// and keep them identical to assets/protocol.js on the web side.
// ===========================================================================

// --- Pairing (chat) ---
// Channel both the TV and HUD use to find each other.
integer SLTV_PAIR_CHANNEL = -748291;
// HUD -> TV : "SLTV_PAIR|<wearerKey>"
// TV  -> HUD: "SLTV_ACK|<capURL>|<token>|<role>|<permsCSV>"
string  SLTV_PAIR  = "SLTV_PAIR";
string  SLTV_ACK   = "SLTV_ACK";

// --- Commands (web -> TV over the llRequestURL HTTP cap, image-GET) ---
//   cap?cmd=LOAD&tok=..&url=..
//   cap?cmd=POWER&tok=..&state=ON|OFF
//   cap?cmd=DISPLAY&tok=..&mode=FIT|FILL|STRETCH|CINEMA|FS_ON|FS_OFF|ASPECT_169|ASPECT_43|ASPECT_219
//   cap?cmd=VOL&tok=..&level=0..100
//   cap?cmd=FAV_ADD&tok=..&type=..&id=..&name=..&url=..&icon=..
//   cap?cmd=FAV_DEL&tok=..&key=type:idOrUrl
//   cap?cmd=SET&tok=..&key=adult&value=on|off
// --- Reads (JSONP) ---
//   cap?get=favorites&cb=..&tok=..   -> cb([ {..}, .. ])

// --- Linkset Data keys (smart memory) ---
//   last_url last_radio last_tv last_party power display vol adult perms favorites
