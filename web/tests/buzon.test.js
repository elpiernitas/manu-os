import test from "node:test";
import assert from "node:assert/strict";
import { amountCents, parseWhen, parseLine, lineId, applyBuzon, buzonSummary } from "../core/buzon.js";
import { newEntry } from "../core/money.js";

const NOW = new Date(2026, 8, 29, 20, 0);

test("amounts as Wallet and Shortcuts write them", () => {
  assert.equal(amountCents("12,50 €"), 1250);
  assert.equal(amountCents("€12.50"), 1250);
  assert.equal(amountCents("1.234,56 €"), 123456);
  assert.equal(amountCents("1,234.56"), 123456);
  assert.equal(amountCents("-3,2"), 320);
  assert.equal(amountCents("7"), 700);
  assert.equal(amountCents("gratis"), null);
  assert.equal(amountCents("0,00"), null);
});

test("dates: ISO, with offset and Spanish d/m/y", () => {
  const a = parseWhen("2026-09-29 17:40");
  assert.deepEqual([a.getFullYear(), a.getMonth(), a.getDate(), a.getHours(), a.getMinutes()], [2026, 8, 29, 17, 40]);
  assert.equal(parseWhen("2026-09-29T15:40:00Z").toISOString(), "2026-09-29T15:40:00.000Z");
  const b = parseWhen("29/9/2026, 8:05");
  assert.deepEqual([b.getDate(), b.getMonth(), b.getHours(), b.getMinutes()], [29, 8, 8, 5]);
  assert.equal(parseWhen("2026-09-29").getHours(), 12); // day only: midday, so time zones keep the day
  assert.equal(parseWhen("31/2/2026"), null);
  assert.equal(parseWhen("ayer"), null);
});

test("lines: every kind, accents and case, errors explained", () => {
  assert.equal(parseLine("Gasto|2026-09-29 17:40|12,50 €|Mercadona", NOW).merchant, "Mercadona");
  assert.equal(parseLine("MANU|pasos|2026-09-29|8432,0", NOW).value, 8432);
  assert.equal(parseLine("Sueño|2026-09-29|7,46", NOW).value, 7.5);
  assert.equal(parseLine("peso|2026-09-29|72,4", NOW).kind, "weight");
  assert.equal(parseLine("lugar|2026-09-29 17:40|Calle Ejemplo 1|Gijón", NOW).text, "Calle Ejemplo 1 Gijón");
  assert.equal(parseLine("   ", NOW), null);
  assert.equal(parseLine("hola|2026-09-29|1", NOW).error, "tipo desconocido");
  assert.equal(parseLine("gasto|mañana|3", NOW).error, "fecha no válida");
  assert.equal(parseLine("gasto|2026-10-05 10:00|3|x", NOW).error, "fecha en el futuro");
  assert.equal(parseLine("sueño|2026-09-29|30", NOW).error, "valor no válido");
  assert.equal(lineId("Gasto|2026-09-29 17:40|12,50 €|Mercadona"), lineId("gasto | 2026-09-29 17:40 | 12,50 €|mercadona".replace(/ \| /g, "|")));
});

test("importing twice adds nothing; health keeps one value per day", () => {
  const file = [
    "gasto|2026-09-29 17:40|12,50 €|Mercadona",
    "gasto|2026-09-29 18:02|3,20 €|Cafetería",
    "pasos|2026-09-28|6000",
    "pasos|2026-09-29|8432",
    "sueño|2026-09-29|7,5",
    "lugar|2026-09-29 17:40|Gijón",
    "esto no es una línea",
  ].join("\n");
  const vault = { spending: [], health: [{ day: "2026-09-29", kind: "STEPS", value: 100 }], settings: {} };
  const r = applyBuzon(file, vault, { now: NOW, newEntry });
  assert.equal(r.added, 6);
  assert.equal(r.spending.length, 2);
  assert.equal(r.spending[0].source, "APPLEPAY");
  assert.equal(r.spending[0].cents, 1250);
  assert.ok(r.spending[0].category);
  assert.deepEqual(r.health.filter((h) => h.kind === "STEPS").map((h) => [h.day, h.value]).sort(), [["2026-09-28", 6000], ["2026-09-29", 8432]]);
  assert.equal(r.places.length, 1);
  assert.deepEqual(r.errors, [{ line: 7, error: "tipo desconocido" }]);
  assert.equal(buzonSummary(r), "2 gastos, pasos de 2 días, sueño de 1 día y 1 lugar · 1 líneas no entendidas");

  const again = applyBuzon(file + "\ngasto|2026-09-29 20:00|1 €|Pan", { ...vault, settings: { buzonSeen: r.seenAll } }, { now: NOW, newEntry });
  assert.equal(again.added, 1);
  assert.equal(again.repeated, 6);
  assert.equal(again.spending[0].merchant, "Pan");
});

test("WEB-78: notes dictated to Siri go through the buzón", async () => {
  const { parseLine, applyBuzon, buzonSummary } = await import("../core/buzon.js");
  const now = new Date(2026, 9, 2, 20);
  const ev = parseLine("nota|2026-10-02 08:15|gasté 15 en gasolina", now);
  assert.equal(ev.kind, "note");
  assert.equal(ev.text, "gasté 15 en gasolina");
  assert.equal(parseLine("nota|2026-10-02 08:15|", now).error, "nota vacía");
  assert.equal(parseLine("nota|2026-10-02 08:15|precio | 12 €", now).text, "precio | 12 €");
  const v = { settings: {}, health: [], places: [] };
  const r = applyBuzon("nota|2026-10-02 08:15|gasté 15 en gasolina\nnota|2026-10-02 09:00|tarea llamar al banco\nnota|2026-10-02 08:15|gasté 15 en gasolina", v, { now, newEntry: (e) => e });
  assert.equal(r.notes.length, 2);
  assert.equal(r.repeated, 1);
  assert.equal(buzonSummary(r), "2 notas dictadas · 1 ya estaban");
});

test("WEB-89: «MANU Fichar» and «MANU Ánimo» lines", async () => {
  const { parseLine, applyBuzon } = await import("../core/buzon.js");
  const now = new Date(2026, 9, 6, 22);
  assert.deepEqual(parseLine("fichaje|2026-10-06 09:02:10|entro", now).t, "in");
  const p = parseLine("fichaje|2026-10-06 11:00:00|pausa|Café", now);
  assert.equal(p.t, "pause"); assert.equal(p.why, "Café");
  assert.ok(parseLine("fichaje|2026-10-06 11:00|bailar", now).error);
  assert.equal(parseLine("animo|2026-10-06 21:00:00|bien", now).value, 3);
  assert.equal(parseLine("animo|2026-10-06 21:00:00|4", now).value, 4);
  assert.ok(parseLine("animo|2026-10-06 21:00|9", now).error);
  const r = applyBuzon("fichaje|2026-10-06 13:01:00|salida\nfichaje|2026-10-06 09:02:00|entro\nanimo|2026-10-06 21:00:00|mal", { settings: {} }, { now, newEntry: (e) => e });
  assert.deepEqual(r.punches.map((x) => x.t), ["in", "out"], "sorted by time");
  assert.deepEqual(r.moods, [{ day: "2026-10-06", value: 1, at: r.moods[0].at }]);
});

test("WEB-90: Apple Pay text from the Shortcut → amount and shop", async () => {
  const { walletText, parseLine } = await import("../core/buzon.js");
  assert.deepEqual(walletText("Mercadona 12,50 €"), { cents: 1250, merchant: "Mercadona" });
  assert.deepEqual(walletText("€12.50 Bar Ejemplo"), { cents: 1250, merchant: "Bar Ejemplo" });
  assert.deepEqual(walletText("BAR EJEMPLO | 3,50 € | Visa •••• 5011"), { cents: 350, merchant: "BAR EJEMPLO" });
  assert.deepEqual(walletText("Importe: 25.00 EUR Comercio: Cine"), { cents: 2500, merchant: "Cine" });
  assert.equal(walletText("algo sin precio"), null);
  const e = parseLine("applepay|2026-10-08 18:00:00|Bar Ejemplo 4,20 €", new Date(2026, 9, 8, 20));
  assert.equal(e.kind, "expense"); assert.equal(e.cents, 420);
  const unk = parseLine("applepay|2026-10-08 18:00:00|sin importe", new Date(2026, 9, 8, 20));
  assert.equal(unk.kind, "note"); assert.match(unk.text, /Apple Pay que no entendí: sin importe/);
});
