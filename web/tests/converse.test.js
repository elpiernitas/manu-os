import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedToSend, buildContext, buildConversationPayload, BASIC_CONTEXT, FULL_CONTEXT, AUTO_SAFE } from "../core/converse.js";
import { sensitiveKinds, isSensitive, parseCalls } from "../core/ai.js";

test("sensitive categories; secrets can never be allowed", () => {
  assert.deepEqual([...sensitiveKinds("cuánto gasté este mes en el banco")].sort(), ["money"]);
  assert.deepEqual([...sensitiveKinds("mi IBAN ES91 2100 0418 4502")], ["money", "secret"].filter((k) => sensitiveKinds("mi IBAN ES91 2100 0418 4502").has(k)));
  assert.equal(isSensitive("dolor de cabeza"), true);
  assert.equal(allowedToSend("¿cuánto gasté este mes?", BASIC_CONTEXT).ok, false);
  assert.equal(allowedToSend("¿cuánto gasté este mes?", FULL_CONTEXT).ok, true);
  assert.deepEqual(allowedToSend("mi contraseña es hola123", FULL_CONTEXT).blocked, ["secret"]);
  assert.equal(allowedToSend("llámame al 612 345 678", FULL_CONTEXT).ok, false);
  assert.equal(allowedToSend("¿qué tengo mañana?", BASIC_CONTEXT).ok, true);
});

const data = {
  events: { "2026-09-29": [{ time: "18:00", title: "Pádel" }], "2026-09-30": [{ time: null, title: "Vacaciones" }] },
  reminders: [{ text: "Pagar seguro", at: "2026-10-02T08:00:00.000Z", done: false }],
  tasks: [{ text: "Llamar al taller" }], ideas: [{ text: "Viaje a Lisboa" }],
  weather: { city: "Gijón", text: "Nublado", temp: 21, min: 18, max: 27, rain: 30 },
  habits: [{ name: "Caminar", doneToday: true }],
  money: { spent: 190507, earned: 150000, payroll: 150000, balance: 215480, byCategory: [["TRANSFERS", 77860], ["SHOPPING", 25532]] },
  health: { sleep: 7.2, steps: 8000 }, mood: "Bien", birthdays: [{ name: "Persona Ejemplo", days: 3 }],
};
const now = new Date(2026, 8, 29, 10);

test("context includes only the categories Manu chose", () => {
  const basic = buildContext(data, BASIC_CONTEXT, now);
  assert.ok(basic.includes("AGENDA hoy: 18:00 Pádel") && basic.includes("Mañana: todo el día Vacaciones"));
  assert.ok(basic.includes("TAREAS pendientes: Llamar al taller") && basic.includes("TIEMPO en Gijón") && basic.includes("Caminar (hecho hoy)"));
  assert.ok(!basic.includes("DINERO") && !basic.includes("SALUD") && !basic.includes("ÁNIMO") && !basic.includes("Persona Ejemplo"));
  const full = buildContext(data, FULL_CONTEXT, now);
  assert.ok(full.includes("gastado 1.905,07 €") && full.includes("nómina 1.500,00 €") && full.includes("SALUD") && full.includes("Persona Ejemplo"));
  assert.equal(buildContext(data, {}, now), "");
});

test("conversation payload: context in the instruction, history filtered, tools included", () => {
  const history = [{ from: "me", text: "hola" }, { from: "manu", text: "¡Hola!" }, { from: "me", text: "gasté 20 en cena" }, { from: "manu", text: "Pensando…" }];
  const p = buildConversationPayload({ message: "¿qué tengo hoy?", history, contextText: buildContext(data, BASIC_CONTEXT, now), context: BASIC_CONTEXT, now });
  assert.ok(p.systemInstruction.parts[0].text.includes("AGENDA hoy"));
  assert.deepEqual(p.contents.map((c) => c.parts[0].text), ["hola", "¡Hola!", "¿qué tengo hoy?"]);
  assert.ok(p.tools[0].functionDeclarations.some((f) => f.name === "completar_tarea"));
});

test("new tool completar_tarea is parsed; auto actions exclude money and app changes", () => {
  const calls = parseCalls({ candidates: [{ content: { parts: [{ functionCall: { name: "completar_tarea", args: { texto: "taller" } } }] } }] });
  assert.deepEqual(calls, [{ name: "completar_tarea", texto: "taller" }]);
  assert.ok(AUTO_SAFE.has("anadir_tarea") && !AUTO_SAFE.has("apuntar_gasto") && !AUTO_SAFE.has("sugerir_mejora") && !AUTO_SAFE.has("importar_extracto"));
});

test("WEB-28: Manu's switch lets sensitive categories go, never secrets or crisis", async () => {
  const { mayGo, setSensitiveOk, askWithActions, buildActionPayload } = await import("../core/ai.js");
  const { buildProjectPayload } = await import("../core/projects.js");
  assert.equal(mayGo("cuánto gasté en el banco"), false);
  setSensitiveOk(true);
  try {
    for (const t of ["cuánto gasté en el banco", "me duele la cabeza, tomo ibuprofeno", "estoy triste"]) assert.equal(mayGo(t), true, t);
    for (const t of ["mi contraseña es hola123", "llámame al 612 345 678", "quiero morir", "abre el refugio"]) assert.equal(mayGo(t), false, t);
    const project = { name: "P", sources: [{ kind: "text", title: "Nómina", text: "sueldo de septiembre" }, { kind: "text", title: "Clave", text: "contraseña: x" }] };
    assert.deepEqual(buildProjectPayload({ project, question: "¿cuánto cobro?" }).excluded, [2]);
    const r = await askWithActions({ key: "k", model: "m", payload: buildActionPayload("gasté 30 € en la farmacia"), confirmed: true }, async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }) }));
    assert.equal(r.text, "ok");
    assert.equal(allowedToSend("quiero morir", FULL_CONTEXT).ok, false);
  } finally { setSensitiveOk(false); }
  assert.equal(mayGo("estoy triste"), false);
});
