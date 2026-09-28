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

test("Sabadell .xls (BIFF, synthetic data): expenses imported, income skipped, header found after preamble", () => {
  const XLSX = loadXlsx();
  const wb = XLSX.read(fs.readFileSync(new URL("./fixtures-sabadell-ejemplo.xls", import.meta.url)), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
  const r = importStatementRows(rows);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.entries.map((e) => [e.merchant, e.cents, e.category]), [
    ["COMPRA TARJ. SUPERMERCADO EJEMPLO", 3450, "GROCERIES"],
    ["CARGO SPOTIFY EJEMPLO", 1199, "SUBSCRIPTIONS"],
  ]);
  assert.equal(r.skippedIncome, 1);
  assert.ok(r.entries[0].at.startsWith("2026-09-2"));
  const again = importStatementRows(rows, new Set(r.entries.map((e) => e.id)));
  assert.equal(again.entries.length, 0);
  assert.equal(again.duplicates, 2);
});

test("Excel serial dates and float amounts from spreadsheets", () => {
  assert.ok(parseDate(46293).startsWith("2026-09-2")); // 2026-09-28 as an Excel serial
  const r = importStatementRows([["Fecha", "Concepto", "Importe"], [46293, "Bar", -2.3000000000000003]]);
  assert.equal(r.entries[0].cents, 230);
});
