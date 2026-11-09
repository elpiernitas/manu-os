// La memoria en el chat (WEB-94), sin IA (ADR-0009).
//
//   «recuerda que mi café favorito es el cortado»  → guarda (y detecta si contradice algo)
//   «apúntate que el 3 de marzo fui a Oviedo»     → guarda un recuerdo con fecha y lugar
//   «¿qué sabes de mí?» / «¿qué sabes del café?»  → responde separando hechos y deducciones
//   «¿qué recuerdas de marzo de 2024?»            → busca por fecha
//   «olvida lo del cilantro»                       → propone borrar; borra al confirmar
// «Recuérdame…» sigue siendo un recordatorio con hora: no pasa por aquí.

import { normalise } from "./text.js";
import { remember, search, current, keyOf, dateFilter } from "./brain.js";
import { describe, line, contradiction, own } from "./voice.js";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/** Recognises a memory command. Returns { kind, ... } or null. */
export function memCommand(text) {
  const raw = String(text ?? "").trim();
  const t = normalise(raw).replace(/[¿?¡!]/g, "").trim();
  let m;
  if ((m = raw.match(/^\s*(?:recuerda|ap[uú]ntate|acu[eé]rdate(?: de)?|no olvides|que sepas|toma nota(?: de)?)\s+(?:que|de que)\s+(.{2,})$/i))) return { kind: "remember", text: m[1].trim().replace(/[.]+$/, "") };
  if (/^(que sabes de mi|que recuerdas de mi|que sabes sobre mi|que tienes de mi|mi memoria)$/.test(t)) return { kind: "about", topic: "" };
  if ((m = t.match(/^que (?:sabes|recuerdas|tienes apuntado) (?:de|del|de la|de los|de las|sobre|acerca de)\s+(.+)$/))) return { kind: "about", topic: m[1].replace(/^(el|la|los|las|mi|mis)\s+/, "") };
  if ((m = t.match(/^(?:olvida|olvidate de|borra (?:el recuerdo|de tu memoria))\s+(?:lo de\s+|lo del\s+|lo de la\s+|que\s+)?(.{2,})$/))) return { kind: "forget", topic: m[1] };
  return null;
}

// «mi café favorito es el cortado» → key «cafe favorito», value «el cortado».
// «prefiero X», «me gusta X», «no me gusta X», «vivo en X», «trabajo en X», «estudio X».
export function extractFact(text) {
  const t = String(text).trim();
  const n = normalise(t);
  let m;
  if ((m = t.match(/^mi[s]?\s+(.{2,40}?)\s+(?:es|son|est[aá]n?)\s+(.{1,120})$/i))) return { kind: "PREFERENCE", key: m[1], value: m[2], text: t };
  if ((m = n.match(/^(?:ya )?no me gusta[n]?\s+(.{2,80})$/))) return { kind: "PREFERENCE", key: `no me gusta ${keyOf(m[1])}`, value: "no", text: t };
  if ((m = n.match(/^me (?:gusta|encanta|flipa)[n]?\s+(.{2,80})$/))) return { kind: "PREFERENCE", key: `me gusta ${keyOf(m[1])}`, value: "si", text: t };
  if ((m = t.match(/^prefiero\s+(.{2,120})$/i))) return { kind: "PREFERENCE", text: t };
  if ((m = t.match(/^vivo en\s+(.{2,60})$/i))) return { kind: "FACT", key: "donde vivo", value: m[1], text: t };
  if ((m = t.match(/^(?:ahora )?trabajo (?:en|de|como)\s+(.{2,60})$/i))) return { kind: "FACT", key: "trabajo", value: m[1], text: t };
  if ((m = t.match(/^(?:estudio|estoy estudiando)\s+(.{2,80})$/i))) return { kind: "FACT", key: "estudios", value: m[1], text: t };
  if ((m = n.match(/^he decidido\s+(.{2,120})$/))) return { kind: "DECISION", text: t };
  return { kind: "MEMORY", text: t };
}

// A date in the memory («el 3 de marzo de 2024», «en 2023», «ayer») and a place («en Oviedo»).
export function extractWhen(text, now = new Date()) {
  const n = normalise(text);
  let m;
  const pad = (x) => String(x).padStart(2, "0");
  if (/\bayer\b/.test(n)) { const d = new Date(now); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  if (/\bhoy\b/.test(n)) return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if ((m = n.match(new RegExp(`\\b(\\d{1,2}) de (${MONTHS.join("|")})(?: de ((?:19|20)\\d{2}))?`)))) {
    const mo = MONTHS.indexOf(m[2]) + 1; let y = m[3] ? Number(m[3]) : now.getFullYear();
    if (!m[3] && new Date(y, mo - 1, Number(m[1])) > now) y--; // «el 3 de diciembre» said in March is last year
    return `${y}-${pad(mo)}-${pad(m[1])}`;
  }
  const df = dateFilter(n);
  if (df?.year && df.month) return `${df.year}-${df.month}`;
  if (df?.year) return df.year;
  return null;
}
export function extractPlace(text) {
  const m = String(text).match(/\b(?:en|a|desde)\s+((?:[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)(?:\s+(?:de\s+)?[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)*)/);
  return m ? m[1] : null;
}

/**
 * Runs a memory command against the brain. Returns { brain, reply, pending? }.
 * `pending` (for «olvida») is a list of claim ids the UI asks Manu to confirm before deleting:
 * forgetting is never done on a vague match.
 */
export function runMemCommand(brain, cmd, { now = new Date(), seed = 0, uid } = {}) {
  const voice = brain.voice ?? {};
  if (cmd.kind === "remember") {
    const f = extractFact(cmd.text);
    const when = extractWhen(cmd.text, now);
    const place = f.kind === "MEMORY" ? extractPlace(cmd.text) : null;
    const r = remember(brain, { text: f.text.charAt(0).toUpperCase() + f.text.slice(1), kind: f.kind, key: f.key, value: f.value, when, place, source: { kind: "manu", excerpt: cmd.text } }, { now, ...(uid ? { uid } : {}) });
    if (r.conflict.length) return { brain: r.brain, reply: contradiction(voice, r.conflict[0], f.value ?? f.text, seed), claim: r.claim };
    const mine = own(voice, "acierto", seed);
    return { brain: r.brain, claim: r.claim, reply: `${mine ? `${mine} ` : ""}${line(voice, "saved", seed)} (${{ FACT: "hecho", PREFERENCE: "preferencia", DECISION: "decisión", MEMORY: "recuerdo" }[r.claim.kind]}${when ? `, ${when}` : ""}${place ? `, en ${place}` : ""})` };
  }
  if (cmd.kind === "about") {
    const hits = cmd.topic ? search(brain, cmd.topic, { now }) : current(brain, { now }).filter((c) => c.subject === "Manu").map((claim) => ({ claim }));
    return { brain, reply: describe(voice, hits.slice(0, 15), { seed, topic: cmd.topic }) };
  }
  if (cmd.kind === "forget") {
    const hits = search(brain, cmd.topic, { now }).filter((h) => h.score >= 1);
    if (!hits.length) return { brain, reply: `No encuentro nada sobre «${cmd.topic}» para borrar.` };
    return { brain, reply: `¿Borro esto para siempre?\n${hits.slice(0, 5).map((h) => `• ${h.claim.text}`).join("\n")}`, pending: hits.slice(0, 5).map((h) => h.claim.id) };
  }
  return { brain, reply: lower("No te he entendido.") };
}
