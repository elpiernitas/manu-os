import test from "node:test";
import assert from "node:assert/strict";
import { briefing, briefingText, monthPace, isBriefingQuestion } from "../core/briefing.js";

const at = (d, h) => new Date(`${d}T${h}:00`).toISOString();
const weather = { today: { rain: 60, min: 12, max: 20 }, days: [{ min: 12, max: 20, rain: 60 }, { min: 10, max: 18, rain: 10 }] };

test("WEB-46: morning summary — weather, next event, reminder, tasks, birthday, mail, month pace", () => {
  const now = new Date(2026, 8, 29, 9, 0);
  const b = briefing({
    now, weather, advice: "Hoy puede llover (60 %). Lleva paraguas.",
    today: [{ time: "08:00", title: "Ya pasó" }, { time: "10:00", title: "Dentista" }, { time: "17:00", title: "Pádel" }],
    reminders: [{ text: "Llamar al taller", at: at("2026-09-29", "18:00"), done: false }, { text: "Ayer", at: at("2026-09-28", "18:00"), done: false }],
    tasks: [{ text: "Comprar regalo" }, { text: "Otra" }],
    birthdays: [{ person: { name: "Persona Demo" }, days: 1 }],
    spending: [{ cents: 5000, at: at("2026-09-10", "10:00") }, { cents: 10000, at: at("2026-08-10", "10:00") }, { cents: 9999, at: at("2026-08-30", "10:00") }],
    importantMail: 2,
  });
  const t = briefingText(b);
  assert.equal(b.evening, false);
  assert.match(t, /☔ Hoy puede llover/);
  assert.match(t, /2 eventos hoy; el próximo: 10:00 Dentista/);
  assert.match(t, /A las 18:00: Llamar al taller/);
  assert.match(t, /2 tareas pendientes: Comprar regalo…/);
  assert.match(t, /Persona Demo cumple mañana/);
  assert.match(t, /2 correos importantes sin leer/);
  assert.match(t, /Llevas 50,00 € este mes, un 50 % menos que el mes pasado a estas alturas/); // 30 Aug is after the 29th: not counted
});

test("WEB-46: evening summary — spent today, tasks done today, tomorrow and its weather", () => {
  const now = new Date(2026, 8, 29, 21, 30);
  const b = briefing({
    now, weather,
    tomorrow: [{ time: null, title: "🎂 Cumpleaños de Persona Demo" }, { time: "09:00", title: "Reunión" }, { time: "12:00", title: "Comida" }],
    spending: [{ cents: 320, at: at("2026-09-29", "10:00") }, { cents: 1280, at: at("2026-09-29", "14:00") }, { cents: 999, at: at("2026-09-28", "14:00") }],
    inbox: [{ status: "TASK", done: true, doneAt: at("2026-09-29", "12:00") }, { status: "TASK", done: true, doneAt: at("2026-09-28", "12:00") }],
  });
  const t = briefingText(b);
  assert.equal(b.evening, true);
  assert.match(t, /Hoy has gastado 16,00 € en 2 compras/);
  assert.match(t, /Has terminado 1 tarea/);
  assert.match(t, /Mañana: 09:00 Reunión y 1 cosa más/);
  assert.match(t, /Mañana 10°–18°\./);
  assert.ok(!t.includes("Cumpleaños de")); // not repeated as an event
  assert.match(briefingText(briefing({ now, tomorrow: [{ time: null, title: "Vacaciones" }] })), /Mañana: Vacaciones \(todo el día\)\./);
});

test("WEB-46: an empty day still says something useful, never crashes", () => {
  const b = briefing({ now: new Date(2026, 8, 29, 22, 0) });
  assert.ok(b.lines.length >= 2);
  assert.equal(briefing({ now: new Date(2026, 8, 29, 9, 0) }).lines.length, 0);
});

test("WEB-46: month pace compares the same days of last month", () => {
  const now = new Date(2026, 2, 31, 12, 0); // 31 March vs February (28 days)
  const p = monthPace([{ cents: 100, at: new Date(2026, 2, 5).toISOString() }, { cents: 400, at: new Date(2026, 1, 28, 10).toISOString() }], now);
  assert.deepEqual(p, { cur: 100, prev: 400, diff: -75 });
});

test("WEB-46: questions that ask for the summary", () => {
  for (const q of ["resumen del dia", "como va mi dia", "que tal voy", "como ha ido el dia"]) assert.ok(isBriefingQuestion(q), q);
  for (const q of ["gaste 3 en pan", "que hice ayer"]) assert.ok(!isBriefingQuestion(q), q);
});
