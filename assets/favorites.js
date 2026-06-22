// Favorites model — pure logic. Persistence side-effects live in remote.js.
export function favKey(item) {
  return `${item.type}:${item.id || item.url}`;
}

export function addFavorite(list, item) {
  const key = favKey(item);
  if (list.some((f) => favKey(f) === key)) return list.slice();
  return [...list, item];
}

export function removeFavorite(list, key) {
  return list.filter((f) => favKey(f) !== key);
}

export function serialize(list) {
  return JSON.stringify(list);
}

export function deserialize(str) {
  try {
    const v = JSON.parse(str);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
