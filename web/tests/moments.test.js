// Momentos (WEB-120). Datos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import { newMoment, byMonth, onThisDay, searchMoments } from "../core/moments.js";
import { cloudPayload, applyRemote } from "../core/cloudprivacy.js";
import { validateVault, emptyVault } from "../core/storage.js";

const now = new Date(2026, 10, 20, 21, 0);

test("un momento necesita una frase o una foto, y no puede ser del futuro", () => {
  const m = newMoment({ id: "m1", text: "  Café al sol en el puerto  ", people: ["p1", "p1"], place: "Puerto" }, now);
  assert.equal(m.day, "2026-11-20"); assert.equal(m.text, "Café al sol en el puerto"); assert.deepEqual(m.people, ["p1"]); assert.equal(m.source, "manu");
  assert.equal(newMoment({ id: "m2", imageId: "img1" }, now).text, "", "solo foto vale");
  assert.throws(() => newMoment({ id: "m3", text: " " }, now), /frase o elige una foto/);
  assert.throws(() => newMoment({ id: "m4", text: "x", day: "2026-11-21" }, now), /ya ha pasado/);
  assert.equal(newMoment({ id: "m5", text: "x", day: "no" }, now).day, "2026-11-20");
});

test("por meses, tal día como hoy y búsqueda (también por persona)", () => {
  const list = [
    { id: "a", day: "2026-11-20", text: "Paseo por la playa", people: ["p1"], createdAt: "1" },
    { id: "b", day: "2026-10-02", text: "Cena tranquila", place: "Casa", people: [], createdAt: "1" },
    { id: "c", day: "2025-11-20", text: "Primer día en la oficina", people: [], createdAt: "1" },
  ];
  assert.deepEqual(byMonth(list).map((g) => [g.label, g.items.length]), [["noviembre de 2026", 1], ["octubre de 2026", 1], ["noviembre de 2025", 1]]);
  assert.deepEqual(onThisDay(list, now).map((m) => m.id), ["c"]);
  assert.deepEqual(searchMoments(list, "playa").map((m) => m.id), ["a"]);
  assert.deepEqual(searchMoments(list, "persona", [{ id: "p1", name: "Persona Prueba" }]).map((m) => m.id), ["a"]);
});

test("los momentos no suben a Tu nube y el dispositivo conserva los suyos", () => {
  const v = { ...emptyVault(), moments: [{ id: "a", day: "2026-11-20", text: "x", people: [], createdAt: "1" }] };
  assert.equal(cloudPayload(v).moments, undefined);
  assert.equal(applyRemote({ ...emptyVault() }, v).moments.length, 1, "bajar de la nube no borra los momentos de aquí");
  assert.equal(validateVault({ ...v }).ok, true);
  assert.equal(validateVault({ ...v, moments: "x" }).ok, false);
});
