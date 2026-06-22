export const APP_VERSION = "2.0.0";

const GUEST_DEFAULT = ["radio", "tv", "party"];

export function isNewer(remote, local) {
  const a = String(remote).split(".").map(Number);
  const b = String(local).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

export function parsePerms(search) {
  const p = new URLSearchParams(search || "");
  const role = p.get("role") || "guest";
  const raw = p.get("perms");
  const perms = raw !== null
    ? new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))
    : new Set(GUEST_DEFAULT);
  return { role, perms };
}

export function canUse(role, perms, cap) {
  if (role === "owner") return true;
  return perms.has(cap);
}

export async function checkForUpdate(fetchFn = fetch, current = APP_VERSION) {
  const res = await fetchFn("data/version.json");
  if (!res.ok) throw new Error(`version.json HTTP ${res.status}`);
  const j = await res.json();
  return {
    available: isNewer(j.version, current),
    version: j.version,
    notes: j.notes || "",
    url: j.url || "",
  };
}
