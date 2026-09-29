import test from "node:test";
import assert from "node:assert/strict";
import { excerpts, findExcerpts, askPayload, profileDigest, profilePayload, memoryContext } from "../core/recall.js";
import { mayGo, setSensitiveOk } from "../core/ai.js";

const doc = (id, title, at, msgs) => ({ id, source: "chatgpt", title, at, messages: msgs.map(([role, text]) => ({ role, text })) });
const DOCS = [
  doc("a", "Viaje a Lisboa", Date.parse("2026-01-01"), [["me", "¿Qué ver en Lisboa?"], ["ai", "Alfama y Belém."], ["me", "Y para comer pastéis de nata"], ["ai", "La fábrica de Belém."]]),
  doc("b", "Mal día", Date.parse("2026-02-01"), [["me", "Hoy quiero morir"], ["ai", "Llama al 024."], ["me", "Gracias, lo de Lisboa me animó"]]),
  doc("c", "Claves", Date.parse("2026-03-01"), [["me", "mi contraseña del banco es hola123 y Lisboa"]]),
  doc("d", "Gimnasio", Date.parse("2026-04-01"), [["me", "rutina de gimnasio con ansiedad"], ["ai", "Empieza suave."]]),
];

test("excerpts: around the hit, numbered, bounded", () => {
  const ex = findExcerpts(DOCS, "pastéis de nata en Lisboa", { limit: 1 });
  assert.equal(ex.length, 1);
  assert.equal(ex[0].n, 1);
  assert.ok(ex[0].text.includes("Manu: Y para comer pastéis de nata"));
  const tiny = excerpts([{ doc: DOCS[0], query: "lisboa" }], { perDoc: 30 });
  assert.ok(tiny[0].text.length <= 30);
});

test("crisis and secrets never go, even with sensitive data allowed", () => {
  setSensitiveOk(true);
  try {
    const ex = findExcerpts(DOCS, "lisboa", { permit: mayGo });
    const all = ex.map((e) => e.text).join(" ");
    assert.ok(!all.includes("morir") && !all.includes("hola123"));
    assert.ok(!ex.some((e) => e.title === "Claves")); // a secret-looking title never travels with a fragment
    assert.ok(all.includes("Alfama"));
    const payloadText = JSON.stringify(askPayload("¿qué vi en Lisboa?", ex));
    assert.ok(payloadText.includes("[1]") && !payloadText.includes("hola123"));
    assert.ok(findExcerpts(DOCS, "gimnasio ansiedad", { permit: mayGo }).length === 1); // health allowed
  } finally { setSensitiveOk(false); }
  const off = findExcerpts(DOCS, "gimnasio ansiedad", { permit: mayGo }).map((e) => e.text).join(" ");
  assert.ok(!off.includes("ansiedad") && off.includes("Empieza suave")); // switch off: the health line stays on the phone
});

test("profile digest: titles in date order with Manu's first allowed line, bounded", () => {
  setSensitiveOk(true);
  try {
    const d = profileDigest(DOCS, { permit: mayGo });
    assert.equal(d.total, 4);
    assert.ok(d.text.indexOf("Viaje a Lisboa") < d.text.indexOf("Gimnasio"));
    assert.ok(!d.text.includes("morir") && !d.text.includes("hola123"));
    assert.ok(d.text.includes("«Gracias, lo de Lisboa me animó»")); // skips the crisis line, keeps the next
    assert.ok(profileDigest(DOCS, { maxChars: 60 }).used <= 1);
    assert.ok(JSON.stringify(profilePayload(d)).includes("Quién eres"));
  } finally { setSensitiveOk(false); }
});

test("memory context for the conversation is short and empty when nothing matches", () => {
  assert.ok(memoryContext(DOCS, "¿qué comí en Lisboa?").includes("Viaje a Lisboa"));
  assert.equal(memoryContext(DOCS, "astronomía"), "");
});
