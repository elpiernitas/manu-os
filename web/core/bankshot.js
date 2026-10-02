// Capturas del banco (WEB-80): Manu adds screenshots of his bank app and
// Gemini reads the movements (date, concept, amount, in or out). He reviews
// the list before anything is saved. The images go to Google only after his
// tap, and only with «Permitir datos sensibles» or his explicit OK (money is
// sensitive in ai.js).
import { incomeKind } from "./bank.js";

export const MAX_SHOTS = 6;

const SYSTEM = (now) => `Eres el lector de capturas bancarias de MANU OS. Hoy es ${now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.
Lee SOLO los movimientos visibles en las capturas (app de un banco español). Devuelve JSON: una lista de objetos
{"fecha":"AAAA-MM-DD","concepto":"texto tal cual","importe":-12.50}
- importe en euros, NEGATIVO si es un cargo o gasto y POSITIVO si es un ingreso (nómina, Bizum recibido, devolución, transferencia recibida).
- Si una fecha no trae año, usa el año de hoy (o el anterior si quedaría en el futuro). Si un movimiento no muestra fecha, usa la del grupo en que aparece.
- No inventes movimientos ni importes; no incluyas saldos, totales ni números de tarjeta o cuenta.
- Si no hay movimientos legibles, devuelve [].`;

export function buildBankShotsPayload(images, now = new Date()) {
  if (!images.length || images.length > MAX_SHOTS) throw new Error(`Entre 1 y ${MAX_SHOTS} capturas por vez`);
  const parts = images.flatMap((b, i) => [{ text: `Captura ${i + 1}` }, { inlineData: { mimeType: "image/jpeg", data: b } }]);
  return {
    systemInstruction: { parts: [{ text: SYSTEM(now) }] },
    contents: [{ role: "user", parts }],
    generationConfig: { maxOutputTokens: 2000, temperature: 0.1, responseMimeType: "application/json" },
  };
}

const clip = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

/**
 * The model's JSON → movements to review. Anything malformed is dropped.
 * @returns {Array<{ key, at, concept, cents, income: boolean, kind? }>} cents always positive
 */
export function parseBankShots(text, now = new Date()) {
  let data;
  try { data = JSON.parse(String(text ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return []; }
  if (!Array.isArray(data)) data = Array.isArray(data?.movimientos) ? data.movimientos : [];
  const out = [];
  const seen = new Set();
  for (const m of data.slice(0, 200)) {
    if (!m || typeof m !== "object") continue;
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(m.fecha ?? ""));
    const amount = typeof m.importe === "number" ? m.importe : Number(String(m.importe ?? "").replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    const concept = clip(m.concepto, 80);
    if (!d || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1e6 || !concept) continue;
    const at = new Date(+d[1], +d[2] - 1, +d[3], 12, 0);
    if (Number.isNaN(at.getTime()) || at.getDate() !== +d[3] || at.getTime() > now.getTime() + 86400000) continue;
    const cents = Math.round(Math.abs(amount) * 100);
    const income = amount > 0;
    const key = `${d[0]}|${income ? "+" : "-"}${cents}|${concept.toLowerCase()}`;
    if (seen.has(key)) continue; // the same movement in two overlapping screenshots
    seen.add(key);
    out.push({ key, at: at.toISOString(), concept, cents, income, ...(income ? { kind: incomeKind(concept) } : {}) });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

// Already in MANU (same day and amount, on the same side)? Then it is unticked by default.
export function alreadyThere(mov, spending, income) {
  const day = mov.at.slice(0, 10);
  const list = mov.income ? income ?? [] : spending ?? [];
  return list.some((e) => e.cents === mov.cents && String(e.at ?? "").slice(0, 10) === day);
}
