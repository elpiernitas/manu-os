// Franjas del día, trabajo visible solo cuando toca, fin de semana y dinero en una línea.
import test from "node:test";
import assert from "node:assert/strict";
import { franja, visibleTasks, hiddenWork, weekendKey, moneyLine } from "../core/daymode.js";

const at = (d, h, m = 0) => new Date(2026, 10, d, h, m); // nov 2026: el 16 es lunes, el 21 sábado

test("franjas de un día laborable: mañana, trabajo, desconexión, tarde y noche", () => {
  assert.equal(franja(at(16, 7, 30)).key, "MORNING");
  assert.equal(franja(at(16, 10)).key, "WORK");
  assert.equal(franja(at(16, 13, 5)).key, "DISCONNECT");
  assert.equal(franja(at(16, 13, 5), { closedDay: "2026-11-16" }).key, "AFTERNOON", "cerrada la jornada, ya es tarde");
  assert.equal(franja(at(16, 16)).key, "AFTERNOON");
  assert.equal(franja(at(16, 23)).key, "NIGHT");
});

test("el trabajo se ve de la mañana al cierre; después, ni en la tarde ni el fin de semana", () => {
  const tasks = [{ id: "a", text: "Enviar planos", work: true }, { id: "b", text: "Llamar al taller" }];
  const ids = (f) => visibleTasks(tasks, f).map((t) => t.id);
  assert.deepEqual(ids(franja(at(16, 8))), ["a", "b"], "por la mañana de un laborable, sí");
  assert.deepEqual(ids(franja(at(16, 10))), ["a", "b"]);
  assert.deepEqual(ids(franja(at(16, 13, 30), { closedDay: "2026-11-16" })), ["b"], "cerrada la jornada, fuera");
  assert.deepEqual(ids(franja(at(16, 17))), ["b"]);
  assert.deepEqual(ids(franja(at(21, 11))), ["b"], "el sábado, fuera");
  assert.equal(hiddenWork(tasks, franja(at(21, 11))), 1, "pero se dice cuántas esperan");
  assert.equal(hiddenWork(tasks, franja(at(16, 10))), 0);
});

test("fin de semana: se pregunta cada uno; descanso o proyectos solo si Manu lo dice", () => {
  const sab = franja(at(21, 11)), dom = franja(at(22, 11));
  assert.equal(sab.key, "WEEKEND"); assert.equal(sab.weekendPlan, null, "sin decidir, no se supone nada");
  assert.equal(weekendKey(at(21, 11)), weekendKey(at(22, 18)), "sábado y domingo son el mismo fin de semana");
  const plans = { [weekendKey(at(21, 9))]: "descanso" };
  assert.equal(franja(at(22, 12), { weekendPlans: plans }).weekendPlan, "descanso");
  assert.equal(franja(at(28, 12), { weekendPlans: plans }).weekendPlan, null, "el siguiente vuelve a preguntar");
  assert.equal(dom.showsWork, false);
  assert.equal(franja(at(21, 23)).key, "NIGHT");
});

test("dinero en una línea: dato, comparación y el humor justo, sin juzgar", () => {
  const s = { consumo: 31250, fiable: true, pending: { cents: 0 } };
  assert.equal(moneyLine(s, null), "Llevas 312,50 € este mes.");
  assert.match(moneyLine(s, 4, { humor: 1 }), /^Llevas 312,50 € este mes\. (Como|Igual)/);
  assert.match(moneyLine(s, -23, { humor: 0 }), /Un 23 % menos que el mes pasado a estas alturas\.$/);
  assert.match(moneyLine(s, 18, { humor: 2, seed: 1 }), /Un 18 % más/);
  for (const h of [0, 1, 2]) for (let seed = 0; seed < 4; seed++) for (const d of [-30, 0, 30]) assert.ok(!/deberías|cuidado|mal|gastón|derroch/i.test(moneyLine(s, d, { humor: h, seed })), "nunca juzga");
  assert.match(moneyLine({ consumo: 100, fiable: false, pending: { cents: 60000 } }, 50), /provisional: hay 600,00 € sin atribuir/);
  assert.equal(moneyLine(null, 0), null);
});
