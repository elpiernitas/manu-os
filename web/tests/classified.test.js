// ChatGPT Excel «Gastos clasificados» sheet (invented rows, same layout).
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifiedFromRows, dropCrossSource, importStatementRows } from "../core/bank.js";
import { applyRules } from "../core/money.js";

const sheet = [
  ["Gastos clasificados"], [], [],
  ["Fecha", "Comercio normalizado", "Concepto original", "Gasto (€)", "Categoría", "Subcategoría", "Etiquetas", "Confianza", "Revisar", "Criterio / evidencia"],
  [46294, "Bar Ejemplo", "COMPRA TARJ. BAR EJEMPLO", 12.5, "Ocio nocturno", "Copas", "", "Alta", "No", ""],
  [46294, "Bar Ejemplo", "COMPRA TARJ. BAR EJEMPLO", 12.5, "Ocio nocturno", "Copas", "", "Alta", "No", ""],
  [46293, "Tienda Ejemplo", "COMPRA TIENDA EJEMPLO", 30, "Compras", "", "", "Media", "Sí", ""],
  ["", "", "", "", "", "", "", "", "", ""],
  ["no es fecha", "x", "x", 1, "Compras", "", "", "", "No", ""],
];

test("classified sheet becomes rule-based expenses, with review flags", () => {
  const r = classifiedFromRows(sheet);
  assert.equal(r.entries.length, 3);
  assert.equal(r.skipped, 1);
  const [a, b, c] = r.entries;
  assert.deepEqual([a.cents, a.category, a.sub, a.ruled, a.inferred, a.source], [1250, "NIGHTLIFE", "Copas", true, false, "CHATGPT"]);
  assert.notEqual(a.id, b.id, "two identical purchases are both kept");
  assert.deepEqual([c.category, c.review, c.inferred], ["SHOPPING", true, true]);
  assert.equal(a.at.slice(0, 10), "2026-09-29"); // Excel serial 46294
});

test("re-importing the sheet adds nothing; Manu's own rule wins", () => {
  const first = classifiedFromRows(sheet);
  const again = classifiedFromRows(sheet, first.entries);
  assert.deepEqual([again.entries.length, again.duplicates], [0, 3]);
  const mine = classifiedFromRows(sheet, [], { "bar ejemplo": "FOOD_AND_DRINK" });
  assert.equal(mine.entries[0].category, "FOOD_AND_DRINK");
  // Sheet categories are proposals: a later rule version still applies.
  assert.equal(applyRules(first.entries, { "bar ejemplo": { category: "LEISURE" } }).entries[0].category, "LEISURE");
});

test("bank file and ChatGPT sheet never double-count the same statement", () => {
  const bankRows = [["Fecha", "Concepto", "Importe", "Saldo"], ["29/09/2026", "COMPRA TARJ. BAR EJEMPLO", "-12,50", "100"], ["29/09/2026", "COMPRA TARJ. BAR EJEMPLO", "-12,50", "87,5"], ["28/09/2026", "COMPRA TIENDA EJEMPLO", "-30,00", "112,50"], ["28/09/2026", "OTRA COSA", "-5,00", "142,50"]];
  const bank = importStatementRows(bankRows).entries;
  // ChatGPT sheet after the bank file: nothing new.
  const afterBank = classifiedFromRows(sheet, bank);
  assert.deepEqual([afterBank.entries.length, afterBank.duplicates], [0, 3]);
  // Bank file after the ChatGPT sheet: only the line ChatGPT did not have.
  const gpt = classifiedFromRows(sheet).entries;
  const cross = dropCrossSource(bank, gpt, "CHATGPT");
  assert.deepEqual([cross.entries.length, cross.duplicates], [1, 3]);
  assert.equal(cross.entries[0].merchant, "OTRA COSA");
});
