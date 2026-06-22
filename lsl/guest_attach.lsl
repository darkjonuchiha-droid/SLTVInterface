// ===========================================================================
// SLTV — guest_attach.lsl  (lives IN the Guest HUD object, beside hud_remote.lsl)
// When the dispenser rezzes this HUD it is told which avatar to attach to.
// It uses an SL Experience to temp-attach silently (no blue dialog). If the
// Experience is unavailable/declined, it tells the dispenser to fall back to a
// manual Wear, then cleans itself up.
//
// SETUP: compile this inside your Experience. See lsl/SETUP.md.
// ===========================================================================

integer SETUP_CHANNEL = -748292;
integer ATTACH_POINT  = ATTACH_HUD_CENTER_2;

key     gTarget = NULL_KEY;
integer gDone   = FALSE;

default {
    on_rez(integer sp) {
        llListen(SETUP_CHANNEL, "", NULL_KEY, "");
        llSetTimerEvent(12.0);     // give up if never told a target / never attaches
    }

    listen(integer c, string nm, key id, string msg) {
        list p = llParseStringKeepNulls(msg, ["|"], []);
        if (llList2String(p, 0) != "SLTV_ATTACH") return;
        gTarget = (key)llList2String(p, 1);
        llRequestExperiencePermissions(gTarget, "");
    }

    experience_permissions(key who) {
        llAttachToAvatarTemp(ATTACH_POINT);   // temp -> auto-cleans on detach/logout
    }

    experience_permissions_denied(key who, integer reason) {
        // No Experience / declined -> let the TV hand over a wearable copy instead.
        llRegionSay(SETUP_CHANNEL, "SLTV_ATTACH_FAIL|" + (string)gTarget);
        if (llGetAttached() == 0) llDie();
    }

    attach(key id) {
        if (id != NULL_KEY) { gDone = TRUE; llSetTimerEvent(0.0); }
        // hud_remote.lsl (same object) pairs with the TV from here.
    }

    timer() {
        llSetTimerEvent(0.0);
        if (!gDone && llGetAttached() == 0) llDie();   // clean up an orphaned rez
    }
}
