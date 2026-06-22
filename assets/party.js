// Watch-party URL helpers. CyTube channels become cytu.be rooms; any room
// is wrapped in players/watch.html so a relayed fullscreen state stays consistent.
export function cytubeUrl(channel) {
  return `https://cytu.be/r/${encodeURIComponent(channel)}`;
}

export function watchWrapperUrl(src, { fs = false } = {}) {
  return `players/watch.html?src=${encodeURIComponent(src)}${fs ? "&fs=1" : ""}`;
}

function roomUrlFor({ kind, value }) {
  return kind === "cytube" ? cytubeUrl(value) : value;
}

export function partyTarget(input) {
  return watchWrapperUrl(roomUrlFor(input));
}

export function partyToFavorite({ kind, value, name } = {}) {
  const url = roomUrlFor({ kind, value });
  const label = name || (kind === "cytube" ? `CyTube: ${value}` : url);
  return { type: "party", id: url, name: label, url, icon: "" };
}
