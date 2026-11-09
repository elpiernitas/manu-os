// WEB-99 — avisos con MANU cerrada: la cola (privada por defecto), el servidor (sin duplicados,
// solo servicios push reales, suscripciones muertas fuera) y la migración (RLS). Datos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pushQueue, rowId, queueKey, replaceQueue, dropAll, securityCheck, serverKey } from "../core/push.js";
import { runDue, payload, GENERIC, STALE_MS } from "../../supabase/functions/manu-push/handler.js";
import { SUPABASE_SQL } from "../core/sync.js";

const NOW = new Date("2026-11-09T10:00:00+01:00");
const at = (min) => new Date(NOW.getTime() + min * 60000).toISOString();
const rems = [
  { id: "a1", text: "Llamar a una persona inventada por su cumpleaños", at: at(30) },
  { id: "a2", text: "Pasado", at: at(-5) },
  { id: "a3", text: "Hecho", at: at(60), done: true },
  { id: "a4", text: "Dentro de tres días", at: at(3 * 1440) },
  { id: "a5", text: "Mañana", at: at(1440) },
];

test("queue: only pending reminders of the next 48 h, opaque ids, no text by default", () => {
  const q = pushQueue(rems, { now: NOW });
  assert.deepEqual(q.map((r) => r.id), [rowId(rems[0]), rowId(rems[4])]);
  assert.ok(q.every((r) => r.body === null));
  assert.doesNotMatch(JSON.stringify(q), /cumpleaños|persona|Mañana/, "nothing personal leaves by default");
  assert.match(q[0].id, /^r_a1_\d+$/);
  const t = pushQueue(rems, { now: NOW, showText: true });
  assert.equal(t[0].body, "Llamar a una persona inventada por su cumpleaños", "text only if Manu turns it on");
  assert.ok(pushQueue([{ id: "x", text: "y".repeat(300), at: at(5) }], { now: NOW, showText: true })[0].body.length <= 120);
});

test("queue: no duplicates, bounded, changes only when it should", () => {
  const dup = [rems[0], { ...rems[0] }];
  assert.equal(pushQueue(dup, { now: NOW }).length, 1);
  const many = Array.from({ length: 80 }, (_, i) => ({ id: `m${i}`, text: "x", at: at(i + 1) }));
  assert.equal(pushQueue(many, { now: NOW }).length, 50);
  const a = queueKey(pushQueue(rems, { now: NOW })), b = queueKey(pushQueue(rems, { now: new Date(NOW.getTime() + 60000) }));
  assert.equal(a, b, "same queue a minute later: nothing to upload");
  assert.notEqual(a, queueKey(pushQueue([...rems, { id: "n", text: "z", at: at(10) }], { now: NOW })));
  const moved = pushQueue([{ ...rems[0], at: at(45) }], { now: NOW })[0].id;
  assert.notEqual(moved, rowId(rems[0]), "a moved reminder is a new notice (the old one is deleted on replace)");
});

// A fake server database with the same «claim» semantics as DELETE … RETURNING.
function fakeDb(rows, subs, keys = null) {
  const db = { rows: [...rows], list: [...subs], saved: 0, dropped: [] };
  return Object.assign(db, {
    keys: async () => db.keysV ?? keys,
    saveKeys: async (k) => { db.keysV = k; db.saved++; },
    claim: async (nowIso) => { const due = db.rows.filter((r) => r.at <= nowIso); db.rows = db.rows.filter((r) => r.at > nowIso); return due; },
    subs: async (users) => db.list.filter((s) => users.includes(s.user_id)),
    requeue: async (r) => { db.rows.push(r); },
    dropSub: async (s) => { db.dropped.push(s.id); db.list = db.list.filter((x) => x.id !== s.id); },
  });
}
const SUB = { p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth: "BTBZMqHH6r4Tts7J_aSIgg" };

test("server: creates its keys once, sends due notices once, generic by default", async () => {
  const db = fakeDb([{ user_id: "u1", id: "r_a1_1", at: at(-1), body: null }, { user_id: "u1", id: "r_a5_2", at: at(60), body: null }],
    [{ id: "s1", user_id: "u1", endpoint: "https://web.push.apple.com/abc", ...SUB }, { id: "s2", user_id: "u2", endpoint: "https://web.push.apple.com/other", ...SUB }]);
  const sent = [];
  const send = async (endpoint, headers, body) => { sent.push({ endpoint, headers, size: body.length }); return 201; };
  const site = "https://example.invalid/manu/";
  let out = await runDue({ db, send, now: NOW.getTime(), site });
  assert.equal(db.saved, 1, "VAPID keys generated on the server, once");
  assert.equal(out.sent, 1); assert.deepEqual(sent.map((s) => s.endpoint), ["https://web.push.apple.com/abc"], "only to the owner of the notice");
  assert.match(sent[0].headers.Authorization, /^vapid t=.+, k=/); assert.equal(sent[0].headers["Content-Encoding"], "aes128gcm");
  out = await runDue({ db, send, now: NOW.getTime(), site });
  assert.equal(out.sent, 0, "a claimed notice is never sent twice");
  assert.equal(db.saved, 1, "keys are reused");
  assert.equal(db.rows.length, 1, "future notices wait");
  const p = JSON.parse(payload({ id: "r_x_1", body: null }, site));
  assert.deepEqual(p, { web_push: 8030, notification: { title: "MANU", body: GENERIC, navigate: `${site}#avisos`, tag: "r_x_1" } });
});

test("server: overlapping runs do not duplicate; dead and foreign endpoints are handled", async () => {
  const db = fakeDb([{ user_id: "u1", id: "r_1", at: at(-1), body: null }, { user_id: "u1", id: "r_old", at: new Date(NOW.getTime() - STALE_MS - 60000).toISOString(), body: null }],
    [{ id: "dead", user_id: "u1", endpoint: "https://web.push.apple.com/dead", ...SUB }, { id: "evil", user_id: "u1", endpoint: "https://evil.example/x", ...SUB }, { id: "ok", user_id: "u1", endpoint: "https://fcm.googleapis.com/fcm/send/ok", ...SUB }]);
  let calls = 0;
  const send = async (endpoint) => { calls++; return endpoint.endsWith("dead") ? 410 : 201; };
  const [a, b] = await Promise.all([runDue({ db, send, now: NOW.getTime(), site: "https://x.invalid/" }), runDue({ db, send, now: NOW.getTime(), site: "https://x.invalid/" })]);
  assert.equal(a.sent + b.sent, 1, "two runs at once: sent once");
  assert.equal(a.stale + b.stale, 1, "a notice hours late is dropped, not sent");
  assert.equal(calls, 2, "never posts to an endpoint that is not a push service");
  assert.deepEqual(db.dropped, ["dead"], "a 410 removes the subscription");
});

// A fake PostgREST for the app-side adapters.
function fakeRest(handler) { const log = []; return { log, fetch: async (url, init = {}) => { log.push({ url, method: init.method ?? "GET", headers: init.headers ?? {}, body: init.body }); return handler(url, init); } }; }
const res = (status, json) => ({ ok: status < 300, status, json: async () => json, text: async () => JSON.stringify(json ?? "") });
const cfg = { url: "https://falso.supabase.co", key: "sb_publishable_falso" }, ses = { access: "tok" };

test("app adapters: replace the queue (upsert + delete the rest), switch everything off, read the public key", async () => {
  const r = fakeRest(() => res(201, null));
  await replaceQueue(cfg, ses, [{ id: "r_a_1", at: at(5), body: null }, { id: "r_b_2", at: at(9), body: null }], r.fetch);
  assert.equal(r.log[0].method, "POST"); assert.match(r.log[0].url, /on_conflict=user_id,id/); assert.match(r.log[0].headers.Prefer, /merge-duplicates/);
  assert.equal(r.log[1].method, "DELETE"); assert.match(r.log[1].url, /attempts=eq\.0&id=not\.in\.\(r_a_1,r_b_2\)/, "server retries are never deleted by the app");
  const e = fakeRest(() => res(204, null));
  await replaceQueue(cfg, ses, [], e.fetch);
  assert.equal(e.log.length, 1); assert.match(e.log[0].url, /id=not\.is\.null/, "empty queue: delete all of Manu's rows (RLS limits it to his)");
  const off = fakeRest(() => res(204, null));
  await dropAll(cfg, ses, off.fetch);
  assert.deepEqual(off.log.map((x) => [x.method, x.url.split("/rest/v1/")[1]]), [["DELETE", "manu_push_queue?user_id=not.is.null"], ["DELETE", "manu_push_subs?user_id=not.is.null"]]);
  const k = fakeRest(() => res(200, "B".repeat(87)));
  assert.equal(await serverKey(cfg, ses, k.fetch), "B".repeat(87));
  const missing = fakeRest(() => res(404, { code: "PGRST202", message: "Could not find the function" }));
  await assert.rejects(serverKey(cfg, ses, missing.fetch), (x) => x.missing === true);
});

test("security check reads only, and flags anything readable without a session", async () => {
  const r = fakeRest((url, init) => (url.includes("manu_push_keys") && init.headers.Authorization ? res(200, [{ id: 1 }]) : res(200, [])));
  const out = await securityCheck(cfg, ses, r.fetch);
  assert.ok(r.log.every((x) => x.method === "GET"));
  assert.equal(out.find((x) => x.label === "Claves privadas con tu sesión").ok, false, "a leak would be shown as a failure");
  assert.ok(out.filter((x) => x.label !== "Claves privadas con tu sesión").every((x) => x.ok));
  assert.ok(r.log.filter((x) => !x.headers.Authorization).length === 4, "four checks without any session");
});

test("migrations: RLS on every table, private keys and cron token closed to the app, base = app SQL", () => {
  const push = readFileSync(new URL("../../supabase/migrations/20261109120000_push.sql", import.meta.url), "utf8");
  for (const t of ["manu_push_subs", "manu_push_queue", "manu_push_keys", "manu_push_cron"]) assert.match(push, new RegExp(`alter table public\\.${t} enable row level security`));
  assert.match(push, /revoke all on public\.manu_push_subs, public\.manu_push_queue, public\.manu_push_keys, public\.manu_push_cron from anon, authenticated/);
  assert.doesNotMatch(push, /grant [^;]*manu_push_(keys|cron)/, "nobody but the server reads keys or the token");
  assert.match(push, /using \(user_id = \(select auth\.uid\(\)\)\) with check/);
  assert.match(push, /body is null or length\(body\) <= 120/);
  assert.match(push, /web\\\.push\\\.apple\\\.com/, "only push-service endpoints can be stored");
  assert.doesNotMatch(push, /sb_secret|service_role_key|eyJ/, "no secret in the repository");
  const base = readFileSync(new URL("../../supabase/migrations/20261109000000_base.sql", import.meta.url), "utf8");
  assert.ok(base.includes(SUPABASE_SQL), "the base migration is the same SQL the app shows");
});

test("server: a temporary provider failure is retried for that device only, without duplicates", async () => {
  const db = fakeDb([{ user_id: "u1", id: "r_1", at: at(-1), body: null }],
    [{ id: "okdevice", user_id: "u1", endpoint: "https://web.push.apple.com/ok", ...SUB }, { id: "flaky", user_id: "u1", endpoint: "https://web.push.apple.com/flaky", ...SUB }]);
  const sends = [];
  let flakyFails = 2;
  const send = async (endpoint) => { sends.push(endpoint); if (endpoint.endsWith("flaky") && flakyFails-- > 0) return 503; return 201; };
  const site = "https://x.invalid/";
  let t = NOW.getTime();
  let out = await runDue({ db, send, now: t, site });
  assert.deepEqual([out.sent, out.retried], [1, 1]);
  assert.equal(db.rows.length, 1); assert.equal(db.rows[0].sub_id, "flaky"); assert.equal(db.rows[0].attempts, 1);
  out = await runDue({ db, send, now: t + 30000, site });
  assert.equal(out.rows, 0, "not before its retry time");
  out = await runDue({ db, send, now: t + 61000, site });
  assert.deepEqual([out.sent, out.retried], [0, 1], "second failure: retried again");
  out = await runDue({ db, send, now: t + 61000 + 4 * 60000 + 1000, site });
  assert.equal(out.sent, 1, "third try works");
  assert.equal(sends.filter((e) => e.endsWith("/ok")).length, 1, "the device that got it is never sent it again");
  assert.equal(db.rows.length, 0);
  // Network error, and the retry limit.
  const db2 = fakeDb([{ user_id: "u1", id: "r_2", at: at(-1), body: null }], [{ id: "down", user_id: "u1", endpoint: "https://web.push.apple.com/down", ...SUB }]);
  const boom = async () => { throw new Error("network"); };
  let total = { retried: 0, failed: 0 };
  for (let i = 0; i < 6; i++) { const o = await runDue({ db: db2, send: boom, now: t + i * 20 * 60000, site }); total.retried += o.retried ?? 0; total.failed += o.failed ?? 0; }
  assert.deepEqual(total, { retried: 2, failed: 1 }, "3 tries in total, then it stops (iOS Reminders remain the fallback)");
});
