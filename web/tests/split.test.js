import test from "node:test";
import assert from "node:assert/strict";
import { toAsk, equalSplit, detailSplit, markPaid, debts, settleAll, debtLine, reminderText } from "../core/split.js";
import { buildBankShotsPayload, parseBankShots, alreadyThere } from "../core/bankshot.js";
import { categorise } from "../core/money.js";

const now = new Date(2026, 9, 2, 20);
const ana = { key: "p1", name: "Ana García", googleId: "people/1" }, luis = { key: "p2", name: "Luis" };

test("WEB-80: which spends to ask about (bars, recent, not asked)", () => {
  const sp = [
    { id: "a", cents: 1250, category: "FOOD_AND_DRINK", at: "2026-10-02T17:00:00Z", merchant: "Bar Pepe" },
    { id: "b", cents: 150, category: "FOOD_AND_DRINK", at: "2026-10-02T09:00:00Z" }, // a coffee alone
    { id: "c", cents: 3000, category: "GROCERIES", at: "2026-10-02T10:00:00Z" },
    { id: "d", cents: 4000, category: "NIGHTLIFE", at: "2026-09-20T23:00:00Z" }, // too old
    { id: "e", cents: 2000, category: "NIGHTLIFE", at: "2026-10-01T23:00:00Z", splitAsked: true },
    { id: "f", cents: 2000, category: "NIGHTLIFE", at: "2026-10-01T22:00:00Z" },
  ];
  assert.deepEqual(toAsk(sp, now).map((x) => x.id), ["a", "f"]);
  assert.equal(categorise("BAR PEPE"), "FOOD_AND_DRINK");
});

test("WEB-80: equal parts and «what each one had»", () => {
  const eq = equalSplit(1000, [ana, luis]);
  assert.deepEqual(eq.people.map((p) => p.cents), [333, 333]);
  assert.equal(eq.mine, 334); // odd cents stay with Manu
  const det = detailSplit(1250, [{ ...ana, cents: 450, what: "2 cañas y una tapa" }, { ...luis, cents: 0 }]);
  assert.equal(det.people.length, 1);
  assert.equal(det.mine, 800);
  assert.equal(det.people[0].what, "2 cañas y una tapa");
  assert.throws(() => detailSplit(500, [{ ...ana, cents: 600 }]), /más que el gasto/);
});

test("WEB-80: who owes Manu, and paying back", () => {
  let sp = [
    { id: "a", cents: 1250, merchant: "Bar Pepe", at: "2026-10-02T17:00:00Z", split: detailSplit(1250, [{ ...ana, cents: 450, what: "2 cañas" }, { ...luis, cents: 400 }]) },
    { id: "b", cents: 3000, merchant: "Sidrería", at: "2026-10-01T20:00:00Z", split: equalSplit(3000, [ana]) },
  ];
  let d = debts(sp);
  assert.deepEqual(d.map((x) => [x.key, x.cents]), [["p1", 1950], ["p2", 400]]);
  assert.equal(debtLine(d[0]), "Ana te debe 19,50 € (Bar Pepe: 2 cañas; Sidrería).");
  assert.match(reminderText(d[0]), /Total: 19,50 €/);
  sp = [markPaid(sp[0], "p2", true, now), sp[1]];
  assert.deepEqual(debts(sp).map((x) => x.key), ["p1"]);
  sp = settleAll(sp, "p1", now);
  assert.deepEqual(debts(sp), []);
  assert.ok(sp[1].split.people[0].paidAt);
});

test("WEB-80: bank screenshots → movements to review", () => {
  const p = buildBankShotsPayload(["AAA", "BBB"], now);
  assert.equal(p.generationConfig.responseMimeType, "application/json");
  assert.equal(p.contents[0].parts.filter((x) => x.inlineData).length, 2);
  assert.throws(() => buildBankShotsPayload([], now));
  const reply = JSON.stringify([
    { fecha: "2026-10-01", concepto: "BAR PEPE GIJON", importe: -12.5 },
    { fecha: "2026-10-01", concepto: "NOMINA RK", importe: "1.234,56" },
    { fecha: "2026-10-01", concepto: "BAR PEPE GIJON", importe: -12.5 }, // overlapping screenshot
    { fecha: "2026-12-24", concepto: "futuro", importe: -5 },
    { fecha: "2026-10-01", concepto: "", importe: -3 },
    { fecha: "ayer", concepto: "x", importe: -3 },
    { fecha: "2026-09-30", concepto: "Bizum de Ana", importe: 7.5 },
  ]);
  const m = parseBankShots("```json\n" + reply + "\n```", now);
  assert.equal(m.length, 3);
  assert.deepEqual(m.map((x) => [x.concept, x.cents, x.income]), [["BAR PEPE GIJON", 1250, false], ["NOMINA RK", 123456, true], ["Bizum de Ana", 750, true]]);
  assert.equal(m[1].kind, "PAYROLL");
  assert.deepEqual(parseBankShots("no es json", now), []);
  assert.ok(alreadyThere(m[0], [{ cents: 1250, at: "2026-10-01T10:00:00.000Z" }], []));
  assert.ok(!alreadyThere(m[0], [{ cents: 1250, at: "2026-10-02T10:00:00.000Z" }], []));
});
