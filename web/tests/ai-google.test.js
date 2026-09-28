import { test } from "node:test";
import assert from "node:assert/strict";
import { isSensitive, pickModel, requestBody, replyText, ask, systemPrompt, buildPayload, BASE_SYSTEM } from "../core/ai.js";
import { planTaskSync, birthdaysFrom, mergePeople, saveBackup, SCOPE, runServices, listOpenTasks, contactBirthdays, paginate } from "../core/google.js";
import { encryptBackup, decryptBackup, isEnvelope, passphraseProblem, envelopeProblem, MIN_ITERATIONS } from "../core/crypto.js";

test("privacy denylist blocks obvious cases, including the four examples from review round 1", () => {
  for (const t of ["tengo VIH", "me recetaron sertralina", "cobro 1500 al mes", "mi tarjeta es 4111 1111 1111 1111",
    "tengo que ir al médico", "gasté 20 €", "mi IBAN ES91 2100 0418", "llama al 612 345 678", "escribe a alguien@correo.es", "estoy triste", "mi contraseña es x"]) {
    assert.equal(isSensitive(t), true, t);
  }
  for (const t of ["qué película puedo ver hoy", "dame ideas para una cena con amigos"]) assert.equal(isSensitive(t), false, t);
});

test("nothing is sent without explicit confirmation, whatever the text", async () => {
  let called = 0;
  const fetchSpy = async () => { called++; return { ok: true, status: 200, json: async () => ({}) }; };
  for (const t of ["tengo VIH", "me recetaron sertralina", "cobro 1500 al mes", "mi tarjeta es 4111 1111 1111 1111", "qué película veo"]) {
    await assert.rejects(ask({ key: "k", model: "m", payload: buildPayload(t) }, fetchSpy), (e) => e.code === "unconfirmed");
  }
  for (const t of ["tengo VIH", "me recetaron sertralina", "cobro 1500 al mes", "mi tarjeta es 4111 1111 1111 1111"]) {
    await assert.rejects(ask({ key: "k", model: "m", payload: buildPayload(t), confirmed: true }, fetchSpy), (e) => e.code === "sensitive");
  }
  assert.equal(called, 0);
});

test("default payload carries only the message and a fixed instruction", () => {
  const p = buildPayload("qué película veo");
  assert.equal(p.contents.length, 1);
  assert.equal(p.contents[0].parts[0].text, "qué película veo");
  assert.equal(p.systemInstruction.parts[0].text, BASE_SYSTEM);
  assert.ok(!JSON.stringify(p).includes("Tareas") && !JSON.stringify(p).includes("Agenda"));
});

test("confirmed request: key in header, exact payload sent, errors mapped", async () => {
  let seen;
  const payload = buildPayload("hola");
  const text = await ask({ key: "secret", model: "gemini-x", payload, confirmed: true }, async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "¡Hola!" }] } }] }) }; });
  assert.equal(text, "¡Hola!");
  assert.ok(!seen.url.includes("secret"));
  assert.equal(seen.init.headers["x-goog-api-key"], "secret");
  assert.deepEqual(JSON.parse(seen.init.body), payload);
  await assert.rejects(ask({ key: "k", model: "m", payload, confirmed: true }, async () => ({ status: 429, ok: false })), (e) => e.code === "quota");
});

test("opt-in context stays filtered; model choice prefers newest stable flash", () => {
  const sys = systemPrompt({ tasks: ["Comprar pan", "Pagar la hipoteca"], city: "Gijón" });
  assert.ok(sys.includes("Comprar pan") && !sys.includes("hipoteca"));
  assert.equal(requestBody("hola", [{ from: "me", text: "gasté 5 €" }, { from: "manu", text: "Anotado" }]).contents.length, 2);
  assert.equal(replyText({}), null);
  const json = { models: ["gemini-1.5-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.0-flash-preview"].map((n) => ({ name: `models/${n}`, supportedGenerationMethods: ["generateContent"] })) };
  assert.equal(pickModel(json), "gemini-2.5-flash");
});

test("each service asks only for its own scope; a denial does not break the others", async () => {
  const asked = [];
  const tokenFor = async (scope) => { asked.push(scope); if (scope === SCOPE.contacts) throw new Error("Permiso denegado"); return `t:${scope}`; };
  const services = Object.entries(SCOPE).map(([key, scope]) => ({ key, scope, run: async (token) => { assert.equal(token, `t:${scope}`); return "bien"; } }));
  const status = await runServices(services, { calendar: true, tasks: true, contacts: true, drive: false }, tokenFor);
  assert.deepEqual(asked, [SCOPE.calendar, SCOPE.tasks, SCOPE.contacts], "drive is off: its scope is never requested");
  assert.equal(status.calendar, "ok: bien");
  assert.equal(status.tasks, "ok: bien");
  assert.match(status.contacts, /^error: Permiso denegado/);
  assert.equal(status.drive, "off");
});

test("remote backup never contains sensitive markers in clear and restores after decrypting", async () => {
  const vault = { schema: 1, inbox: [], spending: [{ id: "s", cents: 4500, merchant: "MARCADOR_DINERO" }], health: [{ day: "2026-09-28", kind: "SLEEP", value: 7 }], moods: [{ day: "2026-09-28", value: 1 }], chat: [{ from: "me", text: "MARCADOR_SALUD" }] };
  const env = await encryptBackup(vault, "frase larga de prueba", { iterations: MIN_ITERATIONS });
  const uploaded = JSON.stringify(env);
  for (const marker of ["MARCADOR_DINERO", "MARCADOR_SALUD", "SLEEP", "4500", "moods"]) assert.ok(!uploaded.includes(marker), marker);
  assert.ok(isEnvelope(env));
  assert.deepEqual(await decryptBackup(env, "frase larga de prueba"), vault);
  await assert.rejects(decryptBackup(env, "otra frase distinta"), /incorrecta/);
  const tampered = { ...env, kdf: { ...env.kdf, iterations: MIN_ITERATIONS + 1 } };
  await assert.rejects(decryptBackup(tampered, "frase larga de prueba"), /incorrecta o copia dañada/, "header is authenticated");
  assert.ok(passphraseProblem("corta"));
});

test("saveBackup refuses plaintext and uploads envelopes to appDataFolder", async () => {
  await assert.rejects(saveBackup("t", { schema: 1, inbox: [] }, async () => { throw new Error("no debería llamar"); }), /cifradas/);
  const env = await encryptBackup({ schema: 1 }, "frase larga de prueba", { iterations: MIN_ITERATIONS });
  const calls = [];
  const fake = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body });
    if (url.includes("/drive/v3/files?")) return { ok: true, status: 200, json: async () => ({ files: [] }) };
    return { ok: true, status: 200, json: async () => ({ id: "f1" }) };
  };
  await saveBackup("t", env, fake);
  assert.equal(calls[1].method, "POST");
  assert.ok(calls[1].body.includes('"parents":["appDataFolder"]') && calls[1].body.includes('"format":"manuos-backup"'));
});

test("tasks two-way plan and contacts merge", () => {
  const plan = planTaskSync([{ id: "a", status: "TASK", text: "Nueva" }, { id: "b", status: "TASK", done: true, googleId: "g1" }, { id: "c", status: "TASK", googleId: "g2" }], [{ id: "g1", title: "x" }, { id: "g3", title: "De Google" }], { complete: true });
  assert.deepEqual([plan.push, plan.complete, plan.closedRemotely].map((l) => l.map((i) => i.id)), [["a"], ["b"], ["c"]]);
  assert.deepEqual(plan.pull.map((t) => t.id), ["g3"]);
  const g = birthdaysFrom({ connections: [{ resourceName: "people/1", names: [{ displayName: "Persona Uno" }], birthdays: [{ date: { month: 3, day: 7 } }] }] });
  let n = 0;
  const first = mergePeople([], g, () => `p${++n}`);
  assert.equal(mergePeople(first.people, g, () => `p${++n}`).added, 0);
});

test("round 2: closed envelope schema is enforced before any upload or KDF work", async () => {
  const env = await encryptBackup({ schema: 1 }, "frase larga de prueba", { iterations: MIN_ITERATIONS });
  assert.equal(envelopeProblem(env), null);
  // An extra field carrying a plaintext marker never reaches fetch.
  let fetched = 0;
  const spy = async () => { fetched++; return { ok: true, status: 200, json: async () => ({ files: [] }) }; };
  await assert.rejects(saveBackup("t", { ...env, leak: "MARCADOR_SALUD" }, spy), /campos no válidos/);
  await assert.rejects(saveBackup("t", { ...env, kdf: { ...env.kdf, extra: "MARCADOR_SALUD" } }, spy), /KDF no válido/);
  await assert.rejects(saveBackup("t", { ...env, cipher: { ...env.cipher, note: "MARCADOR_SALUD" } }, spy), /cifrado no válido/);
  assert.equal(fetched, 0);
  // Out-of-range iterations are rejected quickly, before PBKDF2.
  for (const iterations of [1e12, 1, 0, -5, 1.5, "600000", MIN_ITERATIONS - 1]) {
    const t0 = Date.now();
    await assert.rejects(decryptBackup({ ...env, kdf: { ...env.kdf, iterations } }, "frase larga de prueba"), /Copia no válida/);
    assert.ok(Date.now() - t0 < 50, `fast rejection for ${iterations}`);
  }
  // Wrong names, IV, salt, version, ciphertext.
  const bad = [
    { ...env, format: "otro" },
    { ...env, v: 2 },
    { ...env, kdf: { ...env.kdf, name: "scrypt" } },
    { ...env, kdf: { ...env.kdf, hash: "SHA-1" } },
    { ...env, kdf: { ...env.kdf, salt: "AAAA" } },
    { ...env, kdf: { ...env.kdf, salt: "no es base64!!" } },
    { ...env, cipher: { ...env.cipher, name: "AES-CBC" } },
    { ...env, cipher: { ...env.cipher, iv: "AAAAAAAAAAAAAAAAAAAAAA==" } },
    { ...env, ct: "" },
    null,
    [],
  ];
  for (const x of bad) {
    assert.ok(envelopeProblem(x), JSON.stringify(x)?.slice(0, 60));
    await assert.rejects(decryptBackup(x, "frase larga de prueba"), /Copia no válida/);
  }
  await assert.rejects(encryptBackup({}, "frase larga de prueba", { iterations: 10 }), /fuera de rango/);
});

// Fake Google Tasks with 150 open tasks served in pages of 100.
function tasksServer({ pages, failOn = null, loopToken = false }) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const token = new URL(url).searchParams.get("pageToken");
    const index = token ? Number(token.replace("p", "")) : 0;
    if (failOn === index) return { ok: false, status: 500, json: async () => ({}) };
    const next = loopToken ? "p1" : index + 1 < pages.length ? `p${index + 1}` : undefined;
    return { ok: true, status: 200, json: async () => ({ items: pages[index], ...(next ? { nextPageToken: next } : {}) }) };
  };
  return { fetchImpl, calls };
}
const openTasks = (from, n) => Array.from({ length: n }, (_, i) => ({ id: `g${from + i}`, title: `Tarea ${from + i}`, status: "needsAction" }));

test("round 3: tasks on page 2 are never closed; incomplete listings close nothing", async () => {
  const pages = [openTasks(0, 100), openTasks(100, 50)];
  const linked = [{ id: "local", status: "TASK", googleId: "g120" }, { id: "gone", status: "TASK", googleId: "g999" }];

  const full = tasksServer({ pages });
  const all = await listOpenTasks("t", full.fetchImpl);
  assert.equal(all.tasks.length, 150);
  assert.equal(all.complete, true);
  assert.equal(full.calls.length, 2);
  assert.ok(full.calls[1].includes("pageToken=p1"));
  const plan = planTaskSync(linked, all.tasks, { complete: all.complete });
  assert.deepEqual(plan.closedRemotely.map((i) => i.id), ["gone"], "g120 is on page 2 and stays open");

  const failing = tasksServer({ pages, failOn: 1 });
  const partial = await listOpenTasks("t", failing.fetchImpl);
  assert.equal(partial.complete, false);
  assert.deepEqual(planTaskSync(linked, partial.tasks, { complete: partial.complete }).closedRemotely, [], "a failed second page closes nothing");

  const looping = tasksServer({ pages, loopToken: true });
  const looped = await listOpenTasks("t", looping.fetchImpl);
  assert.equal(looped.complete, false);
  assert.ok(looping.calls.length <= 3, "a repeated token stops the loop");
  assert.deepEqual(planTaskSync(linked, looped.tasks, { complete: looped.complete }).closedRemotely, []);

  assert.deepEqual(planTaskSync(linked, [], {}).closedRemotely, [], "default is incomplete");
  await assert.rejects(listOpenTasks("t", tasksServer({ pages, failOn: 0 }).fetchImpl), /Google respondió 500/, "a failed first page is an error, not an empty list");
  const capped = await paginate(async (t) => ({ items: [1], nextPageToken: `n${(Number(t?.slice(1)) || 0) + 1}` }), { maxPages: 5 });
  assert.equal(capped.complete, false);
  assert.equal(capped.items.length, 5);
});

test("round 3: contacts are paginated and a partial listing never deletes people", async () => {
  const person = (i) => ({ resourceName: `people/${i}`, names: [{ displayName: `Persona ${i}` }], birthdays: [{ date: { month: 1, day: (i % 28) + 1 } }] });
  const pages = [Array.from({ length: 3 }, (_, i) => person(i)), [person(3)]];
  const fetchImpl = async (url) => {
    const token = new URL(url).searchParams.get("pageToken");
    const index = token ? 1 : 0;
    return { ok: true, status: 200, json: async () => ({ connections: pages[index], ...(index === 0 ? { nextPageToken: "x" } : {}) }) };
  };
  const got = await contactBirthdays("t", fetchImpl);
  assert.equal(got.people.length, 4);
  assert.equal(got.complete, true);
  const existing = [{ id: "p0", name: "Persona Z", googleId: "people/77", birthday: "05-05" }];
  const merged = mergePeople(existing, got.people.slice(0, 1), () => "new");
  assert.ok(merged.people.some((p) => p.googleId === "people/77"), "missing contacts are kept");
});
