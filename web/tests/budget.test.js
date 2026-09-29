import test from "node:test";
import assert from "node:assert/strict";
import { budgetStatus, budgetLine, budgetCommand, categoryFromText } from "../core/budget.js";

const at = (d) => new Date(`${d}T12:00:00`).toISOString();

test("WEB-47: status per category — ok, warn (80 % or ahead of the month), over", () => {
  const now = new Date(2026, 8, 10, 12); // day 10 of 30: a third of the month
  const spending = [
    { category: "FOOD_AND_DRINK", cents: 22000, at: at("2026-09-05") }, // 220 of 200 → over
    { category: "LEISURE", cents: 4000, at: at("2026-09-08") },         // 40 of 50 = 80 % → warn
    { category: "TRANSPORT", cents: 6000, at: at("2026-09-03") },       // 60 of 100 on day 10 → ahead → warn
    { category: "GROCERIES", cents: 5000, at: at("2026-09-02") },       // 50 of 300 → ok
    { category: "GROCERIES", cents: 99999, at: at("2026-08-20") },      // last month: ignored
  ];
  const r = budgetStatus(spending, { FOOD_AND_DRINK: 20000, LEISURE: 5000, TRANSPORT: 10000, GROCERIES: 30000, NOPE: 100, HEALTH: -5 }, now);
  assert.deepEqual(r.map((b) => [b.cat, b.status]), [["FOOD_AND_DRINK", "over"], ["LEISURE", "warn"], ["TRANSPORT", "warn"], ["GROCERIES", "ok"]]);
  assert.equal(budgetLine(r[0]), "Comer y beber: te has pasado 20,00 € del presupuesto (200,00 €).");
  assert.equal(budgetLine(r[3]), "Supermercado: llevas 50,00 € de 300,00 € (17 %), te quedan 250,00 €.");
});

test("WEB-47: categories from everyday words", () => {
  assert.equal(categoryFromText("comida"), "FOOD_AND_DRINK");
  assert.equal(categoryFromText("el súper"), "GROCERIES");
  assert.equal(categoryFromText("ocio nocturno"), "NIGHTLIFE"); // longest match wins over «ocio»
  assert.equal(categoryFromText("ocio"), "LEISURE");
  assert.equal(categoryFromText("gasolina"), "TRANSPORT");
  assert.equal(categoryFromText("nada que ver"), null);
});

test("WEB-47: budget orders from the chat", () => {
  assert.deepEqual(budgetCommand("Pon un presupuesto de 200 € para comida"), { kind: "set", cat: "FOOD_AND_DRINK", cents: 20000 });
  assert.deepEqual(budgetCommand("presupuesto de ocio nocturno 80,5"), { kind: "set", cat: "NIGHTLIFE", cents: 8050 });
  assert.deepEqual(budgetCommand("quita el presupuesto de tabaco"), { kind: "remove", cat: "TOBACCO" });
  assert.deepEqual(budgetCommand("¿cómo voy de presupuesto?"), { kind: "ask" });
  assert.equal(budgetCommand("gasté 20 en comida"), null);
  assert.equal(budgetCommand("presupuesto de 200"), null); // no category: not guessed
});
