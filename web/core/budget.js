// Presupuestos (WEB-47): a monthly limit per category, how much is left and
// whether Manu is spending faster than the month goes by. Pure; the limits
// live in vault.settings.budgets as { CATEGORY: cents }.
import { CATEGORIES, euros } from "./money.js";
import { normalise } from "./text.js";

const monthBounds = (now) => [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()];

// status: ok | warn (≥ 80 % or clearly ahead of the month) | over (> 100 %)
export function budgetStatus(spending, budgets = {}, now = new Date()) {
  const [s, e] = monthBounds(now);
  const spent = {};
  for (const x of spending ?? []) { const t = Date.parse(x.at); if (t >= s && t < e) spent[x.category] = (spent[x.category] ?? 0) + x.cents; }
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = Math.min(1, (now.getDate() - 1 + (now.getHours() + 1) / 24) / days);
  return Object.entries(budgets ?? {})
    .filter(([cat, limit]) => CATEGORIES[cat] && Number.isInteger(limit) && limit > 0)
    .map(([cat, limit]) => {
      const used = spent[cat] ?? 0;
      const pct = Math.round((used / limit) * 100);
      const ahead = used > limit * elapsed * 1.15 && used > limit * 0.3; // spending faster than the month (with some slack)
      const status = used > limit ? "over" : pct >= 80 || ahead ? "warn" : "ok";
      return { cat, limit, spent: used, left: limit - used, pct, status };
    })
    .sort((a, b) => b.pct - a.pct);
}

// One short sentence for the day summary and the chat.
export function budgetLine(b) {
  const name = CATEGORIES[b.cat];
  if (b.status === "over") return `${name}: te has pasado ${euros(-b.left)} del presupuesto (${euros(b.limit)}).`;
  return `${name}: llevas ${euros(b.spent)} de ${euros(b.limit)} (${b.pct} %), te quedan ${euros(b.left)}.`;
}

// Category from what Manu says: «comida», «súper», «ocio nocturno», «gasolina»…
const ALIASES = {
  FOOD_AND_DRINK: ["comer", "comida", "comer fuera", "bares", "restaurantes", "comer y beber"],
  GROCERIES: ["super", "supermercado", "compra", "la compra"],
  TRANSPORT: ["transporte", "gasolina", "coche", "bus"],
  SUBSCRIPTIONS: ["suscripciones", "suscripcion"],
  LEISURE: ["ocio"],
  HOME: ["casa", "hogar"],
  HEALTH: ["salud", "farmacia"],
  SHOPPING: ["compras", "ropa"],
  NIGHTLIFE: ["ocio nocturno", "fiesta", "salir", "copas"],
  TOBACCO: ["tabaco"],
  TRAVEL: ["viajes", "viaje"],
  SERVICES: ["servicios"],
  OTHER: ["otros"],
};
export function categoryFromText(text) {
  const t = normalise(text);
  let best = null;
  for (const [cat, words] of Object.entries(ALIASES)) for (const w of [...words, normalise(CATEGORIES[cat])]) {
    if (new RegExp(`(^|\\s)${w}(\\s|$)`).test(t) && (!best || w.length > best.len)) best = { cat, len: w.length };
  }
  return best?.cat ?? null;
}

// «pon un presupuesto de 200 € para comida», «presupuesto de ocio 80»,
// «quita el presupuesto de tabaco». Returns null when it is not a budget order.
export function budgetCommand(text) {
  const t = normalise(text);
  if (!/\bpresupuesto\b/.test(t)) return null;
  if (/^(como|que tal|cuanto) /.test(t) || /\?$/.test(String(text).trim())) return { kind: "ask" };
  const cat = categoryFromText(t.replace(/\bpresupuesto\b/g, " "));
  if (/^(quita|elimina|borra|sin)\b/.test(t)) return cat ? { kind: "remove", cat } : null;
  const m = t.match(/(\d{1,6})(?:[.,](\d{1,2}))?\s*(?:€|euros?)?/);
  if (!m || !cat) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
  return cents > 0 ? { kind: "set", cat, cents } : null;
}
