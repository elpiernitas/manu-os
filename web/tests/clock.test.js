import test from "node:test";
import assert from "node:assert/strict";
import { clockState, nextActions, tally, today, dur, balanceText, monthReport, reportRows, toCsv, punch, editPunch, workdayMinutes } from "../core/clock.js";

const at = (d, h, m = 0) => new Date(2026, 9, d, h, m);
let n = 0; const id = () => `e${++n}`;
const day = (d, steps) => steps.reduce((c, [t, h, m, why]) => punch(c, t, { at: at(d, h, m), id: id(), why }), []);

test("WEB-74: the buttons follow the state: Entro → Pausa/Salida → Vuelvo", () => {
  assert.equal(clockState([]), "off");
  assert.deepEqual(nextActions("off"), ["in"]);
  let c = punch([], "in", { at: at(7, 8, 50), id: id() });
  assert.equal(clockState(c[0].events), "working");
  assert.deepEqual(nextActions("working"), ["pause", "out"]);
  c = punch(c, "pause", { at: at(7, 10, 0), id: id(), why: "Café" });
  assert.equal(clockState(c[0].events), "paused");
  assert.deepEqual(nextActions("paused"), ["back"]);
  assert.throws(() => punch(c, "out", { at: at(7, 10, 5), id: id() }), /No estás trabajando/);
  assert.throws(() => punch(c, "in", { at: at(7, 10, 5), id: id() }), /Ya estás dentro|No/);
  c = punch(c, "back", { at: at(7, 10, 15), id: id() });
  assert.equal(c[0].events[1].why, "Café");
});

test("WEB-74: in at 8:50, two smokes of 10 min → leave at 13:10", () => {
  const c = day(7, [["in", 8, 50], ["pause", 10, 0, "Fumar"], ["back", 10, 10], ["pause", 11, 30, "Fumar"], ["back", 11, 40]]);
  const r = today(c[0].events, { now: at(7, 12, 0), targetMin: 240 });
  assert.equal(r.state, "working");
  assert.equal(r.workedMin, 170); // 8:50-10:00 (70) + 10:10-11:30 (80) + 11:40-12:00 (20)
  assert.equal(r.pausedMin, 20);
  assert.equal(r.pauses, 2);
  assert.equal(r.leftMin, 70);
  assert.equal(r.leaveAt, "13:10");
  // while paused there is no exit time (it moves with the pause)
  const p = day(8, [["in", 9, 0], ["pause", 10, 0]]);
  const rp = today(p[0].events, { now: at(8, 10, 20) });
  assert.equal(rp.leaveAt, null);
  assert.equal(rp.pausedMin, 20);
  // more than the day: extra time
  const long = day(9, [["in", 9, 0]]);
  assert.equal(today(long[0].events, { now: at(9, 13, 25) }).extraMin, 25);
});

test("WEB-74: the balance in workdays once it reaches one", () => {
  assert.equal(dur(65), "1 h 05 min");
  assert.equal(dur(45), "45 min");
  assert.equal(dur(120), "2 h");
  assert.equal(balanceText(35), "RK te debe 35 min.");
  assert.equal(balanceText(240), "RK te debe 1 día.");
  assert.equal(balanceText(570), "RK te debe 2 días y 1 h 30 min.");
  assert.equal(balanceText(-20), "Le debes a RK 20 min.");
  assert.match(balanceText(0), /en paz/);
  assert.equal(workdayMinutes({ workStart: "09:00", workEnd: "13:00" }), 240);
});

test("WEB-74: monthly report — closed days count, open days are flagged", () => {
  let c = [];
  c = [...c, ...day(1, [["in", 8, 50], ["out", 13, 20]])]; // 270 → +30
  c = [...c, ...day(2, [["in", 9, 0], ["pause", 10, 0, "Café"], ["back", 10, 15], ["out", 13, 0]])]; // 225 → −15
  c = [...c, ...day(5, [["in", 9, 0]])]; // forgot to clock out
  c = [...c, ...day(30, [["in", 9, 0], ["out", 13, 0]])].concat([{ day: "2026-11-01", events: [] }]);
  const r = monthReport(c, "2026-10", { targetMin: 240, now: at(31, 12) });
  assert.equal(r.days, 3);
  assert.equal(r.openDays, 1);
  assert.equal(r.balanceMin, 15);
  assert.equal(r.balance, "RK te debe 15 min.");
  assert.deepEqual(r.rows.map((x) => x.diffMin), [30, -15, null, 0]);
  assert.equal(r.rows[0].weekday, "jueves");
  const rows = reportRows(r);
  assert.deepEqual(rows[2].slice(0, 4), ["Fecha", "Día", "Entrada", "Salida"]);
  assert.equal(rows[3][8], "+30 min");
  assert.equal(rows[5][3], "sin salida");
  assert.ok(rows.some((x) => x[0] === "RK te debe 15 min."));
  assert.ok(rows.some((x) => /1 día sin salida/.test(x[0] ?? "")));
  const csv = toCsv(rows);
  assert.ok(csv.startsWith("﻿Fichaje;2026-10"));
});

test("WEB-74: fixing a forgotten punch", () => {
  const c = day(5, [["in", 9, 0], ["out", 18, 0]]);
  const outId = c[0].events[1].id;
  const fixed = editPunch(c, "2026-10-05", outId, { time: "13:05" });
  assert.equal(tally(fixed[0].events, at(6, 0)).workedMin, 245);
  const removed = editPunch(fixed, "2026-10-05", outId, { remove: true });
  assert.equal(clockState(removed[0].events), "working");
  assert.equal(editPunch(removed, "2026-10-05", removed[0].events[0].id, { remove: true }).length, 0);
});

test("WEB-74: fichajes go by the minute (no 13:01 because of seconds)", () => {
  const c = punch([], "in", { at: new Date(2026, 9, 7, 8, 50, 40, 664), id: "x" });
  assert.equal(new Date(c[0].events[0].at).getSeconds(), 0);
  assert.equal(today(c[0].events, { now: new Date(2026, 9, 7, 10, 10, 59) }).leaveAt, "12:50");
});

test("WEB-75: 9:01 «¿Fichaste ya?» only if not in; 13:00 «fichar al salir» only if still in", async () => {
  const { clockNudge } = await import("../core/clock.js");
  const none = [];
  assert.equal(clockNudge(none, { now: at(7, 9, 0) }), null); // 9:00 sharp: not yet
  assert.equal(clockNudge(none, { now: at(7, 9, 1) }).kind, "in");
  assert.match(clockNudge(none, { now: at(7, 9, 1) }).text, /Fichaste ya/);
  assert.equal(clockNudge(none, { now: at(7, 10, 5) }), null); // window closed
  assert.equal(clockNudge(none, { now: at(3, 9, 1) }), null); // Saturday
  assert.equal(clockNudge(none, { now: at(7, 9, 1), off: true }), null); // day off
  assert.equal(clockNudge(none, { now: at(7, 9, 1), sent: { day: "2026-10-07", in: true } }), null); // already shown
  assert.equal(clockNudge(none, { now: at(8, 9, 1), sent: { day: "2026-10-07", in: true } }).kind, "in"); // new day
  const inside = day(7, [["in", 8, 55]]);
  assert.equal(clockNudge(inside[0].events, { now: at(7, 9, 1) }), null); // already clocked in
  const out = clockNudge(inside[0].events, { now: at(7, 13, 0) });
  assert.equal(out.kind, "out");
  assert.equal(out.text, "Acuérdate de fichar al salir."); // 8:55 → already done at 13:00
  const smoked = day(7, [["in", 8, 50], ["pause", 10, 0], ["back", 10, 20]]);
  assert.equal(clockNudge(smoked[0].events, { now: at(7, 13, 0) }).text, "Acuérdate de fichar al salir. Hoy puedes salir a las 13:10.");
  assert.equal(clockNudge(smoked[0].events, { now: at(7, 12, 59) }), null);
  const left = day(7, [["in", 9, 0], ["out", 12, 58]]);
  assert.equal(clockNudge(left[0].events, { now: at(7, 13, 0) }), null); // already out
  assert.equal(clockNudge(inside[0].events, { now: at(7, 13, 0), sent: { day: "2026-10-07", out: true } }), null);
  assert.equal(clockNudge(none, { now: at(7, 10, 1), workStart: "10:00" }).kind, "in"); // follows his start time
});

test("QA #6: a correction that leaves the day impossible is refused", async () => {
  const { validSequence } = await import("../core/clock.js");
  const c = day(12, [["in", 9, 0], ["pause", 10, 0], ["back", 10, 15], ["out", 13, 15]]);
  const [inE, pauseE, backE, outE] = c[0].events;
  // ChatGPT's case: deleting «Vuelvo» left state=done with the pause still open
  assert.throws(() => editPunch(c, "2026-10-12", backE.id, { remove: true }), /no cuadra/);
  assert.throws(() => editPunch(c, "2026-10-12", outE.id, { time: "08:00" }), /no cuadra/); // «Salida» before «Entro»
  assert.throws(() => editPunch(c, "2026-10-12", pauseE.id, { time: "14:00" }), /no cuadra/); // pause after leaving
  assert.throws(() => editPunch(c, "2026-10-12", inE.id, { remove: true }), /no cuadra/);
  // still allowed: fix a time in order, delete the last one, delete the only one
  assert.equal(tally(editPunch(c, "2026-10-12", outE.id, { time: "13:30" })[0].events, at(13, 0)).workedMin, 255);
  assert.equal(clockState(editPunch(c, "2026-10-12", outE.id, { remove: true })[0].events), "working");
  assert.ok(validSequence(c[0].events));
  // sort by real time even with mixed offsets
  assert.ok(validSequence([{ t: "in", at: "2026-10-12T09:00:00+02:00" }, { t: "out", at: "2026-10-12T08:00:00Z" }]));
});

test("WEB-79: the month as a note and as a calendar", async () => {
  const { monthNote, monthIcs } = await import("../core/clock.js");
  const c = [...day(5, [["in", 8, 55], ["pause", 10, 0, "Café"], ["back", 10, 15], ["out", 13, 25]]), ...day(6, [["in", 9, 0]])];
  const r = monthReport(c, "2026-10", { now: at(6, 12) });
  const note = monthNote(r, "octubre de 2026");
  assert.match(note, /^Fichaje · octubre de 2026/);
  assert.match(note, /Lun 5: 08:55 – 13:25 · 4 h 15 min \(1 pausa, 15 min\) · \+15 min/);
  assert.match(note, /Mar 6: 09:00 – sin salida/);
  assert.match(note, /RK te debe 15 min\./);
  const ics = monthIcs(c, "2026-10", { now: at(6, 12) });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261005T085500\r\nDTEND:20261005T132500/);
  assert.match(ics, /SUMMARY:Trabajo 08:55–13:25 \(\+15 min\)/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 1); // the open day is left out
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

test("WEB-89: punchAt puts a late punch in its place and refuses what does not fit", async () => {
  const { punchAt, punch } = await import("../core/clock.js");
  let c = punch([], "in", { at: new Date(2026, 9, 6, 9, 0), id: "a" });
  c = punchAt(c, "pause", { at: new Date(2026, 9, 6, 11, 0), id: "c", why: "Café" });
  c = punchAt(c, "back", { at: new Date(2026, 9, 6, 11, 10), id: "d" });
  c = punchAt(c, "out", { at: new Date(2026, 9, 6, 13, 5), id: "b" });
  assert.deepEqual(c[0].events.map((e) => e.t), ["in", "pause", "back", "out"]);
  assert.deepEqual(punchAt(c, "back", { at: new Date(2026, 9, 6, 11, 10), id: "d" }), c, "same id twice: nothing changes");
  assert.throws(() => punchAt(c, "in", { at: new Date(2026, 9, 6, 10, 0), id: "e" }), /ya estabas dentro/);
});

test("WEB-89: a Shortcut punch that arrives late goes before a later one made in the app", async () => {
  const { punchAt, punch } = await import("../core/clock.js");
  // «Entro» from the Shortcut at 9:02, then a pause tapped in MANU at 11:00.
  let c = punchAt([], "in", { at: new Date(2026, 9, 6, 9, 2), id: "s1" });
  c = punch(c, "pause", { at: new Date(2026, 9, 6, 11, 0), id: "a1" });
  assert.deepEqual(c[0].events.map((e) => e.t), ["in", "pause"]);
  assert.throws(() => punchAt(c, "out", { at: new Date(2026, 9, 6, 10, 0), id: "s2" }), /no estabas trabajando|cuadra/, "an «out» before a pause that has no return does not fit");
});
