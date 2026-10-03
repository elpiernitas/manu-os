// Biblioteca (WEB-85), from the idea «biblioteca de vida»: books, articles,
// videos, podcasts and courses, with what Manu took from each one, so he can
// ask «¿qué aprendí de X?» later. Ideas can be drafted by Gemini from his own
// notes (on his tap); the answer to his questions is built on the device.
//
// vault.library = [{ id, kind, title, author?, url?, status: "quiero"|"en curso"|"hecho",
//                    notes?, ideas?: string[], at, doneAt? }]
import { normalise } from "./text.js";

export const LIB_KINDS = { libro: "📚 Libro", articulo: "📰 Artículo", video: "🎬 Vídeo", podcast: "🎧 Podcast", curso: "🎓 Curso" };
export const STATUSES = ["quiero", "en curso", "hecho"];
const clip = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

// From a link: what kind of thing it probably is.
export function kindFromUrl(url) {
  const u = String(url ?? "").toLowerCase();
  if (/youtube\.com|youtu\.be|tiktok\.com|vimeo\.com|instagram\.com\/(reel|p)\//.test(u)) return "video";
  if (/spotify\.com\/episode|podcasts\.apple\.com|ivoox\.com/.test(u)) return "podcast";
  if (/udemy\.com|coursera\.org|domestika\.org|platzi\.com/.test(u)) return "curso";
  if (/goodreads\.com|casadellibro\.com|amazon\.[a-z.]+\/.*(dp|gp\/product)/.test(u)) return "libro";
  return u ? "articulo" : "libro";
}

export function newItem({ id, title, kind, author, url, notes, status = "quiero" }, now = new Date()) {
  const t = clip(title, 120);
  if (!t) throw new Error("Ponle un título");
  return {
    id, title: t, kind: LIB_KINDS[kind] ? kind : kindFromUrl(url), status: STATUSES.includes(status) ? status : "quiero",
    ...(clip(author, 80) ? { author: clip(author, 80) } : {}), ...(url ? { url: String(url).slice(0, 500) } : {}),
    ...(clip(notes, 4000) ? { notes: String(notes).slice(0, 4000) } : {}), at: now.toISOString(),
    ...(status === "hecho" ? { doneAt: now.toISOString() } : {}),
  };
}

export function setStatus(item, status, now = new Date()) {
  if (!STATUSES.includes(status)) return item;
  const out = { ...item, status };
  if (status === "hecho") out.doneAt = item.doneAt ?? now.toISOString(); else delete out.doneAt;
  return out;
}

// ---- Ideas clave with Gemini (from his notes; nothing else is sent) ----
export function ideasPayload(item) {
  const text = `${LIB_KINDS[item.kind] ?? ""} «${item.title}»${item.author ? ` de ${item.author}` : ""}.\nMis notas:\n${String(item.notes ?? "").slice(0, 6000)}`;
  return {
    systemInstruction: { parts: [{ text: "Eres la biblioteca de MANU OS. A partir SOLO de las notas de Manu, devuelve un JSON: una lista de 3 a 6 ideas clave, cada una una frase corta en español, en segunda persona («Aprendiste que…» no; directas: «El interés compuesto…»). No añadas nada que no esté en las notas." }] },
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: { maxOutputTokens: 600, temperature: 0.3, responseMimeType: "application/json" },
  };
}

export function parseIdeas(text) {
  let d;
  try { d = JSON.parse(String(text ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return []; }
  if (!Array.isArray(d)) d = Array.isArray(d?.ideas) ? d.ideas : [];
  return d.map((x) => clip(typeof x === "string" ? x : x?.idea, 200)).filter(Boolean).slice(0, 6);
}

// ---- «¿qué aprendí de …?», «ideas de …», «qué estoy leyendo» ----
export function isLibraryQuestion(text) {
  const n = normalise(text);
  return /\b(que aprendi|ideas (clave )?de|resumen de|que leo|que estoy (leyendo|viendo|escuchando)|mi biblioteca|libros? (que|pendientes)|que me (quedo|quede) de)\b/.test(n);
}

const STOP = new Set(["que", "aprendi", "ideas", "clave", "de", "del", "el", "la", "los", "las", "resumen", "libro", "video", "podcast", "articulo", "curso", "me", "quede", "quedo", "sobre", "un", "una", "mi"]);

export function answerLibrary(question, library) {
  const items = library ?? [];
  if (!items.length) return "Tu biblioteca está vacía. Añade libros, vídeos o podcasts en Tú → Biblioteca.";
  const n = normalise(question);
  if (/que (leo|estoy (leyendo|viendo|escuchando))|en curso/.test(n)) {
    const now = items.filter((i) => i.status === "en curso");
    return now.length ? `Ahora mismo: ${now.map((i) => `${LIB_KINDS[i.kind] ?? ""} ${i.title}`).join("; ")}.` : "No tienes nada «en curso» ahora.";
  }
  if (/pendientes|quiero leer|por leer|por ver/.test(n)) {
    const want = items.filter((i) => i.status === "quiero");
    return want.length ? `Pendientes: ${want.slice(0, 8).map((i) => i.title).join("; ")}.` : "No tienes nada pendiente.";
  }
  const words = n.replace(/[^a-z0-9ñ ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  const scored = items.map((i) => ({ i, s: words.reduce((s, w) => s + (normalise(i.title).includes(w) ? 3 : 0) + (normalise(`${i.author ?? ""} ${i.notes ?? ""} ${(i.ideas ?? []).join(" ")}`).includes(w) ? 1 : 0), 0) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  if (!scored.length) return "No encuentro eso en tu biblioteca.";
  const it = scored[0].i;
  const head = `${LIB_KINDS[it.kind] ?? ""} «${it.title}»${it.author ? ` (${it.author})` : ""}`;
  if (it.ideas?.length) return `${head}:\n${it.ideas.map((x) => `• ${x}`).join("\n")}`;
  if (it.notes) return `${head}. Tus notas: ${clip(it.notes, 600)}`;
  return `${head} está en tu biblioteca, pero aún no tiene notas.`;
}
