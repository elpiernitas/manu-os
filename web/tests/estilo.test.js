// WEB-95 — aprender de ideas, decisiones, correcciones y conversaciones. Datos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import { emptyBrain, remember, current } from "../core/brain.js";
import { tokens, grams, observeText, expressionCandidates, laughCandidate, emojiCandidate, decide, wipeObserved, setLearning, emptyStyle, styleSummary } from "../core/style.js";
import { contentWords, observeFiling, observeMisfile, keywordCandidates, keywordRemovals, applyKeyword, emptyTopics } from "../core/topics.js";
import { proposals, applyProposal, topProposal } from "../core/proposals.js";
import { addJoke, tellJoke, line, removeJoke } from "../core/voice.js";
import { memCommand, runMemCommand } from "../core/memchat.js";
import { matchProject } from "../core/autofile.js";

const NOW = new Date("2026-11-09T10:00:00+01:00");
const day = (n) => new Date(NOW.getTime() + n * 86400000);
const feed = (style, texts) => texts.reduce((s, [t, d]) => observeText(s, t, { now: day(d) }), style);

// ---------------- Style ----------------
test("tokens cut at names, numbers, links and emails; sentence starts are not names", () => {
  assert.deepEqual(tokens("Qué máquina, tío"), ["que", "maquina", "tio"]);
  assert.ok(tokens("ayer con Lucía en el bar").includes("|"), "a capitalised word inside a sentence is treated as a name");
  assert.ok(!tokens("pagué 25 euros").includes("25"));
  assert.ok(!tokens("mira https://x.com o a@b.com").some((w) => /x\.com|@/.test(w)));
});

test("grams: no function-word-only, no sensitive, no names inside", () => {
  const g = grams("Qué máquina eres, de verdad");
  assert.ok(g.includes("que maquina"));
  assert.ok(!grams("me tomé una pastilla para dormir").some((x) => /pastilla/.test(x)), "health words never become expressions");
  assert.ok(!grams("quedo con Pelayo mañana").some((x) => /pelayo/.test(x)), "names never become expressions");
  assert.ok(!grams("de la que es").length, "only function words");
});

test("an expression is proposed after 3 times on 2+ days, with a literal example", () => {
  let s = feed(emptyStyle(), [["Qué máquina eres", 0], ["qué máquina, en serio", 0]]);
  assert.equal(expressionCandidates(s).length, 0, "twice is not enough");
  s = feed(s, [["Venga, qué máquina", 0]]);
  assert.equal(expressionCandidates(s).length, 0, "three times on a single day is not a habit");
  s = feed(s, [["qué máquina el café de hoy", 2]]);
  const c = expressionCandidates(s)[0];
  assert.equal(c.text, "que maquina"); assert.equal(c.times, 4); assert.equal(c.days, 2); assert.match(c.example, /máquina/);
  s = decide(s, c.key, false);
  assert.equal(expressionCandidates(s).length, 0, "a «no» is final");
});

test("laugh and emoji habits need enough evidence and a clear majority", () => {
  let s = feed(emptyStyle(), [["jajaja vale", 0], ["JAJAJA", 1], ["jsjs", 1]]);
  assert.equal(laughCandidate(s), null, "2 of 3 is not clear");
  s = feed(s, [["jajajaja buenísimo", 2], ["jaja", 3], ["jajaja", 3]]);
  assert.equal(laughCandidate(s).laugh, "jajaja");
  let e = emptyStyle();
  for (let i = 0; i < 19; i++) e = observeText(e, `mensaje normal número ${i}`, { now: day(i % 3) });
  assert.equal(emojiCandidate(e), null, "fewer than 20 messages: no conclusion");
  e = observeText(e, "otro más");
  assert.equal(emojiCandidate(e).use, false);
  let f = emptyStyle();
  for (let i = 0; i < 20; i++) f = observeText(f, i % 2 ? "genial 😂" : "vale");
  assert.deepEqual(emojiCandidate(f).top, ["😂"]);
});

test("learning can be turned off, and «olvidar lo observado» keeps Manu's decisions", () => {
  let s = setLearning(emptyStyle(), false);
  assert.equal(observeText(s, "qué máquina").msgs, 0);
  s = feed(setLearning(s, true), [["qué máquina", 0]]);
  s = decide(s, "expr:x", false);
  const w = wipeObserved(s);
  assert.equal(w.msgs, 0); assert.deepEqual(w.grams, {}); assert.ok(w.decided["expr:x"]);
  assert.equal(styleSummary(w).msgs, 0);
});

test("the model stays small", () => {
  let s = emptyStyle();
  for (let i = 0; i < 300; i++) s = observeText(s, `palabra${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))} otra${i % 7}cosa y algo distinto`);
  assert.ok(Object.keys(s.grams).length <= 400);
});

// ---------------- Proposals & voice ----------------
test("style proposals: only in Memoria, adopted only when Manu says yes, verbatim", () => {
  let brain = { ...emptyBrain(), style: feed(emptyStyle(), [["qué máquina", 0], ["qué máquina", 1], ["qué máquina", 2], ["jajaja", 0], ["jajaja", 1], ["jajaja", 2]]) };
  const ps = proposals(brain, { now: NOW });
  const ex = ps.find((p) => p.kind === "expresion");
  assert.ok(ex); assert.match(ex.why, /No la uso hasta que digas que sí/);
  assert.ok(!["expresion", "risa", "emoji"].includes(topProposal(brain, { now: NOW })?.kind), "Hoy is not for style");
  assert.equal(brain.voice.examples.length, 0, "nothing adopted yet");
  brain = applyProposal({ brain }, ex, "when:acierto", {}, { now: NOW }).brain;
  assert.deepEqual(brain.voice.examples.map((e) => [e.text, e.when]), [["que maquina", "acierto"]]);
  const risa = proposals(brain, { now: NOW }).find((p) => p.kind === "risa");
  brain = applyProposal({ brain }, risa, "accept", {}, { now: NOW }).brain;
  assert.equal(brain.voice.laugh, "jajaja");
  assert.ok(!proposals(brain, { now: NOW }).some((p) => p.kind === "risa" || p.kind === "expresion"));
  assert.equal(line({ ...brain.voice, humor: 1 }, "saved", 2).endsWith("jajaja"), true, "laughs his way, now and then");
  assert.equal(line({ ...brain.voice, humor: 0 }, "saved", 2).includes("jajaja"), false, "not with humour off");
});

test("jokes: kept only when Manu says so, told back verbatim with their date, never invented", () => {
  assert.match(tellJoke({ jokes: [] }), /Aún no me has dejado ninguno/);
  let v = addJoke({ jokes: [] }, "¿Sabes por qué el mar es salado? Porque no sabe dulce.", "juego", { now: NOW });
  assert.equal(addJoke(v, "¿sabes por qué el mar es salado? porque no sabe dulce.").jokes.length, 1, "no duplicates");
  const t = tellJoke(v, 0);
  assert.match(t, /noviembre de 2026/); assert.match(t, /no sabe dulce/);
  assert.equal(removeJoke(v, 0).jokes.length, 0);
  assert.throws(() => addJoke(v, "  "), /nada/);
});

test("chat: «guárdate esa» saves the previous message; decisions are offered, not assumed", () => {
  const b = emptyBrain();
  let r = runMemCommand(b, memCommand("guárdate esa"), { now: NOW, previous: "Eres más lento que el wifi del bus" });
  assert.equal(r.brain.voice.jokes[0].text, "Eres más lento que el wifi del bus");
  assert.match(runMemCommand(b, memCommand("guárdate esa"), { now: NOW, previous: null }).reply, /No sé cuál/);
  assert.match(runMemCommand(b, memCommand("guárdate esa"), { now: NOW, previous: "recuerda que x es y" }).reply, /No sé cuál/, "a command is not a joke");
  assert.equal(memCommand("eso es un juego de palabras").as, "juego");
  r = runMemCommand(b, memCommand("He decidido no pedir comida a domicilio entre semana"), { now: NOW });
  assert.equal(r.offerDecision, "He decidido no pedir comida a domicilio entre semana");
  assert.equal(r.brain.claims.length, 0, "nothing saved until Manu taps «Guardar»");
  const saved = remember(b, { text: r.offerDecision, kind: "DECISION", source: { kind: "manu" } }, { now: NOW }).brain;
  assert.match(runMemCommand(saved, memCommand("¿qué decidí sobre la comida?"), { now: NOW }).reply, /no pedir comida/);
  assert.match(runMemCommand(saved, memCommand("qué decidí sobre el gimnasio"), { now: NOW }).reply, /No tengo decisiones/);
  assert.equal(memCommand("recuérdame mañana el gimnasio"), null, "reminders untouched");
});

// ---------------- Ideas & projects ----------------
const projects = [{ id: "p1", name: "Onda Norte", keywords: [], sources: [] }, { id: "p2", name: "Portfolio web", keywords: ["tipografia"], sources: [] }];

test("contentWords skips names, short and stop words", () => {
  assert.deepEqual(contentWords("Revisar el logo nuevo con Iván para la radio"), ["revisar", "logo", "radio"]);
});

test("Manu's own filing proposes a keyword; accepting it makes autofile work", () => {
  let t = emptyTopics();
  for (const s of ["Nuevo jingle de la radio", "jingle más corto", "Ideas de jingle para verano"]) t = observeFiling(t, "p1", s);
  t = observeFiling(t, "p2", "jingle? no");
  assert.equal(keywordCandidates(t, projects).length, 0, "3 of 4 is not 80 %");
  t = observeFiling(t, "p1", "jingle final");
  const c = keywordCandidates(t, projects)[0];
  assert.equal(c.word, "jingle"); assert.equal(c.project, "p1");
  assert.equal(matchProject("un jingle para el lunes", projects), null, "before: not filed");
  let brain = { ...emptyBrain(), topics: t };
  const p = proposals(brain, { projects, now: NOW }).find((x) => x.kind === "palabra");
  const r = applyProposal({ brain, projects }, p, "accept", {}, { now: NOW });
  assert.deepEqual(r.projects[0].keywords, ["jingle"]);
  assert.equal(matchProject("un jingle para el lunes", r.projects).id, "p1", "after: filed automatically");
  assert.ok(!proposals(r.brain, { projects: r.projects, now: NOW }).some((x) => x.kind === "palabra" && x.topic.word === "jingle"));
});

test("removing auto-filed notes twice proposes dropping the keyword; name words are never dropped", () => {
  const ps = [{ id: "p2", name: "Portfolio web", keywords: ["tipografia"], sources: [] }];
  let t = emptyTopics();
  t = observeMisfile(t, ps[0], "Tipografía para la boda de mi prima");
  assert.equal(keywordRemovals(t, ps).length, 0);
  t = observeMisfile(t, ps[0], "la tipografía del menú del bar");
  t = observeMisfile(t, ps[0], "mi portfolio en papel"); t = observeMisfile(t, ps[0], "portfolio otra vez");
  const rm = keywordRemovals(t, ps);
  assert.deepEqual(rm.map((x) => x.word), ["tipografia"], "«portfolio» comes from the name: kept");
  assert.deepEqual(applyKeyword(ps, rm[0], false)[0].keywords, []);
});

test("proposals still never change anything on their own", () => {
  const brain = { ...emptyBrain(), style: feed(emptyStyle(), [["qué máquina", 0], ["qué máquina", 1], ["qué máquina", 2]]), topics: [1, 2, 3].reduce((t) => observeFiling(t, "p1", "jingle"), emptyTopics()) };
  const before = JSON.stringify({ brain, projects });
  proposals(brain, { projects, now: NOW });
  assert.equal(JSON.stringify({ brain, projects }), before);
  assert.throws(() => applyProposal({ brain, projects }, proposals(brain, { projects, now: NOW }).find((x) => x.kind === "palabra"), "delete-all"), /desconocida/);
  assert.equal(current(brain).length, 0, "style never becomes claims about Manu by itself");
});
