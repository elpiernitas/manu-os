// Vuelta de Enable Banking: parámetros, estado y SW. Valores inventados.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCallback, judge, newState, STATE_MAX_AGE_MS } from "../core/bankcallback.js";

const NOW = Date.parse("2026-11-09T10:00:00Z");
const st = { state: "estado-inventado-123456", at: NOW - 60000 };

test("parses the documented parameters and rejects malformed ones", () => {
  const c = parseCallback("?code=codigo-inventado-0001&state=estado-inventado-123456");
  assert.deepEqual([c.code, c.state, c.error, c.present], ["codigo-inventado-0001", "estado-inventado-123456", null, true]);
  assert.equal(parseCallback("?code=<script>alert(1)</script>&state=x").code, null);
  const e = parseCallback("?error=access_denied&error_description=Cancelled%20by%20user<b>&state=estado-inventado-123456");
  assert.equal(e.error, "access_denied"); assert.equal(e.description, "Cancelled by userb");
  assert.equal(parseCallback("?error=%3Cimg%3E").error, "invalid_response");
  assert.equal(parseCallback("").present, false);
});

test("only a matching, recent, single-use state lets the code through", () => {
  const ok = judge(parseCallback(`?code=codigo-inventado-0001&state=${st.state}`), st, NOW);
  assert.equal(ok.kind, "ok"); assert.equal(ok.pending.code, "codigo-inventado-0001");
  assert.equal(judge(parseCallback("?code=codigo-inventado-0001&state=otro-estado-999999"), st, NOW).kind, "mismatch");
  assert.equal(judge(parseCallback(`?code=codigo-inventado-0001&state=${st.state}`), null, NOW).kind, "unknown-state");
  assert.equal(judge(parseCallback(`?code=codigo-inventado-0001&state=${st.state}`), { ...st, at: NOW - STATE_MAX_AGE_MS - 1 }, NOW).kind, "expired");
  assert.equal(judge(parseCallback("?error=access_denied"), st, NOW).kind, "error");
  assert.equal(judge(parseCallback(`?state=${st.state}`), st, NOW).kind, "invalid");
  const s = newState(globalThis.crypto, NOW); assert.match(s.state, /^[A-Za-z0-9_-]{32}$/);
});

test("the service worker never caches or serves the bank return or legal pages as the app", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(sw, /if \(page && url\.pathname !== scope && url\.pathname !== `\$\{scope\}index\.html`\) return;/);
  assert.match(sw, /startsWith\(`\$\{scope\}banco\/`\)\) return;/);
  const html = readFileSync(new URL("../banco/vuelta/index.html", import.meta.url), "utf8");
  assert.match(html, /name="referrer" content="no-referrer"/); assert.match(html, /script-src 'self'/); assert.doesNotMatch(html, /https?:\/\/(?!elpiernitas)/, "no third-party resources on the callback page");
  const js = readFileSync(new URL("../banco/vuelta/vuelta.js", import.meta.url), "utf8");
  assert.ok(js.indexOf("history.replaceState") < js.indexOf("parseCallback(search)"), "the code leaves the URL before anything else");
  assert.doesNotMatch(js, /console\.|fetch\(|localStorage\.setItem\("manuos\.bank\.pending/, "no logging, no network, the code never in localStorage");
});
