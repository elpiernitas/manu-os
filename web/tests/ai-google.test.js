import { test } from "node:test";
import assert from "node:assert/strict";
import { isSensitive, pickModel, requestBody, replyText, ask, systemPrompt } from "../core/ai.js";
import { planTaskSync, birthdaysFrom, mergePeople, saveBackup, SCOPES } from "../core/google.js";

test("privacy: health, money, mood, contact data and secrets never go to the model", () => {
  for (const t of ["tengo que ir al médico", "cuánto dinero me queda", "gasté 20 €", "mi IBAN ES91 2100 0418", "llama al 612 345 678", "escribe a alguien@correo.es", "estoy triste", "mi contraseña es x"]) {
    assert.equal(isSensitive(t), true, t);
  }
  for (const t of ["qué película puedo ver hoy", "dame ideas para una cena con amigos", "cómo organizo mi semana"]) {
    assert.equal(isSensitive(t), false, t);
  }
});

test("model choice prefers the newest stable flash", () => {
  const json = { models: [
    { name: "models/gemini-1.5-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-2.5-flash-lite", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.0-flash-preview", supportedGenerationMethods: ["generateContent"] },
    { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
  ] };
  assert.equal(pickModel(json), "gemini-2.5-flash");
  assert.equal(pickModel({ models: [] }), null);
});

test("request drops sensitive history and bounds sizes; system prompt filters too", () => {
  const body = requestBody("hola", [{ from: "me", text: "gasté 5 €" }, { from: "manu", text: "Anotado" }], "sys");
  assert.equal(body.contents.length, 2);
  assert.equal(body.contents[0].role, "model");
  const sys = systemPrompt({ tasks: ["Comprar pan", "Pagar la hipoteca"], city: "Gijón" });
  assert.ok(sys.includes("Comprar pan") && !sys.includes("hipoteca"));
  assert.equal(replyText({ candidates: [{ content: { parts: [{ text: " Hola " }] } }] }), "Hola");
  assert.equal(replyText({}), null);
});

test("ask refuses sensitive text before any network call and maps errors", async () => {
  let called = false;
  await assert.rejects(ask({ key: "k", model: "m", message: "me duele, voy al médico" }, async () => { called = true; }), (e) => e.code === "sensitive");
  assert.equal(called, false);
  await assert.rejects(ask({ key: "k", model: "m", message: "hola" }, async () => ({ status: 429, ok: false })), (e) => e.code === "quota");
  let headers;
  const text = await ask({ key: "secret", model: "gemini-x", message: "hola" }, async (url, init) => { headers = init.headers; assert.ok(!url.includes("secret")); return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "¡Hola!" }] } }] }) }; });
  assert.equal(text, "¡Hola!");
  assert.equal(headers["x-goog-api-key"], "secret", "key goes in a header, never in the URL");
});

test("tasks two-way sync plan", () => {
  const local = [
    { id: "a", status: "TASK", text: "Nueva" },
    { id: "b", status: "TASK", done: true, googleId: "g1" },
    { id: "c", status: "TASK", googleId: "g2" },
    { id: "d", status: "IDEA", text: "idea" },
  ];
  const plan = planTaskSync(local, [{ id: "g1", title: "x" }, { id: "g3", title: "De Google" }]);
  assert.deepEqual(plan.push.map((i) => i.id), ["a"]);
  assert.deepEqual(plan.complete.map((i) => i.id), ["b"]);
  assert.deepEqual(plan.closedRemotely.map((i) => i.id), ["c"]);
  assert.deepEqual(plan.pull.map((t) => t.id), ["g3"]);
});

test("contacts birthdays merge without duplicates", () => {
  const g = birthdaysFrom({ connections: [
    { resourceName: "people/1", names: [{ displayName: "Persona Uno" }], birthdays: [{ date: { month: 3, day: 7 } }] },
    { resourceName: "people/2", names: [{ displayName: "Sin fecha" }] },
  ] });
  assert.deepEqual(g, [{ googleId: "people/1", name: "Persona Uno", birthday: "03-07" }]);
  let n = 0;
  const first = mergePeople([], g, () => `p${++n}`);
  assert.equal(first.added, 1);
  const again = mergePeople(first.people, g, () => `p${++n}`);
  assert.equal(again.added, 0);
  assert.equal(again.people.length, 1);
});

test("drive backup creates in appDataFolder, then updates", async () => {
  const calls = [];
  const fake = (existing) => async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body });
    if (url.includes("/drive/v3/files?")) return { ok: true, status: 200, json: async () => ({ files: existing ? [{ id: "f1" }] : [] }) };
    return { ok: true, status: 200, json: async () => ({ id: "f1" }) };
  };
  await saveBackup("t", { schema: 1 }, fake(false));
  assert.equal(calls[1].method, "POST");
  assert.ok(calls[1].body.includes('"parents":["appDataFolder"]'));
  calls.length = 0;
  await saveBackup("t", { schema: 1 }, fake(true));
  assert.equal(calls[1].method, "PATCH");
  assert.ok(SCOPES.includes("drive.appdata") && !SCOPES.includes("auth/drive "), "only the app folder");
});
