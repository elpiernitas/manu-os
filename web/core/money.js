import { normalise } from "./text.js";

// Amounts are integer cents: never floats for money.
export const CATEGORIES = {
  FOOD_AND_DRINK: "Comer y beber",
  GROCERIES: "Supermercado",
  TRANSPORT: "Transporte",
  SUBSCRIPTIONS: "Suscripciones",
  LEISURE: "Ocio",
  HOME: "Casa",
  HEALTH: "Salud",
  SHOPPING: "Compras",
  TRANSFERS: "Bizum y transferencias",
  CASH: "Efectivo",
  NIGHTLIFE: "Ocio nocturno",
  TOBACCO: "Tabaco",
  TRAVEL: "Viajes",
  SERVICES: "Servicios",
  FINANCE: "Finanzas",
  ADMIN: "Administración",
  DONATIONS: "Donaciones",
  OTHER: "Otros",
};

// Keywords are matched as whole words (or phrases) on the normalised text, so
// "super" does not match "superior". Order matters: first match wins.
const RULES = [
  ["TRANSFERS", ["bizum", "transferencia", "traspaso"]],
  ["CASH", ["reintegro", "cajero", "retirada efectivo"]],
  ["SUBSCRIPTIONS", ["netflix", "spotify", "hbo", "max", "disney", "prime video", "amazon prime", "icloud", "apple com", "google one", "youtube", "dazn", "suscripcion", "chatgpt", "openai", "claude"]],
  ["GROCERIES", ["mercadona", "carrefour", "lidl", "alcampo", "eroski", "dia", "supermercado", "super", "alimerka", "el arbol", "masymas", "froiz", "aldi", "hipercor", "gadis", "consum", "bm supermercados", "fruteria", "carniceria", "panaderia"]],
  ["TRANSPORT", ["gasolina", "gasolinera", "repsol", "cepsa", "galp", "bp", "shell", "petronor", "ballenoil", "plenoil", "bus", "emtusa", "alsa", "tren", "renfe", "taxi", "cabify", "uber", "parking", "aparcamiento", "peaje", "autopista", "itv", "taller"]],
  ["FOOD_AND_DRINK", ["cafe", "cafeteria", "bar", "sidreria", "restaurante", "cena", "comida", "desayuno", "pizza", "pizzeria", "telepizza", "burger", "burger king", "mcdonalds", "kfc", "cerveza", "glovo", "just eat", "uber eats", "tapas", "heladeria", "confiteria", "pasteleria", "pub"]],
  ["LEISURE", ["cine", "cines", "concierto", "entradas", "ticketmaster", "libro", "libreria", "juego", "steam", "playstation", "nintendo", "gimnasio", "gym", "piscina"]],
  ["HEALTH", ["farmacia", "medico", "dentista", "clinica", "fisio", "fisioterapia", "optica", "hospital"]],
  ["HOME", ["luz", "agua", "alquiler", "ikea", "internet", "orange", "movistar", "vodafone", "digi", "jazztel", "iberdrola", "endesa", "edp", "naturgy", "totalenergies", "leroy merlin", "bricomart", "seguro", "seguros", "comunidad"]],
  ["SHOPPING", ["amazon", "aliexpress", "shein", "zara", "primark", "decathlon", "el corte ingles", "mediamarkt", "pccomponentes", "fnac", "action", "normal", "tiger", "bershka", "pull bear", "h m", "temu"]],
];
const RULE_PATTERNS = RULES.map(([cat, keys]) => [cat, new RegExp(`(^|[^a-z0-9ñ])(${keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?=$|[^a-z0-9ñ])`)]);

// Stable key for a merchant in bank concepts: drops card/payment prefixes,
// numbers and dates, so "COMPRA TARJ. 5540XXXX LA TIENDA-GIJON" and next
// month's line share the same key.
const PREFIXES = /^(compra tarj\.?|compra tarjeta|compra|pago con tarjeta|pago|cargo|recibo|adeudo)\s+/;
export function merchantKey(merchant) {
  const t = normalise(merchant ?? "")
    .replace(/[0-9x*]{4,}/g, " ")
    .replace(/\d+([/.-]\d+)*/g, " ")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.replace(PREFIXES, "").trim().split(" ").slice(0, 4).join(" ") || null;
}

// A learned rule is either a category id (Manu's correction) or
// { category, sub, ask } (imported rules). Unknown categories are ignored.
export function ruleFor(merchant, learned = {}) {
  const key = merchantKey(merchant);
  const r = key ? learned[key] : null;
  if (!r) return null;
  const rule = typeof r === "string" ? { category: r } : r;
  return rule.category in CATEGORIES ? rule : null;
}

// Manu's own corrections win over the built-in rules. They are his decisions,
// never inferred facts (AGENTS.md).
export function categorise(merchant, learned = {}) {
  if (!merchant) return "OTHER";
  const rule = ruleFor(merchant, learned);
  if (rule) return rule.category;
  const text = normalise(merchant).replace(/[^a-z0-9ñ]+/g, " ");
  for (const [category, re] of RULE_PATTERNS) if (re.test(text)) return category;
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

export function newEntry({ id, cents, merchant, at }, learned = {}) {
  const rule = ruleFor(merchant, learned);
  const entry = { id, cents, merchant: merchant ?? null, at, category: categorise(merchant, learned), inferred: !rule || Boolean(rule.ask) };
  if (rule?.sub) entry.sub = rule.sub;
  if (rule?.ask) entry.review = true;
  return entry;
}

// Spanish category names (e.g. from the enriched Excel) -> ids.
const NAME_TO_ID = {
  "restauracion": "FOOD_AND_DRINK", "comer y beber": "FOOD_AND_DRINK",
  "alimentacion": "GROCERIES", "supermercado": "GROCERIES",
  "transporte": "TRANSPORT", "suscripciones": "SUBSCRIPTIONS", "digital": "SUBSCRIPTIONS",
  "ocio": "LEISURE", "ocio y cultura": "LEISURE", "casa": "HOME", "hogar": "HOME", "salud": "HEALTH",
  "compras": "SHOPPING", "transferencias": "TRANSFERS", "bizum y transferencias": "TRANSFERS", "efectivo": "CASH",
  "ocio nocturno": "NIGHTLIFE", "tabaco": "TOBACCO", "viajes": "TRAVEL", "servicios": "SERVICES",
  "finanzas": "FINANCE", "administracion": "ADMIN", "donaciones": "DONATIONS", "otros": "OTHER",
};
export const categoryId = (name) => NAME_TO_ID[normalise(name ?? "")] ?? null;

// Rows of the "Reglas MANU OS" sheet: header row with "Patrón / comercio",
// "Categoría", "Subcategoría", "¿Preguntar?". Returns { rules, skipped } or { error }.
export function rulesFromRows(rows) {
  const norm = (c) => normalise(String(c ?? ""));
  const h = (rows ?? []).findIndex((r) => (r ?? []).some((c) => norm(c).startsWith("patron")) && (r ?? []).some((c) => norm(c) === "categoria"));
  if (h < 0) return { error: "No encuentro la hoja de reglas (columnas «Patrón / comercio» y «Categoría»)." };
  const header = rows[h].map(norm);
  const col = (pred) => header.findIndex(pred);
  const cPat = col((c) => c.startsWith("patron")), cCat = col((c) => c === "categoria"), cSub = col((c) => c.startsWith("subcategoria")), cAsk = col((c) => c.includes("preguntar"));
  const rules = {};
  let skipped = 0;
  for (const r of rows.slice(h + 1)) {
    const key = merchantKey(r?.[cPat]);
    const category = categoryId(r?.[cCat]);
    if (!key || !category) { if (r?.some((c) => c !== null && c !== "")) skipped++; continue; }
    rules[key] = { category, ...(cSub >= 0 && r[cSub] ? { sub: String(r[cSub]).slice(0, 60) } : {}), ...(cAsk >= 0 && norm(r[cAsk]).startsWith("s") ? { ask: true } : {}) };
  }
  return { rules, skipped };
}

// Re-applies rules to entries that are still proposals; confirmed ones are kept.
export function applyRules(entries, learned) {
  let changed = 0;
  const next = entries.map((e) => {
    if (!e.inferred) return e;
    const rule = ruleFor(e.merchant, learned);
    if (!rule) return e;
    changed++;
    const { sub, review, ...rest } = e;
    return { ...rest, category: rule.category, inferred: Boolean(rule.ask), ...(rule.sub ? { sub: rule.sub } : {}), ...(rule.ask ? { review: true } : {}) };
  });
  return { entries: next, changed };
}

// Manu corrects one entry: remember the rule and apply it to every entry of
// the same merchant that is still only a proposal.
export function learnCategory(entries, learned, entryId, category) {
  if (!(category in CATEGORIES)) throw new Error(`Unknown category ${category}`);
  const target = entries.find((e) => e.id === entryId);
  if (!target) return { entries, learned, applied: 0 };
  const key = merchantKey(target.merchant);
  const nextLearned = key ? { ...learned, [key]: category } : learned;
  let applied = 0;
  const next = entries.map((e) => {
    if (e.id === entryId) { const { review, ...rest } = e; return { ...rest, category, inferred: false }; }
    if (key && e.inferred && merchantKey(e.merchant) === key) { applied++; const { review, ...rest } = e; return { ...rest, category, inferred: false }; }
    return e;
  });
  return { entries: next, learned: nextLearned, applied };
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
