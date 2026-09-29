import { test } from "node:test";
import assert from "node:assert/strict";
import { quickDetect } from "../core/assistant.js";

const now = new Date(2026, 8, 29, 10, 0);

test("free text becomes the right kind", () => {
  assert.deepEqual(quickDetect("llamar al taller", now), { kind: "TASK", text: "llamar al taller" });
  assert.deepEqual(quickDetect("idea: viaje a Lisboa", now), { kind: "IDEA", text: "viaje a Lisboa" });
  assert.deepEqual(quickDetect("gasté 3,20 en café", now), { kind: "EXPENSE", cents: 320, merchant: "café" });
  assert.deepEqual(quickDetect("12,50 gasolina", now), { kind: "EXPENSE", cents: 1250, merchant: "gasolina" });
  assert.deepEqual(quickDetect("cena 30€", now), { kind: "EXPENSE", cents: 3000, merchant: "cena" });
  assert.equal(quickDetect("", now).kind, "TASK");
});

test("reminders get their date: today if still ahead, otherwise tomorrow", () => {
  const r = quickDetect("recuérdame sacar la basura a las 21", now);
  assert.equal(r.kind, "REMINDER"); assert.equal(r.text, "sacar la basura");
  assert.equal(r.at.getDate(), 29); assert.equal(r.at.getHours(), 21);
  assert.equal(quickDetect("recuérdame llamar a las 9", now).at.getDate(), 30);
  assert.equal(quickDetect("recuérdame mañana pagar el seguro a las 10", now).at.getDate(), 30);
});

test("numbers that are not money stay as tasks", () => {
  assert.equal(quickDetect("comprar 2 kilos de patatas", now).kind, "TASK");
  assert.equal(quickDetect("revisar el informe 3", now).kind, "TASK");
});
