// DjBrain (Fase 0): procesa eventos, mantiene las memorias separadas y puntúa candidatas.
// Determinista y sin red. Independiente del proveedor: solo conoce `Track`.
import { DEFAULTS } from "./defaults.js";
import { validateEvent } from "./events.js";
import { classifyListen } from "./signals.js";
import { emptyExplicit, applyRule } from "./memory/explicit.js";
import { makeSemantics, roleOf } from "./memory/playlists.js";
import { emptyTaste, recordListen, recordSave, bumpFatigue, personalAt, addEvidenceInPlace, touchInPlace } from "./memory/taste.js";
import { emptySession, onListen } from "./memory/session.js";
import { emptyContext, applyContext } from "./memory/context.js";
import { scoreCandidate } from "./scoring.js";
import { poolOf, positiveAnchors, BUCKET, mixFor } from "./pools.js";

const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b ?? {})) o[k] = v && typeof v === "object" && !Array.isArray(v) ? merge(a[k] ?? {}, v) : v; return o; };
const LISTEN = new Set(["track_skipped", "track_completed", "track_repeated"]);
const KIND_LABEL = { skip_strong: "saltada enseguida", skip_moderate: "saltada", ambiguous: "a medias", accept: "escuchada", accept_strong: "entera", repeat: "repetida" };
const describeContext = (c) => [c.label, c.device, c.shared ? "compartido: no cuenta como tu gusto" : null, c.mode ? `modo ${c.mode}` : null].filter(Boolean).join(" · ") || "normal";

export class DjBrain {
  constructor({ config = {}, playlists = {}, catalog = [] } = {}) {
    this.config = merge(DEFAULTS, config);
    this.playlists = makeSemantics(playlists);
    this.catalog = new Map();
    for (const t of catalog) this.addTrack(t);
    this.explicit = emptyExplicit();
    this.taste = emptyTaste();
    this.session = emptySession();
    this.context = emptyContext();
    this.current = null; // { trackId, source, startedAt }
    this.log = [];
  }

  addTrack(track) {
    if (!track?.id || !track.artistId) throw new Error("Una canción necesita id y artistId");
    this.catalog.set(track.id, { language: "unknown", tags: [], ...track });
  }
  track(id) { const t = this.catalog.get(id); if (!t) throw new Error(`Canción desconocida: ${id}`); return t; }

  /** Procesa un evento. Devuelve { state, explanation[] }. */
  process(raw) {
    const e = validateEvent(raw);
    if (e.track) this.addTrack(e.track);
    const notes = [];
    // Un hueco largo abre una sesión nueva; un cambio de dispositivo, NO (§17, criterio 12).
    if (this.session.lastAt !== null && e.t - this.session.lastAt > this.config.session.idleResetMs && e.type !== "session_started") {
      this.session = emptySession(e.t); notes.push("Hueco largo: sesión nueva");
    }
    switch (e.type) {
      case "session_started": this.session = emptySession(e.t); if (e.context) this.context = applyContext(this.context, e.context, e.t); notes.push("Sesión nueva: START"); break;
      case "session_ended": this.session = emptySession(null); this.current = null; notes.push("Sesión terminada: la memoria de sesión se descarta; el gusto se queda"); break;
      case "context_changed": this.context = applyContext(this.context, e.context, e.t); this.session.lastAt = e.t; notes.push(`Contexto: ${describeContext(e.context)}. El rollo de la sesión sigue`); break;
      case "explicit_preference": this.applyExplicit(e.rule, e.t, notes); break;
      case "track_started": this.current = { trackId: e.trackId, source: e.source ?? null, startedAt: e.t }; this.session.lastAt = e.t; break;
      case "track_saved_to_playlist": this.save(e, notes); break;
      default: if (LISTEN.has(e.type)) this.listen(e, notes);
    }
    const out = { at: e.at, type: e.type, state: this.session.state, explanation: notes };
    this.log = [...this.log, out].slice(-1000);
    return out;
  }

  applyExplicit(rule, t, notes) {
    if (rule.kind === "playlist") { this.playlists = { ...this.playlists, ...makeSemantics({ [rule.playlistId]: { role: rule.role, mode: rule.mode } }) }; notes.push(`Playlist ${rule.playlistId}: ahora es «${rule.role}»`); }
    this.explicit = applyRule(this.explicit, rule, t);
    notes.push(`Regla explícita guardada (${rule.kind}). Manda sobre el histórico`);
  }

  isShared(source) {
    if (source?.shared) return true;
    if (source?.playlistId && roleOf(this.playlists, source.playlistId).role === "shared") return true;
    return this.context.shared;
  }

  listen(e, notes) {
    const track = this.track(e.trackId);
    const duration = e.durationMs ?? track.durationMs ?? 0;
    const signal = classifyListen({ type: e.type, msPlayed: e.msPlayed ?? duration, durationMs: duration }, this.config.skip);
    const source = this.current?.trackId === e.trackId ? this.current.source : e.source ?? null;
    const shared = this.isShared(source);
    const known = (this.taste.tracks[track.id]?.plays ?? 0) > 0;
    const prevArtistPlays = this.taste.artists[track.artistId]?.plays ?? 0;
    const searching = this.session.state === "SEARCHING";
    // Sesión: impacto fuerte.
    const r = onListen(this.session, track, signal, { t: e.t, known, prevArtistPlays }, this.config);
    this.session = r.session; notes.push(...r.notes);
    // Largo plazo: impacto débil, sin castigo durante SEARCHING ni en contexto compartido.
    const searchingNow = searching || this.session.state === "SEARCHING";
    this.taste = recordListen(this.taste, track, signal, { t: e.t, shared, searching: searchingNow }, this.config.taste);
    // Fatiga: algo que gusta y se salta (o suena mucho) se quema un tiempo, sin bajar el gusto.
    const loved = personalAt(this.taste.tracks[track.id], e.t, this.config.taste) >= this.config.pools.knownPersonal;
    if (signal.negative && loved) this.taste = bumpFatigue(this.taste, track.id, this.config.fatigue.skipKnownLoved, e.t, this.config.fatigue);
    else if (signal.positive) this.taste = bumpFatigue(this.taste, track.id, this.config.fatigue.playRecent, e.t, this.config.fatigue);
    if (shared) notes.push("Contexto compartido: cuenta muy poco para tu gusto personal");
    notes.push(`«${track.title}»: ${KIND_LABEL[signal.kind] ?? signal.kind}`);
    if (this.current?.trackId === e.trackId) this.current = null;
  }

  save(e, notes) {
    const track = this.track(e.trackId);
    const sem = roleOf(this.playlists, e.playlistId);
    this.taste = recordSave(this.taste, track, sem, e.t, this.config.taste);
    notes.push(`Guardada en ${e.playlistId} (${sem.role}${sem.mode ? `: ${sem.mode}` : ""})`);
  }

  /** Evidencia personal directa (tops, guardadas). No es una sesión. */
  seedEvidence(trackId, delta, at) { const tr = this.catalog.get(trackId); if (tr) addEvidenceInPlace(this.taste, tr, delta, Date.parse(at), this.config.taste); }
  /** Escucha pasada con fecha (recientes de Spotify). */
  seedPlay(trackId, t) { const tr = this.catalog.get(trackId); if (tr) touchInPlace(this.taste, tr, t); }
  /**
   * Historial importado (carga masiva): cada escucha suma o resta al largo plazo como en DJ-BRAIN
   * (saltos rápidos sueltos no restan), sin pasar por la máquina de estados de la sesión.
   */
  importListen(track, { msPlayed, completed, shared = false }, t) {
    if (!this.catalog.has(track.id)) this.addTrack(track);
    const tr = this.catalog.get(track.id);
    const signal = classifyListen({ type: completed ? "track_completed" : "track_skipped", msPlayed, durationMs: tr.durationMs || (completed ? msPlayed : 0) }, this.config.skip);
    recordListen(this.taste, tr, signal, { t, shared, searching: false, inPlace: true }, this.config.taste);
  }

  /** Carga el contenido actual de una playlist como guardados (para importar datos reales en local). */
  seedPlaylist(playlistId, trackIds, at) { for (const id of trackIds) this.process({ type: "track_saved_to_playlist", trackId: id, playlistId, at }); }

  /** Puntúa candidatas. Filtros duros ANTES del ranking: lo excluido nunca entra. */
  rank(candidates, { at, sequence = false }) {
    const t = Date.parse(at);
    // Una sesión caducada no cuenta al puntuar (lo saltado hace semanas no sigue «saltado hoy»).
    const stale = this.session.lastAt !== null && t - this.session.lastAt > this.config.session.idleResetMs;
    const view = stale ? Object.assign(Object.create(this), { session: emptySession(null) }) : this;
    const tracks = candidates.map((c) => (typeof c === "string" ? this.track(c) : (this.catalog.has(c.id) ? this.catalog.get(c.id) : (this.addTrack(c), this.catalog.get(c.id)))));
    const anchors = positiveAnchors(view, this.catalog, t);
    const scored = tracks.map((tr) => ({ ...scoreCandidate(tr, view, t, { sequence }), pool: poolOf(tr, view, t, anchors) }));
    const kept = scored.filter((x) => !x.excluded).sort((a, b) => b.score - a.score || a.track.id.localeCompare(b.track.id));
    return { ranked: kept, excluded: scored.filter((x) => x.excluded).map((x) => ({ id: x.track.id, why: x.excluded })) };
  }

  /** Las próximas N canciones, mezclando conocidas / cerca / lejos (§10) sin repetir artista seguido. */
  nextBatch(candidates, { at, n = 10, upcomingArtists = [] }) {
    const { ranked } = this.rank(candidates, { at, sequence: true });
    const mix = mixFor(this);
    const quota = { known: Math.round(n * mix.known), near: Math.round(n * mix.near) }; quota.far = Math.max(0, n - quota.known - quota.near);
    const buckets = { known: [], near: [], far: [] };
    // Fuera de la tanda: lo que acaba de sonar (enfriamiento) y lo que puntúa casi nada frente a lo
    // mejor. Una cuota no se rellena con canciones malas.
    const best = ranked[0]?.score ?? 0;
    for (const x of ranked) if (x.factors.repetition.value >= 0.1 && x.score >= best * 0.08) buckets[BUCKET[x.pool]].push(x);
    const cfg = this.config.repetition;
    const history = [...this.session.recent.map((r) => r.artistId), ...upcomingArtists]; // lo que suena y lo ya encolado también cuenta
    const ok = (x, seq) => { const arts = [...history, ...seq.map((y) => y.track.artistId)]; return arts.at(-1) !== x.track.artistId && arts.slice(-4).filter((a) => a === x.track.artistId).length < cfg.maxArtistInLast5; };
    const out = []; const used = { known: 0, near: 0, far: 0 };
    while (out.length < n && (buckets.known.length || buckets.near.length || buckets.far.length)) {
      const order = ["known", "near", "far"].filter((b) => buckets[b].length).sort((a, b) => (used[a] / Math.max(quota[a], 0.0001)) - (used[b] / Math.max(quota[b], 0.0001)) || buckets[b][0].score - buckets[a][0].score);
      let picked = null;
      for (const b of order) { const i = buckets[b].findIndex((x) => ok(x, out)); if (i >= 0) { picked = buckets[b].splice(i, 1)[0]; used[b]++; break; } }
      if (!picked) { const b = order[0]; picked = buckets[b].shift(); used[b]++; }
      out.push(picked);
    }
    return { batch: out, mix };
  }

  exportState() {
    return JSON.parse(JSON.stringify({ version: 1, config: this.config, playlists: this.playlists, catalog: [...this.catalog.values()], explicit: this.explicit, taste: this.taste, session: this.session, context: this.context }));
  }
  static fromState(s) {
    if (s?.version !== 1) throw new Error("Estado de DJ-BRAIN no compatible");
    const b = new DjBrain({ config: s.config, playlists: s.playlists, catalog: s.catalog });
    Object.assign(b, { explicit: s.explicit, taste: s.taste, session: s.session, context: s.context });
    return b;
  }
}
