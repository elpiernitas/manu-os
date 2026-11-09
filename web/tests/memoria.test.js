// WEB-94 — Memoria: núcleo, aprendizaje, propuestas, conocernos, voz y chat. Datos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import { emptyBrain, validateBrain, remember, correct, confirm, expire, reject, resolve, forget, current, history, staleness, staleClaims, search, related, stats } from "../core/brain.js";
import { spendFeatures, observe, ruleCandidates, decideRule, predict, emptyModel, MIN_SUPPORT } from "../core/learn.js";
import { proposals, applyProposal, topProposal, unknownSpends, applyLearned, recordOutcome } from "../core/proposals.js";
import { QUESTIONS, nextQuestion, answer, skip, progress } from "../core/conocernos.js";
import { addExample, own, contradiction, describe } from "../core/voice.js";
import { memCommand, runMemCommand, extractWhen, extractFact } from "../core/memchat.js";
import { validateVault, emptyVault } from "../core/storage.js";

const NOW = new Date("2026-11-09T10:00:00+01:00");
const ids = () => { let n = 0; return () => `c${++n}`; };
const days = (n) => new Date(NOW.getTime() + n * 86400000);
const rem = (b, input, opts = {}) => remember(b, input, { now: NOW, uid: opts.uid, ...opts });

test("remember: Manu's words are ACTIVE with provenance; a rule's are only PROPOSED", () => {
  const uid = ids();
  let { brain, claim } = rem(emptyBrain(), { text: "Mi café favorito es el cortado", kind: "PREFERENCE", key: "café favorito", value: "cortado" }, { uid });
  assert.equal(claim.status, "ACTIVE"); assert.equal(claim.source.kind, "manu"); assert.equal(claim.key, "cafe favorito"); assert.ok(claim.confirmedAt);
  const r = rem(brain, { text: "Los viernes sueles salir", kind: "FACT", source: { kind: "regla" }, confidence: 0.7, reason: "3 de 3 viernes" }, { uid });
  assert.equal(r.claim.status, "PROPOSED"); assert.equal(r.claim.kind, "INFERENCE", "a rule never creates a FACT"); assert.equal(r.claim.confidence, 0.7);
  assert.throws(() => rem(brain, { text: "   " }), /texto/);
});

test("contradictions are never resolved silently: both become CONTESTED, Manu resolves", () => {
  const uid = ids();
  let b = rem(emptyBrain(), { text: "Vivo en Gijón", kind: "FACT", key: "donde vivo", value: "Gijón" }, { uid }).brain;
  const r = rem(b, { text: "Vivo en Oviedo", kind: "FACT", key: "donde vivo", value: "Oviedo" }, { uid });
  assert.equal(r.conflict.length, 1);
  assert.deepEqual(r.brain.claims.map((c) => c.status), ["CONTESTED", "CONTESTED"]);
  const same = rem(r.brain, { text: "vivo en oviedo", kind: "FACT", key: "donde vivo", value: "oviedo" }, { uid });
  assert.equal(same.conflict.length, 1, "repeating one side still conflicts with the other");
  b = resolve(r.brain, "c2", { now: NOW });
  assert.equal(b.claims.find((c) => c.id === "c2").status, "ACTIVE");
  assert.equal(b.claims.find((c) => c.id === "c1").status, "SUPERSEDED");
  assert.throws(() => resolve(b, "c2"), /no está en duda/);
});

test("correct keeps the history: old version SUPERSEDED, closed, linked both ways", () => {
  const uid = ids();
  let b = rem(emptyBrain(), { text: "Estudio Marketing", kind: "FACT", key: "estudios", value: "Marketing" }, { uid }).brain;
  const r = correct(b, "c1", { text: "Estudio Gestión de Ventas" }, { now: days(1), uid });
  assert.equal(r.previous.status, "SUPERSEDED"); assert.equal(r.previous.supersededBy, "c2"); assert.ok(r.previous.validUntil);
  assert.equal(r.claim.supersedes, "c1"); assert.equal(r.claim.source.kind, "correccion"); assert.equal(r.claim.value, "Estudio Gestión de Ventas");
  assert.deepEqual(history(r.brain, "c2").map((c) => c.id), ["c1", "c2"]);
  assert.deepEqual(history(r.brain, "c1").map((c) => c.id), ["c1", "c2"]);
  assert.deepEqual(current(r.brain, { now: days(2) }).map((c) => c.id), ["c2"]);
  assert.throws(() => correct(r.brain, "c1", { text: "x" }), /ya no está vigente/);
});

test("correcting one side of a contradiction settles it", () => {
  const uid = ids();
  let b = rem(emptyBrain(), { text: "a", kind: "FACT", key: "k", value: "a" }, { uid }).brain;
  b = rem(b, { text: "b", kind: "FACT", key: "k", value: "b" }, { uid }).brain;
  const r = correct(b, "c1", { text: "c" }, { now: NOW, uid });
  assert.equal(r.claim.status, "ACTIVE");
  assert.deepEqual(current(r.brain, { now: NOW }).map((c) => c.id), ["c3"]);
});

test("confirm turns a deduction into Manu's fact; reject and expire keep the record", () => {
  const uid = ids();
  let b = rem(emptyBrain(), { text: "Te gusta el jazz", kind: "HYPOTHESIS", source: { kind: "deduccion" }, confidence: 0.4, reason: "Spotify" }, { uid }).brain;
  const c = confirm(b, "c1", { now: NOW }).claims[0];
  assert.equal(c.status, "ACTIVE"); assert.equal(c.kind, "FACT"); assert.equal(c.source.confirmedBy, "manu");
  b = rem(b, { text: "otra", kind: "INFERENCE", source: { kind: "regla" } }, { uid }).brain;
  b = reject(b, "c2", { now: NOW });
  assert.equal(b.claims[1].status, "REJECTED");
  assert.equal(search(b, "otra", { now: NOW }).length, 0, "rejected guesses are not answers");
  b = rem(b, { text: "Voy al gimnasio los lunes", kind: "FACT" }, { uid }).brain;
  b = expire(b, "c3", { now: NOW });
  assert.equal(current(b, { now: days(1) }).some((x) => x.id === "c3"), false);
  assert.equal(search(b, "gimnasio", { now: days(1), history: true }).length, 1);
});

test("forget erases the text of the claim and of every version, leaving a content-free event", () => {
  const uid = ids();
  let b = rem(emptyBrain(), { text: "Secreto viejo", kind: "FACT", key: "s", value: "viejo" }, { uid }).brain;
  b = correct(b, "c1", { text: "Secreto nuevo" }, { now: NOW, uid }).brain;
  b = rem(b, { text: "Otra cosa" }, { uid }).brain;
  const r = forget(b, "c2", { now: NOW });
  assert.equal(r.removed, 2);
  assert.deepEqual(r.brain.claims.map((c) => c.id), ["c3"]);
  const dump = JSON.stringify(r.brain);
  assert.ok(!dump.includes("Secreto"), "no text survives anywhere");
  assert.equal(r.brain.events.at(-1).type, "forget"); assert.equal(r.brain.events.at(-1).count, 2);
  assert.equal(forget(r.brain, "nope").removed, 0);
});

test("staleness: preferences age, memories and durable or private things never do", () => {
  const uid = ids();
  let b = rem(emptyBrain(), { text: "Me gusta el té", kind: "PREFERENCE" }, { uid }).brain;
  b = rem(b, { text: "Fui a Lisboa", kind: "MEMORY" }, { uid }).brain;
  b = rem(b, { text: "Nací en noviembre", kind: "FACT", durable: true }, { uid }).brain;
  b = rem(b, { text: "A Ana le gusta el té", kind: "PREFERENCE", subject: "Ana", thirdParty: true }, { uid }).brain;
  b = rem(b, { text: "Algo de salud", kind: "PREFERENCE", sensitive: true }, { uid }).brain;
  assert.equal(staleness(b.claims[0], days(179)).stale, false);
  assert.equal(staleness(b.claims[0], days(180)).stale, true);
  assert.deepEqual(staleClaims(b, days(5000)).map((c) => c.id), ["c1"]);
  assert.equal(staleness(confirm(b, "c1", { now: days(200) }).claims[0], days(201)).stale, false, "confirming makes it fresh again");
});

test("search by words, place and dates; related explains every link", () => {
  const uid = ids();
  let b = emptyBrain();
  b = rem(b, { text: "Concierto en Oviedo con amigos", when: "2024-03-02", place: "Oviedo", tags: ["música"] }, { uid }).brain;
  b = rem(b, { text: "Comida en Oviedo", when: "2024-03-15", place: "Oviedo" }, { uid }).brain;
  b = rem(b, { text: "Playa en Gijón", when: "2024-08-01", place: "Gijón" }, { uid }).brain;
  assert.deepEqual(search(b, "oviedo", { now: NOW }).map((h) => h.claim.id).sort(), ["c1", "c2"]);
  assert.deepEqual(search(b, "qué recuerdas de marzo de 2024", { now: NOW }).map((h) => h.claim.id).sort(), ["c1", "c2"]);
  assert.deepEqual(search(b, "agosto", { now: NOW }).map((h) => h.claim.id), ["c3"]);
  assert.ok(search(b, "concierto", { now: NOW })[0].why.includes("texto"));
  const rel = related(b, "c1", { now: NOW });
  assert.equal(rel[0].claim.id, "c2"); assert.ok(rel[0].why.some((w) => w.includes("Oviedo"))); assert.ok(rel[0].why.some((w) => w.includes("mismo mes")));
  assert.equal(related(b, "c3", { now: NOW }).length, 0, "no invented connections");
  assert.equal(stats(b, NOW).total, 3);
});

test("validateBrain fills defaults and rejects broken data; the vault accepts a brain", () => {
  assert.ok(validateBrain(undefined).ok);
  assert.equal(validateBrain({ schema: 2, claims: [] }).ok, false);
  assert.equal(validateBrain({ schema: 1, claims: [{ id: "a", kind: "RUMOR", status: "ACTIVE" }] }).ok, false);
  assert.equal(validateBrain({ schema: 1, claims: [{ id: "a", kind: "FACT", status: "ACTIVE" }, { id: "a", kind: "FACT", status: "ACTIVE" }] }).ok, false);
  const v = validateBrain({ schema: 1, claims: [] });
  assert.deepEqual(v.brain.learn, { obs: {}, rules: [] }); assert.equal(v.brain.voice.humor, 1);
  const vault = { ...emptyVault(), brain: emptyBrain() };
  assert.equal(validateVault(vault).ok, true);
  assert.equal(validateVault({ ...emptyVault(), brain: { schema: 1, claims: "x" } }).ok, false);
});

// ---------------- Learning ----------------
const spend = (id, at, cents, merchant, extra = {}) => ({ id, at, cents, merchant, category: "OTHER", inferred: true, ...extra });
const nightBars = [spend("s1", "2026-11-01T01:30:00+01:00", 900, "BAR UNO"), spend("s2", "2026-11-02T02:10:00+01:00", 1200, "PUB DOS"), spend("s3", "2026-11-07T23:40:00+01:00", 700, "TABERNA TRES")];

test("features describe time, amount and weekend; merchant feature is kept separate", () => {
  const f = spendFeatures(nightBars[0]);
  assert.ok(f.includes("noche|5-15")); assert.ok(f.some((x) => x.startsWith("comercio|bar uno")));
  assert.ok(!spendFeatures(spend("d", "2026-11-04T12:00:00+01:00", 900, "X")).some((x) => x.startsWith("noche")));
});

test("learning: a rule is proposed only after 3 agreeing answers, applied only if Manu accepts", () => {
  let m = emptyModel();
  for (const e of nightBars.slice(0, 2)) m = observe(m, spendFeatures(e), "NIGHTLIFE");
  assert.equal(ruleCandidates(m).length, 0, `fewer than ${MIN_SUPPORT} examples: nothing`);
  m = observe(m, spendFeatures(nightBars[2]), "NIGHTLIFE");
  const c = ruleCandidates(m).find((x) => x.feature === "noche|5-15");
  assert.ok(c); assert.equal(c.label, "NIGHTLIFE"); assert.equal(c.agree, 3); assert.ok(c.confidence < 1 && c.confidence >= 0.8, "never certainty");
  assert.match(c.why, /3 de 3 gastos de noche/);
  const fresh = spend("s9", "2026-11-08T00:30:00+01:00", 1000, "BAR NUEVO");
  assert.equal(predict(m, spendFeatures(fresh)), null, "no rule yet → no guess");
  const rej = decideRule(m, c, false, { uid: () => "r0" });
  assert.equal(predict(rej, spendFeatures(fresh)), null); assert.ok(!ruleCandidates(rej).some((x) => x.feature === c.feature), "a «no» is not asked again");
  m = decideRule(m, c, true, { uid: () => "r1" });
  const g = predict(m, spendFeatures(fresh));
  assert.equal(g.label, "NIGHTLIFE"); assert.equal(g.rule, "r1"); assert.match(g.why, /confianza/);
});

test("learning: disagreement blocks a rule; repeated corrections pause an active one", () => {
  let m = emptyModel();
  const labels = ["NIGHTLIFE", "NIGHTLIFE", "FOOD_AND_DRINK", "NIGHTLIFE"];
  nightBars.concat([spend("s4", "2026-11-08T01:00:00+01:00", 800, "Q")]).forEach((e, i) => { m = observe(m, spendFeatures(e), labels[i]); });
  assert.ok(!ruleCandidates(m).some((c) => c.feature === "noche|5-15"), "3 of 4 is below 80 %");
  let m2 = emptyModel();
  for (const e of nightBars) m2 = observe(m2, spendFeatures(e), "NIGHTLIFE");
  m2 = decideRule(m2, ruleCandidates(m2).find((x) => x.feature === "noche|5-15"), true, { uid: () => "r1" });
  for (let i = 0; i < 4; i++) m2 = observe(m2, ["noche|5-15"], "TRANSPORT");
  assert.equal(m2.rules[0].status, "PAUSED");
  assert.equal(predict(m2, ["noche|5-15"]), null);
});

// ---------------- Proposals ----------------
test("proposals: unknown spend → answer teaches → pattern → rule → new spends labelled as deductions", () => {
  let brain = emptyBrain();
  let spending = [...nightBars, spend("old", "2026-07-01T01:00:00+01:00", 900, "VIEJO")];
  assert.deepEqual(unknownSpends(spending, NOW).map((e) => e.id), ["s3", "s2", "s1"], "only the last 60 days");
  for (const id of ["s3", "s2", "s1"]) {
    const p = proposals(brain, { spending, now: NOW }).find((x) => x.kind === "gasto" && x.entry === id);
    assert.ok(p, `asks about ${id}`);
    ({ brain, spending } = applyProposal({ brain, spending }, p, "choose", { category: "NIGHTLIFE" }, { now: NOW }));
    assert.equal(spending.find((e) => e.id === id).inferred, false, "Manu's answer is his decision");
  }
  const rp = proposals(brain, { spending, now: NOW }).find((x) => x.kind === "regla");
  assert.ok(rp); assert.match(rp.why, /deducción/);
  ({ brain, spending } = applyProposal({ brain, spending }, rp, "accept", {}, { now: NOW, uid: () => "r1" }));
  assert.equal(proposals(brain, { spending, now: NOW }).filter((x) => x.kind === "regla" && x.key === rp.key).length, 0);
  spending.push(spend("s10", "2026-11-08T23:50:00+01:00", 1100, "BAR NUEVO"));
  const g = proposals(brain, { spending, now: NOW }).find((x) => x.entry === "s10");
  assert.equal(g.guess.label, "NIGHTLIFE"); assert.equal(g.actions[0].id, "cat:NIGHTLIFE");
  const auto = applyLearned(brain, spending);
  assert.equal(auto.changed, 2, "the new spend and the old unknown one, both as deductions");
  const e = auto.spending.find((x) => x.id === "s10");
  assert.equal(e.category, "NIGHTLIFE"); assert.equal(e.inferred, true, "still a deduction"); assert.ok(e.learned.confidence < 1);
  assert.equal(applyLearned(brain, auto.spending).changed, 0, "idempotent");
});

test("proposals never execute without an action; «no» is not repeated, «luego» comes back later", () => {
  const uid = ids();
  let brain = rem(emptyBrain(), { text: "Prefiero trabajar de mañana", kind: "PREFERENCE" }, { uid, now: days(-400) }).brain;
  const before = JSON.stringify(brain);
  const list = proposals(brain, { now: NOW });
  assert.equal(JSON.stringify(brain), before, "building proposals changes nothing");
  const v = list.find((p) => p.kind === "vigencia");
  assert.ok(v);
  const later = applyProposal({ brain }, v, "later", {}, { now: NOW }).brain;
  assert.ok(!proposals(later, { now: days(1) }).some((p) => p.key === v.key));
  assert.ok(proposals(later, { now: days(31) }).some((p) => p.key === v.key));
  const changed = applyProposal({ brain }, v, "change", { text: "Ahora prefiero la tarde" }, { now: NOW, uid });
  assert.equal(current(changed.brain, { now: NOW })[0].text, "Ahora prefiero la tarde");
  assert.throws(() => applyProposal({ brain }, v, "change", { text: " " }, { now: NOW }), /Escribe/);
  assert.throws(() => applyProposal({ brain }, v, "borrar-todo", {}, { now: NOW }), /desconocida/);
});

test("topProposal respects the daily budget and a recent «luego»", () => {
  let brain = emptyBrain();
  assert.equal(topProposal(brain, { now: NOW }).kind, "pregunta");
  brain = recordOutcome(brain, "x", "LATER", "pregunta", { now: NOW });
  assert.equal(topProposal(brain, { now: new Date(NOW.getTime() + 3600000) }), null);
  brain = emptyBrain(); brain.settings.maxPerDay = 2;
  brain = recordOutcome(brain, "a", "ACCEPTED", "gasto", { now: NOW }); brain = recordOutcome(brain, "b", "ACCEPTED", "gasto", { now: NOW });
  assert.equal(topProposal(brain, { now: NOW }), null);
});

test("contested claims become a proposal and Manu picks", () => {
  const uid = ids();
  let b = rem(emptyBrain(), { text: "Mi color es azul", kind: "PREFERENCE", key: "color", value: "azul" }, { uid }).brain;
  b = rem(b, { text: "Mi color es verde", kind: "PREFERENCE", key: "color", value: "verde" }, { uid }).brain;
  const p = proposals(b, { now: NOW }).find((x) => x.kind === "duda");
  assert.equal(p.actions.filter((a) => a.id.startsWith("keep:")).length, 2);
  const r = applyProposal({ brain: b }, p, "keep:c2", {}, { now: NOW });
  assert.deepEqual(current(r.brain, { now: NOW }).map((c) => c.value), ["verde"]);
});

// ---------------- Getting to know each other ----------------
test("conocernos: gradual levels, daily limit, declines respected, voice answers set the tone", () => {
  let b = emptyBrain();
  assert.equal(nextQuestion(b, { now: NOW }).level, 1);
  const r = answer(b, "ciudad", "Gijón", { now: NOW, uid: () => "q1" });
  assert.equal(r.claim.source.kind, "pregunta"); assert.equal(r.claim.key, "donde vivo"); assert.equal(r.claim.kind, "FACT");
  b = r.brain;
  b = skip(b, "nombre", { now: NOW });
  b = answer(b, "franqueza", "2", { now: NOW }).brain;
  assert.equal(b.voice.franqueza, 2);
  assert.equal(nextQuestion(b, { now: NOW }), null, "3 a day at most");
  const tomorrow = days(1);
  const q = nextQuestion(b, { now: tomorrow });
  assert.ok(q && q.id !== "nombre" && q.id !== "ciudad", "declined and answered never come back");
  b = skip(b, q.id, { now: tomorrow, forever: false });
  assert.notEqual(nextQuestion(b, { now: tomorrow })?.id, q.id);
  assert.equal(nextQuestion(b, { now: days(5) }).id, q.id, "«otro día» comes back");
  assert.throws(() => answer(b, "humor", "7", { now: NOW }), /opción/);
  assert.throws(() => answer(b, "meta", "", { now: NOW }), /respuesta/);
  assert.equal(progress(b).done, 3);
  assert.ok(QUESTIONS.every((x) => !/\b(novia|novio|ex|amigo|amiga)\b/i.test(x.q)), "no questions about other people");
});

// ---------------- Voice ----------------
test("voice: Manu's own expressions are reused verbatim, only where he said, never invented", () => {
  let v = { humor: 2, franqueza: 2, examples: [] };
  v = addExample(v, "¡Qué máquina!", "acierto");
  v = addExample(v, "¡qué máquina!", "acierto");
  assert.equal(v.examples.length, 1, "no duplicates");
  assert.equal(own(v, "acierto", 0), "¡Qué máquina!");
  assert.equal(own(v, "error", 0), null);
  assert.equal(own(v, "acierto", 1), null, "used sparingly");
  assert.equal(own({ examples: [] }, "acierto", 0), null);
});

test("voice: a contradiction always cites the date and the earlier words; tone changes, facts do not", () => {
  const prev = { value: "Gijón", text: "Vivo en Gijón", recordedAt: "2026-03-03T10:00:00Z" };
  for (const f of [0, 1, 2]) {
    const s = contradiction({ franqueza: f }, prev, "Oviedo", 0);
    assert.match(s, /Gijón/); assert.match(s, /marzo/); assert.match(s, /en duda/);
  }
  assert.notEqual(contradiction({ franqueza: 0 }, prev, "Oviedo"), contradiction({ franqueza: 2 }, prev, "Oviedo"));
});

test("describe separates facts, doubts and deductions and never invents", () => {
  const uid = ids();
  let b = rem(emptyBrain(), { text: "Me gusta el café", kind: "PREFERENCE" }, { uid }).brain;
  b = rem(b, { text: "Te gusta el café de noche", kind: "INFERENCE", source: { kind: "regla" }, confidence: 0.6, reason: "x" }, { uid }).brain;
  const s = describe(b.voice, search(b, "café", { now: NOW }), { topic: "café" });
  assert.match(s, /Hechos y recuerdos:\n• Me gusta el café/); assert.match(s, /Deducciones sin confirmar:\n• Te gusta el café de noche \(Deducción, 60 %/);
  assert.match(describe(b.voice, [], {}), /nada|hueco/i);
});

// ---------------- Chat ----------------
test("chat commands: remember / about / forget, and «recuérdame» stays a reminder", () => {
  assert.deepEqual(memCommand("Recuerda que mi café favorito es el cortado"), { kind: "remember", text: "mi café favorito es el cortado" });
  assert.equal(memCommand("apúntate que el 3 de marzo fui a Oviedo").kind, "remember");
  assert.deepEqual(memCommand("¿Qué sabes de mí?"), { kind: "about", topic: "" });
  assert.deepEqual(memCommand("qué recuerdas de marzo de 2024"), { kind: "about", topic: "marzo de 2024" });
  assert.deepEqual(memCommand("olvida lo del cilantro"), { kind: "forget", topic: "cilantro" });
  assert.equal(memCommand("recuérdame mañana llamar al banco"), null);
  assert.equal(memCommand("apunta que comprar pan"), null, "«apunta que» is still an idea");
  assert.equal(memCommand("hola"), null);
});

test("chat: facts get keys, memories get dates and places, contradictions are flagged", () => {
  assert.deepEqual(extractFact("mi café favorito es el cortado"), { kind: "PREFERENCE", key: "café favorito", value: "el cortado", text: "mi café favorito es el cortado" });
  assert.equal(extractFact("vivo en Gijón").key, "donde vivo");
  assert.equal(extractWhen("el 3 de marzo de 2024 fui", NOW), "2024-03-03");
  assert.equal(extractWhen("el 25 de diciembre cené", NOW), "2025-12-25", "a future day this year means last year");
  assert.equal(extractWhen("ayer", NOW), "2026-11-08");
  const uid = ids();
  let r = runMemCommand(emptyBrain(), memCommand("recuerda que el 3 de marzo de 2024 fui a Oviedo al concierto"), { now: NOW, uid });
  assert.equal(r.claim.when, "2024-03-03"); assert.equal(r.claim.place, "Oviedo"); assert.match(r.reply, /recuerdo, 2024-03-03, en Oviedo/);
  r = runMemCommand(r.brain, memCommand("recuerda que mi café favorito es el cortado"), { now: NOW, uid });
  r = runMemCommand(r.brain, memCommand("recuerda que mi café favorito es el solo"), { now: NOW, uid });
  assert.match(r.reply, /cortado/); assert.match(r.reply, /en duda/);
  const about = runMemCommand(r.brain, memCommand("qué sabes del café"), { now: NOW });
  assert.match(about.reply, /En duda:/);
  const f = runMemCommand(r.brain, memCommand("olvida lo del concierto"), { now: NOW });
  assert.deepEqual(f.pending, ["c1"]); assert.equal(f.brain, r.brain, "forget only proposes; nothing is deleted yet");
  assert.match(runMemCommand(r.brain, memCommand("olvida lo de xilófono"), { now: NOW }).reply, /No encuentro/);
});
