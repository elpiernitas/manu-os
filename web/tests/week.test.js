// La semana (WEB-121): tipos separados, tiempo reservado, conflictos, preparar la semana. Datos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import { weekView, weekAdvice, newReserve, reservesOn, declineText, prepareWeek } from "../core/week.js";

const now = new Date(2026, 10, 20, 17, 0); // viernes
const cal = { "2026-11-20": [{ time: "19:00", end: "20:00", title: "Pádel" }], "2026-11-23": [{ time: "18:30", end: "19:30", title: "Cena de prueba" }] };
const eventsFor = (k) => cal[k] ?? [];

test("cada cosa por lo que es: evento, recordatorio, reservado y propuesta", () => {
  const v = {
    reminders: [{ id: "r1", text: "Llamar al taller", at: new Date(2026, 10, 21, 10, 0).toISOString(), done: false }],
    inbox: [{ id: "i1", status: "IDEA", text: "Comida familiar el domingo a las 14:00" }],
    settings: { reserved: [newReserve({ id: "z1", weekday: 1, from: "18:00", to: "21:00", kind: "descanso" })] },
  };
  const w = weekView(v, now, { eventsFor });
  assert.equal(w.length, 7);
  assert.deepEqual(w[0].items.map((x) => x.type), ["evento"]);
  assert.equal(w[1].label, "Mañana"); assert.equal(w[1].items[0].type, "recordatorio");
  assert.equal(w[2].items[0].type, "propuesta", "lo que MANU supone va como propuesta, no como evento");
  const lunes = w.find((d) => d.key === "2026-11-23");
  assert.deepEqual(lunes.items.map((x) => x.type), ["reservado", "evento"]);
  assert.equal(lunes.conflicts.length, 1, "la cena choca con el rato reservado");
  assert.match(weekAdvice(w)[0].text, /Tú decides/);
});

test("reservar tiempo: validación y días", () => {
  assert.throws(() => newReserve({ id: "x", weekday: 1, from: "20:00", to: "19:00" }), /fin posterior/);
  assert.throws(() => newReserve({ id: "x" }), /Elige un día/);
  const r = newReserve({ id: "x", day: "2026-11-25", from: "9:05", to: "10:00", kind: "rara" });
  assert.equal(r.kind, "descanso");
  assert.equal(reservesOn([r], new Date(2026, 10, 25)).length, 1);
  assert.equal(reservesOn([newReserve({ id: "y", weekday: 0 })], new Date(2026, 10, 22)).length, 1, "cada domingo");
});

test("semana cargada sin descanso → propone proteger un rato, sin llenar huecos", () => {
  const busy = {}; for (const k of ["2026-11-20", "2026-11-21", "2026-11-23", "2026-11-24"]) busy[k] = Array.from({ length: 5 }, (_, i) => ({ time: `${pad(9 + i)}:00`, title: `Reunión ${i}` }));
  function pad(n) { return String(n).padStart(2, "0"); }
  const adv = weekAdvice(weekView({}, now, { eventsFor: (k) => busy[k] ?? [] }));
  assert.equal(adv.length, 1); assert.equal(adv[0].kind, "proteger"); assert.match(adv[0].text, /sin planes/);
  assert.deepEqual(weekAdvice(weekView({}, now, { eventsFor })), [], "una semana normal no recibe consejos");
});

test("decir que no: texto listo para copiar, sin excusas inventadas", () => {
  assert.match(declineText("Cena de prueba"), /esta vez no puedo/);
  assert.doesNotMatch(declineText("x"), /enferm|médico|trabajo/i);
  assert.match(declineText("x", { tone: "mover" }), /moverlo/);
});

test("preparar la semana: rápido (3 por bloque) y completo, sin inventar", () => {
  const v = { inbox: Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, status: "TASK", text: `Tarea ${i}`, at: `2026-11-0${i + 1}` })).concat([{ id: "i1", status: "IDEA", text: "Idea suelta", at: "2026-11-10" }]),
    docs: [{ id: "d", title: "Seguro", expires: "2026-12-01" }], projects: [{ id: "p", name: "Proyecto Alfa" }] };
  const q = prepareWeek(v, now, { eventsFor, recurring: [{ label: "Streaming", nextDay: "3/12" }] });
  assert.equal(q.minutes, 10);
  assert.deepEqual(q.blocks.map((b) => b.key), ["citas", "tareas", "docs", "pagos", "libre"]);
  const t = q.blocks.find((b) => b.key === "tareas"); assert.equal(t.items.length, 3); assert.equal(t.total, 6); assert.equal(t.items[0], "Tarea 0", "lo más antiguo primero");
  assert.match(q.blocks.find((b) => b.key === "pagos").from, /estimación/);
  const c = prepareWeek(v, now, { mode: "completo", eventsFor });
  assert.ok(c.blocks.some((b) => b.key === "ideas" && b.items[0] === "Idea suelta"));
  assert.equal(c.blocks.find((b) => b.key === "tareas").items.length, 6);
  assert.equal(prepareWeek({}, now).blocks.every((b) => Array.isArray(b.items)), true);
});

import { newInterest, resourcesFor } from "../core/interests.js";
test("aficiones y aprender: ligero, sin inventar pasos", () => {
  assert.throws(() => newInterest({ id: "a", name: " " }), /nombre/);
  const g = newInterest({ id: "a", name: "Fotografía analógica" });
  assert.equal(g.kind, "aficion"); assert.equal(g.step, undefined, "sin paso si Manu no lo escribe");
  const lib = [{ id: "l1", title: "Manual de fotografía", kind: "libro" }, { id: "l2", title: "Recetas" }];
  assert.deepEqual(resourcesFor(g, lib).map((x) => x.id), ["l1"]);
  assert.equal(newInterest({ id: "b", kind: "aprender", name: "Inglés", step: "Ver una serie en VO" }).step, "Ver una serie en VO");
});
