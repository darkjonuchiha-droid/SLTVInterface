// Minimal M3U/M3U8 playlist parser → [{ name, logo, group, url, tvgId }].
function attr(line, key) {
  const m = line.match(new RegExp(`${key}="([^"]*)"`));
  return m ? m[1] : "";
}

export function parseM3U(text) {
  const lines = (text || "").split(/\r?\n/);
  const channels = [];
  let pending = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#EXTINF")) {
      const name = line.slice(line.indexOf(",") + 1).trim();
      pending = {
        name,
        logo: attr(line, "tvg-logo"),
        group: attr(line, "group-title"),
        tvgId: attr(line, "tvg-id"),
      };
    } else if (line && !line.startsWith("#")) {
      if (pending) {
        channels.push({ ...pending, url: line });
        pending = null;
      }
    }
  }
  return channels;
}
