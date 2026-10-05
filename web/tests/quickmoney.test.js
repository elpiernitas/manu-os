import test from "node:test";
import assert from "node:assert/strict";
import { cleanConcept, QUICK_SPEND, QUICK_INCOME, quickSpendCategory, quickIncomeKind, fixedIncomeStatus, commonSpends, recurringIncome } from "../core/quickmoney.js";
import { parseLine, applyBuzon, buzonSummary } from "../core/buzon.js";
import { newEntry } from "../core/money.js";
import { INBOX_SQL, newInboxToken, registerInboxToken, pullInbox, deleteInbox, inboxRequest } from "../core/sync.js";

const now = new Date(2026, 9, 3, 22);

test("WEB-86: the Shortcut's menus map to MANU", () => {
  assert.equal(quickSpendCategory("bar"), "FOOD_AND_DRINK");
  assert.equal(quickSpendCategory("Discoteca"), "NIGHTLIFE");
  assert.equal(quickSpendCategory("Supermercado"), "GROCERIES");
  assert.equal(quickSpendCategory("nada"), null);
  assert.equal(quickIncomeKind("Nómina"), "PAYROLL");
  assert.equal(quickIncomeKind("manutencion"), "FAMILY");
  assert.ok(QUICK_SPEND.length >= 10 && QUICK_INCOME.length >= 4);
});

test("WEB-86: Shortcut lines → gasto with its category, ingreso with its kind", () => {
  const g = parseLine("gasto|2026-10-03 21:40|12,50|Bar|cañas con Ana", now);
  assert.deepEqual([g.kind, g.cents, g.category, g.merchant], ["expense", 1250, "FOOD_AND_DRINK", "cañas con Ana"]);
  const g2 = parseLine("gasto|2026-10-03 21:40|9|Discoteca|", now);
  assert.equal(g2.merchant, "Discoteca");
  const i = parseLine("ingreso|2026-10-01 09:00|300|Manutención|papá", now);
  assert.deepEqual([i.kind, i.cents, i.incomeKind, i.concept], ["income", 30000, "FAMILY", "Manutención · papá"]);
  assert.equal(parseLine("ingreso|2026-10-01 09:00|675,70|Nómina|", now).incomeKind, "PAYROLL");
  const r = applyBuzon("gasto|2026-10-03 21:40|12,50|Bar|cañas\ningreso|2026-10-01 09:00|300|Manutención|\ngasto|2026-10-03 21:40|12,50|Bar|cañas", { settings: {}, health: [], places: [] }, { now, newEntry: (e) => newEntry(e, {}) });
  assert.equal(r.spending.length, 1);
  assert.equal(r.spending[0].category, "FOOD_AND_DRINK");
  assert.equal(r.spending[0].review, undefined);
  assert.equal(r.income[0].kind, "FAMILY");
  assert.equal(buzonSummary(r), "1 gasto y 1 ingreso · 1 ya estaban");
});

test("WEB-86: fixed incomes this month", () => {
  const fixed = [{ id: "f1", name: "Nómina", cents: 67570, day: 28 }, { id: "f2", name: "Manutención", cents: 30000, day: 1 }, { id: "f3", name: "Abuelo", cents: 40000, day: 5 }];
  const income = [{ id: "i1", cents: 30000, concept: "TRANSFERENCIA", at: "2026-10-01T10:00:00Z" }, { id: "i2", cents: 40000, concept: "x", at: "2026-09-05T10:00:00Z" }];
  const st = fixedIncomeStatus(fixed, income, now);
  assert.deepEqual(st.map((x) => [x.f.id, Boolean(x.got), x.due]), [["f1", false, false], ["f2", true, false], ["f3", false, false]]);
  const later = fixedIncomeStatus(fixed, income, new Date(2026, 9, 6));
  assert.equal(later[2].due, true); // the grandfather's did not come yet
  assert.equal(fixedIncomeStatus([{ id: "f", name: "Abuelo", cents: 40000, day: 5 }], [{ id: "x", cents: 39000, concept: "Bizum del abuelo", at: "2026-10-05T10:00:00Z" }], new Date(2026, 9, 6))[0].got.id, "x"); // by name
});

test("WEB-86: what repeats", () => {
  const sp = [
    ...Array.from({ length: 5 }, (_, i) => ({ cents: 250, merchant: "Bar", category: "FOOD_AND_DRINK", at: new Date(2026, 9, 1 - i * 3).toISOString() })),
    ...Array.from({ length: 3 }, (_, i) => ({ cents: 4000, merchant: "Mercadona", category: "GROCERIES", at: new Date(2026, 8, 20 - i * 7).toISOString() })),
    { cents: 9000, merchant: "Concierto", category: "LEISURE", at: new Date(2026, 8, 10).toISOString() },
  ];
  const c = commonSpends(sp, now);
  assert.deepEqual(c.map((x) => [x.label, x.count, x.avg]), [["Bar", 5, 250], ["Mercadona", 3, 4000]]);
  const inc = [1, 2, 3].map((k) => ({ cents: 30000, concept: "Manutención", at: new Date(2026, 6 + k, 1, 10).toISOString() }));
  assert.equal(recurringIncome(inc, now)[0].merchant, "Manutención");
});

test("WEB-86: cloud inbox for the Shortcut", async () => {
  assert.match(INBOX_SQL, /enable row level security/);
  assert.match(INBOX_SQL, /grant insert \(token, line\) on public.manu_inbox to anon/);
  assert.doesNotMatch(INBOX_SQL, /grant select[^;]*to anon/);
  const t = newInboxToken({ getRandomValues: (b) => b.fill(7) });
  assert.match(t, /^[A-Za-z0-9_-]{32}$/);
  const cfg = { url: "https://x.supabase.co", key: "sb_publishable_x" };
  const req = inboxRequest(cfg, t, "gasto|2026-10-03 21:40|12,50|Bar|");
  assert.equal(req.url, "https://x.supabase.co/rest/v1/manu_inbox");
  assert.equal(req.headers.Authorization, undefined); // the Shortcut never carries Manu's session
  const calls = [];
  const f = (status, body) => async (url, init) => { calls.push({ url, init }); return { ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }; };
  const s = { access: "A" };
  assert.ok(await registerInboxToken(cfg, s, t, f(201, {})));
  assert.match(calls[0].url, /manu_inbox_owner\?on_conflict=user_id/);
  assert.deepEqual(await pullInbox(cfg, s, f(200, [{ id: "11111111-1111-1111-1111-111111111111", line: "x" }])), [{ id: "11111111-1111-1111-1111-111111111111", line: "x" }]);
  await assert.rejects(pullInbox(cfg, s, f(404, { code: "PGRST205", message: "Could not find the table 'public.manu_inbox'" })), (e) => e.code === "inbox");
  await deleteInbox(cfg, s, ["11111111-1111-1111-1111-111111111111", "1; drop"], f(204, {}));
  assert.match(calls.at(-1).url, /id=in\.\(11111111-1111-1111-1111-111111111111\)$/);
});

test("WEB-88: bank concepts keep only the shop's name", () => {
  assert.equal(cleanConcept("COMPRA TARJ. 5402XXXXXXXX5011 CAFE DE LA ACADEMIA-GIJON"), "Cafe de la Academia");
  assert.equal(cleanConcept("COMPRA TARJ. 5402XXXXXXXX5011 EN SU PUNTO-NICANOR PIÑOL"), "En Su Punto");
  assert.equal(cleanConcept("COMPRA TARJ. 5402XXXXXXXX5011 ALIMERKA GIJON-GIJON"), "Alimerka Gijon");
  assert.equal(cleanConcept("Bar de Pepe"), "Bar de Pepe", "what a person typed stays as is");
  assert.equal(cleanConcept(""), "");
  assert.equal(cleanConcept(null), "");
  const common = commonSpends([
    { id: "a", at: "2026-10-01T10:00:00", cents: 300, merchant: "COMPRA TARJ. 5402XXXXXXXX5011 CAFE EJEMPLO-GIJON", category: "FOOD_AND_DRINK" },
    { id: "b", at: "2026-10-02T10:00:00", cents: 350, merchant: "COMPRA TARJ. 5402XXXXXXXX5011 CAFE EJEMPLO-GIJON", category: "FOOD_AND_DRINK" },
  ], now);
  assert.equal(common[0].label, "Cafe Ejemplo");
});

test("WEB-88: a concept typed by a person is never cut", () => {
  assert.equal(cleanConcept("Bar-Pepe con amigos"), "Bar-Pepe con amigos");
});
