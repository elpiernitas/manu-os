// MANU BRAIN en la web (WEB-94): memoria a largo plazo de Manu, estructurada y corregible.
//
// Sigue el modelo de docs/architecture/DATA_MODEL.md y ADR-0002 a escala de la web:
// cada recuerdo es una Claim con clasificación, estado, vigencia, confianza y
// procedencia. Nada se sobrescribe en silencio:
//   - corregir crea una Claim nueva que sustituye a la anterior (SUPERSEDED);
//   - dos valores distintos para lo mismo quedan CONTESTED hasta que Manu elige;
//   - lo que propone una regla o un modelo entra como PROPOSED y no es un hecho;
//   - «olvidar» borra el contenido de verdad y deja solo un evento sin texto.
// Puro: sin DOM ni almacenamiento. La app guarda `vault.brain`.

import { normalise } from "./text.js";

export const BRAIN_SCHEMA = 1;
export const KINDS = ["FACT", "INFERENCE", "PREFERENCE", "DECISION", "MEMORY", "HYPOTHESIS"];
export const STATUSES = ["PROPOSED", "ACTIVE", "SUPERSEDED", "CONTESTED", "REJECTED", "RETRACTED"];
export const KIND_LABEL = { FACT: "Hecho", INFERENCE: "Deducción", PREFERENCE: "Preferencia", DECISION: "Decisión", MEMORY: "Recuerdo", HYPOTHESIS: "Hipótesis" };
export const STATUS_LABEL = { PROPOSED: "Sin confirmar", ACTIVE: "Vigente", SUPERSEDED: "Sustituido", CONTESTED: "En duda", REJECTED: "Rechazado", RETRACTED: "Retirado" };
// Who or what originated a claim. Only Manu's own words or answers make a claim ACTIVE by themselves.
export const SOURCES = { manu: "Me lo dijiste", pregunta: "Respondiste a una pregunta", correccion: "Lo corregiste", regla: "Regla aprendida", deduccion: "Deducción de MANU", importado: "Importado" };
const FROM_MANU = new Set(["manu", "pregunta", "correccion"]);
const DAY = 86400000;
const MAX_TEXT = 600;

// How long before MANU may ask «¿sigue siendo así?». null = never (a memory of the past does not expire).
export const FRESH_DAYS = { FACT: 365, PREFERENCE: 180, DECISION: 120, INFERENCE: 90, HYPOTHESIS: 60, MEMORY: null };

export function emptyBrain() {
  return { schema: BRAIN_SCHEMA, claims: [], events: [], learn: { obs: {}, rules: [] }, outcomes: {}, answers: {}, voice: { humor: 1, franqueza: 1, examples: [] }, settings: { maxPerDay: 3 } };
}

// Validates and fills a brain read from storage, a backup or the cloud.
export function validateBrain(b) {
  if (b === undefined || b === null) return { ok: true, brain: emptyBrain() };
  if (typeof b !== "object" || Array.isArray(b)) return { ok: false, reason: "La memoria no es válida." };
  if (b.schema !== BRAIN_SCHEMA) return { ok: false, reason: `Versión de memoria no compatible (${b.schema}).` };
  if (!Array.isArray(b.claims) || !Array.isArray(b.events ?? [])) return { ok: false, reason: "La memoria no tiene recuerdos válidos." };
  const ids = new Set();
  for (const c of b.claims) {
    if (!c || typeof c.id !== "string" || ids.has(c.id)) return { ok: false, reason: "Hay un recuerdo sin identificador o repetido." };
    ids.add(c.id);
    if (!KINDS.includes(c.kind) || !STATUSES.includes(c.status)) return { ok: false, reason: `El recuerdo ${c.id} tiene un tipo o estado desconocido.` };
  }
  const base = emptyBrain();
  return { ok: true, brain: { ...base, ...b, learn: { ...base.learn, ...(b.learn ?? {}) }, voice: { ...base.voice, ...(b.voice ?? {}) }, settings: { ...base.settings, ...(b.settings ?? {}) }, outcomes: b.outcomes ?? {}, answers: b.answers ?? {}, events: b.events ?? [] } };
}

const iso = (d) => new Date(d).toISOString();
const defaultId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const clean = (t) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
export const keyOf = (t) => normalise(String(t ?? "")).replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || null;

function log(brain, type, claimId, at, extra = {}) {
  brain.events.push({ type, claimId, at: iso(at), ...extra });
  if (brain.events.length > 2000) brain.events.splice(0, brain.events.length - 2000);
}

/**
 * Remembers something. `input`:
 *   text (required) — the memory in Manu's words;
 *   kind — FACT | PREFERENCE | DECISION | MEMORY | INFERENCE | HYPOTHESIS (default MEMORY);
 *   key + value — optional attribute this claim sets (e.g. key "cafe favorito", value "cortado"),
 *                 used to detect corrections and contradictions;
 *   subject — who it is about (default «Manu»); `thirdParty: true` if it is about someone else;
 *   when (YYYY, YYYY-MM or YYYY-MM-DD), place, tags[];
 *   source: { kind: one of SOURCES, ref?, excerpt? }; confidence (0..1) + reason for deductions;
 *   sensitive (bool), durable (bool: facts that do not go stale, e.g. a birth date).
 * Returns { brain, claim, conflict } — `conflict` lists ACTIVE claims with the same key and
 * another value: both become CONTESTED so nothing is decided silently.
 */
export function remember(brain, input, { now = new Date(), uid = defaultId } = {}) {
  const text = clean(input.text);
  if (!text) throw new Error("Un recuerdo necesita texto.");
  const kind = KINDS.includes(input.kind) ? input.kind : "MEMORY";
  const source = { kind: SOURCES[input.source?.kind] ? input.source.kind : "manu", ...(input.source?.ref ? { ref: String(input.source.ref).slice(0, 120) } : {}), ...(input.source?.excerpt ? { excerpt: clean(input.source.excerpt) } : {}) };
  const fromManu = FROM_MANU.has(source.kind);
  // Saying the same thing again is a confirmation, not a second memory.
  if (fromManu && input.key && !input.supersedes) {
    const k = keyOf(input.key), v = keyOf(input.value ?? text), subj = normalise(clean(input.subject) || "Manu");
    const same = brain.claims.find((c) => c.key === k && c.status === "ACTIVE" && normalise(c.subject) === subj && keyOf(c.value) === v);
    if (same) { const next = confirm(brain, same.id, { now }); return { brain: next, claim: next.claims.find((c) => c.id === same.id), conflict: [], repeated: true }; }
  }
  // ADR-0002: what a rule or a model deduces is only proposed, and never becomes a FACT on its own.
  const finalKind = !fromManu && (kind === "FACT" || kind === "MEMORY") ? "INFERENCE" : kind;
  const needsConfidence = finalKind === "INFERENCE" || finalKind === "HYPOTHESIS";
  const confidence = needsConfidence ? Math.max(0, Math.min(1, Number(input.confidence ?? 0.5))) : null;
  const claim = {
    id: uid(),
    text,
    kind: finalKind,
    status: fromManu && !needsConfidence ? "ACTIVE" : "PROPOSED",
    subject: clean(input.subject) || "Manu",
    ...(input.thirdParty ? { thirdParty: true } : {}),
    ...(input.key ? { key: keyOf(input.key), value: clean(input.value ?? text) } : {}),
    ...(input.when ? { when: String(input.when).slice(0, 10) } : {}),
    ...(input.place ? { place: clean(input.place).slice(0, 80) } : {}),
    tags: [...new Set((input.tags ?? []).map(keyOf).filter(Boolean))].slice(0, 8),
    ...(confidence !== null ? { confidence, reason: clean(input.reason) || "Sin explicación" } : {}),
    sensitive: Boolean(input.sensitive || input.thirdParty),
    ...(input.durable ? { durable: true } : {}),
    source,
    recordedAt: iso(now),
    validFrom: input.validFrom ? iso(input.validFrom) : iso(now),
    confirmedAt: fromManu ? iso(now) : null,
    ...(input.supersedes ? { supersedes: input.supersedes } : {}),
  };
  const next = { ...brain, claims: [...brain.claims, claim], events: [...brain.events] };
  log(next, "remember", claim.id, now, { source: source.kind });
  let conflict = [];
  if (claim.key && claim.status === "ACTIVE" && !claim.supersedes) {
    conflict = next.claims.filter((c) => c.id !== claim.id && c.key === claim.key && normalise(c.subject) === normalise(claim.subject) && (c.status === "ACTIVE" || c.status === "CONTESTED") && keyOf(c.value) !== keyOf(claim.value));
    if (conflict.length) {
      const ids = new Set([claim.id, ...conflict.map((c) => c.id)]);
      next.claims = next.claims.map((c) => (ids.has(c.id) ? { ...c, status: "CONTESTED" } : c));
      log(next, "contested", claim.id, now, { with: conflict.map((c) => c.id) });
    }
  }
  return { brain: next, claim: next.claims.find((c) => c.id === claim.id), conflict };
}

const find = (brain, id) => brain.claims.find((c) => c.id === id);
const patchClaim = (brain, id, patch) => ({ ...brain, claims: brain.claims.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

/**
 * Manu corrects a claim. The old one is kept, closed and marked SUPERSEDED; the new one points
 * back to it (DATA_MODEL «Sustitución»). Learned corrections never erase history.
 */
export function correct(brain, id, changes, opts = {}) {
  const old = find(brain, id);
  if (!old) throw new Error("Ese recuerdo no existe.");
  if (old.status === "SUPERSEDED" || old.status === "RETRACTED") throw new Error("Ese recuerdo ya no está vigente: corrige el actual.");
  const now = opts.now ?? new Date();
  const input = {
    text: changes.text ?? old.text, kind: changes.kind ?? (old.kind === "INFERENCE" || old.kind === "HYPOTHESIS" ? "FACT" : old.kind),
    key: old.key, value: changes.value ?? (changes.text && old.key ? changes.text : old.value), subject: old.subject, thirdParty: old.thirdParty,
    when: changes.when ?? old.when, place: changes.place ?? old.place, tags: changes.tags ?? old.tags, sensitive: old.sensitive, durable: old.durable,
    source: { kind: "correccion", ref: old.id }, supersedes: old.id,
  };
  const r = remember(brain, input, { ...opts, now });
  let next = patchClaim(r.brain, old.id, { status: "SUPERSEDED", validUntil: iso(now), supersededBy: r.claim.id });
  // A contradiction is solved by the correction: the other side is superseded too.
  if (old.status === "CONTESTED" && old.key) next = { ...next, claims: next.claims.map((c) => (c.id !== r.claim.id && c.key === old.key && c.status === "CONTESTED" ? { ...c, status: "SUPERSEDED", validUntil: c.validUntil ?? iso(now), supersededBy: r.claim.id } : c)) };
  log(next, "correct", r.claim.id, now, { replaces: old.id });
  return { brain: next, claim: find(next, r.claim.id), previous: find(next, old.id) };
}

// Manu says «sí, sigue siendo así» or confirms a proposal: it becomes ACTIVE and fresh again.
export function confirm(brain, id, { now = new Date() } = {}) {
  const c = find(brain, id);
  if (!c) throw new Error("Ese recuerdo no existe.");
  if (!["ACTIVE", "PROPOSED"].includes(c.status)) throw new Error("Solo se confirma un recuerdo vigente o propuesto.");
  const patch = { status: "ACTIVE", confirmedAt: iso(now) };
  // Once Manu confirms a deduction it is his statement, no longer MANU's guess.
  if (c.kind === "INFERENCE" || c.kind === "HYPOTHESIS") Object.assign(patch, { kind: "FACT", confidence: undefined, reason: undefined, source: { ...c.source, confirmedBy: "manu" } });
  const next = patchClaim(brain, id, patch);
  log(next, "confirm", id, now);
  return next;
}

// «Ya no»: the claim stops being valid today but stays in the history.
export function expire(brain, id, { now = new Date() } = {}) {
  const c = find(brain, id);
  if (!c) throw new Error("Ese recuerdo no existe.");
  const next = patchClaim(brain, id, { status: "RETRACTED", validUntil: iso(now) });
  log(next, "expire", id, now);
  return next;
}

// A proposal Manu says is wrong: kept as REJECTED so the same guess is not proposed again.
export function reject(brain, id, { now = new Date() } = {}) {
  const c = find(brain, id);
  if (!c) throw new Error("Ese recuerdo no existe.");
  const next = patchClaim(brain, id, { status: "REJECTED" });
  log(next, "reject", id, now);
  return next;
}

// Two values in doubt: Manu picks the good one. The others are superseded by it.
export function resolve(brain, keepId, { now = new Date() } = {}) {
  const keep = find(brain, keepId);
  if (!keep || keep.status !== "CONTESTED") throw new Error("Ese recuerdo no está en duda.");
  const next = { ...brain, claims: brain.claims.map((c) => {
    if (c.id === keepId) return { ...c, status: "ACTIVE", confirmedAt: iso(now) };
    if (c.key === keep.key && c.status === "CONTESTED" && normalise(c.subject) === normalise(keep.subject)) return { ...c, status: "SUPERSEDED", validUntil: iso(now), supersededBy: keepId };
    return c;
  }), events: [...brain.events] };
  log(next, "resolve", keepId, now);
  return next;
}

/**
 * «Olvídalo»: Manu's right to delete. The text, value and source excerpt of the claim and of
 * every earlier version it replaced are removed for real. Only a content-free event remains
 * (when, and how many versions), so a backup or sync can propagate the deletion.
 */
export function forget(brain, id, { now = new Date() } = {}) {
  const c = find(brain, id);
  if (!c) return { brain, removed: 0 };
  const chain = new Set([id]);
  let changed = true;
  while (changed) { changed = false; for (const x of brain.claims) if (!chain.has(x.id) && ((x.supersededBy && chain.has(x.supersededBy)) || (x.supersedes && chain.has(x.supersedes)))) { chain.add(x.id); changed = true; } }
  const next = { ...brain, claims: brain.claims.filter((x) => !chain.has(x.id)), events: brain.events.filter((e) => !chain.has(e.claimId)) };
  next.events.push({ type: "forget", at: iso(now), count: chain.size });
  // Learned rules or proposals that pointed to the forgotten claims are dropped too.
  next.outcomes = Object.fromEntries(Object.entries(brain.outcomes ?? {}).filter(([k]) => ![...chain].some((cid) => k.includes(cid))));
  return { brain: next, removed: chain.size };
}

// ---------------- Reading ----------------
const isCurrent = (c, now) => (c.status === "ACTIVE" || c.status === "CONTESTED" || c.status === "PROPOSED") && (!c.validUntil || new Date(c.validUntil) > now);

// What MANU believes now: active, contested and proposed claims that are still valid.
export function current(brain, { now = new Date(), includeProposed = true } = {}) {
  return brain.claims.filter((c) => isCurrent(c, now) && (includeProposed || c.status !== "PROPOSED"));
}

// Every version of one fact, oldest first, with the reason for each change.
export function history(brain, id) {
  const c = find(brain, id);
  if (!c) return [];
  const out = [];
  let x = c;
  const seen = new Set();
  while (x && !seen.has(x.id)) { seen.add(x.id); out.unshift(x); x = x.supersedes ? find(brain, x.supersedes) : null; }
  x = c;
  while (x?.supersededBy && !seen.has(x.supersededBy)) { x = find(brain, x.supersededBy); if (!x) break; seen.add(x.id); out.push(x); }
  return out;
}

/**
 * Is this worth a «¿sigue siendo así?» question? Memories of the past and durable facts never are.
 * Third-party and sensitive claims are never asked about spontaneously (Manu: no random
 * reminders about friendships or sentimental memories).
 */
export function staleness(c, now = new Date()) {
  if (c.status !== "ACTIVE" || c.durable || c.thirdParty || c.sensitive) return { stale: false };
  const days = FRESH_DAYS[c.kind];
  if (!days) return { stale: false };
  const since = new Date(c.confirmedAt ?? c.recordedAt);
  const age = Math.floor((now - since) / DAY);
  return { stale: age >= days, ageDays: age, limitDays: days };
}
export const staleClaims = (brain, now = new Date()) => brain.claims.filter((c) => staleness(c, now).stale).sort((a, b) => staleness(b, now).ageDays - staleness(a, now).ageDays);
export const contested = (brain) => brain.claims.filter((c) => c.status === "CONTESTED");
export const proposed = (brain) => brain.claims.filter((c) => c.status === "PROPOSED");

// Dates Manu might mention: «2024», «marzo de 2024», «en marzo».
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function dateFilter(text) {
  const t = normalise(text);
  const y = t.match(/\b(19|20)\d{2}\b/)?.[0] ?? null;
  const mi = MONTHS.findIndex((m) => new RegExp(`\\b${m}\\b`).test(t));
  if (mi < 0 && !y) return null;
  return { year: y, month: mi >= 0 ? String(mi + 1).padStart(2, "0") : null };
}
const STOP = new Set(["que", "de", "del", "la", "el", "los", "las", "un", "una", "y", "o", "en", "mi", "mis", "me", "lo", "sobre", "sabes", "recuerdas", "acerca", "con", "por", "para", "a", "al", "es", "se", "su", "tu", "te", "yo"]);
export const words = (t) => keyOf(t)?.split(" ").filter((w) => w.length > 1 && !STOP.has(w)) ?? [];

/**
 * Finds memories by words, subject, place, tags and dates («¿qué recuerdas de marzo de 2024?»).
 * Scored and explained: each hit says which field matched. Current claims first; superseded and
 * retracted ones only with `history: true`.
 */
export function search(brain, query, { now = new Date(), history: withHistory = false, limit = 20 } = {}) {
  const ws = words(query);
  const df = dateFilter(query);
  const out = [];
  for (const c of brain.claims) {
    if (!withHistory && !isCurrent(c, now)) continue;
    if (c.status === "REJECTED") continue;
    let score = 0; const why = [];
    const fields = { texto: keyOf(c.text) ?? "", tema: [c.key, ...(c.tags ?? [])].filter(Boolean).join(" "), sobre: keyOf(c.subject) ?? "", lugar: keyOf(c.place) ?? "", valor: keyOf(c.value) ?? "" };
    for (const w of ws) for (const [f, v] of Object.entries(fields)) if (v.split(" ").some((x) => x === w || (w.length > 3 && x.startsWith(w)))) { score += f === "texto" ? 1 : 2; why.push(f); }
    if (df && c.when) { if ((!df.year || c.when.startsWith(df.year)) && (!df.month || c.when.slice(5, 7) === df.month)) { score += 3; why.push("fecha"); } else if (!ws.length) continue; }
    else if (df && !ws.length) continue;
    if (score > 0 || (!ws.length && df && c.when)) out.push({ claim: c, score: score + (isCurrent(c, now) ? 0.5 : 0), why: [...new Set(why)] });
  }
  return out.sort((a, b) => b.score - a.score || String(b.claim.recordedAt).localeCompare(a.claim.recordedAt)).slice(0, limit);
}

/**
 * Memories related to one: same subject (not «Manu», that would be everything), place, date
 * (same month), tags or key. Each link names its reason, so the UI never invents a connection.
 */
export function related(brain, id, { now = new Date(), limit = 8 } = {}) {
  const c = find(brain, id);
  if (!c) return [];
  const out = [];
  for (const x of brain.claims) {
    if (x.id === id || !isCurrent(x, now)) continue;
    const why = [];
    if (c.subject !== "Manu" && normalise(x.subject) === normalise(c.subject)) why.push(`también sobre ${c.subject}`);
    if (c.place && x.place && keyOf(c.place) === keyOf(x.place)) why.push(`en ${c.place}`);
    if (c.when && x.when && c.when.slice(0, 7) === x.when.slice(0, 7)) why.push(`mismo mes (${c.when.slice(0, 7)})`);
    const shared = (c.tags ?? []).filter((t) => (x.tags ?? []).includes(t));
    if (shared.length) why.push(`tema: ${shared.join(", ")}`);
    if (c.key && x.key === c.key) why.push("misma cuestión");
    if (why.length) out.push({ claim: x, why });
  }
  return out.sort((a, b) => b.why.length - a.why.length).slice(0, limit);
}

// Counts for the Memoria screen.
export function stats(brain, now = new Date()) {
  const cur = current(brain, { now });
  return { total: cur.length, active: cur.filter((c) => c.status === "ACTIVE").length, proposed: cur.filter((c) => c.status === "PROPOSED").length, contested: cur.filter((c) => c.status === "CONTESTED").length, stale: staleClaims(brain, now).length, history: brain.claims.length - cur.length };
}
