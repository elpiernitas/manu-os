// La voz de MANU (WEB-94): personalidad configurable, basada en ejemplos reales de Manu.
//
// Nivel base sin IA (ADR-0009): plantillas variadas, sin repetirse, con el tono que Manu elige.
// - humor 0–2: de sobrio a con chispa;
// - franqueza 0–2: de suave a «zasca con fundamento» — puede señalar contradicciones, pero
//   siempre citando lo que Manu dijo y cuándo. Nunca humilla ni vuelve sobre algo cerrado.
// - ejemplos: expresiones que Manu escribe él mismo. MANU solo las reutiliza tal cual, en la
//   situación que Manu indicó; no inventa frases «suyas» ni recuerdos.
// Toda respuesta sobre la memoria separa hechos, recuerdos, deducciones e hipótesis.

import { KIND_LABEL, SOURCES } from "./brain.js";

export const WHEN = { saludo: "Al saludar", acierto: "Cuando algo sale bien", error: "Cuando algo sale mal", despedida: "Al despedirse", cualquiera: "En cualquier momento" };
export const HUMOR_LABEL = ["Sobrio", "Natural", "Con chispa"];
export const FRANQUEZA_LABEL = ["Suave", "Directo", "Zasca con fundamento"];

const pickN = (list, seed) => list[((seed % list.length) + list.length) % list.length];
const level = (v) => Math.max(0, Math.min(2, Number(v ?? 1)));

export function addExample(voice, text, when = "cualquiera", { now = new Date() } = {}) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  if (!t) throw new Error("Escribe la expresión.");
  if ((voice.examples ?? []).some((e) => e.text.toLowerCase() === t.toLowerCase())) return voice;
  return { ...voice, examples: [...(voice.examples ?? []), { text: t, when: WHEN[when] ? when : "cualquiera", at: new Date(now).toISOString() }].slice(-40) };
}
export const removeExample = (voice, i) => ({ ...voice, examples: (voice.examples ?? []).filter((_, k) => k !== i) });

// One of Manu's own expressions for this moment, if he left one. Used sparingly: 1 in 3 at most.
export function own(voice, when, seed = 0) {
  const pool = (voice.examples ?? []).filter((e) => e.when === when || e.when === "cualquiera");
  if (!pool.length || seed % 3 !== 0) return null;
  return pickN(pool, Math.floor(seed / 3)).text;
}

const LINES = {
  saved: [["Apuntado.", "Guardado."], ["Apuntado. Esto ya no se me olvida.", "Hecho, queda en tu memoria.", "Guardado; me lo quedo."], ["Apuntado. Uno menos que tener en la cabeza.", "Guardado. Tu memoria externa crece.", "Hecho. Si se te olvida, aquí estoy."]],
  forgot: [["Borrado."], ["Borrado del todo.", "Olvidado. No queda el texto en ningún sitio de MANU."], ["Borrado. Como si nunca me lo hubieras contado.", "Olvidado. Ni rastro (salvo que lo apuntes otra vez)."]],
  nothing: [["No tengo nada sobre eso."], ["No tengo nada guardado sobre eso.", "De eso no sé nada todavía."], ["Ahí tengo un hueco. Si quieres, cuéntamelo y lo apunto.", "Nada por aquí. O no me lo has contado o lo has borrado."]],
};
// With humor on and a laugh Manu confirmed (his own way of writing it), MANU laughs now and then.
export function line(voice, kind, seed = 0) {
  const base = pickN(LINES[kind][level(voice?.humor)], seed);
  return voice?.laugh && level(voice?.humor) >= 1 && kind === "saved" && seed % 4 === 2 ? `${base} ${voice.laugh}` : base;
}

// ---- Manu's jokes and wordplay: kept only when he says so, returned verbatim with their date ----
export const JOKE_KINDS = { juego: "Juego de palabras", chiste: "Chiste", frase: "Frase tuya" };
export function addJoke(voice, text, kind = "chiste", { now = new Date(), from = null } = {}) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 280);
  if (!t) throw new Error("No hay nada que guardar.");
  const jokes = voice.jokes ?? [];
  if (jokes.some((j) => j.text.toLowerCase() === t.toLowerCase())) return voice;
  return { ...voice, jokes: [...jokes, { text: t, kind: JOKE_KINDS[kind] ? kind : "chiste", at: new Date(now).toISOString(), ...(from ? { from } : {}) }].slice(-100) };
}
export const removeJoke = (voice, i) => ({ ...voice, jokes: (voice.jokes ?? []).filter((_, k) => k !== i) });
// «Cuéntame uno de mis chistes»: one of HIS, never made up.
export function tellJoke(voice, seed = 0) {
  const jokes = voice?.jokes ?? [];
  if (!jokes.length) return "Aún no me has dejado ninguno. Cuando digas uno bueno, escribe «guárdate esa» y lo apunto tal cual.";
  const j = pickN(jokes, seed);
  return `Uno tuyo, del ${new Date(j.at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}:\n«${j.text}»`;
}

/**
 * When Manu says something that contradicts what he said before. The reply always cites the
 * earlier claim and its date — that is the «fundamento». Franqueza changes the tone, not the facts.
 */
export function contradiction(voice, previous, said, seed = 0) {
  const when = new Date(previous.recordedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const before = `«${previous.value ?? previous.text}»`;
  const now = `«${said}»`;
  const f = level(voice?.franqueza);
  const opener = f === 0 ? `Antes me dijiste ${before} (${when}).` : f === 1 ? `Ojo: el ${when} me dijiste ${before}, y ahora ${now}.` : pickN([`Espera, que el ${when} me juraste ${before}. Ahora ${now}. ¿Cambio de opinión o despiste?`, `El ${when} era ${before}. Hoy es ${now}. Alguien ha cambiado, y no he sido yo.`], seed);
  return `${opener} Los dejo los dos en duda hasta que elijas; ninguno pasa a ser verdad en silencio.`;
}

const kindTag = (c) => (c.kind === "INFERENCE" || c.kind === "HYPOTHESIS" ? `${KIND_LABEL[c.kind]}, ${Math.round((c.confidence ?? 0.5) * 100)} % de confianza` : KIND_LABEL[c.kind]);
const dateTag = (c) => (c.when ? ` · ${c.when}` : "");

/**
 * Answer to «¿qué sabes de X?»: grouped so a fact never looks like a guess, each line with its
 * origin. Built only from the claims passed in: MANU never fills gaps with invented memories.
 */
export function describe(voice, hits, { seed = 0, topic = "" } = {}) {
  if (!hits.length) return line(voice, "nothing", seed);
  const groups = [["Hechos y recuerdos", (c) => ["FACT", "MEMORY", "PREFERENCE", "DECISION"].includes(c.kind) && c.status === "ACTIVE"], ["En duda", (c) => c.status === "CONTESTED"], ["Deducciones sin confirmar", (c) => c.status === "PROPOSED" || c.kind === "INFERENCE" || c.kind === "HYPOTHESIS"]];
  const used = new Set();
  const parts = [];
  for (const [title, pred] of groups) {
    const xs = hits.map((h) => h.claim ?? h).filter((c) => !used.has(c.id) && pred(c));
    if (!xs.length) continue;
    xs.forEach((c) => used.add(c.id));
    parts.push(`${title}:\n${xs.map((c) => `• ${c.text} (${kindTag(c)}${dateTag(c)} · ${SOURCES[c.source?.kind] ?? "origen desconocido"})`).join("\n")}`);
  }
  const head = topic ? `Sobre «${topic}» tengo esto:` : "Esto es lo que tengo:";
  return `${head}\n\n${parts.join("\n\n")}\n\nSi algo no es así, corrígelo en Tú → Memoria.`;
}
