import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCalls, buildActionPayload, askWithActions, issueUrl, TOOLS } from "../core/ai.js";

const reply = (parts) => ({ candidates: [{ content: { parts } }] });

test("proposed actions are validated; malformed or unknown ones are dropped", () => {
  const calls = parseCalls(reply([
    { text: "Te lo preparo." },
    { functionCall: { name: "anadir_tarea", args: { texto: "Llamar al taller" } } },
    { functionCall: { name: "apuntar_gasto", args: { importe_euros: 20.5, concepto: "Gasolina" } } },
    { functionCall: { name: "apuntar_gasto", args: { importe_euros: -3 } } },
    { functionCall: { name: "crear_recordatorio", args: { texto: "Médico", cuando: "2026-09-30 09:15" } } },
    { functionCall: { name: "crear_recordatorio", args: { texto: "x", cuando: "mañana" } } },
    { functionCall: { name: "ir_a", args: { pantalla: "dinero" } } },
    { functionCall: { name: "ir_a", args: { pantalla: "javascript:alert(1)" } } },
    { functionCall: { name: "borrar_todo", args: {} } },
    { functionCall: { name: "sugerir_mejora", args: { titulo: "Calendario semanal", descripcion: "Añadir vista de semana" } } },
  ]));
  assert.deepEqual(calls.map((c) => c.name), ["anadir_tarea", "apuntar_gasto", "crear_recordatorio", "ir_a", "sugerir_mejora"]);
  assert.equal(calls[1].cents, 2050);
  assert.equal(new Date(calls[2].at).getHours(), 9);
  assert.equal(calls[4].sensitive, false);
  assert.equal(parseCalls(reply([{ functionCall: { name: "sugerir_mejora", args: { titulo: "x", descripcion: "mi IBAN ES91 2100 0418" } } }]))[0].sensitive, true);
});

test("action payload: only the message, a fixed instruction with the date, and the fixed tool list", () => {
  const p = buildActionPayload("apúntame que mañana llame al taller", new Date(2026, 8, 29, 10));
  assert.equal(p.contents.length, 1);
  assert.ok(p.systemInstruction.parts[0].text.includes("29 de septiembre de 2026"));
  assert.deepEqual(p.tools, TOOLS);
});

test("same privacy gates: consent required and sensitive text never sent", async () => {
  let called = 0;
  const f = async () => { called++; return { ok: true, status: 200, json: async () => reply([{ text: "ok" }]) }; };
  await assert.rejects(askWithActions({ key: "k", model: "m", payload: buildActionPayload("hola") }, f), (e) => e.code === "unconfirmed");
  await assert.rejects(askWithActions({ key: "k", model: "m", payload: buildActionPayload("tengo VIH"), confirmed: true }, f), (e) => e.code === "sensitive");
  assert.equal(called, 0);
  const r = await askWithActions({ key: "k", model: "m", payload: buildActionPayload("hola"), confirmed: true }, async () => ({ ok: true, status: 200, json: async () => reply([{ text: "¡Hola!" }, { functionCall: { name: "ir_a", args: { pantalla: "hoy" } } }]) }));
  assert.equal(r.text, "¡Hola!");
  assert.equal(r.calls[0].pantalla, "hoy");
});

test("improvement suggestions become a prefilled GitHub issue", () => {
  const u = new URL(issueUrl({ titulo: "Vista semanal", descripcion: "Quiero ver la semana" }, "12"));
  assert.equal(u.origin + u.pathname, "https://github.com/elpiernitas/manu-os/issues/new");
  assert.equal(u.searchParams.get("title"), "[MANU] Vista semanal");
  assert.ok(u.searchParams.get("body").includes("versión 12"));
});
