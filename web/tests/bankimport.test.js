// Importar movimientos de Sabadell (API) a Dinero. Datos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import { planImport, apiRows, importRange } from "../core/bankimport.js";

const tx = [
  { ref: "a", date: "2026-11-09", amount: "100.00", currency: "EUR", direction: "credit", description: "ABONO BIZUM DE PERSONA INVENTADA", status: "BOOK" },
  { ref: "b", date: "2026-11-08", amount: "12.50", currency: "EUR", direction: "debit", description: "CAFETERIA INVENTADA", status: "BOOK" },
  { ref: "c", date: "2026-11-08", amount: "12.50", currency: "EUR", direction: "debit", description: "CAFETERIA INVENTADA", status: "BOOK" },
  { ref: "d", date: "2026-11-09", amount: "5.00", currency: "EUR", direction: "debit", description: "PENDIENTE", status: "PDNG" },
  { ref: "e", date: "nope", amount: "1", direction: "debit", status: "BOOK" },
];
const empty = () => ({ spending: [], income: [], settings: {} });

test("debits become expenses, credits income; only booked; two identical coffees are two", () => {
  const p = planImport(tx, empty());
  assert.equal(p.entries.length, 2); assert.equal(p.income.length, 1);
  assert.deepEqual(p.entries.map((e) => e.cents), [1250, 1250]);
  assert.equal(p.income[0].cents, 10000);
  assert.ok(p.entries.every((e) => e.source === "SABADELL") && p.income[0].source === "SABADELL");
  assert.equal(p.pending, 1); assert.equal(p.invalid, 1);
  assert.notEqual(p.entries[0].id, p.entries[1].id);
});

test("importing again adds nothing; a third identical coffee later is added", () => {
  const v = empty(); const p = planImport(tx, v);
  v.spending.push(...p.entries); v.income.push(...p.income);
  const again = planImport(tx, v);
  assert.equal(again.entries.length + again.income.length, 0);
  assert.equal(again.duplicates + again.incomeDuplicates, 3);
  const more = planImport([...tx, { ...tx[1], ref: "f" }], v);
  assert.equal(more.entries.length, 1, "the new third coffee only");
});

test("lines already imported from the Excel statement (same day and amount) are not doubled", () => {
  const v = empty();
  v.spending.push({ id: "bank-xls-1", cents: 1250, at: "2026-11-08T12:00:00.000Z", merchant: "CAFETERIA", source: "BANK" });
  v.income.push({ id: "bank-xls-2", cents: 10000, at: "2026-11-09T12:00:00.000Z", concept: "BIZUM", source: "BANK" });
  const p = planImport(tx, v);
  assert.equal(p.entries.length, 1, "one of the two coffees was already in the Excel");
  assert.equal(p.income.length, 0);
});

test("the user's category rules apply; nothing goes to the memory; range is 90 days", () => {
  const v = { ...empty(), settings: { categoryRules: {} } };
  const p = planImport(tx, v);
  assert.ok(p.entries.every((e) => typeof e.category === "string" || e.category === undefined || e.category === null));
  assert.ok(!("brain" in p));
  const r = importRange(new Date("2026-11-09T12:00:00Z"));
  assert.deepEqual(r, { from: "2026-08-12", to: "2026-11-09" });
  assert.equal(apiRows([]).rows.length, 1);
});
