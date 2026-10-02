// Gastos compartidos (WEB-80), «like Tricount»: when Manu pays at a bar, MANU
// asks who he was with and what each one had, and keeps who still owes him.
// Pure: entries in, balances out.
//
// entry.split = {
//   mode: "equal" | "detail",
//   people: [{ key, name, googleId?, cents, what?, paid: bool, paidAt? }],  // what each one owes Manu
//   mine: cents,                                                             // Manu's own part
// }
// `key` is the person's id in Personas (created from Google Contacts when picked there).

export const SOCIAL = new Set(["FOOD_AND_DRINK", "NIGHTLIFE", "LEISURE"]);
const MIN_CENTS = 300; // a coffee alone is not worth asking about

// Recent bar/restaurant spends that were never asked about (newest first).
export function toAsk(spending, now = new Date(), days = 7) {
  const from = now.getTime() - days * 86400000;
  return (spending ?? [])
    .filter((e) => e && !e.split && !e.splitAsked && SOCIAL.has(e.category) && e.cents >= MIN_CENTS && Date.parse(e.at) >= from && Date.parse(e.at) <= now.getTime() + 60000)
    .sort((a, b) => b.at.localeCompare(a.at));
}

// Equal parts; the odd cents stay with Manu (he paid).
export function equalSplit(cents, others) {
  const n = others.length + 1;
  const each = Math.floor(cents / n);
  return { mode: "equal", mine: cents - each * others.length, people: others.map((p) => ({ ...p, cents: each, paid: false })) };
}

// Each one what they had. Whatever is not assigned is Manu's.
export function detailSplit(cents, parts) {
  const people = parts.filter((p) => Number.isInteger(p.cents) && p.cents > 0).map((p) => ({ ...p, what: p.what ? String(p.what).slice(0, 60) : undefined, paid: false }));
  const owed = people.reduce((s, p) => s + p.cents, 0);
  if (owed > cents) throw new Error(`Lo repartido (${(owed / 100).toFixed(2).replace(".", ",")} €) es más que el gasto.`);
  return { mode: "detail", mine: cents - owed, people };
}

export function markPaid(entry, key, paid = true, now = new Date()) {
  if (!entry.split) return entry;
  return { ...entry, split: { ...entry.split, people: entry.split.people.map((p) => (p.key === key ? { ...p, paid, ...(paid ? { paidAt: now.toISOString() } : { paidAt: undefined }) } : p)) } };
}

/**
 * Who owes Manu, summed per person (unpaid only), biggest first.
 * @returns {Array<{ key, name, cents, items: Array<{ entryId, merchant, at, cents, what }> }>}
 */
export function debts(spending) {
  const by = new Map();
  for (const e of spending ?? []) {
    for (const p of e?.split?.people ?? []) {
      if (p.paid || !(p.cents > 0)) continue;
      const d = by.get(p.key) ?? { key: p.key, name: p.name, googleId: p.googleId ?? null, cents: 0, items: [] };
      d.cents += p.cents;
      d.items.push({ entryId: e.id, merchant: e.merchant ?? "", at: e.at, cents: p.cents, what: p.what ?? null });
      by.set(p.key, d);
    }
  }
  return [...by.values()].sort((a, b) => b.cents - a.cents);
}

// Settle everything a person owes.
export function settleAll(spending, key, now = new Date()) {
  return (spending ?? []).map((e) => (e?.split?.people?.some((p) => p.key === key && !p.paid) ? markPaid(e, key, true, now) : e));
}

const eur = (c) => `${(c / 100).toFixed(2).replace(".", ",")} €`;

// «Ana te debe 7,50 € (Bar Pepe: 2 cañas).»
export function debtLine(d) {
  const first = d.name.split(" ")[0];
  const what = d.items.slice(0, 2).map((i) => `${i.merchant || "gasto"}${i.what ? `: ${i.what}` : ""}`).join("; ");
  return `${first} te debe ${eur(d.cents)}${what ? ` (${what}${d.items.length > 2 ? "…" : ""})` : ""}.`;
}

// Text for a friendly reminder (WhatsApp).
export function reminderText(d) {
  const first = d.name.split(" ")[0];
  const list = d.items.map((i) => `· ${new Date(i.at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} ${i.merchant || "gasto"}${i.what ? ` (${i.what})` : ""}: ${eur(i.cents)}`).join("\n");
  return `¡Hola, ${first}! Te paso lo que quedó pendiente:\n${list}\nTotal: ${eur(d.cents)}. ¡Gracias!`;
}
