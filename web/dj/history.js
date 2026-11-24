// Historial ampliado de la exportación de Spotify → eventos del motor. SOLO para usar en local con
// archivos dentro de data/ (ignorado por Git). Lee una lista blanca de campos y DESCARTA el resto
// (ip_addr, conn_country, user_agent, etc.): nunca salen de este módulo.
// Nombres de campos tal como aparecen en la exportación «Extended streaming history» que conocemos;
// NO_VERIFICADO contra tu archivo: compruébalos con uno real antes de fiarte del resultado.
const READ = ["ts", "platform", "ms_played", "master_metadata_track_name", "master_metadata_album_artist_name", "spotify_track_uri", "reason_start", "reason_end", "skipped", "shuffle"];

const slug = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "desconocido";

/** Un registro → { track, events } o null (podcasts, registros sin canción). */
export function recordToEvents(rec, { durations = {} } = {}) {
  const r = {}; for (const k of READ) if (k in (rec ?? {})) r[k] = rec[k];
  if (!r.ts || !r.master_metadata_track_name || !r.spotify_track_uri) return null;
  const at = new Date(r.ts).toISOString();
  const track = { id: r.spotify_track_uri, title: r.master_metadata_track_name, artistId: `artist:${slug(r.master_metadata_album_artist_name)}`, artistName: r.master_metadata_album_artist_name ?? "Desconocido", durationMs: durations[r.spotify_track_uri] ?? 0, language: "unknown", tags: [] };
  const device = String(r.platform ?? "").toLowerCase().includes("cast") ? "cast" : r.platform ? "otro" : null;
  const ended = r.reason_end === "trackdone" ? "track_completed" : "track_skipped";
  const events = [
    { type: "track_started", at, trackId: track.id, source: { device } },
    { type: ended, at: new Date(Date.parse(at) + (r.ms_played ?? 0)).toISOString(), trackId: track.id, msPlayed: r.ms_played ?? 0, ...(track.durationMs ? {} : { durationMs: ended === "track_completed" ? r.ms_played : 0 }) },
  ];
  return { track, events };
}

/** Muchos registros, ordenados por fecha. Devuelve catálogo mínimo + eventos; nada más. */
export function historyToEvents(records, opts) {
  const out = (records ?? []).map((r) => recordToEvents(r, opts)).filter(Boolean).sort((a, b) => a.events[0].at.localeCompare(b.events[0].at));
  const catalog = new Map(); for (const x of out) catalog.set(x.track.id, x.track);
  return { catalog: [...catalog.values()], events: out.flatMap((x) => x.events) };
}

/**
 * Versión compacta para guardar en el dispositivo (IndexedDB) y reconstruir el gusto: solo canción,
 * artista, cuánto se escuchó, si terminó y cuándo. Sin IP, país, plataforma ni nada más.
 */
export function historyRows(records) {
  const out = [];
  for (const rec of records ?? []) {
    if (!rec?.ts || !rec.master_metadata_track_name || !rec.spotify_track_uri) continue;
    const t = Date.parse(rec.ts); if (!Number.isFinite(t)) continue;
    out.push({ uri: rec.spotify_track_uri, title: rec.master_metadata_track_name, artist: rec.master_metadata_album_artist_name ?? "Desconocido", ms: Number(rec.ms_played) || 0, done: rec.reason_end === "trackdone", t });
  }
  return out.sort((a, b) => a.t - b.t);
}
