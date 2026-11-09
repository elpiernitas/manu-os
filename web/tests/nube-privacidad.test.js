// WEB-98 — memoria y estilo en Tu nube: qué sube, qué baja, cómo se borra. Datos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import { cloudPayload, applyRemote, erasedVault, isErased, cloudInventory, brainInCloud } from "../core/cloudprivacy.js";
import { maskExample, observeText, emptyStyle, surfaceForm, expressionCandidates, scrubStyle } from "../core/style.js";
import { emptyBrain, remember, forget } from "../core/brain.js";
import { emptyVault, validateVault } from "../core/storage.js";
import { isEmptyVault } from "../core/sync.js";

const NOW = new Date("2026-11-09T10:00:00+01:00");
function vaultWithBrain() {
  let b = emptyBrain();
  b = remember(b, { text: "Me gusta el café solo", kind: "PREFERENCE", source: { kind: "manu" } }, { now: NOW, uid: () => "c1" }).brain;
  b = remember(b, { text: "A Persona Inventada le gusta el té", kind: "FACT", thirdParty: true, subject: "Persona Inventada", source: { kind: "manu" } }, { now: NOW, uid: () => "c2" }).brain;
  b = remember(b, { text: "He decidido no pedir comida entre semana", kind: "DECISION", source: { kind: "manu" } }, { now: NOW, uid: () => "c3" }).brain;
  b.style = { ...emptyStyle(), msgs: 3, days: ["2026-11-08"], grams: { "que maquina": { n: 3, days: ["2026-11-08", "2026-11-09"], ex: "ayer con Lucía en el bar, qué máquina" } } };
  return { ...emptyVault(), inbox: [{ id: "i1", text: "Tarea inventada", kind: "TASK" }], brain: b };
}

test("examples mask names, numbers, links and emails, but keep Manu's words", () => {
  assert.equal(maskExample("ayer con Lucía en el bar, qué máquina"), "ayer con … en el bar, qué máquina");
  assert.equal(maskExample("pagué 25 en https://x.com y a@b.com"), "pagué … en … y …");
  assert.match(maskExample("¿Vienes? Pelayo dice que sí"), /^¿…\? … dice que sí$/, "a name at the start of a sentence is masked too");
  assert.equal(maskExample("Qué máquina eres"), "Qué máquina eres", "common words at the start stay");
  let s = emptyStyle();
  for (const [t, d] of [["qué máquina con Iván", 0], ["qué máquina", 1], ["Qué máquina, Iván", 2]]) s = observeText(s, t, { now: new Date(NOW.getTime() + d * 864e5) });
  const c = expressionCandidates(s)[0];
  assert.equal(c.text, "qué máquina", "accents still recovered from the masked example");
  assert.doesNotMatch(JSON.stringify(s), /Iván/, "the name is nowhere in the model");
});

test("what goes up: memory and style by default (Manu's decision), old examples scrubbed, vault untouched", () => {
  const v = vaultWithBrain();
  const before = JSON.stringify(v);
  const p = cloudPayload(v);
  assert.equal(JSON.stringify(v), before, "never mutates the vault");
  assert.ok(brainInCloud(v));
  assert.equal(p.brain.claims.length, 3);
  assert.equal(p.brain.style.grams["que maquina"].ex, "ayer con … en el bar, qué máquina");
  assert.doesNotMatch(JSON.stringify(p), /Lucía/);
  assert.equal(scrubStyle(null), null);
});

test("memory kept per device: not uploaded, and the local one survives a download", () => {
  const v = { ...vaultWithBrain(), settings: { cloudBrain: false } };
  const p = cloudPayload(v);
  assert.ok(!("brain" in p), "forgetting the switch removes the memory from the cloud on the next push");
  const remote = { ...emptyVault(), inbox: [{ id: "i9", text: "Del Mac" }], settings: { cloudBrain: false } };
  const merged = validateVault(applyRemote(remote, v));
  assert.ok(merged.ok);
  assert.equal(merged.vault.brain.claims.length, 3, "this device's memory is kept");
  assert.equal(merged.vault.inbox[0].id, "i9", "the rest comes from the cloud");
  const on = { ...emptyVault(), brain: emptyBrain() };
  assert.equal(applyRemote(on, v), on, "with memory in the cloud, the cloud copy wins as before");
});

test("forgetting a memory removes its text from what goes up", () => {
  const v = vaultWithBrain();
  const b = forget(v.brain, "c2", { now: NOW }).brain;
  const up = JSON.stringify(cloudPayload({ ...v, brain: b }));
  assert.doesNotMatch(up, /Persona Inventada|le gusta el té/);
});

test("«Vaciar mi nube»: an empty, marked copy that no device applies over its data", () => {
  const e = erasedVault({ now: NOW, device: "iPhone" });
  assert.ok(isErased(e)); assert.ok(!isErased(vaultWithBrain())); assert.ok(!isErased(null));
  assert.ok(validateVault(e).ok, "still a valid row for the table");
  assert.ok(isEmptyVault(e), "signing in again treats it as empty: this device's data goes up over it");
  assert.equal(JSON.stringify(e).includes("Tarea"), false);
});

test("inventory: counts only, flags other people's data", () => {
  const inv = cloudInventory(vaultWithBrain());
  assert.deepEqual([inv.brain, inv.memories, inv.thirdParty, inv.decisions, inv.styleMsgs, inv.examples], [true, 3, 1, 1, 3, 1]);
  assert.equal(inv.rest.tareas, 1);
  assert.doesNotMatch(JSON.stringify(inv), /café|Persona/);
  const off = cloudInventory({ ...vaultWithBrain(), settings: { cloudBrain: false } });
  assert.equal(off.brain, false); assert.equal(off.memories, 0);
});
