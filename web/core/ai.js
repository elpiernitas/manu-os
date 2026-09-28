// Optional AI for the MANU chat (ADR-0013). The deterministic core always
// answers first. Nothing is sent automatically: the app shows the exact
// payload and Manu confirms each request. `isSensitive` is a best-effort
// denylist that blocks obvious cases; it is NOT exhaustive and is not a
// privacy guarantee — the explicit confirmation is.
import { normalise } from "./text.js";

const API = "https://generativelanguage.googleapis.com/v1beta";

const SENSITIVE = [
  // health
  "medico", "medica", "vih", "sida", "receta", "sertralina", "ibuprofeno", "paracetamol", "antidepresiv", "ansiolitic", "enfermedad", "pastilla", "medicacion", "medicamento", "diagnostic", "sintoma", "dolor", "hospital", "urgencias", "terapia", "psicolog", "psiquiatr", "ansiedad", "depresi", "salud", "analitica", "embaraz", "peso ",
  // money
  "euro", "€", "cobro", "cobra", "gano ", "ingreso", "al mes", "banco", "sabadell", "nomina", "sueldo", "salario", "deuda", "prestamo", "hipoteca", "tarjeta", "cuenta corriente", "iban", "transferencia", "gaste", "pague", "dinero", "factura",
  // mood / crisis
  "triste", "bajon", "suicid", "morir", "llorar", "solo y", "refugio",
  // secrets
  "contrasena", "password", "pin ", "clave",
];

export function isSensitive(text) {
  const raw = String(text ?? "");
  const t = ` ${normalise(raw)} `;
  if (SENSITIVE.some((k) => t.includes(k))) return true;
  if (/\b[A-Z]{2}\d{2}[ ]?\d{4}/.test(raw)) return true; // IBAN-like
  if (/\b(?:\d[ -]?){13,19}\b/.test(raw)) return true; // card-like numbers
  if (/(\+34)?[ ]?[6-9]\d{2}[ ]?\d{3}[ ]?\d{3}\b/.test(raw)) return true; // phone
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(raw)) return true; // email
  return false;
}

// Picks a current "flash" text model from the account's list instead of
// hard-coding a name that may be retired.
export function pickModel(json) {
  const models = (json?.models ?? []).filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"));
  const name = (m) => String(m.name ?? "");
  const bad = /(preview|exp|tts|image|live|embed|audio|vision|thinking|learnlm|gemma)/i;
  const good = models.filter((m) => /flash/i.test(name(m)) && !bad.test(name(m)));
  const version = (m) => Number((name(m).match(/gemini-(\d+(?:\.\d+)?)/) ?? [0, 0])[1]);
  const sorted = (good.length ? good : models.filter((m) => !bad.test(name(m)))).sort((a, b) => version(b) - version(a) || (/lite/.test(name(a)) ? 1 : 0) - (/lite/.test(name(b)) ? 1 : 0));
  return sorted[0] ? name(sorted[0]).replace(/^models\//, "") : null;
}

export function systemPrompt({ now = new Date(), city = null, tasks = [], events = [] } = {}) {
  const safe = (list) => list.filter((x) => !isSensitive(x)).slice(0, 10);
  return [
    "Eres MANU, el asistente personal de Manu, dentro de la app MANU OS. Hablas en español de España, cercano, honesto y breve (máximo 4 frases).",
    "No inventes datos sobre Manu. Si no sabes algo, dilo. No des diagnósticos médicos ni consejos financieros. No digas que has hecho acciones: la app las hace aparte.",
    "Si Manu quiere apuntar algo, recuérdale las órdenes: «apunta …», «gasté … en …», «recuérdame … a las …», «pon una alarma a las …».",
    `Ahora: ${now.toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.`,
    city ? `Ciudad: ${city}.` : "",
    safe(tasks).length ? `Tareas abiertas: ${safe(tasks).join("; ")}.` : "",
    safe(events).length ? `Agenda de hoy: ${safe(events).join("; ")}.` : "",
  ].filter(Boolean).join("\n");
}

// Default payload: only the message and a fixed instruction. No history, no
// tasks, no agenda (they are opt-in and shown to Manu before sending).
export const BASE_SYSTEM = "Eres MANU, el asistente personal de Manu. Responde en español de España, cercano, honesto y breve (máximo 4 frases). No inventes datos sobre Manu. No des diagnósticos médicos ni consejos financieros.";

export function buildPayload(message, { history = null, system = BASE_SYSTEM } = {}) {
  return requestBody(message, history ?? [], system);
}

// history: [{ from: "me"|"manu", text }] — sensitive turns are dropped.
export function requestBody(message, history = [], system = "") {
  const turns = history.filter((m) => m.text && !isSensitive(m.text)).slice(-6)
    .map((m) => ({ role: m.from === "me" ? "user" : "model", parts: [{ text: String(m.text).slice(0, 1000) }] }));
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [...turns, { role: "user", parts: [{ text: String(message).slice(0, 2000) }] }],
    generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
  };
}

export function replyText(json) {
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("").trim();
  return text || null;
}

export async function listModels(key, fetchImpl = fetch) {
  const res = await fetchImpl(`${API}/models?pageSize=100`, { headers: { "x-goog-api-key": key } });
  if (res.status === 400 || res.status === 403) throw Object.assign(new Error("La clave de Gemini no es válida"), { code: "key" });
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}`);
  return res.json();
}

// Sends exactly `payload` (built with buildPayload and shown to Manu), only
// after an explicit confirmation from the UI.
export async function ask({ key, model, payload, confirmed }, fetchImpl = fetch) {
  if (confirmed !== true) throw Object.assign(new Error("Falta tu confirmación"), { code: "unconfirmed" });
  const texts = (payload?.contents ?? []).flatMap((c) => c.parts.map((p) => p.text));
  if (texts.some(isSensitive)) throw Object.assign(new Error("sensible"), { code: "sensitive" });
  const res = await fetchImpl(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 429) throw Object.assign(new Error("Límite gratuito de Gemini alcanzado por ahora"), { code: "quota" });
  if (res.status === 400 || res.status === 403) throw Object.assign(new Error("La clave de Gemini no es válida"), { code: "key" });
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}`);
  const text = replyText(await res.json());
  if (!text) throw new Error("Gemini no ha respondido");
  return text;
}
