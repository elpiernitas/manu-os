import test from "node:test";
import assert from "node:assert/strict";
import { dayLines, diaryDocs, dayFromText, isDiaryQuestion, dayTitle } from "../core/diary.js";
import { search } from "../core/archive.js";

const at = (d, h = 10) => new Date(`${d}T${String(h).padStart(2, "0")}:30:00`).toISOString();
const VAULT = {
  spending: [{ cents: 1250, merchant: "Gasolinera", at: at("2026-09-22", 9) }, { cents: 300, merchant: "Café", at: at("2026-09-22", 11) }],
  income: [{ cents: 150000, concept: "Nómina", at: at("2026-09-25") }],
  inbox: [{ text: "Llamar al taller", status: "TASK", done: true, at: at("2026-09-22") }, { text: "App de recetas", status: "IDEA", at: at("2026-09-23") }],
  reminders: [{ text: "Sacar la basura", at: at("2026-09-23", 21) }],
  moods: [{ day: "2026-09-22", value: 3 }],
  habits: [{ name: "Leer", done: ["2026-09-22"] }],
  meals: [{ day: "2026-09-22", time: "14:00", text: "Lentejas" }],
  health: [{ day: "2026-09-22", kind: "pasos", value: 9000 }],
  agenda: null,
};

test("a day in the diary: money, tasks, mood, habits, meals, health and agenda", () => {
  const lines = dayLines(VAULT, "2026-09-22", { calendar: { "2026-09-22": [{ time: "18:00", title: "Dentista demo" }] } });
  const all = lines.join("\n");
  for (const s of ["Gastos (15,50 €)", "Gasolinera", "Llamar al taller (hecha)", "Ánimo: Bien", "Hábitos hechos: Leer", "14:00 Lentejas", "pasos 9000", "18:00 Dentista demo"]) assert.ok(all.includes(s), s);
  assert.deepEqual(dayLines(VAULT, "2026-09-24"), []);
});

test("diary documents: one per day with something, never the future, searchable", () => {
  const docs = diaryDocs(VAULT, { now: new Date("2026-09-24T12:00:00") });
  assert.deepEqual(docs.map((d) => d.day), ["2026-09-22", "2026-09-23"]); // 25th is in the future
  assert.equal(docs[0].id, "diario:2026-09-22");
  assert.equal(docs[0].title, "Diario del martes 22 de septiembre de 2026");
  assert.equal(search(docs, "lentejas")[0].doc.day, "2026-09-22");
  assert.equal(dayTitle("2026-09-29"), "martes 29 de septiembre de 2026");
});

test("dates in Spanish: ayer, el lunes, el 12, 12 de septiembre, 3/9", () => {
  const now = new Date(2026, 8, 29); // martes 29 sep 2026
  assert.equal(dayFromText("¿qué hice ayer?", now), "2026-09-28");
  assert.equal(dayFromText("anteayer", now), "2026-09-27");
  assert.equal(dayFromText("¿qué hice el lunes?", now), "2026-09-28");
  assert.equal(dayFromText("¿qué pasó el martes?", now), "2026-09-22"); // last Tuesday, not today
  assert.equal(dayFromText("¿cuánto gasté el 12?", now), "2026-09-12");
  assert.equal(dayFromText("el 12 de agosto", now), "2026-08-12");
  assert.equal(dayFromText("el 3/10", now), "2025-10-03"); // a future date means last year
  assert.equal(dayFromText("gasté 12 en café", now), null);
  assert.ok(isDiaryQuestion("¿qué hice ayer?"));
  assert.ok(isDiaryQuestion("¿cuánto gasté el martes?"));
  assert.ok(!isDiaryQuestion("gasté 12 en café"));
  assert.ok(!isDiaryQuestion("¿qué hice?"));
});
