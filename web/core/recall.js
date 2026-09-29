// «Pregúntale a tu archivo» y «Tu perfil» (WEB-35). Gemini only receives the
// fragments needed for each question, filtered by `permit` (mayGo): crisis,
// Refugio and secrets are never sent; health, money… only if Manu allowed it.
import { search, terms, normalise } from "./archive.js";

const month = (t) => (t ? new Date(t).toLocaleDateString("es-ES", { month: "short", year: "numeric" }) : "sin fecha");

// The messages around each hit, bounded per document and in total.
export function excerpts(results, { perDoc = 1500, total = 9000, permit = () => true } = {}) {
  const out = [];
  let budget = total;
  for (const r of results) {
    if (budget <= 200) break;
    // The title goes with the fragment, so it must be allowed too.
    if (!permit(r.doc.title)) continue;
    const ts = terms(r.query ?? "");
    const msgs = r.doc.messages.filter((m) => permit(m.text));
    if (!msgs.length) continue;
    const hit = Math.max(0, msgs.findIndex((m) => ts.some((t) => normalise(m.text).includes(t))));
    const around = msgs.slice(Math.max(0, hit - 1), hit + 3);
    let text = around.map((m) => `${m.role === "me" ? "Manu" : r.doc.source === "manu" ? "MANU" : "ChatGPT"}: ${m.text.replace(/\s+/g, " ").trim()}`).join("\n");
    text = text.slice(0, Math.min(perDoc, budget));
    budget -= text.length;
    out.push({ n: out.length + 1, id: r.doc.id, title: r.doc.title, date: month(r.doc.at), text });
  }
  return out;
}

export function findExcerpts(docs, question, opts = {}) {
  const results = search(docs, question, { limit: opts.limit ?? 6 }).map((r) => ({ ...r, query: question }));
  return excerpts(results, opts);
}

const block = (ex) => ex.map((e) => `[${e.n}] «${e.title}» (${e.date})\n${e.text}`).join("\n\n");

export function askPayload(question, ex, now = new Date()) {
  const system = `Eres MANU, el asistente personal de Manu. Responde en español de España, cercano y claro, usando SOLO los fragmentos de sus conversaciones pasadas (con ChatGPT o contigo, MANU) que tienes abajo. Cita con [n] de qué conversación sale cada dato. Si la respuesta no está, dilo sin inventar. Hoy es ${now.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}.`;
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: `FRAGMENTOS DE TU ARCHIVO:\n\n${block(ex)}\n\nPREGUNTA: ${String(question).slice(0, 1000)}` }] }],
    generationConfig: { maxOutputTokens: 700, temperature: 0.3 },
  };
}

// A compact digest for the profile: every title with its date, plus a sample
// of what Manu himself wrote (the first allowed message of each conversation).
export function profileDigest(docs, { permit = () => true, maxChars = 40000 } = {}) {
  const lines = [];
  let used = 0;
  for (const d of [...docs].sort((a, b) => (a.at ?? 0) - (b.at ?? 0))) {
    if (!permit(d.title)) continue;
    const mine = d.messages.find((m) => m.role === "me" && permit(m.text));
    const line = `- ${month(d.at)} · ${d.title}${mine ? ` — «${mine.text.replace(/\s+/g, " ").trim().slice(0, 220)}»` : ""}`;
    if (used + line.length > maxChars) break;
    lines.push(line); used += line.length + 1;
  }
  return { text: lines.join("\n"), used: lines.length, total: docs.length };
}

export const PROFILE_SECTIONS = ["Quién eres", "Intereses y gustos", "Trabajo y estudios", "Rutinas y hábitos", "Personas importantes", "Lo que te preocupa", "Metas y proyectos", "Cómo hablas y qué te ayuda"];

export function profilePayload(digest, now = new Date()) {
  const system = `Eres MANU, el asistente personal de Manu. A partir de la lista de sus conversaciones con ChatGPT (títulos, fechas y lo primero que escribió en cada una), escribe un retrato de Manu en español de España, en segunda persona («eres…»), cálido y honesto. Usa estas secciones con título: ${PROFILE_SECTIONS.join("; ")}. En cada sección, 2 a 5 puntos breves y concretos. Solo lo que se deduzca de los datos; si algo es una suposición, dilo («parece que…»). No hagas diagnósticos médicos ni psicológicos. Fecha: ${now.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}.`;
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: `MIS CONVERSACIONES (${digest.used} de ${digest.total}):\n${digest.text}` }] }],
    generationConfig: { maxOutputTokens: 1500, temperature: 0.4 },
  };
}

// For the conversation mode: short memories related to what Manu just said.
export function memoryContext(docs, message, { permit = () => true } = {}) {
  const ex = findExcerpts(docs, message, { limit: 3, perDoc: 600, total: 1600, permit });
  return ex.length ? `RECUERDOS de conversaciones pasadas (con ChatGPT o con MANU) relacionados:\n${ex.map((e) => `«${e.title}» (${e.date}): ${e.text}`).join("\n")}` : "";
}
