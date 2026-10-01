import test from "node:test";
import assert from "node:assert/strict";
import { whatNow, whatNowText, isWhatNowQuestion, staleProjects } from "../core/now.js";

const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min);
const iso = (y, m, d, h, min = 0) => at(y, m, d, h, min).toISOString();

test("WEB-58: a due reminder and an event about to start come first", () => {
  const now = at(2026, 9, 30, 17, 0);
  const r = whatNow({ now, reminders: [{ text: "llamar al banco", at: iso(2026, 9, 30, 16, 30) }], events: [{ time: "18:00", title: "Cine" }], tasks: [{ text: "pagar Orange", at: iso(2026, 9, 1, 9) }] });
  assert.equal(r.main.t, "Te toca: llamar al banco.");
  assert.equal(r.more[0].t, "Prepárate: Cine a las 18:00.");
  assert.match(r.more[0].t, /Cine/);
  assert.match(whatNowText(r), /Después:/);
});

test("WEB-58: at work only the next task; after work, projects and people", () => {
  const now = at(2026, 9, 30, 10, 0);
  const tasks = [{ text: "subir el reel del piso", at: iso(2026, 9, 29, 9) }, { text: "flyer", at: iso(2026, 9, 20, 9) }];
  const projects = [{ id: "p1", name: "fiestas gijón", emoji: "🎉", createdAt: iso(2026, 8, 1, 10) }];
  const quiet = [{ name: "Persona Demo", lastContact: iso(2026, 8, 1, 10) }];
  const work = whatNow({ now, mode: "WORK", tasks, projects, quiet });
  assert.equal(work.main.t, "Lo siguiente: flyer."); // the oldest
  assert.ok(![work.main, ...work.more].some((x) => /fiestas|Persona/.test(x.t)));
  const tarde = whatNow({ now: at(2026, 9, 30, 17), mode: "AFTERNOON", tasks, projects, quiet });
  assert.match(tarde.main.t, /Diez minutos para «fiestas gijón»/);
  assert.match(tarde.main.why, /60 días/);
  assert.equal(tarde.more[0].t, "Escribe a Persona Demo.");
});

test("WEB-58: low mood gets care first (after work), late night means sleep", () => {
  const moods = [{ day: "2026-09-30", value: 1 }];
  const r = whatNow({ now: at(2026, 9, 30, 18), mode: "AFTERNOON", moods, tasks: [{ text: "x", at: iso(2026, 9, 1, 9) }] });
  assert.equal(r.main.e, "💙");
  assert.match(r.main.why, /estoy de bajón/);
  const w = whatNow({ now: at(2026, 9, 30, 10), mode: "WORK", moods, tasks: [{ text: "x", at: iso(2026, 9, 1, 9) }] });
  assert.match(w.main.why, /Cuando salgas del trabajo/);
  const n = whatNow({ now: at(2026, 10, 1, 3), mode: "NIGHT", events: [{ time: "09:00", title: "Trabajo" }] });
  assert.equal(n.main.t, "A dormir.");
  assert.match(n.main.why, /Trabajo a las 09:00/);
  const empty = whatNow({ now: at(2026, 9, 30, 17), mode: "AFTERNOON" });
  assert.match(empty.main.t, /Nada pendiente/);
  assert.equal(empty.more.length, 0);
});

test("WEB-58: stale projects use the latest touch (sources, chat)", () => {
  const now = at(2026, 9, 30, 12);
  const ps = [
    { id: "a", name: "viejo", createdAt: iso(2026, 1, 1, 9) },
    { id: "b", name: "vivo", createdAt: iso(2026, 1, 1, 9), chat: [{ at: iso(2026, 9, 28, 9) }] },
    { id: "c", name: "fuente", createdAt: iso(2026, 1, 1, 9), sources: [{ at: iso(2026, 9, 10, 9) }] },
  ];
  assert.deepEqual(staleProjects(ps, now).map((x) => x.project.id), ["a", "c"]);
});

test("WEB-58: the question, and phrases that are not it", () => {
  for (const q of ["¿Qué hago ahora?", "que hago", "y ahora qué", "q hago hoy", "me aburro", "estoy aburrido", "no sé qué hacer", "¿qué me toca?", "¿Qué es lo siguiente?"]) assert.ok(isWhatNowQuestion(q), q);
  for (const q of ["qué hago para sacarme el carnet", "qué hago de cena", "que hago con el pollo", "gasté 3 en pan", "hago la compra"]) assert.equal(isWhatNowQuestion(q), false, q);
});

test("WEB-59: screenshots waiting show up in the afternoon, never at work", () => {
  const r = whatNow({ now: at(2026, 9, 30, 18), mode: "AFTERNOON", captures: 7 });
  assert.equal(r.main.t, "Revisa tus 7 capturas.");
  assert.deepEqual(r.main.go, { sub: "capturas" });
  assert.equal(whatNow({ now: at(2026, 9, 30, 10), mode: "WORK", captures: 7 }).main.t.includes("capturas"), false);
  assert.equal(whatNow({ now: at(2026, 9, 30, 11), mode: "WEEKEND", captures: 1 }).main.t.includes("captura"), false); // morning: not yet
});

import { oviedoTrip } from "../core/night.js";
test("WEB-71: on an Oviedo day, «Ahora» says when to leave, first of all", () => {
  const trip = oviedoTrip({ workStart: "09:00" });
  assert.deepEqual([trip.leave, trip.arrive], ["08:10", "08:50"]);
  const r = whatNow({ now: at(2026, 10, 7, 7, 40), mode: "MORNING", trip, reminders: [{ text: "x", at: iso(2026, 10, 7, 7, 30) }] });
  assert.equal(r.main.t, "Sal a las 08:10 hacia Oviedo.");
  assert.match(r.main.why, /Quedan 30 minutos/);
  assert.match(r.main.go.href, /destination=Oviedo/);
  assert.equal(whatNow({ now: at(2026, 10, 7, 8, 20), mode: "MORNING", trip }).main.t, "Vas justo: sal ya hacia Oviedo.");
  assert.equal(whatNow({ now: at(2026, 10, 7, 6, 0), mode: "MORNING", trip }).main.t.includes("Oviedo"), false); // too early
  assert.equal(whatNow({ now: at(2026, 10, 7, 9, 30), mode: "WORK", trip }).main.t.includes("Oviedo"), false); // already there
  assert.equal(oviedoTrip({ workStart: "10:30" }).leave, "09:40");
});
