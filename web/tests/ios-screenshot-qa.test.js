import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bankRequest } from "../core/enablebanking.js";
import { bankAisCard } from "../core/bank-ais-view.js";

const read = (path) => readFileSync(new URL(path, new URL("../", import.meta.url)), "utf8");
const cfg = { url: "https://abcdefgh.supabase.co", key: "public" };
const session = { access: "fake-test-session" };

test("missing bank function reports backend not installed, not bank failure", async () => {
  const notFound = async () => ({ ok: false, status: 404, json: async () => ({ message: "Function not found" }) });
  await assert.rejects(
    bankRequest(cfg, session, "status", {}, notFound),
    /servidor bancario de MANU todavía no está publicado en Supabase/,
  );
  const notConfigured = async () => ({ ok: false, status: 503, json: async () => ({ error: "not configured" }) });
  await assert.rejects(bankRequest(cfg, session, "status", {}, notConfigured), /todavía no está configurado/);
});

test("expired cloud auth and network failures use distinct user-safe errors", async () => {
  const unauthorized = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(bankRequest(cfg, session, "status", {}, unauthorized), /Tu nube ha caducado/);
  await assert.rejects(bankRequest(cfg, session, "status", {}, async () => { throw Error("network secret: no exposure"); }), /No se puede contactar con el servidor de MANU/);
  const success = await bankRequest(cfg, session, "status", {}, async () => ({ ok: true, status: 200, json: async () => ({ connected: false }) }));
  assert.deepEqual(success, { connected: false });
});

test("bank card can show a safe configuration warning while retaining the retry button", () => {
  const html = bankAisCard({ checked: false, connected: false, error: "El servidor bancario todavía no está configurado" }, true);
  assert.match(html, /Comprobar servidor/);
  assert.match(html, /todavía no está configurado/);
  assert.match(html, /role="alert"/);
});

test("MANU empty-chat copy follows Gemini on/off state", () => {
  const app = read("app.js");
  assert.match(app, /const intro = aiReady\(\) && aiMode\(\)\.on/);
  assert.match(app, /Gemini está activado para conversar contigo/);
  assert.match(app, /La IA está disponible, pero ahora está desactivada/);
  assert.match(app, /const history = vault\.chat\.length \? vault\.chat : \[\{ from: "manu", text: intro \}\]/);
});

test("iOS scroll header is readable over content and money total is labeled correctly", () => {
  const css = read("styles.css");
  const app = read("app.js");
  const sw = read("sw.js");
  assert.match(css, /\.topbar\.show \{[^}]*background: rgba\(8, 11, 17, \.97\)/);
  assert.match(css, /\.topbar\.show \{[^}]*-webkit-backdrop-filter: none/);
  assert.match(app, /Gastos registrados en MANU, no es el saldo de Sabadell/);
  assert.match(sw, /const VERSION = "manuos-v104"/);
});
