// candidate_score = hard × session_fit × personal_fit × discovery_value × context_fit × fatigue × repetition (§19).
// Cada factor queda en el desglose para explicar la decisión.
import { similarity } from "./similarity.js";
import { personalAt, fatigueAt } from "./memory/taste.js";
import { passesLanguage } from "./memory/explicit.js";

const squash = (x) => 0.5 + 0.5 * Math.tanh(x); // evidencia → 0–1 (0 → 0.5 neutro)

export function hardFilter(track, brain) {
  const lang = passesLanguage(track, brain.explicit.language, brain.config.language);
  if (!lang.ok) return lang;
  if (brain.explicit.artists[track.artistId]?.stance === "block") return { ok: false, why: "artista bloqueado por ti" };
  return { ok: true };
}

export function personalFit(track, brain, t) {
  const cfg = brain.config.taste;
  const tr = brain.taste.tracks[track.id], ar = brain.taste.artists[track.artistId];
  const ev = personalAt(tr, t, cfg) + cfg.artistShare * personalAt(ar, t, cfg);
  const stance = brain.explicit.artists[track.artistId]?.stance;
  const mult = stance ? brain.config.explicit[stance] : 1;
  return { value: squash(ev) * mult, evidence: ev, stance: stance ?? null };
}

export function sessionFit(track, brain) {
  const s = brain.session, st = brain.config.states;
  let v = 1; const why = [];
  if (s.tempBlocked[track.id]) { v *= 0.05; why.push("saltada en esta sesión"); }
  const failed = s.failedArtists[track.artistId] ?? 0;
  const anchorSim = s.anchor ? similarity(s.anchor, track) : 0;
  if (s.state === "SEARCHING") {
    const skipped = s.recent.filter((r) => r.kind === "skip_strong" || r.kind === "skip_moderate").slice(-8).map((r) => r.track);
    const near = Math.max(0, ...skipped.map((x) => similarity(x, track)));
    v *= 1 - 0.6 * near * Math.min(1, 0.5 + 0.25 * s.diversity);
    if (failed) { v *= 0.35; why.push("artista recién fallido"); }
    why.push(`buscando: me alejo de lo saltado (${near.toFixed(2)})`);
  } else if (s.state === "LOCKED_IN" || s.state === "STABLE") {
    v *= 0.55 + 0.9 * anchorSim; why.push(`cerca del ancla (${anchorSim.toFixed(2)})`);
    if (failed) v *= 0.6; // artista que acaba de fallar: menos, pero sin vetarlo
  } else if (s.state === "FATIGUE") {
    v *= 1 - 0.55 * anchorSim; why.push(`fatiga del rollo: me alejo (${anchorSim.toFixed(2)})`);
  }
  const dd = s.deepDive[track.artistId];
  const heard = (brain.taste.tracks[track.id]?.plays ?? 0) > 0;
  if (dd && !dd.closed && !heard) {
    if (dd.open) { v *= 1.6 * (1.15 - 0.3 * (track.popularity ?? 0.5)); why.push("profundizo en el artista (mejor lo menos obvio)"); }
    else if (dd.hits >= 1) { v *= 1.25; why.push("artista nuevo que funcionó: pruebo otra"); }
  }
  return { value: v, why };
}

export function discoveryValue(track, brain) {
  const heard = (brain.taste.tracks[track.id]?.plays ?? 0) > 0;
  if (heard) return { value: 1, novel: false };
  const d = brain.session.discoveries;
  const receptive = d.tried ? d.accepted / d.tried : 0.5;
  return { value: 1 + 0.3 * receptive + 0.1 * brain.session.diversity, novel: true };
}

export function contextFit(track, brain) {
  const mode = brain.explicit.mode?.mode ?? brain.context.mode;
  const modes = brain.taste.tracks[track.id]?.modes ?? {};
  if (mode) return { value: 1 + 0.8 * Math.min(1, modes[mode] ?? 0), mode };
  // Una canción de modo (p. ej. tristeza) sin evidencia personal propia pesa menos fuera de ese modo.
  const modeOnly = Object.values(modes).some((x) => x > 0) && (brain.taste.tracks[track.id]?.personal ?? 0) < 0.3;
  return { value: modeOnly ? 0.6 : 1, mode: null };
}

export function fatiguePenalty(track, brain, t) {
  const f = fatigueAt(brain.taste, track.id, t, brain.config.fatigue);
  return { value: f >= brain.config.fatigue.threshold ? 0.08 : 1 - 0.6 * f, fatigue: f };
}

export function repetitionPenalty(track, brain, t, { sequence = false } = {}) {
  const r = brain.session.recent, cfg = brain.config.repetition;
  let v = 1;
  // En una tanda (nextBatch) el orden lo controla la selección; aquí solo la canción inmediata.
  if (!sequence && r.length && r[r.length - 1].artistId === track.artistId) v *= 0.3;
  if (!sequence && r.slice(-5).filter((x) => x.artistId === track.artistId).length >= cfg.maxArtistInLast5) v *= 0.4;
  const last = brain.taste.tracks[track.id]?.lastAt;
  if (last && t - last < cfg.trackCooldownMs) v *= 0.05;
  return { value: v };
}

export function scoreCandidate(track, brain, t, opts = {}) {
  const hard = hardFilter(track, brain);
  if (!hard.ok) return { track, score: 0, excluded: hard.why, factors: { hard: 0 } };
  const f = {
    hard: 1, session: sessionFit(track, brain), personal: personalFit(track, brain, t), discovery: discoveryValue(track, brain),
    context: contextFit(track, brain), fatigue: fatiguePenalty(track, brain, t), repetition: repetitionPenalty(track, brain, t, opts),
  };
  const score = f.session.value * f.personal.value * f.discovery.value * f.context.value * f.fatigue.value * f.repetition.value;
  return { track, score, factors: f };
}
