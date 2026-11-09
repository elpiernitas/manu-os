// MANU OS / Enable Banking AIS (read-only). No payments endpoint, no bank credentials in the browser.
// NOT deployed by this PR. The live redirect must be added manually to Enable Banking before use.
// Docs: https://enablebanking.com/docs/api/reference/
import {
  newOAuthState, hashState, makeEnableJwt, validState, validAccountId, validIsoDate,
  sabadellFromAspsps, sanitizeAccounts, balancesView, transactionsView,
} from "./bank-core.js";

const SUPABASE = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? (() => { try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default ?? ""; } catch { return ""; } })();
const PUBLIC = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const APP_ID = Deno.env.get("ENBANK_APP_ID") ?? "";
const PRIVATE_KEY = (Deno.env.get("ENBANK_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");
const CALLBACK = Deno.env.get("MANU_BANK_CALLBACK_URL") ?? "";
const APP_ORIGIN = "https://elpiernitas.github.io";
const APP_HOME = APP_ORIGIN + "/manu-os/";
const API = "https://api.enablebanking.com";
const TABLE = "manu_bank_ais";
const cors = { "Access-Control-Allow-Origin": APP_ORIGIN, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Vary": "Origin" };
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });
const safeFail = (status, message) => reply({ error: message }, status);
const serviceHeaders = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json" };
const REST = SUPABASE + "/rest/v1/" + TABLE;
async function parsedResponse(response) {
  const text = await response.text();
  if (!response.ok) throw new Error("Backend request failed: " + response.status);
  return text ? JSON.parse(text) : null;
}
async function rowFor(user) {
  const rows = await parsedResponse(await fetch(REST + "?user_id=eq." + encodeURIComponent(user) + "&select=user_id,state_hash,state_until,session_id,accounts,consent_until", { headers: serviceHeaders }));
  return rows?.[0] ?? null;
}
async function putRow(row) {
  const rows = await parsedResponse(await fetch(REST + "?on_conflict=user_id", {
    method: "POST", headers: { ...serviceHeaders, Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(row),
  }));
  if (!rows?.[0]) throw new Error("Bank state was not stored");
  return rows[0];
}
async function claimPending(hash, now) {
  const rows = await parsedResponse(await fetch(REST + "?state_hash=eq." + hash + "&state_until=gt." + encodeURIComponent(now) + "&select=user_id,session_id", {
    method: "PATCH", headers: { ...serviceHeaders, Prefer: "return=representation" }, body: JSON.stringify({ state_hash: null, state_until: null }),
  }));
  return rows?.[0] ?? null;
}
async function removeRow(user) {
  await parsedResponse(await fetch(REST + "?user_id=eq." + encodeURIComponent(user), { method: "DELETE", headers: serviceHeaders }));
}
async function identity(req) {
  const bearer = req.headers.get("authorization") ?? "";
  if (!/^Bearer [^\s]+$/.test(bearer) || !PUBLIC) return null;
  const r = await fetch(SUPABASE + "/auth/v1/user", { headers: { apikey: PUBLIC, Authorization: bearer } });
  if (!r.ok) return null;
  const user = await r.json();
  return /^[0-9a-f-]{36}$/i.test(user?.id ?? "") ? user.id : null;
}
async function enable(path, options = {}) {
  const jwt = await makeEnableJwt({ appId: APP_ID, privatePem: PRIVATE_KEY });
  const res = await fetch(API + path, {
    method: options.method ?? "GET",
    headers: { Authorization: "Bearer " + jwt, Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error("Enable Banking returned HTTP " + res.status);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}
function configured() {
  return SUPABASE.startsWith("https://") && SERVICE.length > 20 && PUBLIC.length > 10 &&
    /^[a-f0-9-]{36}$/i.test(APP_ID) && PRIVATE_KEY.includes("-----BEGIN PRIVATE KEY-----") &&
    CALLBACK === SUPABASE + "/functions/v1/manu-bank";
}
const bounce = (result) => new Response(null, { status: 303, headers: { Location: APP_HOME + "#banco=" + result, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
async function callback(url) {
  const state = url.searchParams.get("state"), code = url.searchParams.get("code");
  if (!validState(state)) return bounce("error");
  const hash = await hashState(state);
  const pending = await claimPending(hash, new Date().toISOString());
  if (!pending) return bounce("error"); // one-time state, bound to one owner and 10-minute expiry
  if (url.searchParams.has("error") || !code || !validState(code)) return bounce("error");
  try {
    const created = await enable("/sessions", { method: "POST", body: { code } });
    if (!/^[0-9a-f-]{36}$/i.test(created.session_id ?? "")) throw new Error("Invalid session");
    const accounts = sanitizeAccounts(created.accounts);
    if (!accounts.length) throw new Error("No authorised accounts in restricted application");
    await putRow({ user_id: pending.user_id, session_id: created.session_id, accounts, consent_until: created.access?.valid_until ?? null, connected_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return bounce("connected");
  } catch { return bounce("error"); } // do not reveal code, names or provider response
}
const linked = (row) => Boolean(row?.session_id) && (!row.consent_until || Date.parse(row.consent_until) > Date.now());
async function route(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!configured()) return safeFail(503, "Conexión bancaria todavía no configurada");
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/manu-bank")) return callback(url);
  if (req.method !== "POST") return safeFail(405, "Método no permitido");
  if (req.headers.get("origin") && req.headers.get("origin") !== APP_ORIGIN) return safeFail(403, "Origen no permitido");
  const user = await identity(req);
  if (!user) return safeFail(401, "Inicia sesión en Tu nube para usar el banco");
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const row = await rowFor(user);
  if (action === "status") return reply({ connected: linked(row), pending: Boolean(row?.state_hash), accounts: linked(row) ? (row.accounts ?? []).map((x, i) => ({ index: i, label: x.label, currency: x.currency })) : [], validUntil: row?.consent_until ?? null });
  if (action === "start") {
    const aspsps = await enable("/aspsps");
    const bank = sabadellFromAspsps(aspsps);
    const seconds = aspsps.aspsps.find((x) => x.country === bank.country && x.name === bank.name)?.maximum_consent_validity;
    const validity = Math.max(3600, Math.min(86400, Number.isFinite(seconds) && seconds > 0 ? seconds : 86400));
    const state = newOAuthState();
    await putRow({ user_id: user, state_hash: await hashState(state), state_until: new Date(Date.now() + 10 * 60000).toISOString(), updated_at: new Date().toISOString() });
    const auth = await enable("/auth", { method: "POST", body: {
      access: { valid_until: new Date(Date.now() + validity * 1000).toISOString(), balances: true, transactions: true },
      aspsp: bank, psu_type: "personal", state, redirect_url: CALLBACK, language: "es",
    } });
    if (typeof auth.url !== "string" || !auth.url.startsWith("https://auth.enablebanking.com/")) throw new Error("Unexpected authorization destination");
    return reply({ url: auth.url });
  }
  if (action === "disconnect") {
    if (row?.session_id) {
      try { await enable("/sessions/" + encodeURIComponent(row.session_id), { method: "DELETE" }); }
      catch { return safeFail(502, "No se pudo revocar la sesión bancaria. No se ha borrado el vínculo."); }
    }
    await removeRow(user);
    return reply({ connected: false });
  }
  if (action !== "balances" && action !== "transactions") return safeFail(400, "Acción desconocida");
  if (!linked(row)) return safeFail(409, "Vincula tu banco primero o renueva el consentimiento");
  const index = body?.index;
  if (!Number.isInteger(index) || index < 0 || index >= (row.accounts?.length ?? 0)) return safeFail(400, "Cuenta no válida");
  const uid = row.accounts[index]?.uid;
  if (!validAccountId(uid)) return safeFail(400, "Cuenta no válida");
  if (action === "balances") return reply({ balances: balancesView(await enable("/accounts/" + uid + "/balances")) });
  const from = body.from, to = body.to;
  if (!validIsoDate(from) || !validIsoDate(to) || from > to || (Date.parse(to) - Date.parse(from)) > 90 * 86400000) return safeFail(400, "Selecciona un periodo válido de hasta 90 días");
  const q = new URLSearchParams({ date_from: from, date_to: to });
  if (body.continuation !== undefined && body.continuation !== null) {
    if (typeof body.continuation !== "string" || body.continuation.length > 500) return safeFail(400, "Página no válida");
    q.set("continuation_key", body.continuation);
  }
  return reply(transactionsView(await enable("/accounts/" + uid + "/transactions?" + q)));
}
Deno.serve(async (req) => {
  try { return await route(req); }
  catch (err) {
    // Do not log raw bank response, authorization code, IBAN or private key.
    console.error("manu-bank request failed", err instanceof Error ? err.name : "Unknown");
    return safeFail(502, "El banco o el servicio no están disponibles. Vuelve a intentarlo.");
  }
});
