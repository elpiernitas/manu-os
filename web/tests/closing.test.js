import test from "node:test";
import assert from "node:assert/strict";
import { closingDue, workClosing, closingText, isClosingQuestion, nextWorkDay } from "../core/closing.js";
import { whatNow } from "../core/now.js";
import { generate, askWithActions, aiErrorText } from "../core/ai.js";

const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min);
const iso = (y, m, d, h, min = 0) => at(y, m, d, h, min).toISOString();
// 2026-09-30 is a Wednesday; 2026-10-02 a Friday.

test("WEB-63: closing time is a workday from 13:00 to 15:00, once", () => {
  assert.equal(closingDue(at(2026, 9, 30, 12, 59)), false);
  assert.equal(closingDue(at(2026, 9, 30, 13, 0)), true);
  assert.equal(closingDue(at(2026, 9, 30, 14, 59)), true);
  assert.equal(closingDue(at(2026, 9, 30, 15, 0)), false);
  assert.equal(closingDue(at(2026, 10, 3, 13, 30)), false); // Saturday
  assert.equal(closingDue(at(2026, 9, 30, 13, 30), { closedDay: "2026-09-30" }), false);
  assert.equal(closingDue(at(2026, 9, 30, 13, 30), { closedDay: "2026-09-29" }), true);
});

test("WEB-63: what he did, what waits, and the first thing next workday", () => {
  const inbox = [
    { id: "a", status: "TASK", text: "subir el reel", done: true, doneAt: iso(2026, 9, 30, 11) },
    { id: "b", status: "TASK", text: "flyer", done: true, doneAt: iso(2026, 9, 29, 11) }, // yesterday: not counted
    { id: "c", status: "TASK", text: "llamar al cliente", at: iso(2026, 9, 20, 9) },
    { id: "d", status: "TASK", text: "fotos del piso", at: iso(2026, 9, 28, 9) },
    { id: "e", status: "IDEA", text: "idea suelta" },
  ];
  const c = workClosing({ now: at(2026, 9, 30, 13, 5), inbox, tomorrow: [{ title: "🎂 Cumple de Persona Demo" }, { time: "09:30", title: "Reunión" }], reminders: [{ text: "revisar portal", at: iso(2026, 10, 1, 9, 0) }] });
  assert.deepEqual(c.done, ["subir el reel"]);
  assert.deepEqual(c.open, ["llamar al cliente", "fotos del piso"]); // oldest first
  assert.equal(c.first, "09:00 revisar portal"); // the reminder is earlier than the meeting
  assert.equal(c.label, "mañana");
  const text = closingText(c);
  assert.match(text, /Hoy has terminado 1 tarea: subir el reel\./);
  assert.match(text, /Queda para mañana: llamar al cliente, fotos del piso\./);
  assert.match(text, /hasta mañana\.$/);
});

test("WEB-63: on Friday it points to Monday; nothing done is said kindly", () => {
  assert.equal(nextWorkDay(at(2026, 10, 2, 13)).key, "2026-10-05");
  const c = workClosing({ now: at(2026, 10, 2, 13, 10), inbox: [{ id: "x", status: "TASK", text: "informe", at: iso(2026, 10, 1, 9) }], tomorrow: [{ time: "09:00", title: "Equipo" }] });
  assert.equal(c.label, "el lunes");
  assert.match(closingText(c), /Queda para el lunes: informe\./);
  assert.match(closingText(c), /Lo primero el lunes: 09:00 Equipo\./);
  assert.match(closingText(c), /no has tachado nada/);
});

test("WEB-63: «Ahora» asks to close the day first, then the rest", () => {
  const c = workClosing({ now: at(2026, 9, 30, 13, 5), inbox: [{ id: "c", status: "TASK", text: "x", at: iso(2026, 9, 20, 9) }] });
  const r = whatNow({ now: at(2026, 9, 30, 13, 5), mode: "AFTERNOON", tasks: [{ text: "x", at: iso(2026, 9, 20, 9) }], closing: c });
  assert.equal(r.main.t, "Cierra la jornada.");
  assert.match(r.main.why, /la tarea pendiente para mañana/);
  assert.equal(whatNow({ now: at(2026, 9, 30, 13, 5), mode: "AFTERNOON" }).main.t.includes("jornada"), false);
});

test("WEB-63: the phrases that close the day", () => {
  for (const q of ["cierra la jornada", "Cierre", "cierre del día", "fin de jornada", "he terminado de currar", "salgo del trabajo", "ya he acabado de trabajar"]) assert.ok(isClosingQuestion(q), q);
  for (const q of ["cierra la puerta", "he terminado el informe", "salgo a cenar"]) assert.equal(isClosingQuestion(q), false, q);
});

// ---------- Gemini failures told apart ----------
const reply = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json });
const okText = (text, finishReason = "STOP") => reply(200, { candidates: [{ content: { parts: [{ text }] }, finishReason }] });
const seq = (...rs) => { const calls = []; const f = async (url, init) => { calls.push(JSON.parse(init.body)); const r = rs.shift(); if (r instanceof Error) throw r; return r; }; f.calls = calls; return f; };
const noPause = async () => {};
const payload = { contents: [{ role: "user", parts: [{ text: "hola" }] }], generationConfig: { maxOutputTokens: 600 } };

test("WEB-63: a 503 or a network blip is retried once", async () => {
  const f = seq(reply(503, {}), okText("hola"));
  assert.equal((await askWithActions({ key: "k", model: "m", payload, confirmed: true }, f, noPause)).text, "hola");
  const g = seq(new TypeError("Failed to fetch"), okText("vale"));
  assert.equal((await askWithActions({ key: "k", model: "m", payload, confirmed: true }, g, noPause)).text, "vale");
  const h = seq(reply(503, {}), reply(503, {}));
  await assert.rejects(generate({ key: "k", model: "m", payload }, h, noPause), (e) => e.code === "busy" && e.status === 503);
  const n = seq(new TypeError("x"), new TypeError("x"));
  await assert.rejects(generate({ key: "k", model: "m", payload }, n, noPause), (e) => e.code === "network");
});

test("WEB-63: an empty reply cut by MAX_TOKENS is retried with more room", async () => {
  const f = seq(reply(200, { candidates: [{ content: { parts: [] }, finishReason: "MAX_TOKENS" }] }), okText("mañana tienes dos cosas"));
  const r = await askWithActions({ key: "k", model: "m", payload, confirmed: true }, f, noPause);
  assert.equal(r.text, "mañana tienes dos cosas");
  assert.equal(f.calls[1].generationConfig.maxOutputTokens, 2400);
});

test("WEB-69: a JSON answer cut by MAX_TOKENS is retried with more room", async () => {
  const jsonPayload = { contents: [{ role: "user", parts: [{ text: "x" }] }], generationConfig: { maxOutputTokens: 800, responseMimeType: "application/json" } };
  const f = seq(reply(200, { candidates: [{ content: { parts: [{ text: '[{"nombre":"Fies' }] }, finishReason: "MAX_TOKENS" }] }), okText('[{"nombre":"Fiestas"}]'));
  const r = await askWithActions({ key: "k", model: "m", payload: jsonPayload, confirmed: true }, f, noPause);
  assert.equal(r.text, '[{"nombre":"Fiestas"}]');
  assert.equal(f.calls[1].generationConfig.maxOutputTokens, 3200);
});

test("WEB-63: bad key, bad request, retired model and filters are told apart", async () => {
  await assert.rejects(generate({ key: "k", model: "m", payload }, seq(reply(400, { error: { message: "API key not valid. Please pass a valid API key." } })), noPause), (e) => e.code === "key");
  await assert.rejects(generate({ key: "k", model: "m", payload }, seq(reply(400, { error: { message: "Invalid JSON payload" } })), noPause), (e) => e.code === "bad" && /Invalid JSON/.test(e.message));
  await assert.rejects(generate({ key: "k", model: "m", payload }, seq(reply(404, {})), noPause), (e) => e.code === "model");
  await assert.rejects(askWithActions({ key: "k", model: "m", payload, confirmed: true }, seq(reply(200, { candidates: [{ finishReason: "SAFETY" }] })), noPause), (e) => e.code === "blocked");
  await assert.rejects(askWithActions({ key: "k", model: "m", payload, confirmed: true }, seq(reply(200, { promptFeedback: { blockReason: "OTHER" } })), noPause), (e) => e.code === "blocked");
  assert.match(aiErrorText({ code: "busy", status: 503 }), /saturado.*503/);
  assert.match(aiErrorText({ code: "network" }), /conexión/);
  assert.match(aiErrorText(new Error("algo raro")), /algo raro/);
  assert.doesNotMatch(aiErrorText({ code: "empty", reason: null }), /\(null\)/);
});
