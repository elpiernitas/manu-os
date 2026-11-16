// «Guardar en MANU» (misión «asistente real»): una sola entrada para enlaces, notas, ideas y
// archivos, que acaban en la Biblioteca (vault.library). MANU propone título, tipo, tema y
// proyecto solo con lo que ve (el enlace, el texto, el nombre del archivo). Nunca abre la página
// ni lee el archivo, y nunca inventa un resumen: si la propuesta es floja, lo dice y pide revisarla.
//
// Los archivos se guardan en este dispositivo (IndexedDB), nunca en el vault ni en Tu nube.
import { normalise } from "./text.js";
import { kindFromUrl, LIB_KINDS } from "./library.js";

export const SAVE_LIMITS = { fileBytes: 15 * 1024 * 1024, text: 4000, title: 120 };
const URL_RE = /https?:\/\/[^\s<>"']+/i;
const clip = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

// Temas por palabras. Solo propone; Manu lo cambia.
const TOPICS = [
  ["Cocina", /\b(receta\w*|cocina\w*|comida|cenar|horno|ingredientes?|postre\w*)\b/],
  ["Viajes", /\b(viaje\w*|vuelo\w*|hotel\w*|ruta\w*|escapada\w*|playa\w*|lisboa|oporto|madrid|paris|londres|roma)\b/],
  ["Dinero", /\b(ahorro\w*|inversion\w*|invertir|hipoteca\w*|impuestos?|renta|banco\w*|finanzas?|presupuesto\w*)\b/],
  ["Salud", /\b(salud|ejercicio\w*|entreno\w*|gimnasio|dieta\w*|dormir|sueno|medic\w*|fisio\w*)\b/],
  ["Trabajo", /\b(trabajo|empresa\w*|cliente\w*|reunion\w*|proyecto\w*|oficina|inmobiliari\w*|venta\w*)\b/],
  ["Tecnología", /\b(app|apps|software|programa\w*|codigo|github|iphone|ia|inteligencia artificial|chatgpt|claude|gemini)\b/],
  ["Casa", /\b(casa|piso|reforma\w*|mueble\w*|decoracion|jardin\w*|bricolaje)\b/],
  ["Aprender", /\b(curso\w*|aprender|libro\w*|tutorial\w*|clase\w*|idioma\w*|ingles)\b/],
  ["Deporte", /\b(futbol|baloncesto|correr|bici\w*|surf|padel|tenis|deporte\w*)\b/],
];

/** Lo que es una cosa a guardar: enlace, texto o archivo. */
export function detectInput({ text = "", file = null } = {}) {
  if (file) return "file";
  return URL_RE.test(String(text)) ? "link" : String(text).trim() ? "text" : null;
}

const slugTitle = (url) => {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).map((s) => decodeURIComponent(s)).reverse()
      // Un trozo con palabras («como-hacer-pan»), no un identificador («dQw4w9WgXcQ», «@usuario»).
      .find((s) => !s.startsWith("@") && !/^(watch|reel|reels|p|status|video|videos|shorts|index|amp|embed)$/i.test(s) && (/[a-záéíóúñ]{2,}[-_+ ][a-záéíóúñ]{2,}/i.test(s) || /^[a-záéíóúñ]{4,}(\.html?)?$/i.test(s)));
    const t = seg ? seg.replace(/\.(html?|php|aspx?|pdf)$/i, "").replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim() : "";
    return t.length >= 4 ? { title: t.charAt(0).toUpperCase() + t.slice(1), weak: false, host: u.hostname.replace(/^www\./, "") } : { title: `Enlace de ${u.hostname.replace(/^www\./, "")}`, weak: true, host: u.hostname.replace(/^www\./, "") };
  } catch { return { title: "Enlace", weak: true, host: "" }; }
};

/**
 * Propuesta para guardar. `file` = { name, type, size } (sin el contenido).
 * Devuelve { kind, title, url, note, topic, tags, project, needsReview, why: string[] }.
 */
export function propose({ text = "", file = null } = {}, { projects = [] } = {}) {
  const why = [];
  const raw = String(text ?? "").trim();
  const url = raw.match(URL_RE)?.[0]?.replace(/[),.;!?»]+$/, "") ?? null;
  const rest = clip(url ? raw.replace(url, " ") : raw, SAVE_LIMITS.text);
  let kind, title, needsReview = false;
  if (file) {
    const t = String(file.type ?? "");
    kind = t.startsWith("image/") ? "imagen" : t.startsWith("video/") ? "video" : t.startsWith("audio/") ? "podcast" : "documento";
    title = clip(String(file.name ?? "").replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[-_]+/g, " "), SAVE_LIMITS.title) || "Archivo";
    why.push("Título sacado del nombre del archivo; no lo he abierto");
    if (/^(img|image|dsc|pxl|screenshot|captura|scan|documento|file|archivo)?[\s\d-]*$/i.test(title)) { needsReview = true; why.push("El nombre no dice de qué trata: ponle tú el título"); }
  } else if (url) {
    kind = /\.pdf($|\?)/i.test(url) ? "documento" : kindFromUrl(url);
    const firstLine = rest.split(/[.\n]/)[0];
    if (firstLine && firstLine.length >= 4) { title = clip(firstLine, SAVE_LIMITS.title); why.push("Título tomado de lo que escribiste con el enlace"); }
    else {
      const s = slugTitle(url);
      title = s.title; needsReview = s.weak;
      why.push(s.weak ? "El enlace no dice de qué trata y no abro la página: revisa el título" : "Título sacado del propio enlace (no he abierto la página)");
    }
  } else if (rest) {
    kind = rest.length <= 140 && !/\n/.test(raw) ? "idea" : "nota";
    title = clip(raw.split("\n")[0], 80);
    why.push(kind === "idea" ? "Texto corto: lo guardo como idea" : "Texto largo: lo guardo como nota, tal cual");
  } else return null;
  const hay = normalise(`${title} ${rest} ${url ?? ""}`).replace(/[^a-z0-9ñ]+/g, " ");
  const topics = TOPICS.filter(([, re]) => re.test(hay)).map(([t]) => t);
  if (topics.length) why.push(`Tema por palabras como las de «${topics[0]}»`);
  const proj = projects.find((p) => normalise(p.name ?? "").split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4).some((w) => hay.includes(w)));
  if (proj) why.push(`Menciona «${proj.name}»`);
  return { kind: LIB_KINDS[kind] ? kind : "articulo", title: title || "Sin título", url, note: url ? rest : kind === "nota" ? clip(raw, SAVE_LIMITS.text) : "", topic: topics[0] ?? "", tags: topics.slice(0, 3), project: proj?.id ?? null, needsReview, why };
}

// ---------- Buscar en lo guardado ----------
const snippetOf = (text, terms) => {
  const t = String(text ?? "").replace(/\s+/g, " ");
  const n = normalise(t);
  const i = Math.max(0, ...terms.map((w) => n.indexOf(w)).filter((x) => x >= 0).slice(0, 1));
  return t ? `${i > 40 ? "…" : ""}${t.slice(Math.max(0, i - 40), i + 120).trim()}${t.length > i + 120 ? "…" : ""}` : "";
};

function* savedItems(v) {
  for (const i of v.library ?? []) yield { kind: "Biblioteca", icon: (LIB_KINDS[i.kind] ?? "📌").split(" ")[0], id: i.id, title: i.title, url: i.url ?? null, at: i.at, go: { sub: "biblioteca", id: i.id }, text: `${i.title} ${i.author ?? ""} ${i.topic ?? ""} ${(i.tags ?? []).join(" ")} ${i.notes ?? ""} ${(i.ideas ?? []).join(" ")} ${i.url ?? ""} ${i.fileName ?? ""}` };
  for (const d of v.docs ?? []) yield { kind: "Documento", icon: "📄", id: d.id, title: d.title, url: null, at: d.at, go: { sub: "documentos", id: d.id }, text: `${d.title} ${d.company ?? ""} ${d.ref ?? ""} ${d.summary ?? ""}` };
  for (const p of v.projects ?? []) for (const s of p.sources ?? []) yield { kind: `Proyecto «${p.name}»`, icon: "📁", id: s.id, title: s.title, url: s.url ?? null, at: s.at ?? "", go: { project: p.id }, text: `${s.title} ${s.text ?? ""} ${s.url ?? ""}` };
  for (const i of v.inbox ?? []) if (i.status === "IDEA" || i.link) yield { kind: "Idea", icon: "💡", id: i.id, title: i.text, url: i.link ?? null, at: i.at, go: { tab: "agenda" }, text: `${i.text} ${i.link ?? ""}` };
}

/** Búsqueda de texto real (todas las palabras, al inicio de palabra). Lo más reciente primero. */
export function searchSaved(vault, query, { limit = 30 } = {}) {
  const ts = normalise(String(query ?? "")).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 2);
  if (!ts.length) return [];
  const out = [];
  for (const it of savedItems(vault ?? {})) {
    const hay = ` ${normalise(it.text).replace(/[^a-z0-9ñ]+/g, " ")}`;
    if (ts.every((t) => hay.includes(` ${t}`))) { const { text, ...rest } = it; out.push({ ...rest, snippet: snippetOf(text, ts) }); }
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
}

// Abrir un archivo guardado: solo se muestran dentro del navegador los tipos inertes. HTML, SVG,
// XML, JavaScript y lo desconocido se descargan, para que nunca corran con el origen de MANU
// (y así no puedan leer el vault de localStorage).
const SAFE_VIEW = /^(image\/(png|jpeg|gif|webp|heic|heif|avif)|application\/pdf|text\/plain|video\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+)$/i;
export const safeViewType = (mime) => SAFE_VIEW.test(String(mime ?? "").trim()) && !/svg|xml|html|script/i.test(String(mime));
