// Importar los movimientos leídos de Sabadell (Enable Banking) a Dinero, cuando Manu lo pide.
// Reutiliza el importador del extracto (bank.js): mismas reglas de categoría, mismos ids
// estables (no se duplica al repetir) y separación de gastos e ingresos. Solo movimientos
// contabilizados (BOOK): los pendientes pueden cambiar o desaparecer. Va a Dinero, nunca a
// la memoria. Pura, sin red.
import { importStatementRows, dropCrossSource } from "./bank.js";

export const SOURCE = "SABADELL";
export const DAYS = 90;

/** Rows in the statement format (Fecha, Concepto, Importe con signo) from the API view. */
export function apiRows(transactions = []) {
  const rows = [["Fecha", "Concepto", "Importe"]];
  let pending = 0, invalid = 0;
  for (const t of transactions) {
    if (t?.status && t.status !== "BOOK") { pending++; continue; }
    const n = Number(String(t?.amount ?? "").replace(",", "."));
    if (!/^\d{4}-\d{2}-\d{2}/.test(t?.date ?? "") || !Number.isFinite(n) || n === 0 || (t.direction !== "credit" && t.direction !== "debit")) { invalid++; continue; }
    const signed = t.direction === "debit" ? -Math.abs(n) : Math.abs(n);
    rows.push([t.date.slice(0, 10), String(t.description ?? "").slice(0, 80), signed.toFixed(2)]);
  }
  return { rows, pending, invalid };
}

/**
 * What to add to the vault. `vault` = { spending, income, settings }.
 * Duplicates: same line already imported from the API (stable id), or the same day and amount
 * already there from the Excel statement, ChatGPT or Apple Pay.
 */
export function planImport(transactions, vault) {
  const { rows, pending, invalid } = apiRows(transactions);
  const ids = new Set([...(vault.spending ?? []), ...(vault.income ?? [])].map((x) => x.id));
  const r = importStatementRows(rows, ids, vault.settings?.categoryRules ?? {});
  if (r.error) return { error: r.error };
  let entries = r.entries.map((e) => ({ ...e, source: SOURCE }));
  let duplicates = r.duplicates;
  for (const src of ["BANK", "CHATGPT", "APPLEPAY"]) { const d = dropCrossSource(entries, vault.spending ?? [], src); entries = d.entries; duplicates += d.duplicates; }
  const incomeAll = r.income.map((i) => ({ ...i, source: SOURCE }));
  const inc = dropCrossSource(incomeAll, vault.income ?? [], "BANK");
  return { entries, income: inc.entries, duplicates, incomeDuplicates: r.incomeDuplicates + inc.duplicates, pending, invalid: invalid + r.skippedInvalid };
}

export function importRange(now = new Date()) {
  const to = new Date(now), from = new Date(now);
  from.setDate(from.getDate() - (DAYS - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}
