import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// Offline start needs every ACTIVE module. WEB-110 retired the Bahía game from
// app.js (not merely hidden its tab), so caching its 3 modules would be wasteful.
const ARCHIVED_GAME = new Set(["bahia.js", "bahia-draw.js", "bahia-svg.js"]);
test("service worker caches every active core module but not the retired game", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const missing = readdirSync(new URL("../core/", import.meta.url))
    .filter((f) => f.endsWith(".js") && !ARCHIVED_GAME.has(f) && !sw.includes(`"core/${f}"`));
  assert.deepEqual(missing, []);
  for (const file of ARCHIVED_GAME) {
    assert.doesNotMatch(sw, new RegExp(`"core/${file.replaceAll(".", "\\.")}"`));
    assert.ok(!app.includes(`"./core/${file}"`), `${file} must not load in the active app`);
  }
});

// The page shows APP_VERSION; the cache name must move with it or an update is not picked up.
test("service worker cache name follows APP_VERSION", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const v = app.match(/export const APP_VERSION = "(\d+)"/)?.[1];
  assert.ok(v);
  assert.match(sw, new RegExp(`const VERSION = "manuos-v${v}";`));
});

// QA ChatGPT 2026-10 (#4, #7).
test("service worker: no URL with a query is cached, only MANU caches are deleted, HTML only for pages", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(sw, /k\.startsWith\("manuos-"\)/);
  assert.match(sw, /url\.search \? null/);
  assert.match(sw, /Response\.error\(\)/);
  assert.doesNotMatch(sw, /hit \?\? caches\.match\("index\.html"\)/);
});
