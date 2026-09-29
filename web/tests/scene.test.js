import { test } from "node:test";
import assert from "node:assert/strict";
import { weatherEmoji, sceneFor, PARTICLES } from "../core/scene.js";
import { CATEGORIES, CATEGORY_EMOJI } from "../core/money.js";
import { MOODS } from "../core/life.js";

test("every weather icon has an emoji and a scene with a particle count", () => {
  for (const icon of ["sun", "moon", "cloud-sun", "cloud-moon", "cloud", "fog", "rain", "snow", "storm", "desconocido"]) {
    assert.ok(weatherEmoji(icon).length > 0, icon);
    assert.ok(sceneFor(icon) in PARTICLES, icon);
  }
  assert.equal(sceneFor("moon"), "night");
  assert.equal(sceneFor("cloud-sun"), "cloud");
  assert.equal(weatherEmoji("rain"), "🌧️");
});

test("every spending category has an emoji; every mood has one", () => {
  for (const c of Object.keys(CATEGORIES)) assert.ok(CATEGORY_EMOJI[c], c);
  assert.deepEqual(MOODS.map((m) => m.emoji), ["😣", "😕", "🙂", "🤩"]);
});
