import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { importStatementRows, parseDate } from "../core/bank.js";

// Loads the vendored SheetJS build exactly as the browser does (a global XLSX).
function loadXlsx() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL("../vendor/xlsx.full.min.js", import.meta.url), "utf8"), ctx);
  return ctx.XLSX;
}

test("Sabadell .xls (BIFF, synthetic data): expenses and income imported apart, header found after preamble", () => {
  const XLSX = loadXlsx();
  const wb = XLSX.read(fs.readFileSync(new URL("./fixtures-sabadell-ejemplo.xls", import.meta.url)), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
  const r = importStatementRows(rows);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.entries.map((e) => [e.merchant, e.cents, e.category]), [
    ["COMPRA TARJ. SUPERMERCADO EJEMPLO", 3450, "GROCERIES"],
    ["CARGO SPOTIFY EJEMPLO", 1199, "SUBSCRIPTIONS"],
  ]);
  assert.equal(r.income.length, 1, "income kept apart from expenses (WEB-21)");
  assert.ok(r.balance && Number.isInteger(r.balance.cents));
  assert.ok(r.entries[0].at.startsWith("2026-09-2"));
  const again = importStatementRows(rows, new Set(r.entries.map((e) => e.id)));
  assert.equal(again.entries.length, 0);
  const again2 = importStatementRows(rows, new Set([...r.entries, ...r.income].map((e) => e.id)));
  assert.deepEqual([again2.income.length, again2.incomeDuplicates], [0, 1]);
  assert.equal(again.duplicates, 2);
});

test("Excel serial dates and float amounts from spreadsheets", () => {
  assert.ok(parseDate(46293).startsWith("2026-09-2")); // 2026-09-28 as an Excel serial
  const r = importStatementRows([["Fecha", "Concepto", "Importe"], [46293, "Bar", -2.3000000000000003]]);
  assert.equal(r.entries[0].cents, 230);
});
