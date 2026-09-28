import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { rulesFromRows, applyRules, newEntry, categoryId, learnCategory, CATEGORIES } from "../core/money.js";
import { importStatement } from "../core/bank.js";

function sheetRows(file, name) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL("../vendor/xlsx.full.min.js", import.meta.url), "utf8"), ctx);
  const wb = ctx.XLSX.read(fs.readFileSync(new URL(file, import.meta.url)), { type: "buffer" });
  return ctx.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" });
}

test("imports the enriched Excel rules sheet (synthetic fixture)", () => {
  const { rules, skipped, error } = rulesFromRows(sheetRows("./fixtures-reglas-ejemplo.xlsx", "Reglas MANU OS"));
  assert.equal(error, undefined);
  assert.deepEqual(rules["bar ejemplo nocturno"], { category: "NIGHTLIFE", sub: "Bar de copas/pub" });
  assert.deepEqual(rules["estanco ejemplo"], { category: "TOBACCO", sub: "Estanco" });
  assert.equal(rules["bizum a persona ejemplo"]?.ask, true);
  assert.equal(skipped, 1, "unknown category is skipped, not guessed");
  assert.ok(rulesFromRows([["hola"]]).error);
});

test("rules apply to proposals and future imports; Manu's confirmed entries are kept", () => {
  const { rules } = rulesFromRows(sheetRows("./fixtures-reglas-ejemplo.xlsx", "Reglas MANU OS"));
  const csv = "Fecha;Concepto;Importe;Saldo\n01/09/2026;COMPRA TARJ. BAR EJEMPLO NOCTURNO;-8,00;100\n02/09/2026;PAGO BIZUM A PERSONA EJEMPLO;-10,00;90\n03/09/2026;COMPRA TARJ. ESTANCO EJEMPLO;-5,00;85\n";
  const before = importStatement(csv).entries;
  const confirmed = learnCategory(before, {}, before[2].id, "SHOPPING").entries; // Manu decided the estanco line himself
  const { entries, changed } = applyRules(confirmed, rules);
  assert.equal(changed, 2);
  assert.equal(entries[0].category, "NIGHTLIFE");
  assert.equal(entries[0].sub, "Bar de copas/pub");
  assert.equal(entries[0].inferred, false);
  assert.equal(entries[1].category, "TRANSFERS");
  assert.equal(entries[1].review, true, "«¿Preguntar? = Sí» stays a proposal to review");
  assert.equal(entries[2].category, "SHOPPING", "confirmed by Manu: untouched");
  const later = importStatement("Fecha;Concepto;Importe;Saldo\n01/10/2026;COMPRA TARJ. ESTANCO EJEMPLO;-5,00;50\n", new Set(), rules).entries[0];
  assert.equal(later.category, "TOBACCO");
  assert.equal(later.inferred, false);
});

test("Spanish category names map to ids; every id has a title", () => {
  assert.equal(categoryId("Restauración"), "FOOD_AND_DRINK");
  assert.equal(categoryId("Ocio nocturno"), "NIGHTLIFE");
  assert.equal(categoryId("Nope"), null);
  for (const id of ["NIGHTLIFE", "TOBACCO", "TRAVEL", "SERVICES", "FINANCE", "ADMIN", "DONATIONS"]) assert.ok(CATEGORIES[id]);
  assert.equal(newEntry({ id: "x", cents: 1, merchant: "COMPRA TARJ. ESTANCO EJEMPLO", at: "t" }, { "estanco ejemplo": "NOPE" }).category, "OTHER");
});
