// WEB-98 — memoria y estilo en Tu nube: qué sube, qué baja, cómo se borra. Datos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import { cloudPayload, applyRemote, erasedVault, isErased, cloudInventory, brainInCloud, claimCloud, intimate, applyTombstones } from "../core/cloudprivacy.js";
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
  assert.deepEqual(p.brain.claims.map((c) => c.id), ["c1", "c3"], "WEB-99: the memory about another person stays on the device unless authorized");
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
  const on = { ...emptyVault(), brain: { ...emptyBrain(), claims: [v.brain.claims[0]] } };
  assert.deepEqual(applyRemote(on, { ...v, settings: {} }).brain.claims.map((c) => c.id), ["c1", "c2"], "with memory in the cloud, the cloud's wins and this device keeps its local-only memory (c2)");
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
  assert.deepEqual([inv.brain, inv.memories, inv.thirdParty, inv.localOnly, inv.decisions, inv.styleMsgs, inv.examples], [true, 2, 0, 1, 1, 3, 1]);
  assert.equal(inv.rest.tareas, 1);
  assert.doesNotMatch(JSON.stringify(inv), /café|Persona/);
  const off = cloudInventory({ ...vaultWithBrain(), settings: { cloudBrain: false } });
  assert.equal(off.brain, false); assert.equal(off.memories, 0);
});

// ---------------- WEB-99: selective sync and tombstones ----------------
test("selective: conversations never go up, and come back from this device", () => {
  const v = { ...vaultWithBrain(), chat: [{ from: "me", text: "conversación inventada" }], projects: [{ id: "p1", name: "Proyecto", sources: [], chat: [{ q: "pregunta inventada" }] }] };
  const up = cloudPayload(v);
  assert.ok(!("chat" in up)); assert.ok(!("chat" in up.projects[0]));
  assert.doesNotMatch(JSON.stringify(up), /conversación inventada|pregunta inventada/);
  const down = applyRemote({ ...up, projects: [{ id: "p1", name: "Proyecto (Mac)", sources: [] }] }, v);
  assert.equal(down.chat[0].text, "conversación inventada"); assert.equal(down.projects[0].chat[0].q, "pregunta inventada"); assert.equal(down.projects[0].name, "Proyecto (Mac)");
  assert.ok(validateVault(down).ok);
});

test("selective: other people's memories travel only if authorized, intimate ones never", () => {
  const base = { id: "t", kind: "FACT", status: "ACTIVE", thirdParty: true };
  assert.equal(claimCloud({ ...base, text: "A Persona Inventada le gusta el té" }).sync, false);
  assert.equal(claimCloud({ ...base, text: "A Persona Inventada le gusta el té", cloud: true }).sync, true);
  const intim = claimCloud({ ...base, text: "Persona Inventada está en el hospital", cloud: true });
  assert.deepEqual([intim.sync, intim.canAuthorize], [false, false], "intimate: never, even if authorized");
  for (const t of ["su novia", "le han despedido", "tiene ansiedad", "vota a alguien", "tiene deudas"]) assert.ok(intimate(t), t);
  assert.ok(!intimate("le gusta el café"));
  assert.equal(claimCloud({ id: "m", text: "Me gusta el mar", kind: "FACT", status: "ACTIVE" }).sync, true, "Manu's own memories travel");
});

test("tombstones: a memory forgotten on one device never comes back from the other's copy", () => {
  const v = vaultWithBrain();
  // iPhone forgets c1; the Mac still has it.
  const iphone = { ...v, brain: forget(v.brain, "c1", { now: NOW }).brain };
  assert.deepEqual(iphone.brain.forgotten.map((t) => t.id), ["c1"]);
  assert.doesNotMatch(JSON.stringify(iphone.brain.forgotten), /café/, "a tombstone has no text");
  const macCopy = cloudPayload(v);
  // 1) iPhone downloads the Mac's older copy: c1 stays forgotten.
  const down = applyRemote(macCopy, iphone);
  assert.ok(!down.brain.claims.some((c) => c.id === "c1"));
  assert.deepEqual(down.brain.forgotten.map((t) => t.id), ["c1"]);
  // 2) Conflict «Quedarme con este» on the Mac: the iPhone's tombstones are applied before upload.
  const iphoneUp = cloudPayload(iphone);
  const macKeeps = { ...v, brain: applyTombstones(v.brain, iphoneUp.brain) };
  assert.ok(!macKeeps.brain.claims.some((c) => c.id === "c1"));
  assert.ok(!macKeeps.brain.events.some((e) => e.claimId === "c1"));
  // 3) A local-only memory forgotten on the other device does not come back either.
  const otherForgot = { ...macCopy, brain: { ...macCopy.brain, forgotten: [{ id: "c2", at: NOW.toISOString() }] } };
  assert.ok(!applyRemote(otherForgot, v).brain.claims.some((c) => c.id === "c2"));
  assert.ok(validateVault(down).ok);
});
