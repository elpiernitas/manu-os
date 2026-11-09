// Motor de propuestas (WEB-94): MANU conecta información, detecta patrones y propone; Manu decide.
//
// Nada se ejecuta por sí solo: `proposals()` solo construye la lista y `applyProposal()` solo
// se llama cuando Manu pulsa un botón (esa pulsación es su decisión). Cada propuesta dice por qué
// existe y con qué datos. Cada respuesta queda registrada (aceptada, rechazada, aplazada) como
// las Suggestion de DATA_MODEL, y eso decide si vuelve a salir: un «no» no se repite.
// Solo afecta a Manu y a sus datos: nunca escribe, publica ni avisa a otras personas.

import { contested, staleClaims, proposed, confirm, reject, resolve, expire, correct, KIND_LABEL } from "./brain.js";
import { ruleCandidates, decideRule, observe, predict, spendFeatures, featureText } from "./learn.js";
import { nextQuestion } from "./conocernos.js";
import { CATEGORIES, isConfirmed } from "./money.js";

const DAY = 86400000;
const LATER_DAYS = { pregunta: 3, vigencia: 30, gasto: 7, regla: 7, duda: 2, deduccion: 5 };
const fmtDay = (d) => new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "long" });

// The outcome log decides what may show again.
function blocked(brain, key, now) {
  const o = brain.outcomes?.[key];
  if (!o) return false;
  if (o.outcome === "REJECTED" || o.outcome === "ACCEPTED") return true;
  return o.outcome === "LATER" && new Date(o.until) > now;
}
export function recordOutcome(brain, key, outcome, kind, { now = new Date() } = {}) {
  const until = outcome === "LATER" ? new Date(now.getTime() + (LATER_DAYS[kind] ?? 3) * DAY).toISOString() : null;
  return { ...brain, outcomes: { ...(brain.outcomes ?? {}), [key]: { outcome, at: now.toISOString(), ...(until ? { until } : {}) } } };
}

// Spending MANU does not understand yet: «Otros», not decided by Manu, last 60 days.
export function unknownSpends(spending = [], now = new Date()) {
  return spending.filter((e) => e.cents > 0 && e.category === "OTHER" && !isConfirmed(e) && now - new Date(e.at) < 60 * DAY && new Date(e.at) <= now).sort((a, b) => String(b.at).localeCompare(a.at));
}

/**
 * Every proposal that applies right now, most useful first. `{ spending }` is the money list.
 * Each item: { key, kind, title, body, why, actions: [{ id, label, primary? }], ...data }.
 */
export function proposals(brain, { spending = [], now = new Date() } = {}) {
  const out = [];
  // 1. Contradictions: two values for the same thing. Manu chooses; nothing is picked for him.
  const byKey = new Map();
  for (const c of contested(brain)) { const k = `${c.subject}|${c.key}`; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(c); }
  for (const [k, cs] of byKey) {
    const key = `duda:${cs.map((c) => c.id).sort().join(",")}`;
    if (blocked(brain, key, now)) continue;
    out.push({ key, kind: "duda", title: "Tengo dos versiones de lo mismo", body: cs.map((c) => `«${c.value ?? c.text}» (${fmtDay(c.recordedAt)})`).join(" o "), why: `Me dijiste cosas distintas sobre «${cs[0].key}». No elijo yo.`, claims: cs.map((c) => c.id), actions: [...cs.map((c) => ({ id: `keep:${c.id}`, label: `Vale «${String(c.value ?? c.text).slice(0, 30)}»`, primary: true })), { id: "later", label: "Luego" }] });
  }
  // 2. Unknown spending: ask what it is. If a learned rule has a guess, say so, with its confidence.
  const unk = unknownSpends(spending, now);
  for (const e of unk.slice(0, 3)) {
    const key = `gasto:${e.id}`;
    if (blocked(brain, key, now)) continue;
    const guess = predict(brain.learn ?? { obs: {}, rules: [] }, spendFeatures(e));
    const t = new Date(e.at);
    out.push({ key, kind: "gasto", entry: e.id, guess, title: "¿Qué es este gasto?", body: `${(e.cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" })} · ${e.merchant ?? "sin concepto"} · ${fmtDay(t)} a las ${t.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`, why: guess ? `${guess.why} Es una deducción: confírmala o corrígela.` : "No sé clasificarlo. Si me lo dices unas cuantas veces, aprenderé a proponerlo solo.", actions: [...(guess ? [{ id: `cat:${guess.label}`, label: `Sí, ${CATEGORIES[guess.label]}`, primary: true }] : []), { id: "choose", label: guess ? "Es otra cosa" : "Elegir categoría" }, { id: "later", label: "Luego" }] });
  }
  // 3. A pattern in Manu's answers that could become a rule.
  for (const c of ruleCandidates(brain.learn ?? { obs: {}, rules: [] }).slice(0, 2)) {
    const key = `regla:${c.feature}→${c.label}`;
    if (blocked(brain, key, now)) continue;
    out.push({ key, kind: "regla", candidate: c, title: "He visto un patrón", body: `Los gastos ${featureText(c.feature)} suelen ser ${CATEGORIES[c.label] ?? c.label}. ¿Te los propongo así a partir de ahora?`, why: `${c.why} Confianza ${Math.round(c.confidence * 100)} %. Seguirán marcados como deducción y podrás corregirlos.`, actions: [{ id: "accept", label: "Sí, propónmelos", primary: true }, { id: "reject", label: "No" }, { id: "later", label: "Luego" }] });
  }
  // 4. Deductions waiting for Manu.
  for (const c of proposed(brain).slice(0, 3)) {
    const key = `deduccion:${c.id}`;
    if (blocked(brain, key, now)) continue;
    out.push({ key, kind: "deduccion", claim: c.id, title: "¿Es verdad esto?", body: c.text, why: `${KIND_LABEL[c.kind]} con ${Math.round((c.confidence ?? 0.5) * 100)} % de confianza: ${c.reason ?? "sin explicación"}. No lo trato como cierto hasta que lo confirmes.`, actions: [{ id: "confirm", label: "Sí", primary: true }, { id: "reject", label: "No" }, { id: "later", label: "Luego" }] });
  }
  // 5. The next getting-to-know-you question.
  const q = nextQuestion(brain, { now, perDay: brain.settings?.maxPerDay ?? 3 });
  if (q && !blocked(brain, `pregunta:${q.id}`, now)) out.push({ key: `pregunta:${q.id}`, kind: "pregunta", question: q.id, title: "Para conocernos", body: q.q, hint: q.hint ?? null, options: q.options ?? null, why: "Respondes solo si te apetece. Lo que digas queda en tu memoria y lo puedes corregir o borrar.", actions: [] });
  // 6. Something that may be out of date. Never about other people or sensitive things.
  const st = staleClaims(brain, now)[0];
  if (st && !blocked(brain, `vigencia:${st.id}`, now)) out.push({ key: `vigencia:${st.id}`, kind: "vigencia", claim: st.id, title: "¿Sigue siendo así?", body: st.text, why: `Me lo dijiste el ${fmtDay(st.confirmedAt ?? st.recordedAt)}. Las cosas cambian; si sigue igual, no te lo vuelvo a preguntar en mucho tiempo.`, actions: [{ id: "confirm", label: "Sigue así", primary: true }, { id: "change", label: "Ha cambiado" }, { id: "expire", label: "Ya no" }, { id: "later", label: "Luego" }] });
  return out;
}

/**
 * The one proposal worth showing outside the Memoria screen (on Hoy), if any. Daily budget:
 * after `maxPerDay` answers today, or a «Luego» in the last hours, MANU stays quiet.
 */
export function topProposal(brain, opts = {}) {
  const now = opts.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const answeredToday = Object.values(brain.outcomes ?? {}).filter((o) => o.at?.slice(0, 10) === today).length;
  if (answeredToday >= (brain.settings?.maxPerDay ?? 3)) return null;
  const recentLater = Object.values(brain.outcomes ?? {}).some((o) => o.outcome === "LATER" && now - new Date(o.at) < 4 * 3600000);
  if (recentLater) return null;
  return proposals(brain, opts)[0] ?? null;
}

/**
 * Applies Manu's choice. Returns { brain, spending, message }. `payload` carries what he typed
 * or picked (a new value, a category). Unknown actions throw: nothing happens by accident.
 */
export function applyProposal({ brain, spending = [] }, p, actionId, payload = {}, { now = new Date(), uid } = {}) {
  const ids = uid ? { uid } : {};
  let b = brain, sp = spending, message = "Hecho.";
  const outcome = (o) => { b = recordOutcome(b, p.key, o, p.kind, { now }); };
  if (actionId === "later") { outcome("LATER"); return { brain: b, spending: sp, message: "Vale, luego." }; }
  switch (p.kind) {
    case "duda": {
      if (!actionId.startsWith("keep:")) throw new Error("Acción desconocida.");
      b = resolve(b, actionId.slice(5), { now }); outcome("ACCEPTED"); message = "Me quedo con esa. La otra queda en el historial."; break;
    }
    case "gasto": {
      const cat = actionId.startsWith("cat:") ? actionId.slice(4) : payload.category;
      if (!cat || !(cat in CATEGORIES)) throw new Error("Elige una categoría.");
      const e = sp.find((x) => x.id === p.entry);
      if (!e) throw new Error("Ese gasto ya no está.");
      sp = sp.map((x) => (x.id === e.id ? { ...x, category: cat, inferred: false } : x));
      b = { ...b, learn: observe(b.learn ?? { obs: {}, rules: [] }, spendFeatures(e), cat, { now }) };
      outcome("ACCEPTED"); message = `Apuntado como ${CATEGORIES[cat]}. Lo tendré en cuenta.`; break;
    }
    case "regla": {
      if (actionId !== "accept" && actionId !== "reject") throw new Error("Acción desconocida.");
      b = { ...b, learn: decideRule(b.learn, p.candidate, actionId === "accept", { now, ...(uid ? { uid } : {}) }) };
      outcome(actionId === "accept" ? "ACCEPTED" : "REJECTED");
      message = actionId === "accept" ? "Desde ahora te los propongo así, siempre como deducción." : "Entendido, no lo propongo."; break;
    }
    case "deduccion": {
      if (actionId === "confirm") { b = confirm(b, p.claim, { now }); message = "Confirmado: ya es un hecho para mí."; }
      else if (actionId === "reject") { b = reject(b, p.claim, { now }); message = "Descartado. No lo vuelvo a deducir."; }
      else throw new Error("Acción desconocida.");
      outcome(actionId === "confirm" ? "ACCEPTED" : "REJECTED"); break;
    }
    case "vigencia": {
      if (actionId === "confirm") { b = confirm(b, p.claim, { now }); message = "Perfecto, sigue igual."; }
      else if (actionId === "expire") { b = expire(b, p.claim, { now }); message = "Lo marco como cosa del pasado. Sigue en el historial."; }
      else if (actionId === "change") { const v = String(payload.text ?? "").trim(); if (!v) throw new Error("Escribe cómo es ahora."); b = correct(b, p.claim, { text: v }, { now, ...ids }).brain; message = "Corregido. La versión anterior queda en el historial."; }
      else throw new Error("Acción desconocida.");
      outcome("ACCEPTED"); break;
    }
    default: throw new Error("Esta propuesta se responde en su propio formulario.");
  }
  return { brain: b, spending: sp, message };
}

/**
 * Labels new spending with accepted rules, always as a deduction (`inferred: true`, `learned`
 * with its confidence). Only touches «Otros» entries Manu has not decided.
 */
export function applyLearned(brain, spending) {
  let n = 0;
  const next = spending.map((e) => {
    if (e.category !== "OTHER" || isConfirmed(e) || e.learned) return e;
    const g = predict(brain.learn ?? { obs: {}, rules: [] }, spendFeatures(e));
    if (!g) return e;
    n++;
    return { ...e, category: g.label, inferred: true, learned: { rule: g.rule, confidence: Math.round(g.confidence * 100) / 100 } };
  });
  return { spending: next, changed: n };
}
