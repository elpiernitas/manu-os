// Regressions for the ChatGPT review of PR #15/#16 (2026-09-29).
import { test } from "node:test";
import assert from "node:assert/strict";
import { newEntry, learnCategory, applyRules, merchantKey, ruleFor } from "../core/money.js";
import { importStatementRows, legacyFingerprint } from "../core/bank.js";
import { pkceValid, PKCE_MAX_AGE_MS } from "../core/spotify.js";
import { wipeDeviceKeys } from "../core/storage.js";

function fakeStorage(init) {
  const m = new Map(Object.entries(init));
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

test("1. wipe removes every MANU key, including Gemini and Spotify secrets", () => {
  const ls = fakeStorage({ "manuos.vault": "{}", "manuos.gemini": "AIzaX", "manuos.gemini.model": "m", "manuos.gemini.remember": "1", "manuos.spotify.tokens": "{}", "manuos.spotify.pkce": "{}", "other.app": "keep" });
  const ss = fakeStorage({ "manuos.gemini": "AIzaY", "manuos.tab": "tu" });
  wipeDeviceKeys([ls, ss, null]);
  assert.deepEqual([...ls.m.keys()], ["other.app"]);
  assert.equal(ss.m.size, 0);
});

test("2. two shops sharing their first four words keep separate corrections", () => {
  const A = "CAFETERIA PLAZA MAYOR LOCAL UNO", B = "CAFETERIA PLAZA MAYOR LOCAL DOS";
  assert.notEqual(merchantKey(A), merchantKey(B));
  let entries = [newEntry({ id: "a", cents: 100, merchant: A, at: "2026-09-01T10:00:00Z" }), newEntry({ id: "b", cents: 100, merchant: B, at: "2026-09-01T10:00:00Z" })];
  let learned = {};
  ({ entries, learned } = learnCategory(entries, learned, "a", "LEISURE"));
  ({ entries, learned } = learnCategory(entries, learned, "b", "SHOPPING"));
  assert.equal(newEntry({ id: "a2", cents: 100, merchant: A, at: "2026-10-01T10:00:00Z" }, learned).category, "LEISURE");
  assert.equal(newEntry({ id: "b2", cents: 100, merchant: B, at: "2026-10-01T10:00:00Z" }, learned).category, "SHOPPING");
  // Keys saved before the fix (four words) are still honoured.
  assert.equal(ruleFor("MERCADONA AVENIDA DE LA CONSTITUCION", { "mercadona avenida de la": "GROCERIES" }).category, "GROCERIES");
});

test("3. imported rules stay replaceable; only Manu's corrections are final", () => {
  const e = newEntry({ id: "e", cents: 500, merchant: "BAR EJEMPLO", at: "2026-09-01T22:00:00Z" });
  assert.equal(e.inferred, true);
  let { entries } = applyRules([e], { "bar ejemplo": { category: "NIGHTLIFE" } });
  assert.equal(entries[0].category, "NIGHTLIFE");
  ({ entries } = applyRules(entries, { "bar ejemplo": { category: "FOOD_AND_DRINK" } }));
  assert.equal(entries[0].category, "FOOD_AND_DRINK", "second rule version applies");
  // New imports matched by a rule are also not final.
  const imported = newEntry({ id: "f", cents: 500, merchant: "BAR EJEMPLO", at: "2026-09-02T22:00:00Z" }, { "bar ejemplo": { category: "NIGHTLIFE" } });
  assert.equal(applyRules([imported], { "bar ejemplo": { category: "FOOD_AND_DRINK" } }).entries[0].category, "FOOD_AND_DRINK");
  // After Manu corrects it, rules no longer change it.
  const learnt = learnCategory(entries, {}, "e", "LEISURE").entries;
  assert.equal(applyRules(learnt, { "bar ejemplo": { category: "NIGHTLIFE" } }).entries[0].category, "LEISURE");
});

// The pair in the review did not collide when reproduced; this pair was found by
// brute force and does collide in the old importer (1 entry, 1 "duplicate").
test("4. a 32-bit hash collision no longer drops a real bank line", () => {
  const rows = [["Fecha", "Concepto", "Importe", "Saldo"], ["28/09/2026", "COMERCIO PRUEBA 8otjdgq07w8", "-18,24", "6942,62"], ["28/09/2026", "COMERCIO PRUEBA 5fbkbz253mi", "-91,03", "6796,06"]];
  const first = importStatementRows(rows);
  assert.equal(first.entries.length, 2);
  assert.equal(first.duplicates, 0);
  const again = importStatementRows(rows, new Set(first.entries.map((x) => x.id)));
  assert.deepEqual([again.entries.length, again.duplicates], [0, 2]);
});

test("4b. lines imported with old hash ids are recognised only if really the same line", () => {
  const rows = [["Fecha", "Concepto", "Importe", "Saldo"], ["28/09/2026", "COMERCIO PRUEBA 8otjdgq07w8", "-18,24", "6942,62"], ["28/09/2026", "COMERCIO PRUEBA 5fbkbz253mi", "-91,03", "6796,06"]];
  const oldId = legacyFingerprint("2026-09-28", -1824, "COMERCIO PRUEBA 8otjdgq07w8", 694262, 0);
  assert.equal(oldId, legacyFingerprint("2026-09-28", -9103, "COMERCIO PRUEBA 5fbkbz253mi", 679606, 0), "fixture is a real collision");
  const saved = { id: oldId, cents: 1824, merchant: "COMERCIO PRUEBA 8otjdgq07w8", at: "2026-09-28T10:00:00.000Z" };
  const r = importStatementRows(rows, new Set([oldId]), {}, new Map([[oldId, saved]]));
  assert.deepEqual([r.entries.length, r.duplicates], [1, 1]);
  assert.equal(r.entries[0].merchant, "COMERCIO PRUEBA 5fbkbz253mi");
});

test("5. PKCE state expires after 15 minutes and rejects future or invalid times", () => {
  const now = 1_800_000_000_000;
  const p = (at) => ({ verifier: "v", state: "s", at });
  assert.equal(pkceValid(p(now - PKCE_MAX_AGE_MS), "s", now), true);
  assert.equal(pkceValid(p(now - PKCE_MAX_AGE_MS - 1), "s", now), false);
  assert.equal(pkceValid(p(now + 86400000), "s", now), false);
  for (const bad of ["incorrecto", undefined, Infinity, NaN, null, "1800000000000"]) assert.equal(pkceValid(p(bad), "s", now), false, String(bad));
  assert.equal(pkceValid(p(now), "otro", now), false);
  assert.equal(pkceValid(null, "s", now), false);
});
