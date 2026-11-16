// WEB-111 · Dinero 2.0. Todos los datos son ficticios («CAFE UNO», «Mamá», «Ana»…).
import test from "node:test";
import assert from "node:assert/strict";
import * as L from "../core/ledger.js";
import { validateVault } from "../core/storage.js";
import { cloudPayload, applyRemote } from "../core/cloudprivacy.js";
import { importStatementRows } from "../core/bank.js";
import { summaryCard, editorPage, moveRow } from "../core/ledger-view.js";

const MES = { from: "2026-11-01T00:00:00Z", to: "2026-12-01T00:00:00Z" };
const T0 = new Date("2026-11-20T12:00:00Z"), T1 = new Date("2026-11-21T12:00:00Z");
const g = (id, day, cents, merchant, category = "FOOD_AND_DRINK", extra = {}) => ({ id, at: `2026-11-${day}T10:00:00.000Z`, cents, merchant, category, ...extra });
const i = (id, day, cents, concept, extra = {}) => ({ id, at: `2026-11-${day}T10:00:00.000Z`, cents, concept, ...extra });
const base = () => ({ schema: 1, inbox: [], chat: [], settings: {},
  spending: [g("cafe", "02", 1250, "CAFE UNO"), g("cajero", "03", 60000, "REINTEGRO CAJERO GIJON", "CASH"), g("cena", "07", 9000, "RESTAURANTE DOS"), g("zapas", "08", 8000, "TIENDA TRES ZAPATILLAS", "SHOPPING"), g("farmacia", "10", 4000, "FARMACIA CUATRO", "HEALTH"), g("bizum", "11", 2000, "BIZUM A PEPE", "TRANSFERS")],
  income: [i("nomina", "01", 150000, "NOMINA EMPRESA PRUEBA", { payroll: true }), i("ingreso", "05", 60000, "INGRESO EFECTIVO CAJERO"), i("mama", "06", 50000, "TRANSFERENCIA DE MAMA PRUEBA"), i("devol", "15", 8000, "DEVOLUCION TIENDA TRES ZAPATILLAS")],
});
const mv = (v, key) => L.movements(v).find((m) => m.key === key);
const sum = (v) => L.summary(v, MES);
const note = (v, key, change, now = T0) => ({ ...v, ledger: L.annotate(L.ledgerOf(v), mv(v, key), change, { now }) });

test("sin revisar: el cajero, los Bizum y los ingresos dudosos quedan pendientes, no son consumo", () => {
  const s = sum(base());
  assert.equal(s.consumo, 1250 + 9000 + 8000 + 4000, "solo las compras normales");
  assert.equal(s.ingreso, 150000, "solo la nómina es ingreso propio supuesto");
  assert.equal(s.pending.count, 5, "cajero, bizum, ingreso de efectivo, transferencia de mamá y devolución");
  assert.equal(s.fiable, false, "con tanto pendiente no hay consejos");
  assert.ok(s.pending.rows.some((r) => r.key === "g:cajero" && r.pending === 60000));
});

test("caso real: retirada de 600 € y un ingreso posterior se sugieren, pero no se compensan solos", () => {
  const v = base();
  const sg = L.suggestions(v);
  const cash = sg.find((x) => x.kind === "CASH_BACK" && x.a === "g:cajero" && x.b === "i:ingreso");
  assert.ok(cash, "se sugiere la relación");
  assert.equal(cash.confidence, "alta");
  assert.ok(cash.reasons.includes("el ingreso es de efectivo"));
  assert.equal(sum(v).pending.cents >= 120000, true, "sugerir no cambia nada");
  const ok = { ...v, ledger: L.setLink(L.ledgerOf(v), cash, "CONFIRMED", { now: T0 }) };
  const r = new Map(L.resolve(ok).rows.map((x) => [x.key, x]));
  assert.equal(r.get("g:cajero").pending, 0); assert.equal(r.get("g:cajero").consumo, 0); assert.equal(r.get("g:cajero").neutral, 60000);
  assert.equal(r.get("i:ingreso").ingreso, 0, "volver a ingresar tu efectivo no es un ingreso");
  assert.ok(!L.suggestions(ok).some((x) => x.id === cash.id), "lo confirmado no se vuelve a sugerir");
  const no = { ...v, ledger: L.setLink(L.ledgerOf(v), cash, "REJECTED", { now: T0 }) };
  assert.ok(!L.suggestions(no).some((x) => x.id === cash.id), "lo descartado tampoco");
  assert.equal(L.resolve(no).rows.find((x) => x.key === "g:cajero").pending, 60000, "descartar deja la retirada pendiente");
});

test("solo coincidir el importe no basta: sin ingreso de efectivo, confianza baja o ninguna sugerencia", () => {
  const v = { ...base(), income: [i("pepa", "04", 60000, "BIZUM DE PEPA PRUEBA"), i("lejos", "28", 60000, "BIZUM DE LUIS PRUEBA")] };
  const sg = L.suggestions(v).filter((x) => x.kind === "CASH_BACK");
  assert.equal(sg.length, 1);
  assert.equal(sg[0].b, "i:pepa"); assert.equal(sg[0].confidence, "baja");
  assert.ok(sg[0].reasons.some((r) => /solo coincide el importe/.test(r)));
  const antes = { ...base(), income: [i("antes", "02", 60000, "INGRESO EFECTIVO CAJERO")] };
  assert.equal(L.suggestions(antes).filter((x) => x.kind === "CASH_BACK").length, 0, "un ingreso anterior a la retirada no es su vuelta");
});

test("retirada parcialmente devuelta y el resto gastado en efectivo", () => {
  let v = { ...base(), income: [i("parte", "05", 20000, "INGRESO EFECTIVO CAJERO")] };
  v = { ...v, ledger: L.setLink(L.ledgerOf(v), { kind: "CASH_BACK", a: "g:cajero", b: "i:parte" }, "CONFIRMED", { now: T0 }) };
  assert.equal(L.resolve(v).rows.find((x) => x.key === "g:cajero").pending, 40000, "lo no devuelto sigue pendiente");
  v = note(v, "g:cajero", { kind: "CASH", cashUse: "SPENT" });
  const r = L.resolve(v).rows.find((x) => x.key === "g:cajero");
  assert.equal(r.consumo, 40000); assert.equal(r.neutral, 20000); assert.equal(r.pending, 0);
});

test("devoluciones: relacionada rebaja su compra; sin relacionar, rebaja el consumo de su categoría", () => {
  const v = base();
  const sug = L.suggestions(v).find((x) => x.kind === "REFUND");
  assert.equal(sug.a, "g:zapas"); assert.equal(sug.b, "i:devol");
  const ok = { ...v, ledger: L.setLink(L.ledgerOf(v), sug, "CONFIRMED", { now: T0 }) };
  const rows = new Map(L.resolve(ok).rows.map((x) => [x.key, x]));
  assert.equal(rows.get("g:zapas").consumo, 0, "devolución completa");
  assert.equal(rows.get("i:devol").ingreso, 0, "una devolución no es un ingreso");
  assert.equal(sum(ok).consumo, sum(v).consumo - 8000);
  const suelta = note(v, "i:devol", { kind: "REFUND", category: "SHOPPING" });
  assert.equal(sum(suelta).consumo, sum(v).consumo - 8000);
  assert.ok(!sum(suelta).byCategory.some(([c]) => c === "SHOPPING"), "la categoría queda a cero, no en negativo");
});

test("dinero de mamá: entra y sale por tu cuenta sin ser tuyo; el ahorro no lo incluye", () => {
  let v = note(base(), "i:mama", { kind: "OTHERS", parts: [{ who: "n:mama", name: "Mamá", cents: 50000 }] });
  v = note(v, "g:farmacia", { kind: "OTHERS", parts: [{ who: "n:mama", name: "Mamá", cents: 4000 }] });
  const s = sum(v);
  assert.equal(s.ingreso, 150000, "lo de mamá no es ingreso tuyo");
  assert.equal(s.others.in, 50000); assert.equal(s.others.out, 4000);
  assert.equal(s.consumo, 1250 + 9000 + 8000, "su farmacia no es consumo tuyo");
  const b = L.balances(v).find((x) => x.who === "n:mama");
  assert.equal(b.cents, 46000, "tienes 460 € suyos");
  // Un porcentaje: el 30 % de un gasto es mío y el 70 % de mamá.
  const pct = L.partsFromPct(9000, [{ who: L.ME, name: "Yo", pct: 30 }, { who: "n:mama", name: "Mamá", pct: 70 }]);
  const v2 = note(v, "g:cena", { kind: "OTHERS", parts: pct });
  assert.equal(L.resolve(v2).rows.find((x) => x.key === "g:cena").consumo, 2700);
  assert.equal(L.balances(v2).find((x) => x.who === "n:mama").cents, 46000 - 6300);
  assert.throws(() => L.partsFromPct(100, [{ pct: 80 }, { pct: 30 }]), /más de 100/);
});

test("gasto compartido: reparto a partes iguales, lo que me deben, y cuando me pagan no se duplica nada", () => {
  const parts = L.equalParts(9000, [{ name: "Ana" }, { name: "Luis" }]);
  assert.deepEqual(parts.map((p) => p.cents), [3000, 3000, 3000]);
  assert.deepEqual(L.equalParts(1000, [{ name: "Ana" }, { name: "Luis" }]).map((p) => p.cents), [334, 333, 333], "los céntimos sueltos, para mí");
  let v = note(base(), "g:cena", { kind: "SHARED", parts });
  assert.equal(L.resolve(v).rows.find((x) => x.key === "g:cena").consumo, 3000);
  assert.equal(L.balances(v).find((x) => x.name === "Ana").cents, -3000, "Ana te debe 30 €");
  assert.equal(v.spending.length, base().spending.length, "repartir no crea gastos");
  // Ana me paga por Bizum: ese ingreso salda su parte y no es ingreso propio.
  v = { ...v, income: [...v.income, i("anapaga", "12", 3000, "BIZUM DE ANA PRUEBA")] };
  v = note(v, "i:anapaga", { kind: "SETTLE", parts: [{ who: L.personKey("Ana"), name: "Ana", cents: 3000 }] });
  assert.equal(L.balances(v).find((x) => x.name === "Ana"), undefined, "Ana ya no debe nada");
  assert.equal(sum(v).ingreso, 150000);
  assert.throws(() => L.annotate(L.ledgerOf(v), mv(v, "g:cena"), { kind: "SHARED", parts: [{ name: "Ana", cents: 99999 }] }), /más que el movimiento/);
  assert.throws(() => L.annotate(L.ledgerOf(v), mv(v, "g:cena"), { kind: "SHARED", parts: [] }), /al menos una persona/);
  // Una deuda sin movimiento (Luis pagó por mí).
  const d = { ...v, ledger: L.addDebt(L.ledgerOf(v), { name: "Luis", cents: 1500, note: "Entradas" }, { uid: () => "d1", now: T0 }) };
  assert.equal(L.balances(d).find((x) => x.name === "Luis").cents, -3000 + 1500);
});

test("el reparto antiguo (entry.split) se sigue leyendo sin tocar el movimiento", () => {
  const v = { ...base(), spending: [g("viejo", "05", 6000, "BAR VIEJO", "NIGHTLIFE", { split: { mode: "equal", mine: 2000, people: [{ key: "p1", name: "Ana Prueba", cents: 2000, paid: true }, { key: "p2", name: "Luis Prueba", cents: 2000, paid: false }] } })] };
  const r = L.resolve(v).rows.find((x) => x.key === "g:viejo");
  assert.equal(r.kind, "SHARED"); assert.equal(r.consumo, 2000);
  assert.deepEqual(L.balances(v).map((b) => [b.name, b.cents]), [["Luis Prueba", -2000]], "lo ya pagado no cuenta");
});

test("anotar nunca modifica los movimientos originales; todo es reversible", () => {
  const v = base(), copia = JSON.stringify({ spending: v.spending, income: v.income });
  let w = note(v, "g:cafe", { kind: "MINE", name: "Desayuno", category: "FOOD_AND_DRINK" }, T0);
  w = note(w, "g:cafe", { kind: "SHARED", parts: [{ name: "Ana", cents: 625 }] }, T1);
  assert.equal(JSON.stringify({ spending: w.spending, income: w.income }), copia, "el banco intacto");
  const n = L.ledgerOf(w).notes["g:cafe"];
  assert.equal(n.prev.length, 1); assert.equal(n.prev[0].name, "Desayuno");
  const back = { ...w, ledger: L.restore(L.ledgerOf(w), "g:cafe", 0, { now: T1 }) };
  assert.equal(L.ledgerOf(back).notes["g:cafe"].kind, "MINE");
  assert.equal(L.ledgerOf(back).notes["g:cafe"].prev[0].kind, "SHARED", "la versión deshecha queda en el historial");
  const rev = { ...w, ledger: L.revert(L.ledgerOf(w), "g:cafe", { now: T1 }) };
  assert.equal(L.ledgerOf(rev).notes["g:cafe"], undefined);
  assert.equal(L.resolve(rev).rows.find((x) => x.key === "g:cafe").auto, true);
  assert.throws(() => L.annotate(L.ledgerOf(v), mv(v, "i:nomina"), { kind: "SHARED" }), /no vale/);
});

test("importar dos veces: los mismos ids, sin duplicados, y las anotaciones siguen valiendo", () => {
  const rows = [["Fecha", "Concepto", "Importe"], ["02/11/2026", "COMPRA TARJ. CAFE UNO-GIJON", "-12,50"], ["03/11/2026", "REINTEGRO CAJERO", "-600,00"]];
  const first = importStatementRows(rows, new Set(), {});
  assert.equal(first.entries.length, 2, first.error);
  let v = { ...base(), spending: first.entries, income: [] };
  const k = L.keyOf("g", first.entries[0].id);
  v = note(v, k, { kind: "SHARED", parts: [{ name: "Ana", cents: 625 }] });
  const again = importStatementRows(rows, new Set(v.spending.map((e) => e.id)), {});
  assert.equal(again.entries.length, 0, "nada nuevo");
  assert.equal(L.resolve(v).rows.find((x) => x.key === k).kind, "SHARED");
  assert.equal(importStatementRows(rows, new Set(), {}).entries[0].id, first.entries[0].id, "ids estables");
});

test("Tu nube: dos dispositivos se fusionan, gana lo más reciente y lo deshecho no resucita", () => {
  const v = base();
  const iphone = L.annotate(L.emptyLedger(), mv(v, "g:cafe"), { kind: "MINE", name: "Desayuno" }, { now: T0, device: "iPhone" });
  const mac = L.annotate(L.emptyLedger(), mv(v, "g:cena"), { kind: "SHARED", parts: [{ name: "Ana", cents: 4500 }] }, { now: T0, device: "Mac" });
  const both = L.mergeLedger(iphone, mac);
  assert.deepEqual(Object.keys(both.notes).sort(), ["g:cafe", "g:cena"], "cada uno conserva lo suyo");
  const macLater = L.annotate(mac, mv(v, "g:cafe"), { kind: "OTHERS", parts: [{ name: "Mamá", cents: 1250 }] }, { now: T1 });
  const m2 = L.mergeLedger(iphone, macLater);
  assert.equal(m2.notes["g:cafe"].kind, "OTHERS", "gana la versión más reciente");
  assert.ok(m2.notes["g:cafe"].prev.some((p) => p.name === "Desayuno"), "la otra queda en el historial");
  const undone = L.revert(m2, "g:cena", { now: new Date("2026-11-22T12:00:00Z") });
  assert.equal(L.mergeLedger(undone, mac).notes["g:cena"], undefined, "lo deshecho no vuelve desde el otro dispositivo");
  assert.equal(L.mergeLedger(L.mergeLedger(iphone, mac), mac).notes["g:cena"].kind, "SHARED", "fusionar dos veces da lo mismo");
  // A través de Tu nube (subida y bajada reales de la app).
  const local = { ...v, ledger: iphone }, remote = cloudPayload({ ...v, ledger: mac });
  const down = applyRemote(remote, local);
  assert.deepEqual(Object.keys(down.ledger.notes).sort(), ["g:cafe", "g:cena"], "al bajar no se pierden las del dispositivo");
});

test("compatibilidad: un vault sin ledger funciona y la validación conserva el ledger", () => {
  const viejo = base();
  assert.equal(L.ledgerOf(viejo).schema, 1);
  assert.ok(L.summary(viejo, MES).bank.count > 0);
  const v = note(viejo, "g:cafe", { kind: "MINE" });
  const r = validateVault(JSON.parse(JSON.stringify(v)));
  const out = r.vault ?? r;
  assert.ok(out.ledger?.notes?.["g:cafe"], "validar no borra las correcciones");
  assert.equal(L.ledgerOf({ ledger: "basura" }).schema, 1);
});

test("fiabilidad: los consejos vuelven cuando casi no queda nada pendiente", () => {
  let v = base();
  assert.equal(sum(v).fiable, false);
  v = { ...v, ledger: L.setLink(L.ledgerOf(v), { kind: "CASH_BACK", a: "g:cajero", b: "i:ingreso" }, "CONFIRMED", { now: T0 }) };
  v = note(v, "i:mama", { kind: "OTHERS", parts: [{ name: "Mamá", cents: 50000 }] });
  v = note(v, "g:bizum", { kind: "MINE" });
  v = note(v, "i:devol", { kind: "REFUND", category: "SHOPPING" });
  const s = sum(v);
  assert.equal(s.pending.count, 0); assert.equal(s.fiable, true);
  assert.equal(s.ahorro, s.ingreso - s.consumo);
});

test("corrección múltiple: primero se revisa, luego se aplica; cada uno guarda su versión", () => {
  const v = base();
  const plan = L.bulkPlan(v, ["g:bizum", "g:cajero"], { kind: "MINE" });
  assert.equal(L.ledgerOf(v).notes["g:bizum"], undefined, "planear no guarda nada");
  assert.equal(plan.rows.length, 2);
  assert.equal(plan.delta.consumo, 62000); assert.equal(plan.delta.pending, -62000);
  assert.equal(plan.rows[0].before.label, "Pendiente de revisar"); assert.equal(plan.rows[0].after.label, "Gasto propio");
  const cat = L.bulkPlan(note(v, "g:cafe", { kind: "MINE", name: "Desayuno" }), ["g:cafe"], { category: "GROCERIES" });
  assert.equal(L.ledgerOf({ ledger: cat.ledger }).notes["g:cafe"].name, "Desayuno", "solo cambia lo pedido");
  assert.equal(L.ledgerOf({ ledger: cat.ledger }).notes["g:cafe"].prev.length, 1);
});

test("personalSpending alimenta las estadísticas de siempre solo con lo tuyo", () => {
  let v = note(base(), "g:cena", { kind: "SHARED", parts: L.equalParts(9000, [{ name: "Ana" }]) });
  const ps = L.personalSpending(v);
  assert.ok(!ps.some((e) => e.id === "cajero" || e.id === "bizum"), "lo pendiente no entra");
  assert.equal(ps.find((e) => e.id === "cena").cents, 4500);
  v = note(v, "g:cafe", { kind: "MINE", name: "Desayuno", category: "GROCERIES" });
  assert.equal(L.personalSpending(v).find((e) => e.id === "cafe").category, "GROCERIES");
  assert.deepEqual(L.personalIncome(v).map((e) => e.id), ["nomina"]);
});

test("las piezas visuales escapan y no usan estilos en línea", () => {
  const malo = '<img src=x onerror="alert(1)">';
  const v = { ...base(), spending: [g("x", "02", 1000, malo, "OTHER")], income: [] };
  const r = L.resolve(v).rows[0];
  const html = [summaryCard(L.summary(v, MES)), moveRow(r), editorPage(r, { kind: "SHARED", name: malo, parts: [{ who: "n:x", name: malo, cents: 500 }], note: malo }, { people: [{ who: malo, name: malo }] })].join("");
  assert.ok(!html.includes("<img"));
  assert.ok(!/style="/.test(html));
});
