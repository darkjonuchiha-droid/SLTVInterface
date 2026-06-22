// ===========================================================================
// SLTV — guest_dispenser.lsl  (in the TV's "Get Remote" face / child prim)
// Click by a guest -> rez the Guest HUD, which temp-attaches via an Experience.
// Click by the owner -> hands over the Owner HUD to wear.
// If the Experience attach is declined/unavailable, falls back to giving the
// Guest HUD for the visitor to Wear.
//
// SETUP: the TV's inventory must contain the two HUD objects named below, and
// these scripts must be compiled inside your Experience (see lsl/SETUP.md).
// ===========================================================================

string  GUEST_HUD = "SLTV Guest Remote";   // object in this prim's inventory
string  OWNER_HUD = "SLTV Owner Remote";   // object in this prim's inventory
integer SETUP_CHANNEL = -748292;

key gPendingTarget = NULL_KEY;

default {
    state_entry() {
        llListen(SETUP_CHANNEL, "", NULL_KEY, "");
    }

    touch_start(integer n) {
        key toucher = llDetectedKey(0);
        if (toucher == llGetOwner()) {
            if (llGetInventoryType(OWNER_HUD) == INVENTORY_OBJECT)
                llGiveInventory(toucher, OWNER_HUD);
            else
                llRegionSayTo(toucher, 0, "[SLTV] Owner remote not found in the TV.");
            return;
        }
        // guest: rez the HUD so it can attach itself via the Experience
        if (llGetInventoryType(GUEST_HUD) != INVENTORY_OBJECT) {
            llRegionSayTo(toucher, 0, "[SLTV] Guest remote unavailable.");
            return;
        }
        gPendingTarget = toucher;
        llRezObject(GUEST_HUD, llGetPos() + <0.0, 0.0, 0.5>, ZERO_VECTOR, ZERO_ROTATION, 0);
        llRegionSayTo(toucher, 0, "[SLTV] Handing you a remote…");
    }

    object_rez(key id) {
        if (gPendingTarget == NULL_KEY) return;
        // tell the freshly rezzed HUD which avatar to attach to
        llRegionSayTo(id, SETUP_CHANNEL, "SLTV_ATTACH|" + (string)gPendingTarget);
    }

    listen(integer c, string nm, key id, string msg) {
        list p = llParseStringKeepNulls(msg, ["|"], []);
        if (llList2String(p, 0) != "SLTV_ATTACH_FAIL") return;
        // Experience attach failed -> fall back to a manual Wear
        key target = (key)llList2String(p, 1);
        if (llGetInventoryType(GUEST_HUD) == INVENTORY_OBJECT) {
            llGiveInventory(target, GUEST_HUD);
            llRegionSayTo(target, 0, "[SLTV] Couldn't auto-attach — please Wear the remote I just gave you.");
        }
    }
}
