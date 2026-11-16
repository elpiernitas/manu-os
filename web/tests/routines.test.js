// Rutinas de trabajo: aparecen el día que tocan, una vez por periodo, como tareas de trabajo.
import test from "node:test";
import assert from "node:assert/strict";
import { routineTasks, dueOn, lastWorkday, periodKey, newRoutine, MARKETING_PRESETS, routineWhen } from "../core/routines.js";

const d = (m, day, h = 9) => new Date(2026, m, day, h); // noviembre = 10; 20 nov 2026 es viernes
let n = 0; const uid = () => `t${++n}`;

test("semanal: el día elegido, una sola vez por semana, como tarea de trabajo", () => {
  const r = newRoutine({ id: "v", text: "Piezas de vendidos", every: "weekly", weekday: 5 });
  assert.equal(dueOn(r, d(10, 19)), false, "jueves no");
  const a = routineTasks([r], d(10, 20), { uid });
  assert.equal(a.tasks.length, 1);
  assert.equal(a.tasks[0].work, true); assert.equal(a.tasks[0].routine, "v"); assert.equal(a.tasks[0].status, "TASK");
  assert.equal(routineTasks([r], d(10, 20, 17), { done: a.done, uid }).tasks.length, 0, "ni aunque la completes o la borres");
  assert.equal(routineTasks([r], d(10, 27), { done: a.done, uid }).tasks.length, 1, "la semana siguiente, otra");
  assert.equal(routineTasks([{ ...r, on: false }], d(10, 20), { uid }).tasks.length, 0, "apagada, nada");
  assert.equal(routineWhen(r), "Cada viernes");
});

test("mensual y trimestral: el último día laborable", () => {
  assert.equal(lastWorkday(2026, 10).getDate(), 30, "noviembre 2026 acaba en lunes 30");
  assert.equal(lastWorkday(2026, 4).getDate(), 29, "mayo 2026 acaba en domingo 31 → viernes 29");
  const m = newRoutine({ id: "p", text: "Informe", every: "monthly" });
  assert.equal(dueOn(m, d(10, 27)), false);
  assert.equal(dueOn(m, d(10, 30)), true);
  const q = newRoutine({ id: "q", text: "Informe trimestral", every: "quarterly" });
  assert.equal(dueOn(q, d(10, 30)), false, "noviembre no cierra trimestre");
  assert.equal(dueOn(q, new Date(2026, 11, 31, 9)), true, "31 dic 2026 es jueves, cierra trimestre");
  assert.equal(periodKey(q, new Date(2026, 11, 31)), "2026-Q4");
});

test("validación y propuestas de marketing (se confirman, no se activan solas)", () => {
  assert.throws(() => newRoutine({ id: "x", text: " " }));
  assert.throws(() => newRoutine({ id: "x", text: "a", every: "daily" }));
  assert.equal(newRoutine({ id: "x", text: "a", weekday: 99 }).weekday, 7);
  assert.equal(MARKETING_PRESETS.length, 3);
  assert.ok(MARKETING_PRESETS.every((p) => !("on" in p)), "las propuestas no vienen activadas");
});
