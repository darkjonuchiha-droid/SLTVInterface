import { parseM3U } from "./m3u.js";

export const IPTV_BASE = "https://iptv-org.github.io/iptv";

// Curated category subset (IPTV-org exposes more under /categories/<key>.m3u).
export const CATEGORIES = [
  { key: "news", label: "News" },
  { key: "sports", label: "Sports" },
  { key: "movies", label: "Movies" },
  { key: "entertainment", label: "Entertainment" },
  { key: "music", label: "Music" },
  { key: "documentary", label: "Documentary" },
  { key: "comedy", label: "Comedy" },
  { key: "kids", label: "Kids" },
  { key: "science", label: "Science" },
  { key: "travel", label: "Travel" },
];

export function categoryUrl(base, key) {
  return `${base}/categories/${key}.m3u`;
}

export async function fetchCategory(base, key, { fetchFn = fetch, limit = 200 } = {}) {
  const res = await fetchFn(categoryUrl(base, key));
  if (!res.ok) throw new Error(`IPTV-org HTTP ${res.status}`);
  const channels = parseM3U(await res.text());
  return channels.slice(0, limit);
}
