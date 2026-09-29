import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// Offline start needs every module in the install cache (WEB-29: five were missing).
test("service worker caches every core module", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const missing = readdirSync(new URL("../core/", import.meta.url)).filter((f) => f.endsWith(".js") && !sw.includes(`"core/${f}"`));
  assert.deepEqual(missing, []);
});
