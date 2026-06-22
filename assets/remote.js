import { parseRelayConfig, sendCommand } from "./relay.js";
import { CMD } from "./protocol.js";
import { RADIO_BROWSER_BASE, searchStations } from "./radio-browser.js";
import { favKey, addFavorite, removeFavorite, serialize, deserialize } from "./favorites.js";
import { IPTV_BASE, CATEGORIES, fetchCategory } from "./iptv.js";
import { cytubeUrl, watchWrapperUrl, partyToFavorite } from "./party.js";

const cfg = parseRelayConfig(window.location.search);

function showTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${name}`));
}

function initTabs() {
  document.querySelectorAll(".tab").forEach((t) => {
    if (t.disabled) return;
    t.addEventListener("click", () => showTab(t.dataset.tab));
  });
}

function initDebug() {
  if (!cfg.isDev) return;
  const el = document.getElementById("debug");
  if (!el) return;
  el.classList.add("show");
  logDebug(`dev mode — role=${cfg.role}; commands are logged, not sent.`);
}

export function logDebug(msg) {
  const el = document.getElementById("debug");
  if (!el) return;
  const line = document.createElement("div");
  line.textContent = `» ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

const FAV_STORE = "sltv.favorites";

function loadFavorites() {
  return deserialize(localStorage.getItem(FAV_STORE) || "[]");
}
function saveFavorites(list) {
  localStorage.setItem(FAV_STORE, serialize(list));
}
let favorites = loadFavorites();

export function radioPlayerUrl(streamUrl, { fs = false } = {}) {
  const base = "players/radio.html";
  const qs = `src=${encodeURIComponent(streamUrl)}${fs ? "&fs=1" : ""}`;
  return `${base}?${qs}`;
}

export function stationToFavorite(station) {
  return { type: "radio", id: station.id, name: station.name, url: station.url, icon: station.icon || "" };
}

function relayDev(cmd, params) {
  logDebug(`${cmd} ${JSON.stringify(params)}`);
}

function playStation(station) {
  const playerUrl = radioPlayerUrl(station.url, { fs: false });
  // The TV serves the player page from the same Pages origin as the remote.
  const absolute = new URL(playerUrl, window.location.href).href;
  sendCommand(cfg, CMD.LOAD, { url: absolute }, { onDev: (e) => relayDev(e.cmd, e.params) });
}

function toggleFavorite(item) {
  const key = favKey(item);
  const exists = favorites.some((f) => favKey(f) === key);
  if (exists) {
    favorites = removeFavorite(favorites, key);
    if (cfg.isDev) relayDev(CMD.FAV_DEL, { key });
    else sendCommand(cfg, CMD.FAV_DEL, { key });
  } else {
    favorites = addFavorite(favorites, item);
    if (cfg.isDev) relayDev(CMD.FAV_ADD, item);
    else sendCommand(cfg, CMD.FAV_ADD, item);
  }
  saveFavorites(favorites);
  renderFavorites();
}

export function renderStations(stations, isFav) {
  const root = document.getElementById("radioResults");
  root.innerHTML = "";
  if (!stations.length) {
    root.innerHTML = `<div class="empty">No stations found.</div>`;
    return;
  }
  for (const s of stations) {
    const row = document.createElement("div");
    row.className = "station";
    row.innerHTML = `
      <img src="${s.icon || ""}" alt="" onerror="this.style.visibility='hidden'" />
      <div class="meta">
        <div class="name"></div>
        <div class="sub"></div>
      </div>
      <button class="fav" title="Favorite">${isFav(s) ? "★" : "☆"}</button>`;
    row.querySelector(".name").textContent = s.name;
    row.querySelector(".sub").textContent = [s.country, s.codec, s.bitrate ? `${s.bitrate}kbps` : ""].filter(Boolean).join(" · ");
    row.querySelector(".meta").addEventListener("click", () => playStation(s));
    row.querySelector("img").addEventListener("click", () => playStation(s));
    row.querySelector(".fav").addEventListener("click", (ev) => {
      ev.stopPropagation();
      toggleFavorite(stationToFavorite(s));
      const fresh = favorites.some((f) => favKey(f) === favKey(stationToFavorite(s)));
      ev.target.textContent = fresh ? "★" : "☆";
    });
    root.appendChild(row);
  }
}

function renderFavorites() {
  const root = document.getElementById("favList");
  if (!root) return;
  if (!favorites.length) {
    root.innerHTML = `<div class="empty">No favorites yet — tap ⭐ on a station.</div>`;
    return;
  }
  root.innerHTML = "";
  for (const f of favorites) {
    const row = document.createElement("div");
    row.className = "station";
    row.innerHTML = `<div class="meta"><div class="name"></div><div class="sub">${f.type}</div></div><button class="fav">★</button>`;
    row.querySelector(".name").textContent = f.name;
    row.querySelector(".meta").addEventListener("click", () => {
      if (f.type === "radio") playStation({ url: f.url });
      else if (f.type === "tv") playChannel({ url: f.url, name: f.name, logo: f.icon, tvgId: f.id });
      else if (f.type === "party") playParty(f.url);
    });
    row.querySelector(".fav").addEventListener("click", () => toggleFavorite(f));
    root.appendChild(row);
  }
}

async function runRadioSearch() {
  const term = document.getElementById("radioSearch").value.trim();
  const root = document.getElementById("radioResults");
  root.innerHTML = `<div class="hint">Searching…</div>`;
  try {
    const stations = await searchStations(RADIO_BROWSER_BASE, { name: term, limit: 50 });
    renderStations(stations, (s) => favorites.some((f) => favKey(f) === `radio:${s.id}`));
  } catch (e) {
    root.innerHTML = `<div class="empty">Search failed: ${e.message}</div>`;
  }
}

function initRadio() {
  const btn = document.getElementById("radioSearchBtn");
  const input = document.getElementById("radioSearch");
  if (btn) btn.addEventListener("click", runRadioSearch);
  if (input) input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runRadioSearch();
  });
  renderFavorites();
}

export function livePlayerUrl(streamUrl, { fs = false } = {}) {
  const qs = `src=${encodeURIComponent(streamUrl)}${fs ? "&fs=1" : ""}`;
  return `players/livetv.html?${qs}`;
}

export function channelToFavorite(ch) {
  return { type: "tv", id: ch.tvgId || ch.url, name: ch.name, url: ch.url, icon: ch.logo || "" };
}

function playChannel(ch) {
  const absolute = new URL(livePlayerUrl(ch.url, { fs: false }), window.location.href).href;
  sendCommand(cfg, CMD.LOAD, { url: absolute }, { onDev: (e) => relayDev(e.cmd, e.params) });
}

export function renderChannels(channels, isFav) {
  const root = document.getElementById("tvResults");
  root.innerHTML = "";
  if (!channels.length) {
    root.innerHTML = `<div class="empty">No channels found.</div>`;
    return;
  }
  const grid = document.createElement("div");
  grid.className = "grid";
  for (const ch of channels) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.innerHTML = `
      <img src="${ch.logo || ""}" alt="" onerror="this.style.visibility='hidden'" />
      <div class="tile-name"></div>
      <button class="fav">${isFav(ch) ? "★" : "☆"}</button>`;
    tile.querySelector(".tile-name").textContent = ch.name;
    tile.querySelector("img").addEventListener("click", () => playChannel(ch));
    tile.querySelector(".tile-name").addEventListener("click", () => playChannel(ch));
    tile.querySelector(".fav").addEventListener("click", (ev) => {
      ev.stopPropagation();
      toggleFavorite(channelToFavorite(ch));
      ev.target.textContent = favorites.some((f) => favKey(f) === favKey(channelToFavorite(ch))) ? "★" : "☆";
    });
    grid.appendChild(tile);
  }
  root.appendChild(grid);
}

async function loadCategory(key, chipEl) {
  document.querySelectorAll("#tvCategories .chip").forEach((c) => c.classList.toggle("active", c === chipEl));
  const root = document.getElementById("tvResults");
  root.innerHTML = `<div class="hint">Loading channels…</div>`;
  try {
    const channels = await fetchCategory(IPTV_BASE, key, { limit: 120 });
    renderChannels(channels, (ch) => favorites.some((f) => favKey(f) === `tv:${ch.tvgId || ch.url}`));
  } catch (e) {
    root.innerHTML = `<div class="empty">Failed to load: ${e.message}</div>`;
  }
}

function initTv() {
  const bar = document.getElementById("tvCategories");
  if (!bar) return;
  for (const cat of CATEGORIES) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = cat.label;
    chip.addEventListener("click", () => loadCategory(cat.key, chip));
    bar.appendChild(chip);
  }
}

export function partyPlayUrl(roomUrl) {
  return new URL(watchWrapperUrl(roomUrl), window.location.href).href;
}

function playParty(roomUrl) {
  if (!roomUrl) return;
  sendCommand(cfg, CMD.LOAD, { url: partyPlayUrl(roomUrl) }, { onDev: (e) => relayDev(e.cmd, e.params) });
}

function initParty() {
  const cyIn = document.getElementById("cytubeInput");
  const cyGo = document.getElementById("cytubeGo");
  const cyFav = document.getElementById("cytubeFav");
  const roomIn = document.getElementById("roomInput");
  const roomGo = document.getElementById("roomGo");
  const roomFav = document.getElementById("roomFav");
  if (cyGo) cyGo.addEventListener("click", () => { if (cyIn.value.trim()) playParty(cytubeUrl(cyIn.value.trim())); });
  if (cyFav) cyFav.addEventListener("click", () => { if (cyIn.value.trim()) toggleFavorite(partyToFavorite({ kind: "cytube", value: cyIn.value.trim() })); });
  if (roomGo) roomGo.addEventListener("click", () => { if (roomIn.value.trim()) playParty(roomIn.value.trim()); });
  if (roomFav) roomFav.addEventListener("click", () => { if (roomIn.value.trim()) toggleFavorite(partyToFavorite({ kind: "custom", value: roomIn.value.trim() })); });
}

initTabs();
initDebug();
initRadio();
initTv();
initParty();

export { cfg, showTab };
