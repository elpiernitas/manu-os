// Conocernos (WEB-94): la experiencia inicial de conocimiento mutuo.
//
// MANU hace pocas preguntas, de una en una y por niveles: primero lo básico, luego gustos y
// rutinas, luego cómo quiere Manu que le hable. Cada respuesta es una Claim con procedencia
// «Respondiste a una pregunta», que se puede corregir o borrar. «Prefiero no responder» se
// respeta para siempre; «Otro día» la aplaza. Solo pregunta por Manu, nunca por terceros.

import { remember } from "./brain.js";

// level: orden de aparición. kind: clasificación de la Claim. voice: ajusta la personalidad.
export const QUESTIONS = [
  { id: "nombre", level: 1, q: "¿Cómo quieres que te llame?", hint: "Tu nombre, un mote…", kind: "PREFERENCE", key: "como llamarme", durable: true, text: (a) => `Prefiero que me llamen ${a}.` },
  { id: "ciudad", level: 1, q: "¿Dónde vives ahora?", hint: "Ciudad o barrio", kind: "FACT", key: "donde vivo", text: (a) => `Vivo en ${a}.` },
  { id: "estudios", level: 1, q: "¿Qué estás estudiando o qué estudiaste?", kind: "FACT", key: "estudios", text: (a) => `Estudios: ${a}.` },
  { id: "proyecto", level: 1, q: "¿Qué proyecto tuyo te ilusiona más ahora mismo?", kind: "PREFERENCE", key: "proyecto que mas me ilusiona", text: (a) => `El proyecto que más me ilusiona ahora: ${a}.` },
  { id: "franqueza", level: 1, q: "Cuando metas la pata, ¿cómo quieres que te lo diga?", voice: "franqueza", options: [["0", "Con tacto"], ["1", "Directo"], ["2", "Con un zasca, si tengo pruebas"]] },
  { id: "humor", level: 1, q: "¿Cuánto humor quieres en mis respuestas?", voice: "humor", options: [["0", "Poco, al grano"], ["1", "Normal"], ["2", "Mucho"]] },
  { id: "manana", level: 2, q: "¿Eres más de mañanas o de noches?", kind: "PREFERENCE", key: "mananas o noches", options: [["mañanas", "De mañanas"], ["noches", "De noches"], ["depende", "Depende del día"]], text: (a) => `Soy más de ${a}.` },
  { id: "cafe", level: 2, q: "¿Cómo tomas el café (o lo que tomes por la mañana)?", kind: "PREFERENCE", key: "cafe", text: (a) => `Por la mañana tomo: ${a}.` },
  { id: "comida", level: 2, q: "Una comida que te arregla el día.", kind: "PREFERENCE", key: "comida favorita", text: (a) => `Comida que me arregla el día: ${a}.` },
  { id: "musica", level: 2, q: "¿Qué música te pones cuando quieres concentrarte?", kind: "PREFERENCE", key: "musica para concentrarme", text: (a) => `Para concentrarme escucho: ${a}.` },
  { id: "odio", level: 2, q: "Algo pequeño que te saca de quicio.", kind: "PREFERENCE", key: "cosas que me sacan de quicio", text: (a) => `Me saca de quicio: ${a}.` },
  { id: "expresion", level: 2, q: "Una expresión tuya que digas mucho.", hint: "MANU la podrá usar tal cual, cuando tú digas", voiceExample: true },
  { id: "meta", level: 3, q: "¿Qué te gustaría haber conseguido dentro de un año?", kind: "DECISION", key: "meta a un ano", text: (a) => `Dentro de un año me gustaría: ${a}.` },
  { id: "olvido", level: 3, q: "¿Qué tipo de cosas se te suelen olvidar?", hint: "Así sé qué vigilar", kind: "FACT", key: "lo que se me olvida", text: (a) => `Se me suele olvidar: ${a}.` },
  { id: "descanso", level: 3, q: "¿Qué haces para desconectar?", kind: "PREFERENCE", key: "como desconecto", text: (a) => `Para desconectar: ${a}.` },
  { id: "aviso", level: 3, q: "¿Cuándo prefieres que no te moleste?", hint: "Por ejemplo: entre semana antes de las 9", kind: "PREFERENCE", key: "cuando no molestarme", text: (a) => `No molestarme: ${a}.` },
  { id: "vetado", level: 3, q: "¿Hay algún tema que prefieres que no saque yo por mi cuenta?", hint: "Solo saldrá si tú lo preguntas", kind: "DECISION", key: "temas que no sacar", sensitive: true, text: (a) => `Temas que MANU no saca por su cuenta: ${a}.` },
];

export const answered = (brain, id) => Boolean(brain.answers?.[id]);
const dayOf = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * The next question, or null. One level opens when the previous one is answered or skipped.
 * At most `perDay` answers a day, so getting to know each other is gradual, never an interrogation.
 */
export function nextQuestion(brain, { now = new Date(), perDay = 3 } = {}) {
  const ans = brain.answers ?? {};
  const today = dayOf(now);
  const doneToday = Object.values(ans).filter((a) => a.at?.slice(0, 10) === today && a.state !== "later").length;
  if (doneToday >= perDay) return null;
  const open = QUESTIONS.filter((q) => !ans[q.id] || (ans[q.id].state === "later" && ans[q.id].until <= now.toISOString()));
  if (!open.length) return null;
  const lvl = Math.min(...open.map((q) => q.level));
  return open.find((q) => q.level === lvl) ?? null;
}
export const progress = (brain) => ({ done: QUESTIONS.filter((q) => brain.answers?.[q.id] && brain.answers[q.id].state !== "later").length, total: QUESTIONS.length });

/**
 * Manu answers. `answer` is his text (or the option value). Returns the new brain and what was
 * stored, so the UI can show «Guardado como Preferencia» and let him correct it at once.
 */
export function answer(brain, id, value, { now = new Date(), uid, when = "cualquiera" } = {}) {
  const q = QUESTIONS.find((x) => x.id === id);
  if (!q) throw new Error("Pregunta desconocida.");
  const v = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!v) throw new Error("Escribe una respuesta o pulsa «Prefiero no responder».");
  let next = { ...brain, answers: { ...(brain.answers ?? {}) } };
  let claim = null;
  if (q.voice) {
    const n = Number(v);
    if (![0, 1, 2].includes(n)) throw new Error("Elige una opción.");
    next.voice = { ...next.voice, [q.voice]: n };
  } else if (q.voiceExample) {
    next.voice = { ...next.voice, examples: [...(next.voice?.examples ?? []).filter((e) => e.text.toLowerCase() !== v.toLowerCase()), { text: v.slice(0, 140), when, at: now.toISOString() }] };
  } else {
    const label = q.options?.find(([k]) => k === v)?.[0] ?? v;
    const r = remember(next, { text: q.text(label), kind: q.kind, key: q.key, value: label, durable: q.durable, sensitive: q.sensitive, tags: ["conocernos"], source: { kind: "pregunta", ref: q.id, excerpt: q.q } }, { now, ...(uid ? { uid } : {}) });
    next = r.brain; claim = r.claim;
    next.answers = { ...next.answers };
  }
  next.answers[id] = { state: "answered", at: now.toISOString(), ...(claim ? { claimId: claim.id } : {}) };
  return { brain: next, claim, question: q };
}

// «Prefiero no responder» (forever) or «Otro día» (back in 3 days).
export function skip(brain, id, { now = new Date(), forever = true } = {}) {
  if (!QUESTIONS.some((q) => q.id === id)) throw new Error("Pregunta desconocida.");
  const until = new Date(now.getTime() + 3 * 86400000).toISOString();
  return { ...brain, answers: { ...(brain.answers ?? {}), [id]: forever ? { state: "declined", at: now.toISOString() } : { state: "later", at: now.toISOString(), until } } };
}
