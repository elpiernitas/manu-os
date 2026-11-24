// Eventos del motor (Fase 0). La hora llega siempre en el evento: el núcleo no lee el reloj.
export const EVENT_TYPES = Object.freeze([
  "session_started", "session_ended", "track_started", "track_skipped", "track_completed",
  "track_repeated", "track_saved_to_playlist", "context_changed", "explicit_preference",
]);
const NEEDS_TRACK = new Set(["track_started", "track_skipped", "track_completed", "track_repeated", "track_saved_to_playlist"]);

/** Valida y normaliza un evento. Lanza un error que dice qué falta. */
export function validateEvent(e) {
  if (!e || typeof e !== "object") throw new Error("Evento vacío");
  if (!EVENT_TYPES.includes(e.type)) throw new Error(`Tipo de evento desconocido: ${e.type}`);
  const t = Date.parse(e.at);
  if (!Number.isFinite(t)) throw new Error(`${e.type}: falta «at» (fecha ISO)`);
  if (NEEDS_TRACK.has(e.type) && !e.trackId && !e.track?.id) throw new Error(`${e.type}: falta trackId`);
  if (e.type === "track_skipped" && !(Number.isFinite(e.msPlayed) && e.msPlayed >= 0)) throw new Error("track_skipped: falta msPlayed");
  if (e.type === "track_saved_to_playlist" && !e.playlistId) throw new Error("track_saved_to_playlist: falta playlistId");
  if (e.type === "explicit_preference" && !e.rule?.kind) throw new Error("explicit_preference: falta rule.kind");
  if (e.type === "context_changed" && (!e.context || typeof e.context !== "object")) throw new Error("context_changed: falta context");
  return { ...e, trackId: e.trackId ?? e.track?.id, t };
}
