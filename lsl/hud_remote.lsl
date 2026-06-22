// ===========================================================================
// SLTV — hud_remote.lsl   (script inside the worn HUD prim)
// Pairs with a nearby TV over chat, then shows remote.html on the HUD face.
// The SAME script serves the Owner HUD and the (temp-attached) Guest HUD —
// the TV decides the role from who is wearing it.
//
// SETUP: PAGE_BASE must match tv_main.lsl. HUD_FACE = the HUD face that shows
// the remote UI.
// ===========================================================================

string  PAGE_BASE   = "https://darkjonuchiha-droid.github.io/SLTVInterface";
integer HUD_FACE    = 0;
integer PAIR_CHANNEL = -748291;

key     gWearer = NULL_KEY;
integer gListen = -1;

pair() {
    if (gWearer == NULL_KEY) gWearer = llGetOwner();   // fallback (owner case)
    if (gListen != -1) llListenRemove(gListen);
    gListen = llListen(PAIR_CHANNEL, "", NULL_KEY, "");
    llRegionSay(PAIR_CHANNEL, "SLTV_PAIR|" + (string)gWearer);
    llSetText("Connecting to TV…", <1,1,1>, 1.0);
}

showRemote(string cap, string tok, string role, string perms) {
    string url = PAGE_BASE + "/remote.html"
        + "?relay=" + llEscapeURL(cap)
        + "&role="  + role
        + "&tok="   + tok
        + "&perms=" + llEscapeURL(perms);
    llSetPrimMediaParams(HUD_FACE, [
        PRIM_MEDIA_CURRENT_URL,    url,
        PRIM_MEDIA_HOME_URL,       url,
        PRIM_MEDIA_AUTO_PLAY,      TRUE,
        PRIM_MEDIA_AUTO_SCALE,     TRUE,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_ANYONE,
        PRIM_MEDIA_PERMS_CONTROL,  PRIM_MEDIA_PERM_NONE,
        PRIM_MEDIA_WIDTH_PIXELS,   1024,
        PRIM_MEDIA_HEIGHT_PIXELS,  1024
    ]);
    llSetText("", <1,1,1>, 0.0);
}

default {
    state_entry() {
        if (llGetAttached() != 0) pair();     // script reset while worn
    }

    attach(key id) {
        if (id != NULL_KEY) { gWearer = id; pair(); }
    }

    // tap the HUD to re-pair (e.g. after the TV script reset / region restart)
    touch_start(integer n) { pair(); }

    listen(integer chan, string nm, key id, string msg) {
        list p = llParseStringKeepNulls(msg, ["|"], []);
        if (llList2String(p, 0) != "SLTV_ACK") return;
        // SLTV_ACK | cap | token | role | perms
        showRemote(llList2String(p,1), llList2String(p,2), llList2String(p,3), llList2String(p,4));
        if (gListen != -1) { llListenRemove(gListen); gListen = -1; }
    }
}
