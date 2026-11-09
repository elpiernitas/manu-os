import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file = (p) => readFileSync(new URL(p, new URL("../", import.meta.url)), "utf8");

test("Sabadell remains read-only and server-backed, with no OAuth secret in browser", () => {
  const app = file("app.js"), sw = file("sw.js");
  const client = file("core/enablebanking.js"), view = file("core/bank-ais-view.js");
  assert.match(app, /bankAisCard\(bankAisUi, nubeOn\(\)\)/);
  assert.match(app, /case "bank-ais-status"/);
  assert.match(app, /bankAisAction\("disconnect"\)/);
  assert.match(app, /bank: \{ connected: bankAisUi\.checked && bankAisUi\.connected/);
  for(const x of ["core/enablebanking.js","core/bank-ais-view.js"]) assert.ok(sw.includes('"' + x + '"'));
  assert.doesNotMatch(client, /ENBANK_PRIVATE_KEY|BEGIN PRIVATE KEY/);
  assert.doesNotMatch(view, /ENBANK_PRIVATE_KEY|BEGIN PRIVATE KEY/);
  assert.doesNotMatch(client + view, /initiatePayment|createPayment|transferFunds/);
});

test("supabase bank table is server-only and excludes anonymous and authenticated roles", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261109140000_bank_ais.sql", import.meta.url), "utf8");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.manu_bank_ais from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /create policy.*to authenticated/is);
});
