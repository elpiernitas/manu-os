import test from "node:test";
import assert from "node:assert/strict";
import { NUDGES, nudgePrefs, dueNudges, markSent } from "../core/nudges.js";

// October 2026: the 4th is a Sunday, the 7th a Wednesday, the 9th a Friday.
const at = (d, h, m = 0) => new Date(2026, 9, d, h, m);
const ids = (list) => list.map((x) => x.id);

const calm = { moodToday: true }; // mood already marked, so only the 22:00 one is in play
test("WEB-77: 22:00 Sunday–Thursday «¿Dónde trabajas mañana?» only if not answered", () => {
  assert.deepEqual(ids(dueNudges(calm, { now: at(7, 22, 0) })), ["manana"]);
  assert.match(dueNudges(calm, { now: at(7, 22, 0) })[0].text, /Mañana trabajas en Gijón/);
  assert.deepEqual(ids(dueNudges(calm, { now: at(4, 22, 5) })), ["manana"]); // Sunday night
  assert.deepEqual(ids(dueNudges(calm, { now: at(9, 22, 0) })), []); // Friday: tomorrow is Saturday
  assert.deepEqual(ids(dueNudges(calm, { now: at(7, 21, 59) })).includes("manana"), false);
  assert.deepEqual(ids(dueNudges({ ...calm, tomorrowAnswered: true }, { now: at(7, 22, 0) })), []);
  assert.deepEqual(ids(dueNudges(calm, { now: at(7, 23, 30) })), ["manana"]); // late opening, still useful
  assert.deepEqual(ids(dueNudges(calm, { now: at(8, 0, 30) })), []); // window over
  assert.deepEqual(ids(dueNudges(calm, { now: at(7, 22, 0), sent: { day: "2026-10-07", ids: ["manana"] } })), []);
});

test("WEB-77: each nudge has its condition and can be turned off or moved", () => {
  assert.deepEqual(ids(dueNudges({ moodToday: false }, { now: at(7, 21, 0) })), ["animo"]);
  assert.deepEqual(ids(dueNudges({ moodToday: true }, { now: at(7, 21, 0) })), []);
  assert.deepEqual(ids(dueNudges({ moodToday: true, habitsLeft: 2 }, { now: at(7, 21, 30) })), ["habitos"]);
  assert.equal(dueNudges({ moodToday: true, habitsLeft: 1 }, { now: at(7, 21, 30) })[0].text, "Te queda 1 hábito por marcar hoy.");
  assert.deepEqual(ids(dueNudges({ moodToday: true, habitsLeft: 0 }, { now: at(7, 21, 30) })), []);
  // Sunday copy
  assert.deepEqual(ids(dueNudges({ backupDays: 9, tomorrowAnswered: true, moodToday: true }, { now: at(4, 20, 10) })), ["copia"]);
  assert.deepEqual(ids(dueNudges({ backupDays: 2, moodToday: true }, { now: at(4, 20, 10) })), []);
  assert.match(dueNudges({ backupDays: null }, { now: at(4, 20, 10) })[0].text, /ninguna copia/);
  // off / another time
  const prefs = nudgePrefs({ manana: { on: false }, animo: { time: "20:15" } });
  assert.deepEqual(ids(dueNudges({}, { now: at(7, 22, 0), prefs })), ["animo"]); // 20:15 + 2 h window still open at 22:00
  assert.deepEqual(ids(dueNudges({}, { now: at(7, 20, 15), prefs })), ["animo"]);
  assert.equal(nudgePrefs({ animo: { time: "nonsense" } }).animo.time, "21:00");
  assert.equal(nudgePrefs().ficharEntrada.time, null);
});

test("WEB-77: buenos días only when there is something, without names", () => {
  assert.deepEqual(dueNudges({}, { now: at(7, 8, 0) }), []);
  const [b] = dueNudges({ eventsToday: 3, firstAt: "10:00", remindersToday: 1, birthdaysToday: 1 }, { now: at(7, 8, 5) });
  assert.equal(b.text, "Buenos días. Hoy tienes 3 cosas en la agenda (la primera a las 10:00), 1 recordatorio y un cumpleaños.");
  assert.deepEqual(dueNudges({ eventsToday: 1 }, { now: at(10, 8, 5) }), []); // Saturday
});

test("WEB-77: sent marks are per day", () => {
  let s = markSent(null, "2026-10-07", "manana");
  s = markSent(s, "2026-10-07", "animo");
  assert.deepEqual(s, { day: "2026-10-07", ids: ["manana", "animo"] });
  assert.deepEqual(markSent(s, "2026-10-08", "manana"), { day: "2026-10-08", ids: ["manana"] });
  assert.ok(NUDGES.every((n) => n.label && n.hint && Array.isArray(n.days)));
});
