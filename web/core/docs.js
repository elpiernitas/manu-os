// Documentos (WEB-84), from the idea «segundo cerebro»: contracts, insurance
// policies, guarantees… with their expiry date, a warning before it, and
// answers like «¿cuándo vence el seguro del coche?» from the device.
// A photo or PDF can be read once by Gemini (only on Manu's tap; it goes to
// Google). What it extracts is saved on the device; the file stays in
// IndexedDB and never goes into the vault or Tu nube.
//
// vault.docs = [{ id, title, kind, company?, cents?, period?, expires?: "YYYY-MM-DD",
//                 autoRenew?: bool, ref?, phone?, summary?, fileId?, fileType?, at }]
import { normalise } from "./text.js";

export const KINDS = { seguro: "🛡️ Seguro", contrato: "📄 Contrato", garantia: "🧾 Garantía", suscripcion: "🔁 Suscripción", identidad: "🪪 Documento", vehiculo: "🚗 Vehículo", salud: "🩺 Salud", otro: "📁 Otro" };
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
const clip = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const fmt = (k) => fromKey(k).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

export function daysLeft(doc, now = new Date()) {
  if (!doc?.expires || !/^\d{4}-\d{2}-\d{2}$/.test(doc.expires)) return null;
  return Math.round((fromKey(doc.expires) - midnight(now)) / DAY);
}

// Soon to expire (or already expired, within a month), soonest first.
export function expiringSoon(docs, now = new Date(), within = 30) {
  return (docs ?? []).map((d) => ({ doc: d, left: daysLeft(d, now) })).filter((x) => x.left !== null && x.left <= within && x.left >= -30).sort((a, b) => a.left - b.left);
}

export function leftText(left) {
  if (left === null) return "sin fecha de vencimiento";
  if (left < 0) return `venció hace ${-left} ${left === -1 ? "día" : "días"}`;
  if (left === 0) return "vence hoy";
  if (left === 1) return "vence mañana";
  return `vence en ${left} días`;
}

// ---- Gemini reads a photo or a PDF ----
const SYSTEM = (now) => `Eres el lector de documentos de MANU OS. Hoy es ${now.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}.
Del documento (contrato, póliza de seguro, garantía, recibo, suscripción…) devuelve SOLO un objeto JSON:
{"titulo":"nombre corto, p. ej. Seguro del coche","tipo":"seguro|contrato|garantia|suscripcion|identidad|vehiculo|salud|otro","entidad":"compañía o empresa","importe":123.45,"periodicidad":"anual|mensual|trimestral|único","vence":"AAAA-MM-DD","renovacion_automatica":true,"referencia":"nº de póliza o contrato","telefono":"teléfono de atención","resumen":"2 o 3 frases: qué cubre y lo importante"}
- Usa null en lo que no aparezca. No inventes fechas ni importes.
- NUNCA incluyas IBAN, números de tarjeta, DNI/NIE ni contraseñas.`;

export function buildDocPayload({ base64, mime }, now = new Date()) {
  if (!/^(image\/jpeg|application\/pdf)$/.test(mime)) throw new Error("Solo fotos o PDF");
  return {
    systemInstruction: { parts: [{ text: SYSTEM(now) }] },
    contents: [{ role: "user", parts: [{ text: "Documento:" }, { inlineData: { mimeType: mime, data: base64 } }] }],
    generationConfig: { maxOutputTokens: 1200, temperature: 0.1, responseMimeType: "application/json" },
  };
}

const SECRET = /\b(?:ES\d{2}(?:\s?\d{4}){5}|\d{4}(?:[\s-]?\d{4}){3}|\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\b/i; // IBAN, card, DNI, NIE

export function parseDocReply(text) {
  let d;
  try { d = JSON.parse(String(text ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return null; }
  if (Array.isArray(d)) d = d[0];
  if (!d || typeof d !== "object") return null;
  const safe = (v, n) => { const t = clip(v, n); return t && !SECRET.test(t) ? t : undefined; };
  const kind = Object.keys(KINDS).includes(normalise(String(d.tipo ?? ""))) ? normalise(String(d.tipo)) : "otro";
  const expires = /^\d{4}-\d{2}-\d{2}$/.test(String(d.vence ?? "")) && !Number.isNaN(fromKey(d.vence).getTime()) ? d.vence : undefined;
  const amount = typeof d.importe === "number" ? d.importe : Number(String(d.importe ?? "").replace(/\s|€/g, "").replace(",", "."));
  const out = {
    title: safe(d.titulo, 60) ?? "Documento", kind, company: safe(d.entidad, 60), expires,
    cents: Number.isFinite(amount) && amount > 0 && amount < 1e6 ? Math.round(amount * 100) : undefined,
    period: safe(d.periodicidad, 20), autoRenew: typeof d.renovacion_automatica === "boolean" ? d.renovacion_automatica : undefined,
    ref: safe(d.referencia, 40), phone: safe(d.telefono, 20), summary: safe(d.resumen, 400),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}

// ---- «¿cuándo vence el seguro del coche?» ----
export function isDocQuestion(text) {
  const n = normalise(text);
  return /\b(vence|vencen|caduca|caducan|renueva|renuevan|expira|vencimiento|caducidad)\b/.test(n) || (/\b(seguro|poliza|contrato|garantia)\b/.test(n) && /\?|cuando|cuanto|que|cual|telefono/.test(n));
}

const STOP = new Set(["cuando", "vence", "vencen", "caduca", "caducan", "renueva", "expira", "el", "la", "los", "las", "de", "del", "mi", "mis", "que", "me", "se", "un", "una", "cuanto", "cuesta", "pago", "telefono", "es", "y", "a", "en", "por", "para", "lo"]);

export function findDocs(docs, question) { return scoreDocs(docs, question).map((x) => x.d); }
function scoreDocs(docs, question) {
  const words = normalise(question).replace(/[^a-z0-9ñ ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => (w.length > 4 ? w.replace(/s$/, "") : w)); // «seguros» → «seguro»
  const score = (d) => { const hay = normalise(`${d.title} ${d.company ?? ""} ${KINDS[d.kind] ?? ""} ${d.kind} ${d.summary ?? ""}`); return words.reduce((s, w) => s + (hay.includes(w) ? (normalise(d.title).includes(w) ? 3 : 1) : 0), 0); };
  return (docs ?? []).map((d) => ({ d, s: score(d) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
}

export function answerDoc(question, docs, now = new Date()) {
  if (!(docs ?? []).length) return "Aún no tienes documentos. Añádelos en Tú → Documentos (una foto o el PDF).";
  const scored = scoreDocs(docs, question);
  const hits = scored.filter((x) => x.s === scored[0]?.s).map((x) => x.d); // only the best matches
  if (!hits.length) {
    const soon = expiringSoon(docs, now, 60);
    return soon.length ? `No sé a cuál te refieres. Lo próximo que vence: ${soon.slice(0, 3).map((x) => `${x.doc.title} (${leftText(x.left)})`).join("; ")}.` : "No encuentro ese documento en Tú → Documentos.";
  }
  const n = normalise(question);
  return hits.slice(0, 2).map((d) => {
    const left = daysLeft(d, now);
    const bits = [`${d.title}${d.company ? ` (${d.company})` : ""}`];
    const when = left === 0 ? "hoy" : left === 1 ? "mañana" : left < 0 ? `hace ${-left} ${left === -1 ? "día" : "días"}` : `dentro de ${left} días`;
    bits.push(d.expires ? `${left < 0 ? "venció" : "vence"} el ${fmt(d.expires)} (${when})` : "no tengo apuntado cuándo vence");
    if (d.autoRenew === true) bits.push("se renueva sola");
    if (d.cents && (/cuanto|cuesta|pago|importe|precio/.test(n) || hits.length === 1)) bits.push(`${(d.cents / 100).toFixed(2).replace(".", ",")} €${d.period ? ` ${d.period}` : ""}`);
    if (d.phone && /telefono|llamar|contacto/.test(n)) bits.push(`teléfono ${d.phone}`);
    return `${bits.join(", ")}.`;
  }).join(" ");
}

export const DOC_LIMIT = 8 * 1024 * 1024; // a bigger PDF is better as a photo of the key page
