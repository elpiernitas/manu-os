import test from "node:test";
import assert from "node:assert/strict";
import { parse, quickDetect } from "../core/assistant.js";

test("WEB-50: everyday ways of saying an expense", () => {
  const cases = [
    ["me he gastado 12 euros en el cine", 1200, "cine"], ["12€ cine", 1200, "cine"], ["20 euros en cena", 2000, "cena"],
    ["pagué 30 de gasolina", 3000, "gasolina"], ["he pagado 45,90 del gimnasio", 4590, "gimnasio"], ["me costó 3 el bus", 300, "bus"],
    ["compré pan por 2", 200, "pan"], ["gaste 8 en el Mercadona", 800, "Mercadona"],
  ];
  for (const [q, cents, merchant] of cases) assert.deepEqual(parse(q), { kind: "expense", cents, merchant }, q);
  assert.equal(parse("3 cosas que hacer").kind, "unknown"); // a number without currency is not money
});

test("WEB-50: tasks, and «tengo que contarte…» is conversation", () => {
  assert.deepEqual(parse("tengo que comprar leche"), { kind: "task", text: "comprar leche" });
  assert.deepEqual(parse("Tarea: renovar el DNI"), { kind: "task", text: "renovar el DNI" });
  assert.deepEqual(parse("añade tarea llamar al banco"), { kind: "task", text: "llamar al banco" });
  assert.equal(parse("hay que regar las plantas").kind, "unknown"); // WEB-55: «hay que» is usually an expression
  assert.equal(parse("tengo que contarte algo que me pasó").kind, "unknown");
  assert.equal(parse("¿tengo que ir mañana?").kind, "unknown");
  assert.equal(parse("tengo que hacer tantas cosas que no sé ni por dónde empezar hoy").kind, "unknown"); // long: conversation
  assert.deepEqual(quickDetect("tarea: renovar el dni"), { kind: "TASK", text: "renovar el dni" });
});

test("WEB-50: reminders with the time first, «avísame», and «en 20 minutos»", () => {
  assert.deepEqual(parse("recuérdame mañana a las 9 ir al médico"), { kind: "reminder", text: "ir al médico", tomorrow: true, time: "09:00" });
  assert.deepEqual(parse("avísame a las 18:30 de llamar a mamá"), { kind: "reminder", text: "llamar a mamá", tomorrow: false, time: "18:30" });
  assert.deepEqual(parse("avísame en 20 minutos de sacar la ropa"), { kind: "reminder", text: "sacar la ropa", inMinutes: 20 });
  assert.deepEqual(parse("recuérdame dentro de 2 horas mirar el horno"), { kind: "reminder", text: "mirar el horno", inMinutes: 120 });
  assert.deepEqual(parse("recuérdame en media hora apagar el fuego"), { kind: "reminder", text: "apagar el fuego", inMinutes: 30 });
  const now = new Date(2026, 8, 29, 11, 0);
  assert.equal(quickDetect("avísame en 20 minutos de sacar la ropa", now).at.getTime(), now.getTime() + 20 * 60000);
});

test("WEB-50: alarms, ideas without «idea:», spending questions", () => {
  assert.deepEqual(parse("despiértame a las 7:30"), { kind: "alarm", time: "07:30" });
  assert.deepEqual(parse("alarma a las 6"), { kind: "alarm", time: "06:00" });
  assert.deepEqual(parse("apunta idea: app de recetas"), { kind: "idea", text: "app de recetas" });
  assert.deepEqual(parse("¿cuánto llevo gastado este mes?"), { kind: "spendQuery", category: null });
  assert.deepEqual(parse("¿cuánto gasté en comida?"), { kind: "spendQuery", category: "FOOD_AND_DRINK" });
  assert.deepEqual(parse("cuanto llevo gastado en el super este mes"), { kind: "spendQuery", category: "GROCERIES" });
});
