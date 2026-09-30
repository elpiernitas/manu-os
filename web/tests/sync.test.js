import test from "node:test";
import assert from "node:assert/strict";
import { configProblem, parseSyncLink, signIn, signUp, refreshSession, needsRefresh, remoteHead, remotePut, remoteGet, decide, isEmptyVault, syncErrorText, SUPABASE_SQL } from "../core/sync.js";
import { newSalt, deriveSyncKey, sealWithKey, openWithKey, MIN_ITERATIONS } from "../core/crypto.js";

const URL_OK = "https://abcdefghijklmnopqrst.supabase.co";
const KEY_OK = "sb_publishable_TESTkey_1234567890";
const cfg = { url: URL_OK, key: KEY_OK };

test("WEB-64: config accepts the publishable key and refuses the secret one", () => {
  assert.equal(configProblem(cfg), null);
  assert.equal(configProblem({ url: `${URL_OK}/`, key: KEY_OK }), null);
  assert.match(configProblem({ url: URL_OK, key: "sb_secret_abcdefghijklmnop" }), /SECRETA/);
  const jwt = (role) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.sig`;
  assert.equal(configProblem({ url: URL_OK, key: jwt("anon") }), null);
  assert.match(configProblem({ url: URL_OK, key: jwt("service_role") }), /no es la «anon»|SECRETA/);
  assert.match(configProblem({ url: "https://evil.example.com", key: KEY_OK }), /Project URL/);
  assert.match(configProblem({ url: "http://abcdefghijklmnopqrst.supabase.co", key: KEY_OK }), /Project URL/);
});

test("WEB-64: the setup link fills URL and key, and nothing else", () => {
  assert.deepEqual(parseSyncLink(`#nube=${encodeURIComponent(URL_OK)}|${KEY_OK}`), cfg);
  assert.equal(parseSyncLink(`#nube=${URL_OK}|sb_secret_abcdefghijklmnop`), null);
  assert.equal(parseSyncLink("#otra=cosa"), null);
  assert.equal(parseSyncLink(""), null);
});

test("WEB-64: what to do on each situation", () => {
  assert.equal(decide({ remote: null, localEmpty: false }), "push"); // first device
  assert.equal(decide({ remote: null, localEmpty: true }), "push"); // even empty: fixes the account's salt
  assert.equal(decide({ lastRev: null, remote: { rev: 4 }, localEmpty: true }), "pull"); // new, empty device
  assert.equal(decide({ lastRev: null, remote: { rev: 4 }, localEmpty: false }), "conflict"); // both have data: ask
  assert.equal(decide({ lastRev: 4, dirty: false, remote: { rev: 4 } }), "none");
  assert.equal(decide({ lastRev: 4, dirty: true, remote: { rev: 4 } }), "push");
  assert.equal(decide({ lastRev: 4, dirty: false, remote: { rev: 6 } }), "pull");
  assert.equal(decide({ lastRev: 4, dirty: true, remote: { rev: 6 } }), "conflict");
  assert.equal(decide({ lastRev: 6, dirty: false, remote: { rev: 2 } }), "conflict");
  assert.equal(isEmptyVault({ inbox: [], people: [] }), true);
  assert.equal(isEmptyVault({ inbox: [{ id: "a" }] }), false);
  assert.equal(isEmptyVault({ profile: { text: "Soy Manu" } }), false);
});

test("WEB-64: sealed with a key derived once; wrong phrase fails; header tamper fails", async () => {
  const salt = newSalt();
  const k = await deriveSyncKey("una frase larga de prueba", salt, MIN_ITERATIONS);
  const env = await sealWithKey({ inbox: [{ id: "x", text: "hola" }] }, k, { salt, iterations: MIN_ITERATIONS });
  assert.equal(env.kdf.salt, salt);
  assert.doesNotMatch(JSON.stringify(env), /hola/);
  assert.deepEqual(await openWithKey(env, k), { inbox: [{ id: "x", text: "hola" }] });
  const other = await deriveSyncKey("otra frase distinta xx", salt, MIN_ITERATIONS);
  await assert.rejects(openWithKey(env, other), (e) => e.code === "phrase");
  await assert.rejects(openWithKey({ ...env, kdf: { ...env.kdf, iterations: MIN_ITERATIONS + 1 } }, k), (e) => e.code === "phrase");
  const again = await sealWithKey({ a: 1 }, k, { salt, iterations: MIN_ITERATIONS });
  assert.notEqual(again.cipher.iv, env.cipher.iv); // fresh IV each time
  await assert.rejects(deriveSyncKey("corta", salt), /al menos 10/);
});

// ---------- REST, with a tiny fake Supabase ----------
function fakeSupabase() {
  const rows = new Map();
  const calls = [];
  const f = async (url, init = {}) => {
    const u = new URL(url); const method = init.method ?? "GET";
    const h = init.headers ?? {};
    calls.push({ method, path: u.pathname + u.search, headers: h });
    const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
    if (h.apikey !== KEY_OK) return json(401, { message: "Invalid API key" });
    if (u.pathname === "/auth/v1/token" && u.searchParams.get("grant_type") === "password") {
      const b = JSON.parse(init.body);
      return b.password === "contraseña1" ? json(200, { access_token: "A1", refresh_token: "R1", expires_in: 3600, user: { id: "u1", email: b.email } }) : json(400, { error_description: "Invalid login credentials" });
    }
    if (u.pathname === "/auth/v1/token") return JSON.parse(init.body).refresh_token === "R1" ? json(200, { access_token: "A2", refresh_token: "R2", expires_in: 3600, user: { id: "u1" } }) : json(400, { error_description: "Invalid Refresh Token" });
    if (u.pathname === "/auth/v1/signup") return json(200, { id: "u1", email: "x" }); // confirmation pending
    if (u.pathname === "/rest/v1/manu_sync") {
      if (!/^Bearer A/.test(h.Authorization ?? "")) return json(401, { message: "JWT expired" });
      if (method === "GET") { const r = rows.get("vault"); return json(200, r ? [r] : []); }
      if (method === "POST") { if (rows.has("vault")) return json(409, { message: "duplicate key" }); const b = JSON.parse(init.body); rows.set("vault", { ...b, updated_at: "t1" }); return json(201, [{ rev: b.rev }]); }
      if (method === "PATCH") { const want = Number(u.searchParams.get("rev").slice(3)); const r = rows.get("vault"); if (!r || r.rev !== want) return json(200, []); const b = JSON.parse(init.body); rows.set("vault", { ...r, ...b }); return json(200, [{ rev: b.rev }]); }
    }
    return json(404, { message: "not found" });
  };
  return { f, rows, calls };
}

test("WEB-64: log in, first upload, then two devices can't overwrite each other", async () => {
  const sb = fakeSupabase();
  await assert.rejects(signIn(cfg, { email: "m@x.es", password: "mal" }, sb.f), (e) => e.code === "login");
  const s = await signIn(cfg, { email: "m@x.es", password: "contraseña1" }, sb.f, 1000);
  assert.equal(s.access, "A1"); assert.equal(s.userId, "u1"); assert.equal(s.exp, 1000 + 3600000);
  assert.equal(await remoteHead(cfg, s, sb.f), null);
  assert.equal(await remotePut(cfg, s, { data: { v: 1 }, baseRev: null, device: "iPhone" }, sb.f), 1);
  await assert.rejects(remotePut(cfg, s, { data: { v: 1 }, baseRev: null, device: "Mac" }, sb.f), (e) => e.code === "conflict"); // row exists
  assert.equal(await remotePut(cfg, s, { data: { v: 2 }, baseRev: 1, device: "iPhone" }, sb.f), 2);
  await assert.rejects(remotePut(cfg, s, { data: { v: 9 }, baseRev: 1, device: "Mac" }, sb.f), (e) => e.code === "conflict"); // stale
  assert.deepEqual((await remoteGet(cfg, s, sb.f)).data, { v: 2 });
  assert.equal((await remoteHead(cfg, s, sb.f)).rev, 2);
  // Never the key as Bearer; always the user token.
  assert.ok(sb.calls.filter((c) => c.path.startsWith("/rest/")).every((c) => c.headers.Authorization === "Bearer A1"));
});

test("WEB-64: refresh, expiry and signup with email confirmation", async () => {
  const sb = fakeSupabase();
  assert.equal(needsRefresh({ access: "A", exp: 200000 }, 50000), false);
  assert.equal(needsRefresh({ access: "A", exp: 200000 }, 150000), true);
  assert.equal((await refreshSession(cfg, { refresh: "R1" }, sb.f)).access, "A2");
  await assert.rejects(refreshSession(cfg, { refresh: "viejo" }, sb.f), (e) => e.code === "expired");
  await assert.rejects(remoteHead(cfg, { access: "X" }, sb.f), (e) => e.code === "expired");
  assert.deepEqual(await signUp(cfg, { email: "m@x.es", password: "contraseña1" }, sb.f), { confirm: true });
  await assert.rejects(signUp(cfg, { email: "m@x.es", password: "corta" }, sb.f), (e) => e.code === "weak");
  await assert.rejects(remoteHead(cfg, { access: "A1" }, async () => { throw new TypeError("offline"); }), (e) => e.code === "network");
  assert.match(syncErrorText({ code: "table" }), /tabla/);
});

test("WEB-64: the SQL keeps each user to their own row and shuts anon out", () => {
  assert.match(SUPABASE_SQL, /enable row level security/);
  assert.match(SUPABASE_SQL, /revoke all on public\.manu_sync from anon/);
  assert.match(SUPABASE_SQL, /using \(user_id = \(select auth\.uid\(\)\)\) with check \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.doesNotMatch(SUPABASE_SQL, /grant [^;]*delete/); // nobody deletes through the API
});
