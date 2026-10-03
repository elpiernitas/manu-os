import test from "node:test";
import assert from "node:assert/strict";
import { nightReview, weekReview, weekKey, nightDue, weekDue } from "../core/review.js";
import { punch } from "../core/clock.js";

// Sunday 4 October 2026, 21:00
const now = new Date(2026, 9, 4, 21, 0);
const iso = (d, h = 12) => new Date(2026, 9, d, h).toISOString();
const clockDay = (d, outH, outM) => [["in", 9, 0], ["out", outH, outM]].reduce((c, [t, h, m], i) => punch(c, t, { at: new Date(2026, 9, d, h, m), id: `${d}-${i}` }), []);

test("WEB-83: tonight — what went well, what to improve, tomorrow", () => {
  const r = nightReview({
    now,
    inbox: [
      { id: "t1", status: "TASK", text: "llamar al taller", done: true, doneAt: iso(4, 10), at: iso(1) },
      { id: "t2", status: "TASK", text: "renovar DNI", at: iso(20, 12).replace("2026-10-20", "2026-09-20") },
    ],
    habits: [{ name: "Leer", done: ["2026-10-04"] }, { name: "Correr", done: [] }],
    spending: [{ cents: 6000, at: iso(4) }, ...Array.from({ length: 28 }, (_, i) => ({ cents: 1000, at: new Date(2026, 9, 3 - i, 12).toISOString() }))],
    clock: clockDay(4, 13, 15),
    tomorrowEvents: [{ time: "10:00", title: "Dentista" }, { time: "17:00", title: "Pádel" }, { time: null, title: "🎂 Ana" }],
    reminders: [{ text: "x", at: iso(5, 9), done: false }],
  });
  assert.deepEqual(r.wins, ["Has cerrado 1 tarea: llamar al taller.", "Hábitos: 1 de 2 (Leer).", "Jornada fichada: 4 h 15 min (+15 min)."]);
  assert.equal(r.improve[0], "Te falta Correr. Aún estás a tiempo.");
  assert.match(r.improve[1], /Hoy has gastado 60,00 €, bastante más que tu media diaria \(10,00 €\)/);
  assert.match(r.improve[2], /Una tarea lleva más de una semana abierta: «renovar DNI»/);
  assert.deepEqual(r.tomorrow, ["Mañana empiezas a las 10:00: Dentista (y 1 cosa más).", "1 recordatorio para mañana.", "Si te da tiempo, empieza por «renovar DNI»."]);
  assert.ok(nightReview({ now }).empty);
  assert.deepEqual(nightReview({ now, spending: [{ cents: 500, at: iso(2) }] }).wins, ["Hoy no has gastado nada."]);
});

test("WEB-83: the week and a plan", () => {
  const r = weekReview({
    now,
    inbox: [{ id: "a", status: "TASK", text: "uno", done: true, doneAt: iso(2) }, { id: "b", status: "TASK", text: "renovar DNI", at: "2026-09-01T10:00:00Z" }, { id: "c", status: "TASK", text: "pintar", at: "2026-09-02T10:00:00Z" }],
    habits: [{ name: "Leer", done: ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"] }, { name: "Correr", done: ["2026-09-29"] }],
    spending: [{ cents: 10000, at: iso(2), category: "FOOD_AND_DRINK" }, { cents: 5000, at: "2026-09-24T10:00:00Z", category: "GROCERIES" }],
    clock: [...clockDay(28, 13, 30).map((x) => ({ ...x, day: x.day })), ...clockDay(29, 12, 50)].map((x) => ({ ...x, day: x.day.replace("2026-10-28", "2026-09-28").replace("2026-10-29", "2026-09-29") })),
    nextWeekEvents: [{ title: "Dentista", label: "lunes 10:00" }],
  });
  assert.ok(r.wins.includes("Has cerrado 1 tarea."));
  assert.ok(r.wins.includes("Leer: 6 de 7 días. Muy bien."));
  assert.ok(r.improve.includes("Correr se ha quedado en 1 de 7 días."));
  assert.ok(r.improve.some((l) => /Has gastado 100,00 € \(\+100 % que la semana anterior\)\. Lo que más: comer y beber\./.test(l)));
  assert.deepEqual(r.plan.slice(0, 2), ["Cierra primero: «renovar DNI» y «pintar».", "Foco en un solo hábito: Correr, todos los días."]);
  assert.ok(r.plan.some((l) => /primera: Dentista \(lunes 10:00\)/.test(l)));
  assert.equal(r.from, "2026-09-28");
  assert.equal(r.to, "2026-10-04");
});

test("WEB-83: when the cards show", () => {
  assert.equal(weekKey(new Date(2026, 9, 4)), "2026-W40");
  assert.equal(weekKey(new Date(2026, 9, 5)), "2026-W41");
  assert.ok(nightDue(now, null));
  assert.ok(!nightDue(now, "2026-10-04"));
  assert.ok(!nightDue(new Date(2026, 9, 4, 19, 59), null));
  assert.equal(weekDue(now, null), "2026-W40");
  assert.equal(weekDue(new Date(2026, 9, 5, 9), null), "2026-W40"); // Monday morning, still last week's
  assert.equal(weekDue(new Date(2026, 9, 5, 15), null), null);
  assert.equal(weekDue(now, "2026-W40"), null);
  assert.equal(weekDue(new Date(2026, 9, 3, 20), null), null); // Saturday
});
