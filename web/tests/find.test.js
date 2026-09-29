import test from "node:test";
import assert from "node:assert/strict";
import { findInVault, findCommand } from "../core/find.js";

const vault = {
  inbox: [{ id: "i1", text: "Idea: viaje a Lisboa en primavera", status: "IDEA", at: "2026-09-01T10:00:00Z" }, { id: "i2", text: "Llamar al taller por el coche", status: "TASK", at: "2026-09-20T10:00:00Z" }],
  spending: [{ id: "s1", cents: 4500, merchant: "Taller demo", at: "2026-09-22T10:00:00Z" }],
  income: [{ id: "n1", cents: 145000, concept: "Nómina demo", at: "2026-09-01T09:00:00Z" }],
  reminders: [{ id: "r1", text: "Recoger el coche del taller", at: "2026-09-25T18:00:00Z" }],
  people: [{ id: "p1", name: "Persona Demo", notes: "Vive en Lisboa" }],
  projects: [{ id: "pr1", name: "Viaje", emoji: "✈️", sources: [{ id: "x", title: "Hoteles", text: "Barrio Alfama en Lisboa" }] }],
  meals: [{ id: "m1", day: "2026-09-28", text: "Lentejas" }],
  chat: [{ from: "me", text: "¿qué tal Lisboa en octubre?", at: "2026-09-29T08:00:00Z" }],
};

test("WEB-48: one query finds it everywhere, newest first, accents and case ignored", () => {
  const r = findInVault(vault, "LISBOA");
  assert.deepEqual(r.map((x) => x.kind).sort(), ["Chat", "Fuente", "Idea", "Persona"].sort());
  assert.equal(r[0].kind, "Chat"); // newest
  assert.deepEqual(r.find((x) => x.kind === "Fuente").go, { project: "pr1" });
  const t = findInVault(vault, "taller");
  assert.deepEqual(t.map((x) => x.kind), ["Recordatorio", "Gasto", "Tarea"]);
  assert.equal(t[1].title, "Taller demo · 45,00 €");
});

test("WEB-48: every word must match, as the start of a word", () => {
  assert.deepEqual(findInVault(vault, "coche taller").map((x) => x.kind), ["Recordatorio", "Tarea"]);
  assert.deepEqual(findInVault(vault, "nomina").map((x) => x.kind), ["Ingreso"]);
  assert.equal(findInVault(vault, "isboa").length, 0); // not in the middle of a word
  assert.equal(findInVault(vault, "de la").length, 0); // stop words only
  assert.equal(findInVault({}, "algo").length, 0);
});

test("WEB-48: chat orders that ask to find something", () => {
  assert.equal(findCommand("busca Lisboa"), "lisboa");
  assert.equal(findCommand("¿Dónde apunté lo del alquiler?"), "alquiler");
  assert.equal(findCommand("encuentra el taller"), "taller");
  assert.equal(findCommand("busca en mi archivo lentejas"), null); // archive command
  assert.equal(findCommand("buscar una solución"), "una solucion");
  assert.equal(findCommand("gasté 3 en pan"), null);
});
