import { test } from "node:test";
import assert from "node:assert/strict";
import { weatherEmoji, sceneFor, PARTICLES, SHAPES } from "../core/scene.js";
import { CATEGORIES, CATEGORY_EMOJI } from "../core/money.js";
import { MOODS } from "../core/life.js";

test("every weather icon has an emoji and a scene with a particle count", () => {
  for (const icon of ["sun", "moon", "cloud-sun", "cloud-moon", "cloud", "fog", "rain", "snow", "storm", "desconocido"]) {
    assert.ok(weatherEmoji(icon).length > 0, icon);
    assert.ok(sceneFor(icon) in PARTICLES, icon);
  }
  assert.equal(sceneFor("moon"), "night");
  assert.equal(sceneFor("cloud-sun"), "sun-cloud");
  assert.equal(weatherEmoji("rain"), "🌧️");
});

test("WEB-36: the six daytime scenes Manu asked for", () => {
  assert.equal(sceneFor("sun", { max: 34, uv: 5 }), "hot"); // sol mucho: calor
  assert.equal(sceneFor("sun", { max: 22, uv: 9 }), "hot"); // sol mucho: UV muy alto
  assert.equal(sceneFor("sun", { max: 22, uv: 4 }), "sun"); // sol normal
  assert.equal(sceneFor("sun"), "sun");
  assert.equal(sceneFor("cloud-sun", { max: 35 }), "sun-cloud"); // sol con nubes
  assert.equal(sceneFor("cloud"), "cloud"); // nubes
  assert.equal(sceneFor("rain"), "rain"); // nubes con lluvia
  assert.equal(sceneFor("storm"), "storm"); // lluvia y truenos
  assert.equal(sceneFor("moon", { max: 35 }), "night"); // no «sol mucho» at night
  for (const s of ["hot", "sun", "sun-cloud", "cloud", "rain", "storm"]) assert.ok(SHAPES[s]?.length, s);
  assert.ok(SHAPES.storm.includes("bolt") && SHAPES.rain.every((x) => x.includes("cloud")));
});

test("every spending category has an emoji; every mood has one", () => {
  for (const c of Object.keys(CATEGORIES)) assert.ok(CATEGORY_EMOJI[c], c);
  assert.deepEqual(MOODS.map((m) => m.emoji), ["😣", "😕", "🙂", "🤩"]);
});
