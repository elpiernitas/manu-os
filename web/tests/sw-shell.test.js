import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// Offline start needs every module in the install cache (WEB-29: five were missing).
test("service worker caches every core module", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const missing = readdirSync(new URL("../core/", import.meta.url)).filter((f) => f.endsWith(".js") && !sw.includes(`"core/${f}"`));
  assert.deepEqual(missing, []);
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
