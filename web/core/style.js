// Tu manera de escribir (WEB-95): MANU observa cómo escribe Manu dentro de MANU OS (sus
// mensajes en el chat y sus ideas) y aprende expresiones, su forma de reírse y su uso de emojis.
//
// Reglas:
// - Solo observa a Manu, nunca a terceros: lo que parece un nombre, cifras, correos, enlaces o
//   palabras sensibles no entra en las expresiones candidatas.
// - Lo observado es una hipótesis con su recuento y un ejemplo literal. MANU no lo usa hasta
//   que Manu lo confirma (`brain.voice`), y lo rechazado no se vuelve a proponer.
// - El modelo es incremental y acotado (el chat solo guarda 200 mensajes): contadores, no textos,
//   salvo un ejemplo corto por expresión para que Manu vea de dónde sale.
// - Manu puede apagarlo y borrar lo observado cuando quiera.

import { normalise } from "./text.js";

export const MIN_TIMES = 3;   // una expresión candidata: al menos 3 veces…
export const MIN_DAYS = 2;    // …en al menos 2 días distintos
const MAX_GRAMS = 400;
const LAUGHS = [["jajaja", /\b(?:ja){2,}j?\b/], ["jsjs", /\b(?:js){2,}j?\b/], ["xd", /\bxd+\b/], ["hahaha", /\b(?:ha){2,}h?\b/], ["jeje", /\b(?:je){2,}j?\b/], ["lol", /\blol\b/]];
const EMOJI = /\p{Extended_Pictographic}/gu;
// Function words: an expression made only of these says nothing about Manu.
const FUNC = new Set("a al algo ante con contra de del desde el en entre era es esa ese eso esta este esto estoy fue ha han hay he la las le les lo los me mi mis muy nada no nos o os para pero por que se si sin sobre su sus te tengo ti tu un una uno unos y ya yo voy vas va tambien como cuando donde hoy ayer mañana manana ahora".split(" "));
// Never learned as «his expressions»: money, health, sex, crisis… (they may still be his words,
// but a voice that repeats them back would expose them).
const SENSITIVE = /\b(euro|euros|pagar|pague|deuda|banco|tarjeta|cuenta|salud|medico|medica|pastilla|ansiedad|depre|suicid|morir|sexo|follar|borracho|resaca|droga|porro|fumar|novia|novio|ex|contrasena|password|dni)\b/;

export const emptyStyle = () => ({ on: true, msgs: 0, days: [], grams: {}, laugh: {}, emoji: {}, emojiMsgs: 0, decided: {}, since: null });

// Words of a message, keeping only what may form an expression. Capitalised words that are not
// at the start of a sentence look like names (of other people): they cut the sequence.
export function tokens(text) {
  const out = [];
  const parts = String(text ?? "").replace(/https?:\/\/\S+|\S+@\S+/g, " | ").split(/([.!?¡¿\n]+|\s+)/);
  let sentenceStart = true;
  for (const raw of parts) {
    if (!raw) continue;
    if (/^[.!?¡¿\n]+$/.test(raw)) { sentenceStart = true; out.push("|"); continue; }
    if (/^\s+$/.test(raw)) continue;
    const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!w) { out.push("|"); continue; }
    const isName = /^\p{Lu}/u.test(w) && !sentenceStart;
    sentenceStart = false;
    if (isName || /\d/.test(w)) { out.push("|"); continue; }
    out.push(normalise(w));
  }
  return out;
}

// 2–4 word expressions that are not only function words, not sensitive, not cut by a name.
export function grams(text) {
  const t = tokens(text);
  const out = new Set();
  for (let n = 2; n <= 4; n++) for (let i = 0; i + n <= t.length; i++) {
    const g = t.slice(i, i + n);
    if (g.includes("|")) continue;
    if (g.every((w) => FUNC.has(w))) continue;
    if (g.filter((w) => !FUNC.has(w)).every((w) => w.length < 3)) continue;
    const s = g.join(" ");
    if (SENSITIVE.test(s)) continue;
    out.add(s);
  }
  return [...out];
}

const dayOf = (d) => new Date(d).toISOString().slice(0, 10);
// A short literal example, for «de dónde sale esto». Only if the message itself is not sensitive.
const example = (text) => (SENSITIVE.test(normalise(text)) ? null : String(text).replace(/\s+/g, " ").trim().slice(0, 120));

/** Manu wrote `text` (chat or idea). Updates the counters. Returns the new style model. */
export function observeText(style, text, { now = new Date() } = {}) {
  const s = style ?? emptyStyle();
  if (s.on === false) return s;
  const clean = String(text ?? "").trim();
  if (clean.length < 2) return s;
  const day = dayOf(now);
  const next = { ...s, msgs: s.msgs + 1, days: s.days.includes(day) ? s.days : [...s.days, day].slice(-120), grams: { ...s.grams }, laugh: { ...s.laugh }, emoji: { ...s.emoji }, since: s.since ?? now.toISOString() };
  for (const g of grams(clean)) {
    const prev = next.grams[g] ?? { n: 0, days: [] };
    next.grams[g] = { n: prev.n + 1, days: prev.days.includes(day) ? prev.days : [...prev.days, day].slice(-10), ex: prev.ex ?? example(clean) };
  }
  const n = normalise(clean);
  for (const [k, re] of LAUGHS) if (re.test(n)) next.laugh[k] = (next.laugh[k] ?? 0) + 1;
  const emojis = clean.match(EMOJI) ?? [];
  if (emojis.length) { next.emojiMsgs = (s.emojiMsgs ?? 0) + 1; for (const e of emojis) next.emoji[e] = (next.emoji[e] ?? 0) + 1; }
  // Keep the model small: drop the rarest expressions first.
  const keys = Object.keys(next.grams);
  if (keys.length > MAX_GRAMS) {
    keys.sort((a, b) => next.grams[a].n - next.grams[b].n || (next.grams[a].days.at(-1) ?? "").localeCompare(next.grams[b].days.at(-1) ?? ""));
    for (const k of keys.slice(0, keys.length - MAX_GRAMS)) delete next.grams[k];
  }
  return next;
}

/**
 * Expressions worth asking about: repeated, on several days, not already decided. A longer
 * expression hides the shorter ones inside it with the same count («que maquina» vs «que maquina tio»).
 */
export function expressionCandidates(style, { limit = 3 } = {}) {
  if (!style) return [];
  const decided = style.decided ?? {};
  const xs = Object.entries(style.grams).filter(([g, v]) => v.n >= MIN_TIMES && v.days.length >= MIN_DAYS && !decided[`expr:${g}`]);
  const kept = xs.filter(([g, v]) => !xs.some(([h, w]) => h !== g && h.includes(g) && w.n >= v.n));
  return kept.sort((a, b) => b[1].n - a[1].n || b[1].days.length - a[1].days.length).slice(0, limit).map(([g, v]) => ({ key: `expr:${g}`, text: g, times: v.n, days: v.days.length, example: v.ex ?? null }));
}

// How Manu laughs, if one way clearly dominates (≥ 3 times and ≥ 70 %).
export function laughCandidate(style) {
  if (!style || style.decided?.laugh) return null;
  const xs = Object.entries(style.laugh ?? {});
  const total = xs.reduce((a, [, n]) => a + n, 0);
  if (!xs.length) return null;
  const [k, n] = xs.sort((a, b) => b[1] - a[1])[0];
  return n >= 3 && n / total >= 0.7 ? { key: "laugh", laugh: k, times: n } : null;
}

// Emojis: after 20 messages, whether he uses them a lot (≥ 30 %) or almost never (≤ 5 %).
export function emojiCandidate(style) {
  if (!style || style.decided?.emoji || style.msgs < 20) return null;
  const rate = (style.emojiMsgs ?? 0) / style.msgs;
  const top = Object.entries(style.emoji ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([e]) => e);
  if (rate >= 0.3) return { key: "emoji", use: true, rate, top };
  if (rate <= 0.05) return { key: "emoji", use: false, rate, top: [] };
  return null;
}

/** Manu's answer to a style proposal. `yes` false means «no, eso no»: never proposed again. */
export function decide(style, key, yes, { now = new Date() } = {}) {
  return { ...style, decided: { ...(style.decided ?? {}), [key]: { yes: Boolean(yes), at: now.toISOString() } } };
}

// Off switch and «olvida lo que has observado»: counters and examples go; Manu's decisions stay
// (so a «no» is still a «no»).
export const setLearning = (style, on) => ({ ...(style ?? emptyStyle()), on: Boolean(on) });
export const wipeObserved = (style) => ({ ...emptyStyle(), on: style?.on ?? true, decided: style?.decided ?? {} });

// A summary for the screen: plain counts, no guesses.
export function styleSummary(style) {
  if (!style) return null;
  const laughs = Object.entries(style.laugh ?? {}).sort((a, b) => b[1] - a[1]);
  const emojis = Object.entries(style.emoji ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { msgs: style.msgs, days: style.days.length, laughs, emojis, emojiRate: style.msgs ? (style.emojiMsgs ?? 0) / style.msgs : 0, expressions: Object.keys(style.grams).length, on: style.on !== false };
}
