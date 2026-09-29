import test from "node:test";
import assert from "node:assert/strict";
import { parse, reply, futureDay, timeIn, amountCents } from "../core/assistant.js";

const NOW = new Date(2026, 8, 29, 11, 0); // Tuesday 29 September 2026

test("WEB-51: thousands are thousands («1.200» is not 1,20 €)", () => {
  assert.equal(amountCents("gasté 1.200 en el alquiler"), 120000);
  assert.equal(amountCents("1.234,56"), 123456);
  assert.equal(amountCents("12,50"), 1250);
  assert.equal(amountCents("45.90"), 4590);
  assert.deepEqual(parse("gasté 1.200 en el alquiler", NOW), { kind: "expense", cents: 120000, merchant: "alquiler" });
});

test("WEB-51: expenses on another day", () => {
  assert.deepEqual(parse("ayer gasté 20 en la cena", NOW), { kind: "expense", cents: 2000, merchant: "cena", day: "2026-09-28" });
  assert.deepEqual(parse("gasté 20 en la cena el lunes", NOW), { kind: "expense", cents: 2000, merchant: "cena", day: "2026-09-28" });
  assert.deepEqual(parse("hoy he gastado 5 en café", NOW), { kind: "expense", cents: 500, merchant: "café" });
  assert.match(reply(parse("ayer gasté 20 en la cena", NOW)), /en cena \(el lunes 28 de septiembre\)/);
});

test("WEB-51: reminders with a day and an everyday time", () => {
  assert.deepEqual(parse("recuérdame el viernes a las 10 llamar al banco", NOW), { kind: "reminder", text: "llamar al banco", tomorrow: false, time: "10:00", day: "2026-10-02" });
  assert.deepEqual(parse("recuérdame el 12 a las 9 pagar la luz", NOW), { kind: "reminder", text: "pagar la luz", tomorrow: false, time: "09:00", day: "2026-10-12" });
  assert.deepEqual(parse("recuérdame a las 5 y media ir a por el niño", NOW), { kind: "reminder", text: "ir a por el niño", tomorrow: false, time: "17:30" });
  assert.deepEqual(parse("recuérdame esta tarde llamar a Pedro", NOW), { kind: "reminder", text: "llamar a Pedro", tomorrow: false, time: "18:00" });
  assert.deepEqual(parse("recuérdame llamar a mamá mañana a las 8 de la mañana", NOW), { kind: "reminder", text: "llamar a mamá", tomorrow: true, time: "08:00" });
  assert.deepEqual(parse("recuérdame a las 9 menos cuarto de la noche sacar la basura", NOW), { kind: "reminder", text: "sacar la basura", tomorrow: false, time: "20:45" });
  assert.match(reply(parse("recuérdame el viernes a las 10 llamar al banco", NOW)), /el viernes 2 de octubre a las 10:00/);
});

test("WEB-51: future days and times", () => {
  assert.equal(futureDay("el martes", NOW).day, "2026-10-06"); // today is Tuesday: next week
  assert.equal(futureDay("pasado mañana", NOW).day, "2026-10-01");
  assert.equal(futureDay("el 3", NOW).day, "2026-10-03"); // the 3rd has passed: next month
  assert.equal(futureDay("el 31 de febrero", NOW), null);
  assert.equal(futureDay("a las 9 de la mañana", NOW), null); // «mañana» here is not tomorrow
  assert.equal(timeIn("a las 7").h, 7); // 7 is ambiguous (alarm, gym…): kept as said
  assert.equal(timeIn("a las 3").h, 15);
  assert.equal(timeIn("a las 3 de la madrugada").h, 3);
});

test("WEB-51: agenda for a day or the week", () => {
  assert.deepEqual(parse("qué tengo el jueves", NOW), { kind: "agenda", day: "2026-10-01" });
  assert.deepEqual(parse("qué tengo esta semana", NOW), { kind: "agenda", day: "week" });
  assert.deepEqual(parse("¿tengo algo mañana?", NOW), { kind: "agenda", day: "tomorrow" });
  assert.deepEqual(parse("qué tengo que hacer hoy", NOW), { kind: "agenda", day: "today" });
});

test("WEB-51: income, health and mood", () => {
  assert.deepEqual(parse("cobré 1.450 de la nómina", NOW), { kind: "income", cents: 145000, concept: "nómina" });
  assert.deepEqual(parse("ingresé 50 de bizum", NOW), { kind: "income", cents: 5000, concept: "bizum" });
  assert.deepEqual(parse("cobré 200", NOW), { kind: "income", cents: 20000, concept: null });
  assert.deepEqual(parse("dormí 7,5 horas", NOW), { kind: "health", metric: "SLEEP", value: 7.5 });
  assert.deepEqual(parse("peso 72,5", NOW), { kind: "health", metric: "WEIGHT", value: 72.5 });
  assert.deepEqual(parse("he andado 8000 pasos", NOW), { kind: "health", metric: "STEPS", value: 8000 });
  assert.deepEqual(parse("hoy estoy bien", NOW), { kind: "mood", value: 3 });
  assert.deepEqual(parse("me siento genial", NOW), { kind: "mood", value: 4 });
  assert.equal(parse("estoy mal", NOW).kind, "lowMood"); // still offers help
  assert.deepEqual(parse("apunta que tengo que llamar al fontanero", NOW), { kind: "task", text: "llamar al fontanero" });
});

test("WEB-51: a longer sentence or a question about how Manu feels is conversation, not a mood tap", () => {
  assert.equal(parse("estoy cansado desde el lunes, ¿por qué crees que será?", NOW).kind, "unknown");
  assert.equal(parse("me siento bien pero no sé qué hacer con mi vida", NOW).kind, "unknown");
  assert.deepEqual(parse("estoy cansado", NOW), { kind: "mood", value: 2 });
});

test("WEB-52: several expenses in one sentence; decimals are not split", () => {
  assert.deepEqual(parse("gasté 12 en café y 5 en pan", NOW), { kind: "expenses", items: [{ cents: 1200, merchant: "café" }, { cents: 500, merchant: "pan" }] });
  assert.deepEqual(parse("gasté 1.200 en el alquiler y 45,90 en luz", NOW).items, [{ cents: 120000, merchant: "alquiler" }, { cents: 4590, merchant: "luz" }]);
  assert.deepEqual(parse("hoy: 3 de café, 12 de comida y 40 de gasolina", NOW).items.map((x) => x.cents), [300, 1200, 4000]);
  assert.equal(parse("ayer gasté 12 en café y 5 en pan", NOW).day, "2026-09-28");
  assert.deepEqual(parse("gasté 12 en el bar de Pepe y Juan", NOW), { kind: "expense", cents: 1200, merchant: "bar de Pepe y Juan" }); // one amount: one expense
  assert.match(reply(parse("gasté 12 en café y 5 en pan", NOW)), /Anotados 2 gastos: 12,00 € en café, 5,00 € en pan\. Total 17,00 €/);
});

test("WEB-52: the quick sheet keeps the day of reminders and expenses", async () => {
  const { quickDetect } = await import("../core/assistant.js");
  assert.equal(quickDetect("recuérdame el viernes a las 10 llamar al banco", NOW).at.getTime(), new Date(2026, 9, 2, 10, 0).getTime());
  assert.equal(quickDetect("ayer gasté 20 en la cena", NOW).day, "2026-09-28");
  assert.equal(quickDetect("12.50 café", NOW).cents, 1250);
  assert.equal(quickDetect("1.200 alquiler", NOW).cents, 120000);
});
