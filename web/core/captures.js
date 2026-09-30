// «Bandeja de capturas» (WEB-59). Manu takes lots of screenshots and never
// sorts them. He drops them all here at once; Gemini (only when he taps, the
// button says it goes to Google) reads each one, gives it a topic and, if
// there is something to do, proposes it. He reviews by group and keeps only
// the text: the image is deleted once reviewed. Pure: no DOM, no network.
import { parseCalls } from "./ai.js";
import { normalise } from "./text.js";

export const LIMIT = 300;       // captures kept in the vault
export const BATCH = 6;         // images per Gemini request
const clip = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const KINDS = ["tarea", "aviso", "gasto", "idea", "plan", "info", "conversacion", "nada"];

export function newCapture({ id, imageId, at, addedAt = new Date().toISOString() }) {
  return { id, imageId, at: at ?? addedAt, addedAt, status: "pending", topic: null, text: "", kind: null, call: null };
}

// Pending = not read yet; unreviewed = read, still waiting for Manu.
export const pendingCaptures = (list) => (list ?? []).filter((c) => c.status === "pending");
export const toReview = (list) => (list ?? []).filter((c) => c.status === "pending" || c.status === "read");

const SYSTEM = (now) => `Eres MANU, el asistente de Manu. Te paso capturas de pantalla de su iPhone, cada una precedida de su identificador entre corchetes.
Para cada captura devuelve un objeto con:
- "id": el identificador exacto.
- "tema": 1 a 3 palabras que agrupen capturas del mismo asunto (por ejemplo «viaje Oporto», «trabajo RK», «receta», «conversación Eva», «compra ropa»). Usa el mismo tema para capturas del mismo asunto.
- "texto": lo importante que se lee, en una o dos frases, sin inventar.
- "tipo": uno de ${KINDS.join(", ")}.
- "accion": solo si hay algo claro que hacer; si no, null. Formato {"nombre": "anadir_tarea"|"anadir_idea"|"crear_recordatorio"|"apuntar_gasto", "texto": "...", "cuando": "AAAA-MM-DD HH:MM" (solo recordatorio), "importe_euros": número (solo gasto que pagó Manu)}.
Responde SOLO con un array JSON, sin comentarios. Hoy es ${now.toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}.`;

// items: [{ id, base64, at }]
export function buildCapturesPayload(items, now = new Date()) {
  if (!items.length || items.length > BATCH) throw new Error("Entre 1 y 6 capturas por vez");
  const parts = items.flatMap((c) => [
    { text: `[${c.id}] captura del ${new Date(c.at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` },
    { inlineData: { mimeType: "image/jpeg", data: c.base64 } },
  ]);
  return {
    systemInstruction: { parts: [{ text: SYSTEM(now) }] },
    contents: [{ role: "user", parts }],
    generationConfig: { maxOutputTokens: 400 * items.length, temperature: 0.2, responseMimeType: "application/json" },
  };
}

// The model's JSON → { id: { topic, text, kind, call } }. Anything malformed
// is dropped; actions go through the same validator as chat proposals.
export function parseCapturesReply(text, ids) {
  const want = new Set(ids);
  let data;
  try { data = JSON.parse(String(text ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return {}; }
  if (!Array.isArray(data)) data = Array.isArray(data?.capturas) ? data.capturas : [];
  const out = {};
  for (const r of data) {
    if (!r || !want.has(r.id)) continue;
    const kind = KINDS.includes(normalise(String(r.tipo ?? ""))) ? normalise(String(r.tipo)) : "info";
    let call = null;
    const a = r.accion;
    if (a && typeof a === "object" && typeof a.nombre === "string") {
      const [c] = parseCalls({ candidates: [{ content: { parts: [{ functionCall: { name: a.nombre, args: a } }] } }] });
      if (c && ["anadir_tarea", "anadir_idea", "crear_recordatorio", "apuntar_gasto"].includes(c.name)) call = c;
    }
    out[r.id] = { topic: clip(r.tema, 40) || "Varios", text: clip(r.texto, 400), kind, call };
  }
  return out;
}

export function applyReading(list, readings) {
  return (list ?? []).map((c) => (readings[c.id] ? { ...c, ...readings[c.id], status: "read" } : c));
}

// Groups for review: same topic together (unread ones apart), oldest first.
export function groupCaptures(list) {
  const groups = new Map();
  for (const c of toReview(list)) {
    const key = c.status === "pending" ? "__pending" : normalise(c.topic ?? "Varios");
    if (!groups.has(key)) groups.set(key, { key, topic: c.status === "pending" ? "Sin leer" : c.topic ?? "Varios", items: [] });
    groups.get(key).items.push(c);
  }
  const arr = [...groups.values()];
  for (const g of arr) { g.items.sort((a, b) => String(a.at).localeCompare(String(b.at))); if (g.key !== "__pending") g.topic = g.items[0].topic ?? "Varios"; }
  return arr.sort((a, b) => (a.key === "__pending") - (b.key === "__pending") || String(a.items[0].at).localeCompare(String(b.items[0].at)));
}

// Manu keeps the text (and the image goes), or drops the capture entirely.
export const keepCapture = (list, id) => (list ?? []).map((c) => (c.id === id ? { ...c, status: "kept", imageId: null, reviewedAt: new Date().toISOString() } : c));
export const dropCapture = (list, id) => (list ?? []).filter((c) => c.id !== id);
// Oldest kept texts go first when over the limit; pending ones are never dropped.
export function trimCaptures(list) {
  if ((list ?? []).length <= LIMIT) return list ?? [];
  const kept = list.filter((c) => c.status === "kept").sort((a, b) => String(a.reviewedAt ?? a.at).localeCompare(String(b.reviewedAt ?? b.at)));
  const drop = new Set(kept.slice(0, list.length - LIMIT).map((c) => c.id));
  return list.filter((c) => !drop.has(c.id));
}
