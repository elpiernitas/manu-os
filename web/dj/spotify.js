// Adaptador de Spotify para el DJ (WEB-123). Spotify REPRODUCE y aporta candidatas; DJ-BRAIN DECIDE.
// Solo usa endpoints que una app nueva tiene disponibles: reproducción, cola, lo que suena,
// escuchado recientemente, tops, guardadas, playlists propias, artista (top y álbumes) y búsqueda.
// NO usa Recommendations, Related Artists, Audio Features ni Audio Analysis.
// Todo pasa por `fetchImpl` para poder probarlo con un Spotify falso.
export const DJ_SCOPES = [
  "user-read-playback-state", "user-modify-playback-state", "user-read-currently-playing",
  "user-read-recently-played", "user-top-read", "user-library-read",
  "playlist-read-private", "playlist-read-collaborative", "user-read-private",
].join(" ");
export const hasDjScopes = (granted) => DJ_SCOPES.split(" ").every((s) => String(granted ?? "").split(/\s+/).includes(s));

const API = "https://api.spotify.com/v1";

export class SpotifyError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status; }
}

/** Convierte una canción de Spotify a la `Track` del motor. Las etiquetas salen de los géneros del artista si los hay. */
export function toTrack(t, genres = {}) {
  if (!t?.uri || t.type === "episode" || t.is_local) return null;
  const a = t.artists?.[0];
  if (!a?.uri) return null;
  return {
    id: t.uri, title: t.name, artistId: a.uri, artistName: a.name, durationMs: t.duration_ms ?? 0,
    language: "unknown", tags: [...(genres[a.uri] ?? [])], popularity: typeof t.popularity === "number" ? t.popularity / 100 : undefined,
    album: t.album?.name ?? null, image: t.album?.images?.at(-1)?.url ?? t.album?.images?.[0]?.url ?? null,
  };
}

export function spotifyClient(getToken, fetchImpl = (...a) => fetch(...a)) {
  async function call(path, init = {}) {
    const token = await getToken();
    if (!token) throw new SpotifyError("Conecta Spotify", "auth", 401);
    let res;
    try { res = await fetchImpl(path.startsWith("http") ? path : `${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) } }); }
    catch { throw new SpotifyError("Sin conexión con Spotify", "network", 0); }
    if (res.status === 204 || res.status === 202) return null;
    if (res.status === 401) throw new SpotifyError("La sesión de Spotify ha caducado", "auth", 401);
    if (res.status === 403) throw new SpotifyError("Spotify no lo permite (la reproducción exige Premium, o faltan permisos)", "forbidden", 403);
    if (res.status === 404) throw new SpotifyError("Spotify no encuentra un dispositivo activo", "device", 404);
    if (res.status === 429) throw new SpotifyError("Spotify pide esperar un momento", "rate", 429);
    if (!res.ok) throw new SpotifyError(`Spotify respondió ${res.status}`, "http", res.status);
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }
  const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)).toString();
  async function pages(path, max) {
    const out = []; let url = path;
    while (url && out.length < max) { const r = await call(url); out.push(...(r?.items ?? [])); url = r?.next ?? null; }
    return out.slice(0, max);
  }
  return {
    call,
    me: () => call("/me"),
    devices: async () => (await call("/me/player/devices"))?.devices ?? [],
    player: () => call("/me/player"),
    current: () => call("/me/player/currently-playing"),
    play: (uris, deviceId) => call(`/me/player/play${deviceId ? `?${q({ device_id: deviceId })}` : ""}`, { method: "PUT", body: JSON.stringify({ uris }) }),
    queue: (uri, deviceId) => call(`/me/player/queue?${q({ uri, device_id: deviceId })}`, { method: "POST" }),
    next: (deviceId) => call(`/me/player/next${deviceId ? `?${q({ device_id: deviceId })}` : ""}`, { method: "POST" }),
    pause: (deviceId) => call(`/me/player/pause${deviceId ? `?${q({ device_id: deviceId })}` : ""}`, { method: "PUT" }),
    resume: (deviceId) => call(`/me/player/play${deviceId ? `?${q({ device_id: deviceId })}` : ""}`, { method: "PUT" }),
    shuffleOff: (deviceId) => call(`/me/player/shuffle?${q({ state: false, device_id: deviceId })}`, { method: "PUT" }).catch(() => null),
    recent: async () => ((await call(`/me/player/recently-played?${q({ limit: 50 })}`))?.items ?? []),
    top: async (type, range) => pages(`/me/top/${type}?${q({ limit: 50, time_range: range })}`, 50),
    saved: async (max = 300) => (await pages(`/me/tracks?${q({ limit: 50 })}`, max)).map((x) => x.track),
    playlists: async () => pages(`/me/playlists?${q({ limit: 50 })}`, 200),
    playlistTracks: async (id, max = 200) => (await pages(`/playlists/${encodeURIComponent(id)}/tracks?${q({ limit: 100 })}`, max)).map((x) => x.track).filter(Boolean),
    artists: async (ids) => { const out = []; for (let i = 0; i < ids.length; i += 50) out.push(...((await call(`/artists?${q({ ids: ids.slice(i, i + 50).join(",") })}`))?.artists ?? [])); return out.filter(Boolean); },
    artistTop: async (id, market) => ((await call(`/artists/${encodeURIComponent(id)}/top-tracks?${q({ market })}`))?.tracks ?? []),
    artistAlbums: async (id, market) => ((await call(`/artists/${encodeURIComponent(id)}/albums?${q({ include_groups: "album,single", market, limit: 10 })}`))?.items ?? []),
    albumTracks: async (id, market) => ((await call(`/albums/${encodeURIComponent(id)}/tracks?${q({ market, limit: 50 })}`))?.items ?? []),
    search: async (query, market, limit = 50, offset = 0) => ((await call(`/search?${q({ q: query, type: "track", market, limit, offset })}`))?.tracks?.items ?? []),
  };
}
