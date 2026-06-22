// Radio-Browser API client: builds search URLs, parses station results,
// and picks the playable stream URL. The network call is injectable for tests.
// Public mirror; a production build can resolve a live server from
// https://all.api.radio-browser.info/json/servers, but a stable mirror is fine to start.
export const RADIO_BROWSER_BASE = "https://de1.api.radio-browser.info";

export function buildSearchUrl(base, { name, tag, country, language, limit = 50, offset = 0 } = {}) {
  const params = {
    name, tag, country, language,
    limit, offset,
    hidebroken: "true",
    order: "clickcount",
    reverse: "true",
  };
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return `${base}/json/stations/search?${qs}`;
}

export function pickStreamUrl(station) {
  return station.url_resolved || station.url || "";
}

export function parseStations(raw) {
  return (raw || [])
    .map((s) => ({
      id: s.stationuuid,
      name: s.name,
      url: pickStreamUrl(s),
      icon: s.favicon || "",
      tags: s.tags || "",
      country: s.country || "",
      codec: s.codec || "",
      bitrate: s.bitrate || 0,
    }))
    .filter((s) => s.url);
}

export async function searchStations(base, query, fetchFn = fetch) {
  const res = await fetchFn(buildSearchUrl(base, query), {
    headers: { "User-Agent": "SLTV/2.0" },
  });
  if (!res.ok) throw new Error(`Radio-Browser HTTP ${res.status}`);
  return parseStations(await res.json());
}
