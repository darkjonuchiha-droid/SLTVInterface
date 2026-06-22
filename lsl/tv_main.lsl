// ===========================================================================
// SLTV — tv_main.lsl   (root script of the TV/screen prim)
// Receives token-validated commands over its llRequestURL HTTP cap and drives
// media-on-prim. Pairs with HUDs over chat. Persists state in Linkset Data.
//
// SETUP (edit these for your build):
//   PAGE_BASE   - your GitHub Pages root (no trailing slash)
//   SCREEN_FACE - the prim face that shows the media (the "screen")
// The region must allow HTTP-in (llRequestURL); most do.
// ===========================================================================

// ---- config ----
string  PAGE_BASE   = "https://darkjonuchiha-droid.github.io/SLTVInterface";
integer SCREEN_FACE = 0;
integer PAIR_CHANNEL = -748291;

// ---- runtime ----
string  gCap = "";          // current HTTP cap URL (changes on reset/restart)
list    gTokens;            // stride 3: [token, role, permsCSV]
integer MAX_TOKENS = 24;

// ---- update notifications ----
string  TV_VERSION = "2.0.0";   // bump when you ship; compared to data/version.json
key     gVerReq;
integer gNotified = FALSE;

// ---- helpers ----------------------------------------------------------------

ownerSay(string m) { llOwnerSay("[SLTV] " + m); }

// URL-decode and fetch one query value from the request's x-query-string.
string qval(string qs, string nm) {
    list parts = llParseString2List(qs, ["&"], []);
    integer i; integer n = llGetListLength(parts);
    for (i = 0; i < n; i++) {
        list kv = llParseStringKeepNulls(llList2String(parts, i), ["="], []);
        if (llList2String(kv, 0) == nm) return llUnescapeURL(llList2String(kv, 1));
    }
    return "";
}

string lsd(string k) { return llLinksetDataRead(k); }
put(string k, string v) { llLinksetDataWrite(k, v); }

string issueToken(string role, string perms) {
    string tok = (string)llGenerateKey();
    gTokens += [tok, role, perms];
    // keep the list bounded (drop oldest)
    while (llGetListLength(gTokens) > MAX_TOKENS * 3)
        gTokens = llDeleteSubList(gTokens, 0, 2);
    return tok;
}

// returns role for a token, or "" if unknown
string tokenRole(string tok) {
    integer i; integer n = llGetListLength(gTokens);
    for (i = 0; i < n; i += 3)
        if (llList2String(gTokens, i) == tok) return llList2String(gTokens, i + 1);
    return "";
}
string tokenPerms(string tok) {
    integer i; integer n = llGetListLength(gTokens);
    for (i = 0; i < n; i += 3)
        if (llList2String(gTokens, i) == tok) return llList2String(gTokens, i + 2);
    return "";
}

integer permsHas(string perms, string cap) {
    return llListFindList(llParseString2List(perms, [","], []), [cap]) != -1;
}

// is this command allowed for the given token?
integer allowed(string tok, string cmd, string mode) {
    string role = tokenRole(tok);
    if (role == "") return FALSE;          // unknown token
    if (role == "owner") return TRUE;      // owner can do anything
    string perms = tokenPerms(tok);
    if (cmd == "LOAD")
        return permsHas(perms, "radio") || permsHas(perms, "tv") || permsHas(perms, "party") || permsHas(perms, "load");
    if (cmd == "DISPLAY") {
        if (mode == "FS_ON" || mode == "FS_OFF") return permsHas(perms, "fullscreen") || permsHas(perms, "display");
        return permsHas(perms, "display");
    }
    if (cmd == "VOL")   return permsHas(perms, "volume") || permsHas(perms, "load");
    if (cmd == "POWER") return permsHas(perms, "power");
    if (cmd == "FAV_ADD" || cmd == "FAV_DEL") return permsHas(perms, "favorites");
    return FALSE;                          // SET and anything else: owner only
}

// Put a URL on the screen face as shared media-on-prim.
setScreen(string url) {
    llSetPrimMediaParams(SCREEN_FACE, [
        PRIM_MEDIA_CURRENT_URL,   url,
        PRIM_MEDIA_HOME_URL,      url,
        PRIM_MEDIA_AUTO_PLAY,     TRUE,
        PRIM_MEDIA_AUTO_SCALE,    TRUE,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_ANYONE,
        PRIM_MEDIA_PERMS_CONTROL,  PRIM_MEDIA_PERM_NONE,
        PRIM_MEDIA_WIDTH_PIXELS,  1280,
        PRIM_MEDIA_HEIGHT_PIXELS, 720
    ]);
}

// Remember the URL by category (derived from the path) and as last_url.
loadContent(string url) {
    put("last_url", url);
    if (llSubStringIndex(url, "/players/radio.html") != -1)  put("last_radio", url);
    else if (llSubStringIndex(url, "/players/livetv.html") != -1) put("last_tv", url);
    else if (llSubStringIndex(url, "/players/watch.html") != -1)  put("last_party", url);
    setScreen(url);
}

// Toggle/strip an "fs=1" flag on the current URL and reload (synced fullscreen).
string withFs(string url, integer on) {
    // remove any existing fs=1
    integer p = llSubStringIndex(url, "fs=1");
    if (p != -1) {
        // also remove a leading & or ? we may have added
        string before = llGetSubString(url, 0, p - 1);
        string after  = llGetSubString(url, p + 4, -1);
        url = before + after;
        // tidy a trailing/last separator
        if (llGetSubString(url, -1, -1) == "&" || llGetSubString(url, -1, -1) == "?")
            url = llGetSubString(url, 0, -2);
    }
    if (on) {
        if (llSubStringIndex(url, "?") == -1) url += "?fs=1";
        else url += "&fs=1";
    }
    return url;
}

powerOff() {
    put("power", "off");
    setScreen(PAGE_BASE + "/players/idle.html");
}
powerOn() {
    put("power", "on");
    string last = lsd("last_url");
    if (last == "") last = PAGE_BASE + "/players/idle.html";
    setScreen(last);
}

// ---- favorites (Linkset Data JSON array of objects) ----
string favListJson() { string a = lsd("favorites"); if (a == "") return "[]"; return a; }

favAdd(string ty, string fid, string nm, string url, string icon) {
    list items = llJson2List(favListJson());
    string obj = llList2Json(JSON_OBJECT, ["type", ty, "id", fid, "name", nm, "url", url, "icon", icon]);
    items += obj;                                   // remote already dedupes
    if (llGetListLength(items) > 100) items = llList2List(items, -100, -1);
    put("favorites", llList2Json(JSON_ARRAY, items));
}
favDel(string fkey) {
    list items = llJson2List(favListJson());
    list keep; integer i; integer n = llGetListLength(items);
    for (i = 0; i < n; i++) {
        string o = llList2String(items, i);
        string ty = llJsonGetValue(o, ["type"]);
        string fid = llJsonGetValue(o, ["id"]);
        string url = llJsonGetValue(o, ["url"]);
        string k = ty + ":" + fid;
        if (fid == JSON_INVALID || fid == "") k = ty + ":" + url;
        if (k != fkey) keep += o;
    }
    put("favorites", llList2Json(JSON_ARRAY, keep));
}

// returns TRUE if version a ("x.y.z") is newer than b
integer verNewer(string a, string b) {
    list la = llParseString2List(a, ["."], []);
    list lb = llParseString2List(b, ["."], []);
    integer i;
    for (i = 0; i < 3; i++) {
        integer va = (integer)llList2String(la, i);
        integer vb = (integer)llList2String(lb, i);
        if (va > vb) return TRUE;
        if (va < vb) return FALSE;
    }
    return FALSE;
}
checkUpdate() { gVerReq = llHTTPRequest(PAGE_BASE + "/data/version.json", [HTTP_METHOD, "GET"], ""); }

// ---- lifecycle --------------------------------------------------------------
default {
    state_entry() {
        if (lsd("perms") == "") put("perms", "radio,tv,party");   // default guest perms
        if (lsd("power") == "") put("power", "on");
        gTokens = [];
        gNotified = FALSE;
        llListen(PAIR_CHANNEL, "", NULL_KEY, "");
        llReleaseURL(gCap);
        gCap = "";
        llRequestURL();
        llSetTimerEvent(60.0);          // first update check shortly after start
    }

    on_rez(integer p) { llResetScript(); }
    changed(integer c) { if (c & CHANGED_REGION_START) llResetScript(); }

    timer() {
        llSetTimerEvent(21600.0);       // re-check roughly every 6 hours
        checkUpdate();
    }

    http_response(key id, integer status, list meta, string rbody) {
        if (id != gVerReq || status != 200) return;
        string v = llJsonGetValue(rbody, ["version"]);
        if (v == JSON_INVALID || v == "") return;
        if (verNewer(v, TV_VERSION) && !gNotified) {
            gNotified = TRUE;
            ownerSay("Update available: v" + v + " (you have v" + TV_VERSION + "). "
                + llJsonGetValue(rbody, ["notes"]) + "  " + llJsonGetValue(rbody, ["url"]));
        }
    }

    http_request(key id, string method, string body) {
        if (method == URL_REQUEST_GRANTED) {
            gCap = body;
            ownerSay("TV online. Control link ready.");
            // restore last screen state
            if (lsd("power") == "off") powerOff(); else powerOn();
            return;
        }
        if (method == URL_REQUEST_DENIED) {
            ownerSay("Could not get an HTTP control link (region HTTP-in may be off).");
            return;
        }

        string qs  = llGetHTTPHeader(id, "x-query-string");
        string tok = qval(qs, "tok");

        // ---- JSONP reads ----
        string get = qval(qs, "get");
        if (get != "") {
            string cb = qval(qs, "cb");
            string out = "[]";
            if (get == "favorites" && tokenRole(tok) != "") out = favListJson();
            llHTTPResponse(id, 200, cb + "(" + out + ")");
            return;
        }

        // ---- commands ----
        string cmd  = qval(qs, "cmd");
        string mode = qval(qs, "mode");
        if (!allowed(tok, cmd, mode)) { llHTTPResponse(id, 403, "denied"); return; }

        if (cmd == "LOAD") {
            loadContent(qval(qs, "url"));
        }
        else if (cmd == "POWER") {
            if (qval(qs, "state") == "OFF") powerOff(); else powerOn();
        }
        else if (cmd == "DISPLAY") {
            put("display", mode);
            string cur = lsd("last_url");
            if (mode == "FS_ON")  { cur = withFs(cur, TRUE);  put("last_url", cur); setScreen(cur); }
            else if (mode == "FS_OFF") { cur = withFs(cur, FALSE); put("last_url", cur); setScreen(cur); }
            // fit/fill/stretch/cinema/aspect: stored; player honors &mode on next load (refinement)
        }
        else if (cmd == "VOL") {
            put("vol", qval(qs, "level"));     // viewer-side master volume; stored as preference
        }
        else if (cmd == "SET") {
            put(qval(qs, "key"), qval(qs, "value"));
        }
        else if (cmd == "FAV_ADD") {
            favAdd(qval(qs,"type"), qval(qs,"id"), qval(qs,"name"), qval(qs,"url"), qval(qs,"icon"));
        }
        else if (cmd == "FAV_DEL") {
            favDel(qval(qs, "key"));
        }
        llHTTPResponse(id, 200, "ok");
    }

    listen(integer chan, string nm, key id, string msg) {
        list p = llParseStringKeepNulls(msg, ["|"], []);
        if (llList2String(p, 0) != "SLTV_PAIR") return;
        if (gCap == "") return;                       // not ready yet
        key wearer = (key)llList2String(p, 1);
        string role = "guest";
        string perms = lsd("perms");
        if (wearer == llGetOwner()) { role = "owner"; perms = ""; }
        string tok = issueToken(role, perms);
        llRegionSayTo(id, PAIR_CHANNEL, "SLTV_ACK|" + gCap + "|" + tok + "|" + role + "|" + perms);
    }
}
