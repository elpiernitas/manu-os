import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A static contract test for the production deployment, NOT an end-to-end bank test.
// The callback is a public browser redirect, but every account operation must
// validate the logged-in Supabase user itself before reading a bank session.
const fn = readFileSync(new URL("../../supabase/functions/manu-bank/index.ts", import.meta.url), "utf8");
const config = readFileSync(new URL("../../supabase/config.toml", import.meta.url), "utf8");

test("OAuth callback alone skips the platform JWT gate", () => {
  assert.match(config, /\[functions\.manu-bank\]\s*\nverify_jwt = false/);
  assert.doesNotMatch(config, /\[functions\.(?:manu-push|other)\]/);
  assert.match(fn, /req\.method === "GET" && url\.pathname\.endsWith\("\/manu-bank"\)/);
  assert.match(fn, /if \(!validState\(state\)\) return bounce\("error"\)/);
  assert.match(fn, /const pending = await claimPending\(hash,/);
  assert.match(fn, /if \(!pending\) return bounce\("error"\)/);
});

test("private POST actions validate Supabase Auth before any bank response", () => {
  const auth = fn.indexOf("const user = await identity(req)");
  const check = fn.indexOf('if (!user) return safeFail(401');
  const read = fn.indexOf("const row = await rowFor(user)");
  assert.ok(auth > 0 && check > auth && read > check);
  assert.match(fn, /\/auth\/v1\/user/);
  assert.match(fn, /method: "PATCH"/);
  assert.match(fn, /state_hash: null, state_until: null/);
  assert.match(fn, /if \(req\.headers\.get\("origin"\) && req\.headers\.get\("origin"\) !== APP_ORIGIN\)/);
});

test("server supports only read and disconnect; it cannot initiate payments", () => {
  assert.match(fn, /action !== "balances" && action !== "transactions"/);
  assert.match(fn, /action === "disconnect"/);
  assert.doesNotMatch(fn, /\/payments|create_payment|transfer|payment_intent/i);
  assert.match(fn, /cache-control/i);
  assert.match(fn, /Referrer-Policy/);
});
