import test from "node:test";
import assert from "node:assert/strict";
import { PLACES, town, vitality, mood, nightQuestion, moveDays, projectMinutesByDay, lineFor, setTreadmill, setRest, answerNight, startTimer, stopTimer, markSeen, gameState, MAX_PROJECT_MIN_PER_DAY } from "../core/bahia.js";

const now = new Date(2026, 10, 5, 12);
const iso = (y, m, d, h = 12) => new Date(y, m - 1, d, h).toISOString();
const base = () => ({ settings: {}, inbox: [], spending: [], income: [], health: [], projects: [] });
const withGame = (v, game) => ({ ...v, settings: { ...v.settings, game } });

test("WEB-91: five places, all start at level 1 with nothing done", () => {
  const t = town(base(), now);
  assert.deepEqual(t.map((p) => p.id), ["muro", "oficina", "faro", "cafe", "azotea"]);
  assert.ok(t.every((p) => p.level === 1 && p.points === 0));
  assert.equal(PLACES.length, 5);
});

test("WEB-91: moving counts once per day, treadmill or steps", () => {
  let v = base();
  v.health = [{ day: "2026-11-01", kind: "STEPS", value: 12000 }, { day: "2026-11-02", kind: "STEPS", value: 4000 }];
  v = withGame(v, setTreadmill(v, "2026-11-01")); // same day as the steps: still one
  v = withGame(v, setTreadmill(v, "2026-11-03"));
  assert.deepEqual([...moveDays(v)].sort(), ["2026-11-01", "2026-11-03"]);
  assert.equal(town(v, now).find((p) => p.id === "muro").points, 2);
  v = withGame(v, { ...v.settings.game, stepGoal: 3000 });
  assert.equal(moveDays(v).size, 3, "his own step goal");
});

test("WEB-91: project minutes per day are capped; tasks done also build", () => {
  let v = base();
  v = withGame(v, { sessions: [
    { id: "a", start: iso(2026, 11, 1, 9), end: iso(2026, 11, 1, 14) },   // 5 h → capped at 3 h
    { id: "b", start: iso(2026, 11, 2, 10), end: iso(2026, 11, 2, 11) },  // 1 h
  ] });
  assert.equal(projectMinutesByDay(v, now)["2026-11-01"], MAX_PROJECT_MIN_PER_DAY);
  v.inbox = [{ id: "t", status: "TASK", done: true, at: iso(2026, 11, 2) }];
  assert.equal(town(v, now).find((p) => p.id === "oficina").points, 3 + 1 + 1);
});

test("WEB-91: the timer starts once and a session under a minute does not count", () => {
  let v = base();
  v = withGame(v, startTimer(v, "p1", new Date(2026, 10, 5, 10)));
  assert.equal(gameState(v).timer.projectId, "p1");
  assert.deepEqual(startTimer(v, "p2", new Date(2026, 10, 5, 10, 5)).timer.projectId, "p1", "a second start does nothing");
  const after = withGame(v, stopTimer(v, "s1", new Date(2026, 10, 5, 11)));
  assert.equal(gameState(after).sessions.length, 1);
  assert.equal(gameState(after).timer, null);
  const quick = withGame(v, stopTimer(v, "s2", new Date(2026, 10, 5, 10, 0, 30)));
  assert.equal(gameState(quick).sessions.length, 0);
});

test("WEB-91: the lighthouse lights a closed month with more in than out", () => {
  const v = base();
  v.income = [{ id: "i1", cents: 100000, at: iso(2026, 9, 1) }, { id: "i2", cents: 50000, at: iso(2026, 10, 1) }, { id: "i3", cents: 90000, at: iso(2026, 11, 1) }];
  v.spending = [{ id: "s1", cents: 80000, at: iso(2026, 9, 10) }, { id: "s2", cents: 60000, at: iso(2026, 10, 10) }];
  const faro = town(v, now).find((p) => p.id === "faro");
  assert.equal(faro.points, 1, "September yes, October no, November is not closed");
  assert.equal(faro.extra.thisMonthPositive, true);
});

test("WEB-91: ideas count up to 3 a day", () => {
  const v = base();
  v.inbox = Array.from({ length: 5 }, (_, i) => ({ id: `i${i}`, status: "IDEA", text: "x", at: iso(2026, 11, 4) }));
  assert.equal(town(v, now).find((p) => p.id === "cafe").points, 3);
});

test("WEB-91: levels are permanent and the first sight of a new level celebrates once", () => {
  let v = base();
  v.health = Array.from({ length: 8 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, kind: "STEPS", value: 15000 }));
  const muro = town(v, now).find((p) => p.id === "muro");
  assert.equal(muro.level, 2);
  assert.equal(muro.isNew, true);
  assert.equal(mood(v, now), "celebrando");
  v = withGame(v, markSeen(v, now));
  assert.equal(town(v, now).find((p) => p.id === "muro").isNew, false);
  assert.notEqual(mood(v, now), "celebrando");
});

test("WEB-91: vitality drops a little after a night out and comes back", () => {
  let v = base();
  assert.equal(vitality(v, now), 100);
  v = withGame(v, answerNight(v, "2026-11-04", 3)); // «más» last night
  const morning = vitality(v, now);
  assert.ok(morning < 100 && morning >= 60, `a hit, not a disaster: ${morning}`);
  const nextDays = vitality(v, new Date(2026, 10, 8, 12));
  assert.equal(nextDays, 100, "it recovers on its own in a few days");
  assert.throws(() => answerNight(v, "2026-11-04", 9));
});

test("WEB-91: two heavy nights make him tired, moving helps", () => {
  let v = base();
  v = withGame(v, answerNight(v, "2026-11-03", 3));
  v = withGame(v, answerNight(v, "2026-11-04", 3));
  assert.ok(vitality(v, now) < 60);
  assert.equal(mood(v, now), "cansado");
  v = withGame(v, setTreadmill(v, "2026-11-05"));
  v = withGame(v, setRest(v, "2026-11-05"));
  assert.ok(vitality(v, now) > vitality(withGame(v, { ...v.settings.game, treadmill: {}, rest: {} }), now));
});

test("WEB-91: the morning question appears after nightlife or a bar night, once", () => {
  const v = base();
  v.spending = [
    { id: "a", cents: 2300, merchant: "Pub Ejemplo", category: "NIGHTLIFE", at: iso(2026, 11, 4, 23) },
    { id: "b", cents: 800, merchant: "Bar Ejemplo", category: "FOOD_AND_DRINK", at: iso(2026, 11, 4, 22) },
    { id: "c", cents: 3000, merchant: "Super", category: "GROCERIES", at: iso(2026, 11, 4, 10) },
  ];
  const q = nightQuestion(v, now);
  assert.equal(q.day, "2026-11-04");
  assert.deepEqual(q.items.map((i) => i.merchant), ["Pub Ejemplo", "Bar Ejemplo"]);
  assert.equal(nightQuestion(withGame(v, answerNight(v, "2026-11-04", 0)), now), null, "answered: no more asking");
  assert.equal(nightQuestion(v, new Date(2026, 10, 5, 3)), null, "not at 3 am");
  const coffee = base();
  coffee.spending = [{ id: "d", cents: 350, merchant: "Café", category: "FOOD_AND_DRINK", at: iso(2026, 11, 4, 9) }];
  assert.equal(nightQuestion(coffee, now), null, "a coffee is not a night out");
});

test("WEB-91: moods and a stable line for the day", () => {
  const v = base();
  assert.equal(mood(v, now), "tranquilo");
  v.inbox = [{ id: "i", status: "IDEA", text: "x", at: iso(2026, 11, 5, 9) }];
  assert.equal(mood(v, now), "inspirado");
  assert.equal(lineFor("tranquilo", now), lineFor("tranquilo", new Date(2026, 10, 5, 20)));
  assert.equal(typeof lineFor("nadie", now), "string");
});

test("WEB-92: his character is a clean 16 × 24 sprite with every colour defined", async () => {
  const { SPRITE, PAL } = await import("../core/bahia-draw.js");
  assert.equal(SPRITE.length, 24);
  assert.ok(SPRITE.every((row) => row.length === 16));
  const used = new Set(SPRITE.join("").replace(/\./g, ""));
  for (const ch of used) assert.ok(PAL[ch], `colour for «${ch}»`);
  assert.ok(used.has("e"), "the silver hoop");
  assert.ok(used.has("G") && used.has("C"), "glasses: dark on top, clear below");
});
