// LongTermTasteMemory (§6.3) + fatiga (§12), SEPARADAS. Cambia despacio. Puro: devuelve copias.
const DAY = 864e5;
export const emptyTaste = () => ({ tracks: {}, artists: {}, fatigue: {} });
const blank = () => ({ personal: 0, personalAt: null, modes: {}, shared: 0, plays: 0, firstAt: null, lastAt: null, days: [], quickSkipDays: [] });
const decay = (v, from, to, halfLifeDays) => (from === null ? v : v * 0.5 ** (Math.max(0, to - from) / (halfLifeDays * DAY)));
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);

/** Evidencia personal vigente a la hora `t` (la antigua pesa menos). */
export const personalAt = (rec, t, cfg) => (rec ? decay(rec.personal, rec.personalAt, t, cfg.halfLifeDays) : 0);

function add(rec, delta, t, cfg) {
  const r = { ...rec };
  r.personal = personalAt(r, t, cfg) + delta; r.personalAt = t;
  return r;
}
function touch(rec, t) {
  const r = { ...rec, plays: rec.plays + 1, lastAt: t, firstAt: rec.firstAt ?? t };
  const d = dayOf(t); if (!r.days.includes(d)) r.days = [...r.days, d].slice(-400);
  return r;
}

/**
 * Registra una escucha. `shared` = contexto compartido → la evidencia personal se descuenta (§16).
 * `searching` = estamos en SEARCHING → un salto rápido NO toca el largo plazo (§7.4).
 */
export function recordListen(taste, track, signal, { t, shared = false, searching = false, inPlace = false }, cfg) {
  const m = inPlace ? taste : { tracks: { ...taste.tracks }, artists: { ...taste.artists }, fatigue: { ...taste.fatigue } };
  let tr = touch(m.tracks[track.id] ?? blank(), t);
  let ar = touch(m.artists[track.artistId] ?? blank(), t);
  const k = shared ? cfg.sharedDiscount : 1;
  let delta = 0;
  if (signal.kind === "repeat") delta = cfg.repeat;
  else if (signal.kind === "accept_strong") delta = cfg.strongComplete;
  else if (signal.kind === "accept") delta = cfg.complete;
  else if (signal.negative && signal.quick && !searching) {
    // Impacto a largo plazo muy débil; solo pesa si se repite en días distintos.
    const d = dayOf(t);
    if (!tr.quickSkipDays.includes(d)) tr = { ...tr, quickSkipDays: [...tr.quickSkipDays, d].slice(-30) };
    delta = tr.quickSkipDays.length >= cfg.repeatedDaysMin ? cfg.repeatedDaysPenalty : cfg.longTermQuickSkip;
    if (shared) delta = 0;
  }
  if (delta) { tr = add(tr, delta * (delta > 0 ? k : 1), t, cfg); ar = add(ar, delta * (delta > 0 ? k : 1) * cfg.artistShare, t, cfg); }
  if (shared && delta > 0) { tr = { ...tr, shared: tr.shared + delta }; ar = { ...ar, shared: ar.shared + delta * cfg.artistShare }; }
  m.tracks[track.id] = tr; m.artists[track.artistId] = ar;
  return m;
}

/** Guardar en una playlist: el destino importa (§13). */
export function recordSave(taste, track, sem, t, cfg) {
  const m = { tracks: { ...taste.tracks }, artists: { ...taste.artists }, fatigue: { ...taste.fatigue } };
  let tr = m.tracks[track.id] ?? blank(), ar = m.artists[track.artistId] ?? blank();
  const w = cfg.save[sem.role] ?? 0;
  if (w) { tr = add(tr, w, t, cfg); ar = add(ar, w * cfg.artistShare, t, cfg); }
  if (sem.role === "mode") { tr = { ...tr, modes: { ...tr.modes, [sem.mode]: (tr.modes[sem.mode] ?? 0) + cfg.saveMode } }; }
  if (sem.role === "shared") tr = { ...tr, shared: tr.shared + 1 };
  m.tracks[track.id] = tr; m.artists[track.artistId] = ar;
  return m;
}

// ---------- Fatiga ----------
export const fatigueAt = (taste, trackId, t, cfg) => { const f = taste.fatigue[trackId]; return f ? decay(f.value, f.at, t, cfg.halfLifeDays) : 0; };
export function bumpFatigue(taste, trackId, amount, t, cfg) {
  const v = Math.min(1, fatigueAt(taste, trackId, t, cfg) + amount);
  return { ...taste, fatigue: { ...taste.fatigue, [trackId]: { value: v, at: t } } };
}

/** Evidencia personal directa (tops, guardadas, historial importado). Mutación en sitio: para cargas grandes. */
export function addEvidenceInPlace(taste, track, delta, t, cfg) {
  const tr = taste.tracks[track.id] ?? blank(), ar = taste.artists[track.artistId] ?? blank();
  taste.tracks[track.id] = add(tr, delta, t, cfg);
  taste.artists[track.artistId] = add(ar, delta * cfg.artistShare, t, cfg);
}
/** Una escucha antigua (fecha conocida): cuenta reproducciones y días, sin tocar la sesión. */
export function touchInPlace(taste, track, t) {
  taste.tracks[track.id] = touch(taste.tracks[track.id] ?? blank(), t);
  taste.artists[track.artistId] = touch(taste.artists[track.artistId] ?? blank(), t);
}
