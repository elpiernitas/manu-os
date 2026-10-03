// Dinero rápido (WEB-86). Manu saw a friend's iPhone: double tap on the back
// → «¿Ingreso o gasto?» → amount → category (bar, comida, discoteca,
// supermercado…) → saved in his finance app. Here: the «MANU Dinero» Shortcut
// asks the same and sends one line («gasto|2026-10-03 21:40|12,50|Bar|») that
// MANU files. Also his fixed incomes (nómina, manutención…) and what repeats.
// Pure: data in, data out.
import { normalise } from "./text.js";
import { detectRecurring } from "./insights.js";

// What the Shortcut offers, in order, and where each one goes in MANU.
export const QUICK_SPEND = [
  ["Bar", "FOOD_AND_DRINK"], ["Comida", "FOOD_AND_DRINK"], ["Discoteca", "NIGHTLIFE"], ["Supermercado", "GROCERIES"],
  ["Gasolina", "TRANSPORT"], ["Transporte", "TRANSPORT"], ["Tabaco", "TOBACCO"], ["Ropa", "SHOPPING"], ["Compras", "SHOPPING"],
  ["Ocio", "LEISURE"], ["Casa", "HOME"], ["Salud", "HEALTH"], ["Suscripciones", "SUBSCRIPTIONS"], ["Regalos", "OTHER"], ["Otros", "OTHER"],
];
export const QUICK_INCOME = [["Nómina", "PAYROLL"], ["Manutención", "FAMILY"], ["Familia", "FAMILY"], ["Bizum", "BIZUM"], ["Venta", "OTHER"], ["Otros", "OTHER"]];

const find = (list, label) => list.find(([l]) => normalise(l) === normalise(label ?? "")) ?? null;
export const quickSpendCategory = (label) => find(QUICK_SPEND, label)?.[1] ?? null;
export const quickIncomeKind = (label) => find(QUICK_INCOME, label)?.[1] ?? null;

const DAY = 86400000;
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/**
 * Fixed incomes this month: received (matched to an income of about the same
 * amount, or with its name in the concept) or still expected.
 * @param {Array<{ id, name, cents, day }>} fixed  vault.settings.fixedIncome
 * @returns {Array<{ f, got: object|null, due: boolean }>}
 */
export function fixedIncomeStatus(fixed, income, now = new Date()) {
  const key = monthKey(now);
  const used = new Set();
  return (fixed ?? []).map((f) => {
    const name = normalise(f.name);
    const got = (income ?? []).find((i) => !used.has(i.id) && String(i.at ?? "").length >= 7 && monthKey(new Date(i.at)) === key
      && (i.fixedId === f.id || (Math.abs(i.cents - f.cents) <= Math.max(100, f.cents * 0.05)) || (name && normalise(i.concept ?? "").includes(name)))) ?? null;
    if (got) used.add(got.id);
    return { f, got, due: !got && now.getDate() >= (Number(f.day) || 1) };
  });
}

// What he spends on most often (last `days`), by count: «Bar · 9 veces · 63 €».
export function commonSpends(spending, now = new Date(), days = 90, labels = {}) {
  const from = now.getTime() - days * DAY;
  const by = new Map();
  for (const s of spending ?? []) {
    const t = Date.parse(s.at);
    if (!(t >= from && t <= now.getTime()) || !(s.cents > 0)) continue;
    const label = String(s.merchant ?? "").trim() || labels[s.category] || "Otros";
    const k = normalise(label);
    const g = by.get(k) ?? { label, count: 0, cents: 0, category: s.category };
    g.count++; g.cents += s.cents;
    by.set(k, g);
  }
  return [...by.values()].filter((g) => g.count >= 2).map((g) => ({ ...g, avg: Math.round(g.cents / g.count) })).sort((a, b) => b.count - a.count || b.cents - a.cents).slice(0, 8);
}

// Incomes that come every month (same source, similar amount).
export function recurringIncome(income, now = new Date()) {
  return detectRecurring((income ?? []).map((i) => ({ ...i, merchant: i.concept ?? i.source ?? "Ingreso", category: "FINANCE" })), { now });
}

// The Shortcut's line → nothing to do here: the buzón parser reads it
// (gasto|fecha|importe|Categoría|concepto and ingreso|fecha|importe|Tipo|concepto).
