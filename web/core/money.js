import { words } from "./text.js";

// Amounts are integer cents: never floats for money.
export const CATEGORIES = {
  FOOD_AND_DRINK: "Comer y beber",
  GROCERIES: "Supermercado",
  TRANSPORT: "Transporte",
  SUBSCRIPTIONS: "Suscripciones",
  LEISURE: "Ocio",
  HOME: "Casa",
  HEALTH: "Salud",
  OTHER: "Otros",
};

const RULES = [
  ["SUBSCRIPTIONS", ["netflix", "spotify", "hbo", "disney", "prime", "icloud", "suscripcion"]],
  ["GROCERIES", ["mercadona", "carrefour", "lidl", "alcampo", "eroski", "dia", "supermercado", "super"]],
  ["TRANSPORT", ["gasolina", "gasolinera", "repsol", "cepsa", "bus", "tren", "renfe", "taxi", "parking", "peaje"]],
  ["FOOD_AND_DRINK", ["cafe", "bar", "restaurante", "cena", "comida", "desayuno", "pizza", "burger", "cerveza"]],
  ["LEISURE", ["cine", "concierto", "entradas", "libro", "juego"]],
  ["HEALTH", ["farmacia", "medico", "dentista", "fisio"]],
  ["HOME", ["luz", "agua", "alquiler", "ikea", "internet"]],
];

export function categorise(merchant) {
  if (!merchant) return "OTHER";
  const set = new Set(words(merchant));
  for (const [category, keys] of RULES) {
    if (keys.some((k) => set.has(k))) return category;
  }
  return "OTHER";
}

// "12", "12,5", "12.50" -> cents. Returns null for anything else or <= 0.
export function toCents(text) {
  const m = String(text).trim().match(/^(\d{1,7})(?:[.,](\d{1,2}))?$/);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

export function euros(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${whole},${String(abs % 100).padStart(2, "0")} €`;
}

export function newEntry({ id, cents, merchant, at }) {
  return { id, cents, merchant: merchant ?? null, at, category: categorise(merchant), inferred: true };
}

export function correctCategory(entry, category) {
  if (!(category in CATEGORIES)) throw new Error(`Unknown category ${category}`);
  return { ...entry, category, inferred: false };
}

// Totals for entries with start <= at < end (ISO strings or Dates).
export function summary(entries, start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const byCategory = {};
  let total = 0;
  for (const entry of entries) {
    const t = new Date(entry.at).getTime();
    if (t < s || t >= e) continue;
    total += entry.cents;
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + entry.cents;
  }
  return { total, byCategory };
}
