// PlaylistSemanticMemory (§6.2): el significado de cada playlist es un DATO, no código.
export const ROLES = ["core", "mode", "shared", "discovery"];
export function makeSemantics(input = {}) {
  const out = {};
  for (const [id, s] of Object.entries(input)) {
    if (!ROLES.includes(s?.role)) throw new Error(`Playlist ${id}: rol desconocido «${s?.role}»`);
    if (s.role === "mode" && !s.mode) throw new Error(`Playlist ${id}: una playlist de modo necesita «mode»`);
    out[id] = { role: s.role, ...(s.mode ? { mode: s.mode } : {}), ...(s.label ? { label: s.label } : {}) };
  }
  return out;
}
export const roleOf = (semantics, playlistId) => semantics?.[playlistId] ?? { role: "discovery" };
