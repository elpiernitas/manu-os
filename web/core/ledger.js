// DINERO 2.0 (WEB-111): el contexto personal de cada movimiento.
//
// Regla de oro: los movimientos del banco (vault.spending / vault.income) NO se modifican nunca.
// Todo lo que Manu dice de ellos vive aparte, en `vault.ledger`, como información adicional:
//   ledger.notes[key]  → qué es ese movimiento para Manu (tipo, nombre, categoría, reparto, notas)
//   ledger.links[id]   → relaciones confirmadas o descartadas entre dos movimientos
//   ledger.debts[id]   → deudas apuntadas a mano (alguien pagó por mí, o saldé sin movimiento)
//   ledger.dropped[k]  → marcas de borrado, para que Tu nube no resucite lo deshecho
// Cada cambio guarda la versión anterior (`prev`), así que todo es reversible. Viaja con Tu nube y
// se fusiona entre dispositivos (gana la versión más reciente de cada anotación).
//
// Clave de un movimiento: «g:<id>» si es un gasto, «i:<id>» si es un ingreso. Los ids son los de
// siempre (estables entre importaciones), así que una anotación sobrevive a reimportar el extracto.
import { normalise } from "./text.js";
import { incomeKind } from "./bank.js";
import { cleanConcept } from "./quickmoney.js";

export const LEDGER_SCHEMA = 1;
export const emptyLedger = () => ({ schema: LEDGER_SCHEMA, notes: {}, links: {}, debts: {}, dropped: {} });
export function ledgerOf(vault) {
  const l = vault?.ledger;
  if (!l || typeof l !== "object") return emptyLedger();
  return { schema: LEDGER_SCHEMA, notes: l.notes ?? {}, links: l.links ?? {}, debts: l.debts ?? {}, dropped: l.dropped ?? {} };
}

// ---------- Tipos ----------
// Lo que puede ser un movimiento para Manu. «out» = sale dinero de la cuenta; «in» = entra.
export const KIND = {
  MINE: { out: "Gasto propio", in: "Ingreso propio" },
  OTHERS: { out: "Dinero de otra persona", in: "Dinero de otra persona" },
  SHARED: { out: "Gasto compartido" },
  TRANSFER: { out: "Entre mis cuentas", in: "Entre mis cuentas" },
  CASH: { out: "Retirada de efectivo", in: "Ingreso de efectivo" },
  REFUND: { in: "Devolución" },
  SETTLE: { out: "Pago una deuda", in: "Me pagan una deuda" },
  REVIEW: { out: "Pendiente de revisar", in: "Pendiente de revisar" },
};
export const kindsFor = (dir) => Object.keys(KIND).filter((k) => KIND[k][dir]);
export const kindLabel = (kind, dir) => KIND[kind]?.[dir] ?? "Pendiente de revisar";
export const CASH_USE = { SPENT: "Lo gasté yo", KEPT: "Lo tengo en mano", UNKNOWN: "No lo sé todavía" };
export const ME = "me";

const MAX_PREV = 10;
const iso = (d) => new Date(d).toISOString();
export const keyOf = (type, id) => `${type === "income" || type === "i" ? "i" : "g"}:${id}`;
export const personKey = (name) => `n:${normalise(String(name ?? "")).replace(/[^a-z0-9ñ]+/g, " ").trim()}`;

/** Todos los movimientos, con su dirección y clave. Lee el banco; no lo cambia. */
export function movements(vault) {
  const out = (vault?.spending ?? []).filter((e) => e && typeof e.id === "string" && e.cents > 0).map((e) => ({ key: keyOf("g", e.id), dir: "out", id: e.id, at: e.at, cents: e.cents, concept: e.merchant ?? "", category: e.category ?? "OTHER", source: e.source ?? null, raw: e }));
  const inn = (vault?.income ?? []).filter((e) => e && typeof e.id === "string" && e.cents > 0).map((e) => ({ key: keyOf("i", e.id), dir: "in", id: e.id, at: e.at, cents: e.cents, concept: e.concept ?? e.merchant ?? "", category: null, incomeKind: e.kind ?? incomeKind(e.concept ?? e.merchant ?? ""), payroll: Boolean(e.payroll), source: e.source ?? null, raw: e }));
  return [...out, ...inn];
}

// ---------- Lo que MANU supone sin preguntar (y lo que deja pendiente) ----------
const CASH_RE = /\b(cajero|reintegro|retirada|disposicion|atm)\b/;
const CASH_IN_RE = /\b(ingreso efectivo|ingreso en efectivo|ingreso cajero|deposito|ingreso por cajero)\b/;
/**
 * La suposición para un movimiento sin anotar. `pending: true` = no cuenta como gasto ni como
 * ingreso propio hasta que Manu lo revise. Nunca se supone que algo es de otra persona.
 */
export function guess(m) {
  const t = ` ${normalise(m.concept).replace(/[^a-z0-9ñ]+/g, " ")} `;
  if (m.dir === "out") {
    const s = m.raw?.split;
    if (s && Array.isArray(s.people)) return { kind: "SHARED", pending: false, legacy: true, why: "Lo repartiste con el reparto anterior" };
    if (m.category === "CASH" || CASH_RE.test(t)) return { kind: "CASH", pending: true, why: "Retirada de efectivo: no sé si lo gastaste, lo guardas o lo volviste a ingresar" };
    if (m.category === "TRANSFERS") return { kind: "REVIEW", pending: true, why: "Bizum o transferencia: puede ser tuyo, de otra persona o entre tus cuentas" };
    if (m.raw?.review) return { kind: "REVIEW", pending: true, why: "Marcado para revisar al importarlo" };
    return { kind: "MINE", pending: false, why: "Compra normal: la cuento como gasto tuyo" };
  }
  if (m.payroll || m.incomeKind === "PAYROLL") return { kind: "MINE", pending: false, why: "Nómina" };
  if (m.incomeKind === "REFUND") return { kind: "REFUND", pending: true, why: "Parece una devolución: falta saber de qué compra" };
  if (CASH_IN_RE.test(t)) return { kind: "CASH", pending: true, why: "Ingreso de efectivo: falta saber de dónde sale" };
  if (m.incomeKind === "BIZUM" || m.incomeKind === "TRANSFER") return { kind: "REVIEW", pending: true, why: "Bizum o transferencia recibida: puede ser tuya, de otra persona o una deuda que te pagan" };
  if (m.incomeKind === "FAMILY") return { kind: "MINE", pending: false, why: "Manutención" };
  return { kind: "REVIEW", pending: true, why: "Ingreso sin identificar" };
}

// ---------- Anotar (sin tocar el banco) ----------
const cleanText = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
/** Normaliza un reparto: [{ who, name, cents }] con céntimos enteros que suman el importe. */
export function normParts(parts, total) {
  const list = (parts ?? []).map((p) => ({ who: p.who === ME ? ME : String(p.who ?? personKey(p.name)), name: p.who === ME ? "Yo" : cleanText(p.name, 40) || "Sin nombre", cents: Math.max(0, Math.round(Number(p.cents) || 0)) })).filter((p) => p.cents > 0 || p.who === ME);
  const merged = new Map();
  for (const p of list) { const x = merged.get(p.who); if (x) x.cents += p.cents; else merged.set(p.who, { ...p }); }
  const out = [...merged.values()];
  const sum = out.reduce((s, p) => s + p.cents, 0);
  if (sum > total) throw new Error(`Lo repartido (${eur(sum)}) es más que el movimiento (${eur(total)}).`);
  return out;
}
/** Reparto a partes iguales entre «yo» (si va) y las personas; los céntimos sueltos, para mí. */
export function equalParts(total, people, { includeMe = true } = {}) {
  const who = [...(includeMe ? [{ who: ME, name: "Yo" }] : []), ...people.map((p) => ({ who: p.who ?? personKey(p.name), name: p.name }))];
  if (!who.length) return [];
  const each = Math.floor(total / who.length);
  return who.map((p, i) => ({ ...p, cents: each + (i === 0 ? total - each * who.length : 0) }));
}
/** De porcentajes a céntimos (redondeo justo: la diferencia, al primero). */
export function partsFromPct(total, rows) {
  const parts = rows.map((r) => ({ ...r, cents: Math.floor((total * Math.max(0, Number(r.pct) || 0)) / 100) }));
  const pctSum = rows.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  if (pctSum > 100.0001) throw new Error("Los porcentajes suman más de 100.");
  if (Math.abs(pctSum - 100) < 0.0001 && parts.length) parts[0].cents += total - parts.reduce((s, p) => s + p.cents, 0);
  return parts;
}

/**
 * Guarda lo que Manu dice de un movimiento. Devuelve un ledger nuevo. La versión anterior queda en
 * `prev` (hasta 10). `change` = { kind, name, category, parts, cashUse, note }.
 */
export function annotate(ledger, m, change, { now = new Date(), device = null } = {}) {
  const l = { ...ledgerOf({ ledger }), notes: { ...ledgerOf({ ledger }).notes }, dropped: { ...ledgerOf({ ledger }).dropped } };
  if (!kindsFor(m.dir).includes(change.kind)) throw new Error("Ese tipo no vale para este movimiento.");
  const old = l.notes[m.key];
  const note = { kind: change.kind, at: iso(now) };
  if (device) note.by = cleanText(device, 40);
  const name = cleanText(change.name, 80); if (name) note.name = name;
  if (change.category && change.category !== m.category) note.category = String(change.category).slice(0, 30);
  if (change.note) note.note = cleanText(change.note, 500);
  if (["OTHERS", "SHARED", "SETTLE"].includes(change.kind)) {
    note.parts = normParts(change.parts ?? [], m.cents);
    const others = note.parts.filter((p) => p.who !== ME && p.cents > 0);
    if (!others.length) throw new Error("Elige al menos una persona.");
    if (change.kind === "SETTLE" && note.parts.some((p) => p.who === ME)) note.parts = others;
    // Lo que no se reparte es mío (en compartidos y en dinero de otros con parte mía).
    if (change.kind !== "SETTLE") { const sum = note.parts.reduce((s, p) => s + p.cents, 0); const me = note.parts.find((p) => p.who === ME); if (sum < m.cents) { if (me) me.cents += m.cents - sum; else note.parts.unshift({ who: ME, name: "Yo", cents: m.cents - sum }); } }
    if (change.kind === "SETTLE" && others.reduce((s, p) => s + p.cents, 0) !== m.cents) throw new Error("En un pago de deuda, todo el importe es de esa persona.");
  }
  if (change.kind === "CASH" && m.dir === "out" && CASH_USE[change.cashUse]) note.cashUse = change.cashUse;
  if (old) note.prev = [stripPrev(old), ...(old.prev ?? [])].slice(0, MAX_PREV);
  l.notes[m.key] = note;
  delete l.dropped[`n|${m.key}`];
  return l;
}
const stripPrev = ({ prev, ...rest }) => rest;
/** Vuelve a lo que dice el banco (borra la anotación; queda una marca para Tu nube). */
export function revert(ledger, key, { now = new Date() } = {}) {
  const l = ledgerOf({ ledger });
  if (!l.notes[key]) return l;
  const notes = { ...l.notes }; delete notes[key];
  return { ...l, notes, dropped: { ...l.dropped, [`n|${key}`]: iso(now) } };
}
/** Restaura una versión anterior (la actual pasa al historial). */
export function restore(ledger, key, index, { now = new Date() } = {}) {
  const l = ledgerOf({ ledger }), cur = l.notes[key];
  const v = cur?.prev?.[index];
  if (!v) return l;
  const prev = [stripPrev(cur), ...cur.prev.filter((_, i) => i !== index)].slice(0, MAX_PREV);
  return { ...l, notes: { ...l.notes, [key]: { ...v, at: iso(now), prev } } };
}

// ---------- Relaciones entre movimientos ----------
export const LINK = { CASH_BACK: "Efectivo que volví a ingresar", REFUND: "Devolución de esta compra", TRANSFER: "Traspaso entre mis cuentas" };
const linkId = (kind, a, b) => `${kind}|${a}|${b}`;
/** Confirma (o descarta) una relación. Nunca se crea sola: solo con un toque de Manu. */
export function setLink(ledger, { kind, a, b }, status, { now = new Date() } = {}) {
  if (!LINK[kind] || !["CONFIRMED", "REJECTED"].includes(status)) throw new Error("Relación no válida.");
  const l = ledgerOf({ ledger }), id = linkId(kind, a, b);
  const dropped = { ...l.dropped }; delete dropped[`l|${id}`];
  return { ...l, links: { ...l.links, [id]: { kind, a, b, status, at: iso(now) } }, dropped };
}
export function unlink(ledger, id, { now = new Date() } = {}) {
  const l = ledgerOf({ ledger });
  if (!l.links[id]) return l;
  const links = { ...l.links }; delete links[id];
  return { ...l, links, dropped: { ...l.dropped, [`l|${id}`]: iso(now) } };
}
const tokens = (s) => new Set(normalise(cleanConcept(s) || s).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4 && !/^(compra|tarj|tarjeta|devolucion|abono|reembolso|ingreso|transferencia|bizum|recibo)$/.test(w)));
const DAY = 864e5;
/**
 * Relaciones posibles. Solo sugerencias: dos movimientos no se compensan porque coincida el
 * importe. Cada una lleva sus motivos y su confianza; las ya confirmadas o descartadas no salen.
 */
export function suggestions(vault, { max = 20 } = {}) {
  const l = ledgerOf(vault), ms = movements(vault);
  const decided = new Set(Object.values(l.links).flatMap((x) => [`${x.a}|${x.b}`]));
  const used = new Set(Object.values(l.links).filter((x) => x.status === "CONFIRMED").flatMap((x) => [x.a, x.b]));
  const kindOf = (m) => l.notes[m.key]?.kind ?? guess(m).kind;
  const outs = ms.filter((m) => m.dir === "out"), ins = ms.filter((m) => m.dir === "in");
  const out = [];
  for (const w of outs.filter((m) => kindOf(m) === "CASH" && !used.has(m.key))) {
    for (const d of ins) {
      if (used.has(d.key) || decided.has(`${w.key}|${d.key}`)) continue;
      const days = (Date.parse(d.at) - Date.parse(w.at)) / DAY;
      if (days < 0 || days > 45 || d.cents > w.cents) continue;
      const reasons = [], cashIn = kindOf(d) === "CASH" || CASH_IN_RE.test(` ${normalise(d.concept)} `);
      if (cashIn) reasons.push("el ingreso es de efectivo");
      if (d.cents === w.cents) reasons.push("mismo importe");
      else reasons.push(`el ingreso es una parte (${eur(d.cents)} de ${eur(w.cents)})`);
      reasons.push(days < 1 ? "el mismo día" : `${Math.round(days)} ${Math.round(days) === 1 ? "día" : "días"} después`);
      // Sin ingreso de efectivo, solo si el importe es exacto y cercano, y con confianza baja.
      if (!cashIn && !(d.cents === w.cents && days <= 10)) continue;
      const confidence = cashIn && d.cents === w.cents && days <= 15 ? "alta" : cashIn ? "media" : "baja";
      if (!cashIn) reasons.push("solo coincide el importe: no lo doy por hecho");
      out.push({ id: linkId("CASH_BACK", w.key, d.key), kind: "CASH_BACK", a: w.key, b: d.key, cents: d.cents, confidence, reasons, days });
    }
  }
  for (const r of ins.filter((m) => kindOf(m) === "REFUND" && !used.has(m.key))) {
    const rt = tokens(r.concept);
    for (const g of outs) {
      if (decided.has(`${g.key}|${r.key}`)) continue;
      const days = (Date.parse(r.at) - Date.parse(g.at)) / DAY;
      if (days < 0 || days > 90 || r.cents > g.cents) continue;
      const shared = [...tokens(g.concept)].filter((w) => rt.has(w));
      if (!shared.length) continue;
      const reasons = [`mismo comercio (${shared.slice(0, 2).join(", ")})`, r.cents === g.cents ? "devolución completa" : `devolución parcial (${eur(r.cents)} de ${eur(g.cents)})`, `${Math.round(days)} días después`];
      out.push({ id: linkId("REFUND", g.key, r.key), kind: "REFUND", a: g.key, b: r.key, cents: r.cents, confidence: r.cents === g.cents ? "alta" : "media", reasons, days });
    }
  }
  const TRANSFER_RE = /\b(traspaso|entre cuentas|cuenta propia|a mi cuenta)\b/;
  for (const g of outs.filter((m) => TRANSFER_RE.test(` ${normalise(m.concept)} `) && !used.has(m.key))) {
    for (const i of ins.filter((m) => TRANSFER_RE.test(` ${normalise(m.concept)} `) && !used.has(m.key))) {
      const days = Math.abs(Date.parse(i.at) - Date.parse(g.at)) / DAY;
      if (i.cents !== g.cents || days > 3 || decided.has(`${g.key}|${i.key}`)) continue;
      out.push({ id: linkId("TRANSFER", g.key, i.key), kind: "TRANSFER", a: g.key, b: i.key, cents: i.cents, confidence: "media", reasons: ["mismo importe", "los dos dicen traspaso", days < 1 ? "el mismo día" : `${Math.round(days)} días de diferencia`], days });
    }
  }
  const rank = { alta: 0, media: 1, baja: 2 };
  return out.sort((x, y) => rank[x.confidence] - rank[y.confidence] || x.days - y.days).slice(0, max);
}

// ---------- El cálculo ----------
const eur = (c) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
/**
 * Cada movimiento resuelto: qué parte es consumo tuyo, ingreso tuyo, de otras personas, neutra o
 * pendiente. Las cifras salen siempre de aquí.
 */
export function resolve(vault) {
  const l = ledgerOf(vault), ms = movements(vault);
  const byKey = new Map(ms.map((m) => [m.key, m]));
  const confirmed = Object.entries(l.links).filter(([, x]) => x.status === "CONFIRMED" && byKey.has(x.a) && byKey.has(x.b));
  const cashBack = new Map(), cashBackIn = new Set(), refundOf = new Map(), refundFor = new Map(), transfer = new Set();
  for (const [, x] of confirmed) {
    const b = byKey.get(x.b);
    if (x.kind === "CASH_BACK") { cashBack.set(x.a, (cashBack.get(x.a) ?? 0) + b.cents); cashBackIn.add(x.b); }
    if (x.kind === "REFUND") { refundOf.set(x.b, x.a); refundFor.set(x.a, (refundFor.get(x.a) ?? 0) + b.cents); }
    if (x.kind === "TRANSFER") { transfer.add(x.a); transfer.add(x.b); }
  }
  const rows = [];
  for (const m of ms) {
    const note = l.notes[m.key];
    const g = note ? null : guess(m);
    let kind = note?.kind ?? g.kind;
    // Una relación confirmada decide lo que no has anotado a mano.
    if (!note && cashBackIn.has(m.key)) kind = "CASH";
    if (!note && transfer.has(m.key)) kind = "TRANSFER";
    const linked = cashBackIn.has(m.key) || transfer.has(m.key) || refundOf.has(m.key);
    const r = { key: m.key, dir: m.dir, id: m.id, at: m.at, cents: m.cents, concept: m.concept, name: note?.name ?? (cleanConcept(m.concept) || (m.dir === "in" ? "Ingreso" : "Sin concepto")), category: note?.category ?? m.category ?? null, kind, label: kindLabel(kind, m.dir), auto: !note, why: note ? null : g?.why ?? null, note: note?.note ?? null, consumo: 0, ingreso: 0, refund: 0, neutral: 0, pending: 0, people: [], m };
    const parts = note?.parts ?? (g?.legacy ? legacyParts(m) : null);
    if (m.dir === "out") {
      if (kind === "MINE") r.consumo = m.cents;
      else if (kind === "SHARED") { r.consumo = parts?.find((p) => p.who === ME)?.cents ?? 0; for (const p of parts ?? []) if (p.who !== ME && !p.paid) r.people.push({ who: p.who, name: p.name, cents: -p.cents, what: "te debe su parte" }); }
      else if (kind === "OTHERS") { r.consumo = parts?.find((p) => p.who === ME)?.cents ?? 0; for (const p of parts ?? []) if (p.who !== ME) r.people.push({ who: p.who, name: p.name, cents: -p.cents, what: "gastado de su dinero" }); }
      else if (kind === "SETTLE") { for (const p of parts ?? []) r.people.push({ who: p.who, name: p.name, cents: -p.cents, what: "le pagaste" }); }
      else if (kind === "TRANSFER") r.neutral = m.cents;
      else if (kind === "CASH") {
        // Lo que volviste a ingresar (relación confirmada) es neutro; el resto depende de ti.
        const back = Math.min(m.cents, cashBack.get(m.key) ?? 0), rest = m.cents - back;
        r.neutral = back;
        const use = note?.cashUse;
        if (use === "SPENT") { r.consumo = rest; r.category = note?.category ?? "CASH"; } else if (use === "KEPT") r.neutral += rest; else r.pending = rest;
      } else r.pending = m.cents;
      // Una devolución confirmada rebaja lo que te costó (sin dejar el consumo en negativo).
      const back = refundFor.get(m.key) ?? 0;
      if (back && r.consumo) { const off = Math.min(back, r.consumo); r.consumo -= off; r.refundApplied = off; }
    } else {
      const ref = refundOf.get(m.key);
      if (!note && g.pending && !linked) r.pending = m.cents; // lo supuesto y dudoso espera a que lo revises
      else if (kind === "MINE") r.ingreso = m.cents;
      else if (kind === "OTHERS") { r.ingreso = parts?.find((p) => p.who === ME)?.cents ?? 0; for (const p of parts ?? []) if (p.who !== ME) r.people.push({ who: p.who, name: p.name, cents: p.cents, what: "dinero suyo en tu cuenta" }); }
      else if (kind === "SETTLE") { for (const p of parts ?? []) r.people.push({ who: p.who, name: p.name, cents: p.cents, what: "te pagó" }); }
      else if (kind === "REFUND" && ref) {
        // Devolución de una compra concreta: ya rebaja esa compra. Si la compra era de otra
        // persona, el dinero devuelto es suyo.
        const orig = byKey.get(ref), on = l.notes[ref];
        if (on?.kind === "OTHERS") for (const p of on.parts ?? []) if (p.who !== ME) r.people.push({ who: p.who, name: p.name, cents: Math.round((m.cents * p.cents) / orig.cents), what: "devolución de su compra" });
        r.neutral = m.cents; r.category = on?.category ?? orig.category; r.refundOf = ref;
      } else if (kind === "REFUND") { r.refund = m.cents; r.category = note?.category ?? "OTHER"; }
      else if (kind === "TRANSFER" || kind === "CASH") r.neutral = m.cents;
      else r.pending = m.cents;
    }
    r.pendingFlag = r.pending > 0;
    rows.push(r);
  }
  applyLooseRefunds(rows);
  // Deudas apuntadas a mano (sin movimiento en el banco).
  const manual = Object.entries(l.debts).filter(([, d]) => d && d.who && Number.isInteger(d.cents) && d.cents !== 0).map(([id, d]) => ({ id, ...d }));
  return { rows, manual };
}
/**
 * Una devolución sin relacionar rebaja tus compras anteriores de su misma categoría (la más
 * reciente primero, como mucho 90 días antes), para que el resumen, las categorías, la serie y
 * los patrones digan lo mismo. Lo que no encuentra compra queda en `refundLeft`: no rebaja nada
 * y se avisa para relacionarlo.
 */
const REFUND_WINDOW = 90 * 86400000;
function applyLooseRefunds(rows) {
  const refunds = rows.filter((r) => r.refund > 0).sort((a, b) => (a.at < b.at ? -1 : 1));
  for (const rf of refunds) {
    const t = Date.parse(rf.at);
    let left = rf.refund;
    const cands = rows.filter((r) => r.dir === "out" && r.consumo > 0 && (r.category ?? "OTHER") === (rf.category ?? "OTHER") && Date.parse(r.at) <= t && t - Date.parse(r.at) <= REFUND_WINDOW).sort((a, b) => (a.at < b.at ? 1 : -1));
    for (const c of cands) {
      if (!left) break;
      const off = Math.min(left, c.consumo);
      c.consumo -= off; c.refundApplied = (c.refundApplied ?? 0) + off; left -= off;
      (c.refundFrom ??= []).push(rf.key);
    }
    rf.refundUsed = rf.refund - left; rf.refundLeft = left;
  }
}
function legacyParts(m) {
  const s = m.raw.split;
  return [{ who: ME, name: "Yo", cents: s.mine ?? 0 }, ...(s.people ?? []).map((p) => ({ who: String(p.key ?? personKey(p.name)), name: p.name, cents: p.cents, paid: Boolean(p.paid) }))];
}

/** Saldo con cada persona. Positivo: dinero suyo que tienes / le debes. Negativo: te debe. */
export function balances(vault) {
  const { rows, manual } = resolve(vault);
  const by = new Map();
  const add = (who, name, cents, item) => { const b = by.get(who) ?? { who, name, cents: 0, items: [] }; b.cents += cents; b.items.push(item); if (name) b.name = name; by.set(who, b); };
  for (const r of rows) for (const p of r.people) add(p.who, p.name, p.cents, { key: r.key, at: r.at, name: r.name, cents: p.cents, what: p.what });
  for (const d of manual) add(d.who, d.name, d.cents, { debt: d.id, at: d.at, name: d.note || (d.cents < 0 ? "Te debe (apuntado a mano)" : "Le debes (apuntado a mano)"), cents: d.cents, what: "apuntado a mano" });
  return [...by.values()].filter((b) => b.cents !== 0).sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
}
/** Apunta una deuda sin movimiento: cents > 0 = le debo; cents < 0 = me debe. */
export function addDebt(ledger, { who, name, cents, note }, { now = new Date(), uid } = {}) {
  const l = ledgerOf({ ledger });
  const c = Math.round(Number(cents));
  if (!c) throw new Error("Pon un importe.");
  const n = cleanText(name, 40); if (!n) throw new Error("¿Con quién?");
  const id = uid ? uid() : `d-${Date.now().toString(36)}`;
  return { ...l, debts: { ...l.debts, [id]: { who: who ?? personKey(n), name: n, cents: c, note: cleanText(note, 120) || null, at: iso(now) } } };
}
export function dropDebt(ledger, id, { now = new Date() } = {}) {
  const l = ledgerOf({ ledger }); if (!l.debts[id]) return l;
  const debts = { ...l.debts }; delete debts[id];
  return { ...l, debts, dropped: { ...l.dropped, [`d|${id}`]: iso(now) } };
}

// ---------- Resumen fiable ----------
export const RELIABLE_PENDING_SHARE = 0.05; // con más del 5 % sin atribuir, no hay consejos
const inRange = (at, from, to) => { const t = Date.parse(at); return t >= from && t < to; };
/**
 * Las cifras de un periodo, separando banco, consumo personal, ingresos propios, dinero de otras
 * personas, movimientos neutros y lo pendiente. `fiable` decide si se dan consejos y previsiones.
 */
export const NIVEL_LABEL = { CONFIRMADA: "Confirmada por ti", INTERPRETADA: "Interpretada por MANU", PROVISIONAL: "Provisional: falta revisar", SIN_DATOS: "Sin datos" };
export function summary(vault, { from, to }) {
  const f = new Date(from).getTime(), t = new Date(to).getTime();
  const { rows } = resolve(vault);
  const rs = rows.filter((r) => inRange(r.at, f, t));
  const sum = (fn) => rs.reduce((s, r) => s + fn(r), 0);
  const bankOut = sum((r) => (r.dir === "out" ? r.cents : 0)), bankIn = sum((r) => (r.dir === "in" ? r.cents : 0));
  // Las devoluciones ya están descontadas de cada compra (relacionadas o por categoría).
  const refunds = sum((r) => r.refundApplied ?? 0), refundsLeft = sum((r) => r.refundLeft ?? 0);
  const consumo = sum((r) => r.consumo);
  const ingreso = sum((r) => r.ingreso);
  const pending = rs.filter((r) => r.pending > 0);
  const pendingCents = pending.reduce((s, r) => s + r.pending, 0);
  const othersIn = sum((r) => (r.dir === "in" ? r.people.filter((p) => p.cents > 0).reduce((s, p) => s + p.cents, 0) : 0));
  const othersOut = sum((r) => (r.dir === "out" ? r.people.reduce((s, p) => s + -p.cents, 0) : 0));
  const byCategory = {};
  for (const r of rs) if (r.consumo > 0) byCategory[r.category ?? "OTHER"] = (byCategory[r.category ?? "OTHER"] ?? 0) + r.consumo;
  const base = bankOut + bankIn;
  const pendingShare = base ? pendingCents / base : 0;
  const fiable = pendingShare <= RELIABLE_PENDING_SHARE;
  const consumoAuto = sum((r) => (r.auto ? r.consumo : 0));
  // Nivel de confianza de la cifra: confirmada por Manu, interpretada por MANU, provisional
  // (demasiado pendiente) o sin datos. Una cifra con supuestos nunca sale como confirmada.
  const nivel = !rs.length ? "SIN_DATOS" : !fiable ? "PROVISIONAL" : consumoAuto > 0 || pendingCents > 0 ? "INTERPRETADA" : "CONFIRMADA";
  return {
    bank: { out: bankOut, in: bankIn, count: rs.length },
    consumo, consumoAuto, consumoConfirmado: consumo - consumoAuto, ingreso, refunds, refundsLeft, nivel, nivelLabel: NIVEL_LABEL[nivel],
    neutral: sum((r) => r.neutral),
    others: { in: othersIn, out: othersOut },
    pending: { cents: pendingCents, count: pending.length, rows: pending.sort((a, b) => b.pending - a.pending) },
    byCategory: Object.entries(byCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]),
    // El ahorro personal nunca incluye dinero de otras personas ni lo pendiente.
    ahorro: ingreso - consumo, fiable, pendingShare,
  };
}

/**
 * Las vistas que alimentan las estadísticas de siempre (medias, previsiones, patrones, sitios…):
 * solo tu consumo y tus ingresos, con el nombre y la categoría corregidos. Lo pendiente, fuera.
 */
export function personalSpending(vault) {
  return resolve(vault).rows.filter((r) => r.dir === "out" && r.consumo > 0).map((r) => ({ ...r.m.raw, merchant: r.name !== (cleanConcept(r.concept) || "Sin concepto") ? r.name : r.m.raw.merchant, category: r.category ?? r.m.raw.category, cents: r.consumo, ledgerKind: r.kind }));
}
export function personalIncome(vault) {
  return resolve(vault).rows.filter((r) => r.dir === "in" && r.ingreso > 0).map((r) => ({ ...r.m.raw, cents: r.ingreso, ledgerKind: r.kind }));
}

// ---------- Correcciones múltiples con revisión previa ----------
/** Qué cambiaría si se aplica `change` a varios movimientos. No cambia nada. */
export function bulkPlan(vault, keys, change) {
  const before = new Map(resolve(vault).rows.map((r) => [r.key, r]));
  const ms = new Map(movements(vault).map((m) => [m.key, m]));
  let ledger = ledgerOf(vault);
  const skipped = [];
  for (const k of keys) {
    const m = ms.get(k);
    if (!m) continue;
    const cur = ledger.notes[k];
    try { ledger = annotate(ledger, m, { ...(cur ? stripPrev(cur) : {}), kind: change.kind ?? cur?.kind ?? before.get(k).kind, category: change.category ?? cur?.category, parts: change.parts ?? cur?.parts, name: cur?.name, note: cur?.note, cashUse: change.cashUse ?? cur?.cashUse }); }
    catch (err) { skipped.push({ key: k, why: err.message }); }
  }
  const after = new Map(resolve({ ...vault, ledger }).rows.map((r) => [r.key, r]));
  const rows = keys.filter((k) => after.has(k)).map((k) => ({ key: k, name: before.get(k).name, before: pick(before.get(k)), after: pick(after.get(k)), skipped: skipped.find((s) => s.key === k)?.why ?? null }));
  const tot = (map, f) => keys.reduce((s, k) => s + (map.get(k)?.[f] ?? 0), 0);
  return { ledger, rows, skipped, delta: { consumo: tot(after, "consumo") - tot(before, "consumo"), pending: tot(after, "pending") - tot(before, "pending"), ingreso: tot(after, "ingreso") - tot(before, "ingreso") } };
}
const pick = (r) => ({ kind: r.kind, label: r.label, category: r.category, consumo: r.consumo, ingreso: r.ingreso, pending: r.pending });

// ---------- Tu nube: fusionar dos dispositivos ----------
/**
 * Une el ledger de dos dispositivos. De cada anotación, relación o deuda gana la versión más
 * reciente; una marca de borrado más reciente que la anotación la elimina. Nada se pierde en
 * silencio: el historial (`prev`) se une también.
 */
export function mergeLedger(a, b) {
  const A = ledgerOf({ ledger: a }), B = ledgerOf({ ledger: b });
  const dropped = { ...A.dropped };
  for (const [k, at] of Object.entries(B.dropped)) if (!dropped[k] || dropped[k] < at) dropped[k] = at;
  const pickNewest = (x, y, prefix) => {
    const out = {};
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      const p = x[k], q = y[k];
      let w = !p ? q : !q ? p : (String(q.at) > String(p.at) ? q : p);
      if (prefix === "n" && p && q && p !== q) {
        const other = w === p ? q : p;
        const prev = [...(w.prev ?? []), stripPrev(other), ...(other.prev ?? [])].filter((v, i, arr) => arr.findIndex((z) => z.at === v.at && z.kind === v.kind) === i && v.at !== w.at).slice(0, MAX_PREV);
        w = { ...w, prev };
      }
      const d = dropped[`${prefix}|${k}`];
      if (w && (!d || String(w.at) > d)) out[k] = w;
    }
    return out;
  };
  return { schema: LEDGER_SCHEMA, notes: pickNewest(A.notes, B.notes, "n"), links: pickNewest(A.links, B.links, "l"), debts: pickNewest(A.debts, B.debts, "d"), dropped };
}
