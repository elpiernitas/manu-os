import { test } from "node:test";
import assert from "node:assert/strict";
import { newProject, addSource, buildProjectPayload, citations, PRESETS, PROJECT_LIMITS } from "../core/projects.js";

const base = () => {
  let p = newProject({ id: "p1", name: "Viaje a Lisboa", emoji: "✈️" });
  p = addSource(p, { id: "s1", kind: "note", text: "Vuelo el 12 de octubre a las 9:00.\nHotel en Alfama." });
  p = addSource(p, { id: "s2", kind: "link", title: "Vídeo de TikTok", url: "https://www.tiktok.com/@a/video/1", text: "Los 5 miradores imprescindibles de Lisboa" });
  p = addSource(p, { id: "s3", kind: "note", text: "Llamar al hotel al 612 345 678" });
  p = addSource(p, { id: "s4", kind: "image", imageId: "img1", title: "Captura del billete" });
  return p;
};

test("projects and sources are validated and titled", () => {
  const p = base();
  assert.equal(p.sources.length, 4);
  assert.equal(p.sources[0].title, "Vuelo el 12 de octubre a las 9:00.");
  assert.throws(() => newProject({ id: "x", name: "  " }));
  assert.throws(() => addSource(p, { id: "s", kind: "note", text: "" }));
  assert.throws(() => addSource(p, { id: "s", kind: "pdf", text: "x" }));
  let full = newProject({ id: "f", name: "Lleno" });
  for (let i = 0; i < PROJECT_LIMITS.sources; i++) full = addSource(full, { id: `n${i}`, kind: "note", text: "x" });
  assert.throws(() => addSource(full, { id: "extra", kind: "note", text: "x" }));
});

test("the payload carries numbered sources and images; sensitive sources stay on the phone", () => {
  const { payload, sent, excluded } = buildProjectPayload({ project: base(), question: "¿Qué día es el vuelo?", images: { img1: "data:image/jpeg;base64,AAAA" } });
  const parts = payload.contents[0].parts;
  const text = parts.at(-1).text;
  assert.ok(text.includes("[1] Vuelo el 12 de octubre") && text.includes("[2] Vídeo de TikTok (https://www.tiktok.com/@a/video/1)"));
  assert.ok(!text.includes("612 345 678"), "phone number never sent");
  assert.deepEqual(excluded, [3]);
  assert.deepEqual(sent, [1, 2, 4]);
  assert.deepEqual(parts[1], { inlineData: { mimeType: "image/jpeg", data: "AAAA" } });
  assert.ok(payload.systemInstruction.parts[0].text.includes("SOLO las fuentes"));
  assert.equal(payload.tools, undefined);
});

test("a sensitive question is never sent; presets exist; citations are parsed", () => {
  assert.throws(() => buildProjectPayload({ project: base(), question: "mi IBAN ES91 2100 0418 4502 0005 1332" }), (e) => e.code === "sensitive");
  assert.ok(PRESETS.resumen && PRESETS.claves && PRESETS.preguntas);
  assert.deepEqual(citations("El vuelo es el 12 [1]. Miradores [2, 1]. Nada [9].", 4), [1, 2]);
});
