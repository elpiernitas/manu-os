// Candidatas para el DJ a partir de lo que Spotify SÍ deja leer a una app nueva (WEB-123).
//  - Conocidas: tus tops (4 semanas, 6 meses, años), tus guardadas, lo escuchado hace poco y tus playlists.
//  - Nuevas de artistas que ya te funcionan: top y últimos lanzamientos de tus artistas principales.
//  - Artistas nuevos: búsqueda por los géneros de tus artistas (si Spotify los da). Sin Recommendations
//    ni Related Artists: si un día hay otra fuente (Last.fm, MusicBrainz…) entra como otro «source».
// Devuelve datos; no decide nada. Lo que es señal de gusto lo convierte `seedBrain` según la semántica.
import { toTrack } from "./spotify.js";

const DAY = 864e5;
/** Rol por defecto de una playlist: las colaborativas son contexto compartido; el resto, descubrimiento débil. */
export const defaultRole = (pl) => (pl.collaborative ? { role: "shared" } : { role: "discovery" });

async function limited(items, n, fn) {
  const out = []; let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch { out[k] = null; } } });
  await Promise.all(workers);
  return out;
}

/**
 * Construye el catálogo. `roles` = { [playlistId]: { role, mode? } } elegidos por Manu.
 * `daySeed` cambia la página de la búsqueda de descubrimiento cada día (determinista dentro del día).
 */
export async function buildCatalog(api, { roles = {}, now = Date.now(), maxPlaylists = 25, perPlaylist = 150, onProgress = () => {} } = {}) {
  const me = await api.me();
  const market = me?.country || "ES";
  const tracks = new Map(), sources = new Map(), seeds = [];
  const put = (raw, source, genres) => { const t = toTrack(raw, genres); if (!t) return null; if (!tracks.has(t.id)) tracks.set(t.id, t); (sources.get(t.id) ?? sources.set(t.id, new Set()).get(t.id)).add(source); return t; };

  onProgress("Leyendo tus playlists…");
  // Cada fuente falla por separado: si Spotify niega una (p. ej. playlists suyas para apps nuevas), las demás siguen.
  const pls = (await api.playlists().catch(() => [])).filter((p) => p && p.id).slice(0, maxPlaylists);
  const plTracks = await limited(pls, 4, (p) => api.playlistTracks(p.id, perPlaylist));
  pls.forEach((p, i) => { for (const raw of plTracks[i] ?? []) { const t = put(raw, `playlist:${p.id}`); if (t) seeds.push({ trackId: t.id, playlistId: p.id }); } });

  onProgress("Leyendo tus tops y guardadas…");
  const [topS, topM, topL, saved, recent, artS, artM] = await Promise.all([
    api.top("tracks", "short_term").catch(() => []), api.top("tracks", "medium_term").catch(() => []), api.top("tracks", "long_term").catch(() => []),
    api.saved(300).catch(() => []), api.recent().catch(() => []), api.top("artists", "short_term").catch(() => []), api.top("artists", "medium_term").catch(() => []),
  ]);
  const evidence = [];
  for (const [list, w, src] of [[topS, 0.5, "top:short"], [topM, 0.35, "top:medium"], [topL, 0.2, "top:long"], [saved, 0.35, "saved"]]) for (const raw of list) { const t = put(raw, src); if (t) evidence.push({ trackId: t.id, delta: w }); }
  const recentPlays = [];
  for (const it of recent) { const t = put(it.track, "recent"); if (t) recentPlays.push({ trackId: t.id, at: Date.parse(it.played_at) || now }); }

  // Géneros de los artistas (si Spotify los da; si vienen vacíos, la similitud usa el artista).
  onProgress("Mirando tus artistas…");
  const topArtists = [...new Map([...artS, ...artM].filter(Boolean).map((a) => [a.uri, a])).values()];
  const knownArtistIds = [...new Set([...tracks.values()].map((t) => t.artistId))];
  const genres = {};
  for (const a of topArtists) genres[a.uri] = a.genres ?? [];
  const missing = knownArtistIds.filter((u) => !(u in genres)).slice(0, 150).map((u) => u.split(":").pop());
  for (const a of await api.artists(missing).catch(() => [])) genres[a.uri] = a.genres ?? [];
  for (const t of tracks.values()) t.tags = [...(genres[t.artistId] ?? [])];

  // Nuevas de artistas que ya te funcionan: top + últimos lanzamientos.
  onProgress("Buscando canciones nuevas de tus artistas…");
  const mainArtists = topArtists.slice(0, 15);
  const tops = await limited(mainArtists, 4, (a) => api.artistTop(a.id, market));
  mainArtists.forEach((a, i) => { for (const raw of tops[i] ?? []) put(raw, "artist-top", genres); });
  const albums = await limited(mainArtists.slice(0, 8), 4, (a) => api.artistAlbums(a.id, market));
  const recentAlbums = albums.flatMap((l) => (l ?? []).slice(0, 2));
  const albumTracks = await limited(recentAlbums, 4, (al) => api.albumTracks(al.id, market));
  recentAlbums.forEach((al, i) => { for (const raw of albumTracks[i] ?? []) put({ ...raw, album: { name: al.name, images: al.images } }, "artist-new", genres); });

  // Artistas nuevos: búsqueda por géneros frecuentes de tus artistas.
  onProgress("Buscando artistas nuevos…");
  const freq = {};
  for (const a of topArtists) for (const g of a.genres ?? []) freq[g] = (freq[g] ?? 0) + 1;
  const topGenres = Object.entries(freq).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 6).map(([g]) => g);
  const daySeed = Math.floor(now / DAY);
  const found = await limited(topGenres, 3, (g, k) => api.search(`genre:"${g}"`, market, 50, (daySeed % 4) * 50));
  topGenres.forEach((g, i) => { for (const raw of found[i] ?? []) { const t = put(raw, "search-genre", genres); if (t && !t.tags.length) t.tags = [g]; } });

  onProgress("Listo");
  return {
    builtAt: now, market, tracks: [...tracks.values()], seeds, evidence, recentPlays,
    playlists: pls.map((p) => ({ id: p.id, name: p.name, collaborative: Boolean(p.collaborative), owner: p.owner?.id === me?.id, total: p.tracks?.total ?? null, role: roles[p.id] ?? defaultRole(p) })),
    sources: Object.fromEntries([...sources].map(([k, v]) => [k, [...v]])),
    genresKnown: Object.values(genres).some((g) => g.length),
  };
}

/**
 * Pasa lo que Spotify cuenta a la memoria del motor, respetando la semántica (DJ-BRAIN §13, §16):
 * núcleo = señal fuerte; modo = afinidad con el modo; compartida = contexto (casi nada personal);
 * descubrimiento = señal débil. Tops y guardadas = evidencia personal moderada.
 */
export function seedBrain(brain, cat, { at }) {
  const roles = Object.fromEntries(cat.playlists.map((p) => [p.id, p.role]));
  brain.playlists = { ...brain.playlists };
  for (const [id, r] of Object.entries(roles)) brain.playlists[id] = { role: r.role, ...(r.mode ? { mode: r.mode } : {}) };
  for (const t of cat.tracks) brain.addTrack(t);
  for (const s of cat.seeds) brain.process({ type: "track_saved_to_playlist", trackId: s.trackId, playlistId: s.playlistId, at });
  for (const e of cat.evidence) brain.seedEvidence(e.trackId, e.delta, at);
  for (const r of cat.recentPlays) brain.seedPlay(r.trackId, r.at);
  brain.session.lastAt = null; // sembrar no es una sesión
  return brain;
}
