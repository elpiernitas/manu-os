// «Proyectos», like NotebookLM: notebooks with sources (notes, pasted text,
// screenshots, video captions). Gemini answers only from those sources and
// cites them as [n]. Sources that look sensitive are never sent (AGENTS.md).
import { mayGo } from "./ai.js";

export const PROJECT_LIMITS = { sources: 40, textChars: 20000, imagesPerAsk: 4, promptChars: 60000 };
const clip = (v, n) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, n);

export function newProject({ id, name, emoji = "📁", at = new Date().toISOString() }) {
  const n = clip(name, 60);
  if (!n) throw new Error("Ponle un nombre al proyecto");
  return { id, name: n, emoji: clip(emoji, 4) || "📁", createdAt: at, sources: [], chat: [] };
}

export function addSource(project, { id, kind, title, text = "", url = null, imageId = null, at = new Date().toISOString() }) {
  if (!["note", "link", "image"].includes(kind)) throw new Error("Tipo de fuente no válido");
  if (project.sources.length >= PROJECT_LIMITS.sources) throw new Error(`Máximo ${PROJECT_LIMITS.sources} fuentes por proyecto`);
  const t = clip(text, PROJECT_LIMITS.textChars);
  if (kind === "note" && !t) throw new Error("La nota está vacía");
  if (kind === "image" && !imageId) throw new Error("Falta la captura");
  const source = { id, kind, title: clip(title, 80) || (kind === "image" ? "Captura" : t.split("\n")[0].slice(0, 60) || "Enlace"), text: t, at, ...(url ? { url } : {}), ...(imageId ? { imageId } : {}) };
  return { ...project, sources: [...project.sources, source] };
}

export const PRESETS = {
  resumen: "Haz un resumen claro de todas las fuentes, en 5 a 8 frases.",
  claves: "Enumera los puntos clave de las fuentes (máximo 8 viñetas).",
  preguntas: "Escribe 5 preguntas de repaso con su respuesta breve, basadas en las fuentes.",
};

// Numbers the sources [1..n]; images are sent inline (the most recent ones, up
// to the limit). Returns what goes and what stays on the phone, and why.
export function buildProjectPayload({ project, question, images = {} }) {
  const q = clip(question, 2000);
  if (!q) throw new Error("Escribe una pregunta");
  if (!mayGo(q)) throw Object.assign(new Error("sensible"), { code: "sensitive" });
  const numbered = project.sources.map((s, i) => ({ ...s, n: i + 1 }));
  const excluded = numbered.filter((s) => s.kind !== "image" && !mayGo(`${s.title} ${s.text}`));
  const textSources = numbered.filter((s) => s.kind !== "image" && !excluded.includes(s));
  const imageSources = numbered.filter((s) => s.kind === "image" && images[s.imageId]).slice(-PROJECT_LIMITS.imagesPerAsk);
  let budget = PROJECT_LIMITS.promptChars;
  const blocks = [];
  for (const s of textSources) {
    const body = `[${s.n}] ${s.title}${s.url ? ` (${s.url})` : ""}\n${s.text}`.slice(0, Math.max(0, budget));
    if (!body) break;
    budget -= body.length;
    blocks.push(body);
  }
  const parts = [];
  for (const s of imageSources) {
    const [head, data] = String(images[s.imageId]).split(",");
    const mime = (head.match(/^data:(image\/[a-z]+);base64$/) ?? [])[1];
    if (!mime || !data) continue;
    parts.push({ text: `[${s.n}] Captura: ${s.title}` }, { inlineData: { mimeType: mime, data } });
  }
  parts.push({ text: `FUENTES DEL PROYECTO «${project.name}»:\n\n${blocks.join("\n\n") || "(sin fuentes de texto)"}\n\nPREGUNTA: ${q}` });
  const system = "Eres MANU, el asistente de Manu, en modo cuaderno. Responde en español de España usando SOLO las fuentes del proyecto. Cita cada dato con el número de su fuente entre corchetes, por ejemplo [2]. Si la respuesta no está en las fuentes, dilo claramente y no inventes. Sé claro y breve.";
  return {
    payload: { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts }], generationConfig: { maxOutputTokens: 900, temperature: 0.2 } },
    sent: [...textSources.slice(0, blocks.length), ...imageSources].map((s) => s.n).sort((a, b) => a - b),
    excluded: excluded.map((s) => s.n),
  };
}

// «[2]» and «[1, 3]» in an answer → the source numbers it cites.
export function citations(text, count) {
  const out = new Set();
  for (const m of String(text ?? "").matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) for (const n of m[1].split(",").map((x) => Number(x.trim()))) if (n >= 1 && n <= count) out.add(n);
  return [...out].sort((a, b) => a - b);
}
