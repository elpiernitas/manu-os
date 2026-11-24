// SessionMemory (§6.4) y máquina de estados (§8): START → STABLE → SEARCHING → LOCKED_IN → FATIGUE.
// Cambia muy rápido. HARD_FILTER no es un estado aquí sino una capa que se aplica en cualquier estado
// (ver docs/INTERPRETACIONES.md).
import { similarity } from "../similarity.js";

export const STATES = ["START", "STABLE", "SEARCHING", "LOCKED_IN", "FATIGUE"];
export const emptySession = (t = null) => ({
  state: "START", startedAt: t, lastAt: t, anchor: null, recent: [], acceptsTotal: 0, consecutiveAccepts: 0,
  quickSkips: [], diversity: 0, tempBlocked: {}, failedArtists: {}, directionAccepts: 0, deepDive: {},
  discoveries: { tried: 0, accepted: 0 },
});

/**
 * Aplica el resultado de una escucha. Devuelve { session, notes[] } (las notas explican el cambio).
 * `track` es la canción; `signal` sale de classifyListen; `known` = ¿se había escuchado antes?
 */
export function onListen(s0, track, signal, { t, known, prevArtistPlays }, cfg) {
  const s = structuredClone(s0); const notes = [];
  const C = cfg.states, S = cfg.searching;
  s.lastAt = t;
  const prevAnchor = s.anchor;
  const inDirection = prevAnchor ? similarity(prevAnchor, track) >= C.directionSimilarity : false;
  s.recent = [...s.recent, { trackId: track.id, artistId: track.artistId, at: t, kind: signal.kind, inDirection, track }].slice(-30);
  if (!known) { s.discoveries.tried++; if (signal.positive) s.discoveries.accepted++; }

  if (signal.negative || signal.kind === "ambiguous") {
    s.tempBlocked[track.id] = true; // descarte temporal de sesión, no de largo plazo
    s.consecutiveAccepts = 0;
  }
  if (signal.negative && signal.quick) {
    s.quickSkips = [...s.quickSkips, t];
    s.failedArtists[track.artistId] = (s.failedArtists[track.artistId] ?? 0) + 1;
    const dd = s.deepDive[track.artistId];
    if (dd?.open) { dd.quickSkips = (dd.quickSkips ?? 0) + 1; if (dd.quickSkips >= cfg.deepDive.closeAfterQuickSkips) { dd.open = false; dd.closed = true; notes.push(`Cierro la profundización en ${track.artistName}: ${dd.quickSkips} saltos rápidos`); } }
  }
  // Saltos rápidos dentro de la ventana corta (últimas N escuchas y X minutos).
  const lastN = s.recent.slice(-S.windowEvents);
  const quickInWindow = lastN.filter((r) => (r.kind === "skip_strong" || r.kind === "skip_moderate") && s.quickSkips.includes(r.at) && t - r.at <= S.windowMs).length;
  // Racha: cuenta saltos rápidos seguidos desde el último positivo (para 5 y 10).
  let streak = 0; for (let i = s.recent.length - 1; i >= 0; i--) { const r = s.recent[i]; if (r.kind === "accept" || r.kind === "accept_strong" || r.kind === "repeat") break; if (s.quickSkips.includes(r.at)) streak++; }

  if (signal.positive) {
    s.acceptsTotal++; s.consecutiveAccepts++;
    if (s.state === "SEARCHING" || s.state === "FATIGUE") {
      notes.push(`${s.state === "SEARCHING" ? "Fin de la búsqueda" : "Nueva dirección tras la fatiga"}: «${track.title}» funciona y pasa a ser el ancla`);
      s.state = "LOCKED_IN"; s.anchor = track; s.directionAccepts = 1; s.quickSkips = []; s.diversity = 0;
    } else if (s.state === "START") {
      s.directionAccepts = inDirection ? s.directionAccepts + 1 : 1;
      s.anchor = track;
      if (s.acceptsTotal >= C.stableAfterAccepts) { s.state = "STABLE"; notes.push("Ya hay escuchas aceptadas: STABLE"); }
    } else if (s.state === "STABLE") {
      s.directionAccepts = inDirection ? s.directionAccepts + 1 : 1;
      if (!inDirection) s.anchor = track;
      if (s.consecutiveAccepts >= C.lockAfterConsecutiveAccepts) { s.state = "LOCKED_IN"; s.anchor = track; s.directionAccepts = Math.max(s.directionAccepts, s.consecutiveAccepts); notes.push(`${s.consecutiveAccepts} aceptadas seguidas: LOCKED_IN con «${track.title}» de ancla`); }
    } else if (s.state === "LOCKED_IN") {
      if (inDirection) s.directionAccepts++; else { s.anchor = track; s.directionAccepts = 1; notes.push(`El rollo se mueve hacia «${track.title}»`); }
    }
    // Artista nuevo que funciona (§11).
    if ((prevArtistPlays ?? 0) <= cfg.taste.newArtistMaxPlays || s.deepDive[track.artistId]) {
      const dd = s.deepDive[track.artistId] ?? { hits: 0, open: false, quickSkips: 0 };
      if (!dd.closed) {
        dd.hits++;
        if (dd.hits === 1) notes.push(`new_artist_hit: ${track.artistName}. Pruebo 1–2 canciones más suyas, sin monopolizar`);
        if (dd.hits >= cfg.deepDive.openAfterHits && !dd.open) { dd.open = true; notes.push(`ArtistDeepDive abierto: ${track.artistName}`); }
        s.deepDive[track.artistId] = dd;
      }
    }
  } else if (signal.negative) {
    if (quickInWindow >= S.enter || streak >= S.enter) {
      if (s.state !== "SEARCHING") notes.push(`${Math.max(quickInWindow, streak)} saltos rápidos: SEARCHING. Es la dirección la que no funciona, no los artistas`);
      s.state = "SEARCHING";
      s.diversity = streak >= S.reset ? 3 : streak >= S.widen ? 2 : 1;
      if (streak >= S.reset && s.anchor) { notes.push(`${streak} saltos: reinicio la dirección (los filtros duros siguen)`); s.anchor = null; s.directionAccepts = 0; }
    } else if ((s.state === "LOCKED_IN" || s.state === "STABLE") && s.directionAccepts >= C.fatigueMinDirectionAccepts) {
      const win = s.recent.slice(-C.fatigueWindow).filter((r) => r.inDirection && (r.kind === "skip_strong" || r.kind === "skip_moderate"));
      if (win.length >= C.fatigueSkipsInDirection) { s.state = "FATIGUE"; notes.push("Se saltan canciones del rollo que antes funcionaba: FATIGUE, me alejo poco a poco"); }
    }
  }
  return { session: s, notes };
}
