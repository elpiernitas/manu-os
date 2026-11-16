import test from "node:test";
import assert from "node:assert/strict";
import { nightReview, weekReview, weekKey, nightDue, weekDue } from "../core/review.js";
import { punch } from "../core/clock.js";

// Sunday 4 October 2026, 21:00
const now = new Date(2026, 9, 4, 21, 0);
const iso = (d, h = 12) => new Date(2026, 9, d, h).toISOString();
const clockDay = (d, outH, outM) => [["in", 9, 0], ["out", outH, outM]].reduce((c, [t, h, m], i) => punch(c, t, { at: new Date(2026, 9, d, h, m), id: `${d}-${i}` }), []);

test("noche: hechos, pendiente y mañana, sin juicios", () => {
  const r = nightReview({
    now,
    inbox: [
      { id: "t1", status: "TASK", text: "llamar al taller", done: true, doneAt: iso(4, 10), at: iso(1) },
      { id: "t2", status: "TASK", text: "renovar DNI", at: "2026-09-20T12:00:00.000Z" },
    ],
    habits: [{ name: "Leer", done: ["2026-10-04"] }, { name: "Correr", done: [] }],
    spending: [{ cents: 6000, at: iso(4) }, ...Array.from({ length: 28 }, (_, i) => ({ cents: 1000, at: new Date(2026, 9, 3 - i, 12).toISOString() }))],
    clock: clockDay(4, 13, 15),
    todayEvents: [{ time: "18:00", title: "Pádel" }],
    tomorrowEvents: [{ time: "10:00", title: "Dentista" }, { time: "17:00", title: "Pádel" }, { time: null, title: "🎂 Ana" }],
    reminders: [{ text: "x", at: iso(5, 9), done: false }],
    projects: [{ name: "Reforma", sources: [{ at: iso(4, 11) }, { at: iso(4, 12) }, { at: iso(1) }] }],
    docsSoon: [{ title: "Seguro del coche", left: 3 }, { title: "Lejano", left: 40 }],
  });
  assert.deepEqual(r.wins, ["Has cerrado 1 tarea: llamar al taller.", "Hoy tenías 1 cita: Pádel.", "Proyecto «Reforma»: 2 cosas nuevas.", "Hábitos: 1 de 2 (Leer).", "Jornada fichada: 4 h 15 min (+15 min).", "Hoy has gastado 60,00 € (tu media diaria: 10,00 €)."]);
  assert.deepEqual(r.improve, ["Hábitos sin marcar hoy: Correr.", "1 tarea abierta: «renovar DNI».", "Abierta desde hace más de una semana: «renovar DNI»."]);
  assert.deepEqual(r.tomorrow, ["Mañana empiezas a las 10:00: Dentista (y 1 cosa más).", "1 recordatorio para mañana.", "Seguro del coche: vence en 3 días.", "Si te da tiempo, empieza por «renovar DNI»."]);
  const all = [...r.wins, ...r.improve, ...r.tomorrow].join(" ");
  assert.ok(!/a mejorar|aún estás a tiempo|bastante más|muy bien|deberías/i.test(all), "sin juicios");
  assert.ok(nightReview({ now }).empty);
  assert.deepEqual(nightReview({ now, spending: [{ cents: 500, at: iso(2) }] }).wins, ["Hoy no has gastado nada."]);
});

test("semana: lo que avanzó, lo pendiente, lo que viene y como mucho dos propuestas", () => {
  const r = weekReview({
    now,
    inbox: [{ id: "a", status: "TASK", text: "uno", done: true, doneAt: iso(2) }, { id: "b", status: "TASK", text: "renovar DNI", at: "2026-09-01T10:00:00Z" }, { id: "c", status: "TASK", text: "pintar", at: "2026-09-02T10:00:00Z" }],
    habits: [{ name: "Leer", done: ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"] }, { name: "Correr", done: ["2026-09-29"] }],
    spending: [{ cents: 10000, at: iso(2), category: "FOOD_AND_DRINK" }, { cents: 5000, at: "2026-09-24T10:00:00Z", category: "GROCERIES" }],
    clock: [...clockDay(28, 13, 30).map((x) => ({ ...x, day: x.day })), ...clockDay(29, 12, 50)].map((x) => ({ ...x, day: x.day.replace("2026-10-28", "2026-09-28").replace("2026-10-29", "2026-09-29") })),
    nextWeekEvents: [{ title: "Dentista", label: "lunes 10:00" }],
    projects: [{ name: "Reforma", sources: [{ at: iso(1) }] }, { name: "Parado", sources: [{ at: "2026-08-01T10:00:00Z" }] }],
    docsSoon: [{ title: "Seguro del coche", left: 10 }],
  });
  assert.ok(r.wins.includes("Has cerrado 1 tarea."));
  assert.ok(r.wins.includes("Proyecto «Reforma» avanzó: 1 cosa nueva."));
  assert.ok(!r.wins.some((l) => /Parado/.test(l)), "un proyecto sin novedades no se da por avanzado");
  assert.ok(r.wins.includes("Hábitos: Leer 6 de 7, Correr 1 de 7."), "hábitos informados, sin penalizar");
  assert.ok(r.wins.some((l) => /Consumo personal: 100,00 € \(\+100 % que la semana anterior\)\. Lo que más: comer y beber\./.test(l)));
  assert.ok(r.improve.some((l) => /2 tareas llevan más de una semana abiertas: «renovar DNI» y «pintar»/.test(l)));
  assert.deepEqual(r.next, ["1 cosa en la agenda; la primera: Dentista (lunes 10:00).", "Seguro del coche: vence en 10 días."]);
  assert.ok(r.plan.length <= 2);
  assert.deepEqual(r.plan, ["Cerrar «renovar DNI», abierta desde el 1 sept.", "Revisar «Seguro del coche» antes de que venza."]);
  assert.ok(!r.plan.some((l) => /intenta no pasar/.test(l)), "sin topes de gasto arbitrarios");
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

test("revisiones: con cifras de dinero provisionales no se comenta el gasto", async () => {
  const { nightReview, weekReview } = await import("../core/review.js");
  const now = new Date(2026, 10, 18, 21, 0);
  const spending = [{ at: new Date(2026, 10, 18, 12).toISOString(), cents: 90000, category: "SHOPPING" }, ...Array.from({ length: 10 }, (_, k) => ({ at: new Date(2026, 10, 5 + k, 12).toISOString(), cents: 1000 }))];
  assert.ok(nightReview({ now, spending }).wins.some((x) => /gastado/.test(x)), "fiable: se comenta");
  const n = nightReview({ now, spending, moneyReliable: false });
  assert.ok(![...n.wins, ...n.improve].some((x) => /gastado|gastar/.test(x)), "provisional: nada de gasto");
  const w = weekReview({ now, spending, moneyReliable: false });
  assert.ok(!w.plan.some((x) => /Gasto: intenta/.test(x)), "sin propuesta de tope");
  assert.ok(w.improve.some((x) => /sin atribuir/.test(x)), "dice por qué");
});
