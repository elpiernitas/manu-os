import { test } from "node:test";
import assert from "node:assert/strict";
import { incomeKind } from "../core/bank.js";
import { markPayroll, monthStats, monthlySeries } from "../core/insights.js";
import { validateVault, emptyVault } from "../core/storage.js";

const at = (d) => `${d}T12:00:00.000Z`;
const exp = (id, d, cents, merchant) => ({ id, at: at(d), cents, merchant, category: "OTHER" });
const inc = (id, d, cents, concept, kind = incomeKind(concept)) => ({ id, at: at(d), cents, concept, kind, source: "BANK" });

test("income kinds from the bank concept", () => {
  assert.equal(incomeKind("TRANSFERENCIA NOMINA EMPRESA EJEMPLO"), "PAYROLL");
  assert.equal(incomeKind("BIZUM DE PERSONA EJEMPLO"), "BIZUM");
  assert.equal(incomeKind("DEVOLUCION COMPRA TIENDA"), "REFUND");
  assert.equal(incomeKind("TRANSFERENCIA DE OTRA CUENTA"), "TRANSFER");
  assert.equal(incomeKind("INGRESO EFECTIVO"), "OTHER");
  assert.equal(incomeKind("ABONO BIZUM DE PERSONA EJEMPLO"), "BIZUM", "Sabadell writes received Bizums as «ABONO BIZUM»");
  assert.equal(incomeKind("ABONO INTERESES"), "OTHER");
});

test("payroll without the word «nómina»: same payer, ≥ 600 €, two months", () => {
  const list = [inc("a", "2026-08-28", 150000, "TRANSF EMPRESA EJEMPLO SL"), inc("b", "2026-09-28", 152000, "TRANSF EMPRESA EJEMPLO SL"), inc("c", "2026-09-10", 2000, "BIZUM AMIGO")];
  const marked = markPayroll(list);
  assert.deepEqual(marked.map((e) => Boolean(e.payroll)), [true, true, false]);
  assert.equal(markPayroll([list[0]])[0].payroll, undefined, "one month is not enough");
});

test("month statistics: income, spending, saving, comparison, projection, top merchants", () => {
  const spending = [exp("s1", "2026-08-05", 10000, "SUPER EJEMPLO"), exp("s2", "2026-09-02", 20000, "SUPER EJEMPLO"), exp("s3", "2026-09-03", 5000, "BAR EJEMPLO"), exp("s4", "2026-09-04", 15000, "SUPER EJEMPLO")];
  const income = [inc("i1", "2026-09-01", 150000, "NOMINA EMPRESA"), inc("i2", "2026-09-12", 3000, "BIZUM AMIGO"), inc("i0", "2026-08-01", 150000, "NOMINA EMPRESA")];
  const s = monthStats(spending, income, "2026-09", new Date(2026, 8, 10, 12));
  assert.equal(s.spent, 40000);
  assert.equal(s.earned, 153000);
  assert.equal(s.saved, 113000);
  assert.equal(s.savingRate, 74);
  assert.deepEqual(s.payroll, { cents: 150000, days: [1] });
  assert.equal(s.spentDelta, 300); // 400 € vs 100 €
  assert.equal(s.avgDaily, 4000); // 400 € / 10 days
  assert.equal(s.projection, 120000); // 30 days
  assert.deepEqual(s.topMerchants[0], { name: "SUPER EJEMPLO", cents: 35000, count: 2 });
  assert.equal(s.biggest.id, "s2");
  assert.deepEqual(s.incomeByKind, [["PAYROLL", 150000], ["BIZUM", 3000]]);
  const past = monthStats(spending, income, "2026-08", new Date(2026, 8, 10));
  assert.equal(past.projection, null);
  const series = monthlySeries(spending, income, 3, new Date(2026, 8, 10));
  assert.deepEqual(series.map((m) => [m.key, m.spent, m.earned]), [["2026-07", 0, 0], ["2026-08", 10000, 150000], ["2026-09", 40000, 153000]]);
});

test("vault keeps income and rejects broken income entries", () => {
  const v = { ...emptyVault(), income: [{ id: "i1", cents: 100, at: at("2026-09-01") }] };
  assert.equal(validateVault(v).ok, true);
  assert.equal(validateVault({ ...v, income: [{ id: "i1", cents: -5, at: at("2026-09-01") }] }).ok, false);
  assert.deepEqual(validateVault({ ...emptyVault(), income: undefined }).vault.income, []);
});

test("WEB-88: the month in course is compared with the same days of the last one", () => {
  const spending = [exp("p1", "2026-09-03", 1000, "A"), exp("p2", "2026-09-20", 50000, "B"), exp("c1", "2026-10-02", 2000, "C")];
  const s = monthStats(spending, [], "2026-10", new Date(2026, 9, 5, 12));
  assert.equal(s.spentDelta, 100, "20 € vs 10 € on 1–5 September, not vs the whole 510 €");
  assert.equal(s.prevSpent, 51000, "the whole previous month is still there");
  const empty = monthStats([exp("p1", "2026-09-20", 5000, "A")], [], "2026-10", new Date(2026, 9, 5, 12));
  assert.equal(empty.spentDelta, null, "nothing to compare on the same days");
});
