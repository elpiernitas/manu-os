import test from "node:test";
import assert from "node:assert/strict";
import {
  newOAuthState, hashState, makeEnableJwt, validState, validIsoDate,
  sabadellFromAspsps, sanitizeAccounts, balancesView, transactionsView,
} from "../../supabase/functions/manu-bank/bank-core.js";
import { bankRequest, safeBankRedirect } from "../core/enablebanking.js";
import { bankAisCard } from "../core/bank-ais-view.js";

test("OAuth state is random, valid, and hashed without retaining raw state", async () => {
  const a = newOAuthState(), b = newOAuthState();
  assert.notEqual(a, b);
  assert.equal(validState(a), true);
  assert.match(await hashState(a), /^[0-9a-f]{64}$/);
  assert.notEqual(await hashState(a), a);
  assert.equal(validState("<script>"), false);
});

test("RS256 signed JWT matches Enable Banking's official claims", async () => {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const bytes = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const pem = "-----BEGIN PRIVATE KEY-----\n" + Buffer.from(bytes).toString("base64") + "\n-----END PRIVATE KEY-----";
  const appId = "00000000-0000-4000-8000-000000000000";
  const jwt = await makeEnableJwt({ appId, privatePem: pem, now: 1750000000000 });
  const [h, p, sig] = jwt.split(".");
  const decode = (v) => JSON.parse(Buffer.from(v, "base64url").toString());
  assert.deepEqual(decode(h), { typ: "JWT", alg: "RS256", kid: appId });
  assert.deepEqual(decode(p), { iss: "enablebanking.com", aud: "api.enablebanking.com", iat: 1750000000, exp: 1750000600 });
  assert.equal(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", pair.publicKey, Buffer.from(sig, "base64url"), new TextEncoder().encode(h + "." + p)), true);
});

test("only Spanish Sabadell in the bank list may be used", () => {
  const bank = sabadellFromAspsps({ aspsps: [{ country: "FR", name: "Sabadell" }, { country: "ES", name: "Banco de Sabadell" }] });
  assert.deepEqual(bank, { country: "ES", name: "Banco de Sabadell" });
  assert.throws(() => sabadellFromAspsps({ aspsps: [{ country: "ES", name: "Otro banco" }] }));
});

test("bank data are minimized and dates validated", () => {
  assert.equal(validIsoDate("2026-11-09"), true);
  assert.equal(validIsoDate("2026-02-30"), false);
  const accounts = sanitizeAccounts([{ uid: "00000000-0000-4000-8000-000000000001", name: "Cuenta", account_id: { iban: "ES00-SECRET" }, currency: "EUR" }]);
  assert.equal(JSON.stringify(accounts).includes("ES00-SECRET"), false);
  assert.deepEqual(balancesView({ balances: [{ balance_amount: { amount: "12.44", currency: "EUR" }, balance_type: "CLAV" }] })[0], { type: "CLAV", amount: "12.44", currency: "EUR", at: "" });
  const tx = transactionsView({ transactions: [{ entry_reference: "a", booking_date: "2026-11-09", transaction_amount: { amount: "5", currency: "EUR" }, credit_debit_indicator: "DBIT", remittance_information: ["Café"] }] });
  assert.equal(tx.transactions[0].description, "Café");
  assert.equal(tx.transactions[0].direction, "debit");
});

test("browser adapter sends only an authenticated action to our Supabase", async () => {
  let got;
  const response = await bankRequest({ url: "https://abcdefgh.supabase.co", key: "public" }, { access: "fake-session" }, "status", {}, async (url, opts) => {
    got = { url, opts };
    return { ok: true, json: async () => ({ connected: false }) };
  });
  assert.deepEqual(response, { connected: false });
  assert.equal(got.url, "https://abcdefgh.supabase.co/functions/v1/manu-bank");
  assert.equal(JSON.parse(got.opts.body).action, "status");
  assert.equal(got.opts.headers.authorization, "Bearer fake-session");
  await assert.rejects(bankRequest({ url: "https://abcdefgh.supabase.co", key: "public" }, { access: "fake" }, "payments"));
  assert.throws(() => safeBankRedirect("https://evil.example/"));
  assert.match(safeBankRedirect("https://auth.enablebanking.com/ais/start?sessionid=test"), /^https:\/\/auth\.enablebanking\.com/);
});

test("bank UI escapes bank-provided text, does not claim an unverified connection", () => {
  const noSession = bankAisCard({ checked: false }, false);
  assert.match(noSession, /Tú → Tu nube/);
  const html = bankAisCard({ checked: true, connected: true, index: 0, accounts: [{ index: 0, label: "<img src=x onerror=alert(1)>", currency: "EUR" }], transactions: [{ description: "<script>alert(1)</script>", amount: "12", currency: "EUR", date: "2026-11-09", direction: "debit" }] }, true);
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;/);
});

test("the account holder's name (AccountResource.name) is never stored; label = description or last 4 of the IBAN", () => {
  const uid = "00000000-0000-4000-8000-000000000002";
  const [a] = sanitizeAccounts([{ uid, name: "Titular Inventado Pérez", account_id: { iban: "ES9100810000000000001234" }, currency: "EUR" }]);
  assert.deepEqual(a, { uid, label: "Cuenta ···1234", currency: "EUR" });
  assert.doesNotMatch(JSON.stringify(a), /Titular|ES91/);
  assert.equal(sanitizeAccounts([{ uid, name: "Titular Inventado", details: "Cuenta Online", currency: "EUR" }])[0].label, "Cuenta Online");
  assert.equal(sanitizeAccounts([{ uid, name: "Titular Inventado" }])[0].label, "Cuenta");
});

test("server pre-flight: ready only with an active PRODUCTION app, AIS and the exact callback registered", async () => {
  const { serverCheck } = await import("../../supabase/functions/manu-bank/bank-core.js");
  const cb = "https://xqsexjpuhvmwkclpnvjo.supabase.co/functions/v1/manu-bank";
  const app = { name: "MANU", kid: "x", environment: "PRODUCTION", redirect_urls: [cb], active: true, countries: ["ES"], services: ["AIS"] };
  assert.equal(serverCheck(app, cb).ready, true);
  assert.equal(serverCheck({ ...app, redirect_urls: ["https://elpiernitas.github.io/manu-os/banco/vuelta/"] }, cb).redirectRegistered, false);
  assert.equal(serverCheck({ ...app, environment: "SANDBOX" }, cb).ready, false);
  assert.equal(serverCheck({ ...app, active: false }, cb).ready, false);
  assert.equal(serverCheck({ ...app, services: ["PIS"] }, cb).ready, false);
  assert.deepEqual(Object.keys(serverCheck(app, cb)).sort(), ["active", "ais", "production", "ready", "redirectRegistered"], "no names, kid or URLs leak to the app");
});
