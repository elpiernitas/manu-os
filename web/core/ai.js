// Optional AI for the MANU chat (ADR-0013). The deterministic core always
// answers first. Nothing is sent automatically: the app shows the exact
// payload and Manu confirms each request. `isSensitive` is a best-effort
// denylist that blocks obvious cases; it is NOT exhaustive and is not a
// privacy guarantee — the explicit confirmation is.
import { normalise } from "./text.js";

const API = "https://generativelanguage.googleapis.com/v1beta";

// Grouped so the conversation mode can allow a category Manu chose (WEB-27).
const SENSITIVE_GROUPS = {
  health: ["medico", "medica", "vih", "sida", "receta", "sertralina", "ibuprofeno", "paracetamol", "antidepresiv", "ansiolitic", "enfermedad", "pastilla", "medicacion", "medicamento", "diagnostic", "sintoma", "dolor", "hospital", "urgencias", "terapia", "psicolog", "psiquiatr", "ansiedad", "depresi", "salud", "analitica", "embaraz", "peso "],
  money: ["euro", "€", "cobro", "cobra", "gano ", "ingreso", "al mes", "banco", "sabadell", "nomina", "sueldo", "salario", "deuda", "prestamo", "hipoteca", "tarjeta", "cuenta corriente", "iban", "transferencia", "gaste", "pague", "dinero", "factura"],
  mood: ["triste", "bajon", "suicid", "morir", "llorar", "solo y", "refugio"],
  secret: ["contrasena", "password", "pin ", "clave"],
};
const SENSITIVE = Object.values(SENSITIVE_GROUPS).flat();

// Which sensitive categories a text touches. «secret» (passwords, cards,
// IBAN, phones, emails, API keys) can never be allowed.
export function sensitiveKinds(text) {
  const raw = String(text ?? "");
  const t = ` ${normalise(raw)} `;
  const kinds = new Set();
  for (const [kind, words] of Object.entries(SENSITIVE_GROUPS)) if (words.some((k) => t.includes(k))) kinds.add(kind);
  if (/\b[A-Z]{2}\d{2}[ ]?\d{4}/.test(raw) || /\b(?:\d[ -]?){13,19}\b/.test(raw) || /(\+34)?[ ]?[6-9]\d{2}[ ]?\d{3}[ ]?\d{3}\b/.test(raw) || /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(raw) || GEMINI_KEY_IN_TEXT.test(raw)) kinds.add("secret");
  return kinds;
}

export function isSensitive(text) {
  const raw = String(text ?? "");
  const t = ` ${normalise(raw)} `;
  if (SENSITIVE.some((k) => t.includes(k))) return true;
  if (/\b[A-Z]{2}\d{2}[ ]?\d{4}/.test(raw)) return true; // IBAN-like
  if (/\b(?:\d[ -]?){13,19}\b/.test(raw)) return true; // card-like numbers
  if (/(\+34)?[ ]?[6-9]\d{2}[ ]?\d{3}[ ]?\d{3}\b/.test(raw)) return true; // phone
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(raw)) return true; // email
  if (GEMINI_KEY_IN_TEXT.test(raw)) return true; // an API key pasted in the chat
  return false;
}

// Gemini API keys: the classic «AIza…» format and the newer «AQ.…» one that
// AI Studio started issuing (seen on Manu's account, 2026-09-29).
export const isGeminiKey = (s) => /^(AIza[0-9A-Za-z_-]{30,60}|AQ\.[0-9A-Za-z_.-]{20,400})$/.test(String(s ?? "").trim());
const GEMINI_KEY_IN_TEXT = /(AIza[0-9A-Za-z_-]{30,}|\bAQ\.[0-9A-Za-z_.-]{20,})/;

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

// ---------- Actions Gemini can PROPOSE (Manu confirms each one in the app) ----------
export const TOOLS = [{ functionDeclarations: [
  { name: "anadir_tarea", description: "Propone añadir una tarea pendiente.", parameters: { type: "OBJECT", properties: { texto: { type: "STRING" } }, required: ["texto"] } },
  { name: "anadir_idea", description: "Propone guardar una idea.", parameters: { type: "OBJECT", properties: { texto: { type: "STRING" } }, required: ["texto"] } },
  { name: "apuntar_gasto", description: "Propone apuntar un gasto en euros.", parameters: { type: "OBJECT", properties: { importe_euros: { type: "NUMBER" }, concepto: { type: "STRING" } }, required: ["importe_euros"] } },
  { name: "crear_recordatorio", description: "Propone un recordatorio. 'cuando' en formato AAAA-MM-DD HH:MM, hora local.", parameters: { type: "OBJECT", properties: { texto: { type: "STRING" }, cuando: { type: "STRING" } }, required: ["texto", "cuando"] } },
  { name: "ir_a", description: "Lleva a una pantalla de MANU.", parameters: { type: "OBJECT", properties: { pantalla: { type: "STRING", enum: ["hoy", "agenda", "dinero", "tu", "tiempo", "google", "ia", "atajos", "habitos", "salud", "comidas", "personas"] } }, required: ["pantalla"] } },
  { name: "completar_tarea", description: "Marca como hecha una tarea pendiente de Manu. 'texto' es el texto (o parte) de la tarea.", parameters: { type: "OBJECT", properties: { texto: { type: "STRING" } }, required: ["texto"] } },
  { name: "importar_extracto", description: "Ofrece importar el extracto del banco (Excel o CSV) en Dinero.", parameters: { type: "OBJECT", properties: {} } },
  { name: "sugerir_mejora", description: "Cuando Manu pide un cambio o una mejora de la app MANU, prepara la sugerencia para el desarrollador. No incluyas datos personales.", parameters: { type: "OBJECT", properties: { titulo: { type: "STRING" }, descripcion: { type: "STRING" } }, required: ["titulo", "descripcion"] } },
] }];

export function actionSystem(now = new Date()) {
  return `${BASE_SYSTEM}
Estás dentro de la app MANU OS. Puedes PROPONER acciones con las funciones disponibles (Manu las confirma una a una); nunca digas que ya están hechas.
Si Manu quiere cambiar o mejorar la app, usa sugerir_mejora con un título corto y una descripción clara, sin datos personales.
Fecha y hora actuales: ${now.toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}.`;
}

export function buildActionPayload(message, now = new Date()) {
  return { ...requestBody(message, [], actionSystem(now)), tools: TOOLS };
}

const clip = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

// Validates what the model proposes; anything malformed is dropped, never executed.
export function parseCalls(json) {
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const out = [];
  for (const p of parts) {
    const c = p.functionCall;
    if (!c || typeof c.name !== "string") continue;
    const a = c.args ?? {};
    switch (c.name) {
      case "anadir_tarea": case "anadir_idea": { const t = clip(a.texto, 140); if (t) out.push({ name: c.name, texto: t }); break; }
      case "apuntar_gasto": { const cents = Math.round(Number(a.importe_euros) * 100); if (Number.isFinite(cents) && cents > 0 && cents < 10000000) out.push({ name: c.name, cents, concepto: clip(a.concepto, 80) || null }); break; }
      case "crear_recordatorio": { const t = clip(a.texto, 140); const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(clip(a.cuando, 16)); if (t && m) { const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]); if (!Number.isNaN(d.getTime())) out.push({ name: c.name, texto: t, at: d.toISOString() }); } break; }
      case "ir_a": { const ok = TOOLS[0].functionDeclarations.find((f) => f.name === "ir_a").parameters.properties.pantalla.enum; if (ok.includes(a.pantalla)) out.push({ name: c.name, pantalla: a.pantalla }); break; }
      case "completar_tarea": { const t = clip(a.texto, 140); if (t) out.push({ name: c.name, texto: t }); break; }
      case "importar_extracto": out.push({ name: c.name }); break;
      case "sugerir_mejora": { const ti = clip(a.titulo, 100), de = clip(a.descripcion, 1500); if (ti && de) out.push({ name: c.name, titulo: ti, descripcion: de, sensitive: isSensitive(`${ti} ${de}`) }); break; }
      default: break; // unknown tools are ignored
    }
  }
  return out;
}

// Suggestions go to the public repository as a prefilled GitHub issue Manu submits himself.
export function issueUrl({ titulo, descripcion }, version = "") {
  const p = new URLSearchParams({ title: `[MANU] ${titulo}`, body: `${descripcion}\n\n---\nEnviado desde MANU${version ? ` (versión ${version})` : ""}.` });
  return `https://github.com/elpiernitas/manu-os/issues/new?${p}`;
}

// Same privacy gates as ask(): explicit consent (per request or Manu's global opt-in) and no sensitive text.
// `permit(text)` decides what may go; by default nothing sensitive. The
// conversation mode passes the categories Manu allowed (secrets never).
export async function askWithActions({ key, model, payload, confirmed, permit = (t) => !isSensitive(t) }, fetchImpl = fetch) {
  if (confirmed !== true) throw Object.assign(new Error("Falta tu confirmación"), { code: "unconfirmed" });
  const texts = (payload?.contents ?? []).flatMap((c) => c.parts.map((p) => p.text)).filter((t) => typeof t === "string");
  if (!texts.every((t) => permit(t))) throw Object.assign(new Error("sensible"), { code: "sensitive" });
  const res = await fetchImpl(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 429) throw Object.assign(new Error("Límite gratuito de Gemini alcanzado por ahora"), { code: "quota" });
  if (res.status === 400 || res.status === 403) throw Object.assign(new Error("La clave de Gemini no es válida"), { code: "key" });
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}`);
  const json = await res.json();
  const calls = parseCalls(json);
  const text = replyText(json);
  if (!text && !calls.length) throw new Error("Gemini no ha respondido");
  return { text, calls };
}

// Screenshots and shared links (WEB-23). Sent only when Manu taps the button
// that says it goes to Google; never with «Enviar sin preguntar».
const SHARED_SYSTEM = (now) => `${actionSystem(now)}
Manu te comparte una captura de pantalla o un vídeo. Extrae lo útil (planes, sitios, fechas y horas, precios, recetas, recomendaciones, tareas) y propón acciones con las funciones: aviso si hay fecha y hora, gasto si es un pago que hizo Manu, tarea si hay algo que hacer, idea si es algo para guardar. Si no hay nada útil, dilo en una frase. No inventes datos que no aparezcan.`;

export function buildImagePayload({ base64, mime, note = "" }, now = new Date()) {
  if (!/^image\/(png|jpeg|webp|heic|heif)$/.test(mime)) throw new Error("Formato de imagen no admitido");
  const parts = [{ inlineData: { mimeType: mime, data: base64 } }, { text: note ? `Captura de Manu. Nota: ${note}` : "Captura de Manu." }];
  return { systemInstruction: { parts: [{ text: SHARED_SYSTEM(now) }] }, contents: [{ role: "user", parts }], tools: TOOLS, generationConfig: { maxOutputTokens: 600, temperature: 0.3 } };
}

export function buildLinkPayload({ provider, url, title, author }, now = new Date()) {
  const text = `Vídeo de ${provider}${author ? ` de ${author}` : ""}.\nEnlace: ${url}\nTexto del vídeo: ${title}`;
  return { systemInstruction: { parts: [{ text: SHARED_SYSTEM(now) }] }, contents: [{ role: "user", parts: [{ text }] }], tools: TOOLS, generationConfig: { maxOutputTokens: 600, temperature: 0.3 } };
}
