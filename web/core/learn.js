// Aprendizaje progresivo (WEB-94): MANU aprende de lo que Manu confirma y corrige.
//
// Ejemplo de Manu: aparece un gasto que no reconoce MANU y le pregunta qué es. Si varias veces
// lo identifica como consumición nocturna, MANU aprende a proponerlo solo — con su confianza,
// el porqué y la opción de corregir. Una deducción nunca se presenta como certeza.
//
// Complementa a money.js, que ya recuerda una categoría por comercio (la corrección de Manu
// gana siempre). Aquí se aprende de rasgos que comparten comercios distintos: la hora, el
// importe, el fin de semana. Puro: el modelo vive en `brain.learn`.

import { merchantKey } from "./money.js";

export const MIN_SUPPORT = 3;      // al menos 3 ejemplos de Manu
export const MIN_AGREEMENT = 0.8;  // y que 4 de cada 5 digan lo mismo
export const PAUSE_BELOW = 0.65;   // una regla activa que falla tanto se pausa

// Rasgos de un gasto. Cada rasgo es una clave legible para explicarlo después.
export function spendFeatures(e) {
  const d = new Date(e.at);
  const h = d.getHours();
  const cents = Math.abs(e.cents ?? 0);
  const out = [];
  const night = h >= 22 || h < 6;
  const band = cents < 500 ? "<5" : cents < 1500 ? "5-15" : cents < 4000 ? "15-40" : ">40";
  const weekend = [0, 5, 6].includes(d.getDay()) && (night || d.getDay() !== 5);
  if (night) out.push(`noche|${band}`);
  out.push(`${night ? "noche" : h < 12 ? "manana" : h < 17 ? "tarde" : "anochecer"}|${weekend ? "finde" : "semana"}|${band}`);
  const mk = merchantKey(e.merchant);
  if (mk) out.push(`comercio|${mk.split(" ").slice(0, 2).join(" ")}`);
  return out;
}

const FEATURE_TEXT = (f) => {
  const [a, b, c] = f.split("|");
  if (a === "comercio") return `en comercios que empiezan por «${b}»`;
  const part = { noche: "de noche (22–6 h)", manana: "por la mañana", tarde: "por la tarde", anochecer: "al anochecer" }[a];
  const money = (x) => ({ "<5": "de menos de 5 €", "5-15": "de 5 a 15 €", "15-40": "de 15 a 40 €", ">40": "de más de 40 €" }[x]);
  if (!c) return `${part}, ${money(b)}`;
  return `${part}, ${b === "finde" ? "en fin de semana" : "entre semana"}, ${money(c)}`;
};
export const featureText = FEATURE_TEXT;

export const emptyModel = () => ({ obs: {}, rules: [] });

// Manu labels (or confirms, or corrects) an item. Every feature counts that label once.
export function observe(model, features, label, { now = new Date(), weight = 1 } = {}) {
  const obs = { ...model.obs };
  for (const f of features) { const row = { ...(obs[f] ?? {}) }; row[label] = (row[label] ?? 0) + weight; obs[f] = row; }
  // A correction of something a rule labelled counts against that rule.
  const rules = model.rules.map((r) => {
    if (r.status !== "ACTIVE" || !features.includes(r.feature)) return r;
    const hit = r.label === label;
    const next = { ...r, hits: r.hits + (hit ? 1 : 0), misses: r.misses + (hit ? 0 : 1), lastAt: new Date(now).toISOString() };
    const tries = next.hits + next.misses;
    if (tries >= 4 && next.hits / tries < PAUSE_BELOW) next.status = "PAUSED";
    return next;
  });
  return { ...model, obs, rules };
}

// Laplace-smoothed agreement: 3 of 3 is 0.8, 9 of 10 is ~0.83, never 1.
const conf = (agree, total) => (agree + 1) / (total + 2);

// The best label a feature suggests, if any reaches the bar.
export function evidenceFor(model, feature) {
  const row = model.obs[feature];
  if (!row) return null;
  const total = Object.values(row).reduce((a, b) => a + b, 0);
  const [label, agree] = Object.entries(row).sort((a, b) => b[1] - a[1])[0];
  return { feature, label, agree, total, agreement: agree / total, confidence: conf(agree, total) };
}

/**
 * New rules worth proposing: enough examples, enough agreement, and not already proposed,
 * active or turned down. Each says why in plain words.
 */
export function ruleCandidates(model) {
  const taken = new Set(model.rules.map((r) => `${r.feature}→${r.label}`));
  const out = [];
  for (const f of Object.keys(model.obs)) {
    if (f.startsWith("comercio|")) continue; // money.js already learns per shop
    const ev = evidenceFor(model, f);
    if (!ev || ev.total < MIN_SUPPORT || ev.agreement < MIN_AGREEMENT) continue;
    if (taken.has(`${f}→${ev.label}`)) continue;
    out.push({ ...ev, why: `${ev.agree} de ${ev.total} gastos ${FEATURE_TEXT(f)} los marcaste así.` });
  }
  return out.sort((a, b) => b.confidence - a.confidence || b.total - a.total);
}

// Manu answers a rule proposal. Accepted → ACTIVE; rejected → kept so it is not proposed again.
export function decideRule(model, candidate, accepted, { now = new Date(), uid = () => `r-${Date.now().toString(36)}` } = {}) {
  const rule = { id: uid(), feature: candidate.feature, label: candidate.label, status: accepted ? "ACTIVE" : "REJECTED", createdAt: new Date(now).toISOString(), hits: 0, misses: 0, basis: { agree: candidate.agree, total: candidate.total } };
  return { ...model, rules: [...model.rules, rule] };
}
export const setRuleStatus = (model, id, status) => ({ ...model, rules: model.rules.map((r) => (r.id === id ? { ...r, status } : r)) });

/**
 * What MANU would propose for an item, using only rules Manu accepted. Returns
 * { label, confidence, rule, why } or null. The result is always marked as a deduction:
 * the app stores it with `inferred: true` and Manu can correct it.
 */
export function predict(model, features) {
  let best = null;
  for (const r of model.rules) {
    if (r.status !== "ACTIVE" || !features.includes(r.feature)) continue;
    // Manu's labels already include the hits and misses of the rule: count them once.
    const row = model.obs[r.feature] ?? {};
    const total = Object.values(row).reduce((x, y) => x + y, 0);
    const confidence = conf(row[r.label] ?? 0, total);
    if (!best || confidence > best.confidence) best = { label: r.label, confidence, rule: r.id, why: `Aprendido: ${FEATURE_TEXT(r.feature)} suele ser esto (${Math.round(confidence * 100)} % de confianza).` };
  }
  return best;
}
