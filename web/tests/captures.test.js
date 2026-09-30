import test from "node:test";
import assert from "node:assert/strict";
import { newCapture, buildCapturesPayload, parseCapturesReply, applyReading, groupCaptures, keepCapture, dropCapture, trimCaptures, toReview, pendingCaptures, LIMIT } from "../core/captures.js";

const cap = (id, at, extra = {}) => ({ ...newCapture({ id, imageId: `img-${id}`, at }), ...extra });

test("WEB-59: one request carries up to 6 captures, each tagged with its id, asking for JSON", () => {
  const p = buildCapturesPayload([{ id: "k1", base64: "AAA", at: "2026-09-30T10:00:00Z" }, { id: "k2", base64: "BBB", at: "2026-09-30T10:01:00Z" }], new Date(2026, 8, 30));
  const parts = p.contents[0].parts;
  assert.match(parts[0].text, /^\[k1\]/);
  assert.equal(parts[1].inlineData.data, "AAA");
  assert.match(parts[2].text, /^\[k2\]/);
  assert.equal(p.generationConfig.responseMimeType, "application/json");
  assert.match(p.systemInstruction.parts[0].text, /SOLO con un array JSON/);
  assert.throws(() => buildCapturesPayload([]));
  assert.throws(() => buildCapturesPayload(Array.from({ length: 7 }, (_, i) => ({ id: `x${i}`, base64: "A", at: "2026-09-30T10:00:00Z" }))));
});

test("WEB-59: the reply is validated — unknown ids, bad actions and junk are dropped", () => {
  const reply = "```json\n" + JSON.stringify([
    { id: "k1", tema: "Viaje Oporto", texto: "Airbnb en Ribeira, 3 noches, 240 €", tipo: "plan", accion: { nombre: "crear_recordatorio", texto: "Pagar el Airbnb", cuando: "2026-10-02 18:00" } },
    { id: "k2", tema: "viaje oporto", texto: "Horario del tren", tipo: "INFO", accion: { nombre: "correo_papelera", remitente: "x" } },
    { id: "k3", tema: "Receta", texto: "Pasta", tipo: "raro", accion: { nombre: "apuntar_gasto", importe_euros: -5 } },
    { id: "intruso", tema: "x", texto: "y" },
  ]) + "\n```";
  const r = parseCapturesReply(reply, ["k1", "k2", "k3"]);
  assert.deepEqual(Object.keys(r), ["k1", "k2", "k3"]);
  assert.equal(r.k1.call.name, "crear_recordatorio");
  assert.equal(r.k1.call.texto, "Pagar el Airbnb");
  assert.equal(r.k2.call, null); // only the four capture actions are allowed
  assert.equal(r.k2.kind, "info");
  assert.equal(r.k3.kind, "info");  // unknown type → info
  assert.equal(r.k3.call, null);    // negative amount rejected
  assert.deepEqual(parseCapturesReply("no es json", ["k1"]), {});
  assert.deepEqual(Object.keys(parseCapturesReply(JSON.stringify({ capturas: [{ id: "k1", tema: "a", texto: "b" }] }), ["k1"])), ["k1"]);
});

test("WEB-59: groups by topic (accents and case ignored), unread apart and last; keep drops the image", () => {
  let list = [cap("a", "2026-09-30T10:00:00Z"), cap("b", "2026-09-30T09:00:00Z"), cap("c", "2026-09-29T20:00:00Z"), cap("d", "2026-09-30T11:00:00Z")];
  list = applyReading(list, { a: { topic: "Viaje Oporto", text: "t", kind: "plan", call: null }, b: { topic: "viaje oporto", text: "t", kind: "info", call: null }, c: { topic: "Recetas", text: "t", kind: "info", call: null } });
  const g = groupCaptures(list);
  assert.deepEqual(g.map((x) => x.topic), ["Recetas", "viaje oporto", "Sin leer"]);
  assert.deepEqual(g[1].items.map((x) => x.id), ["b", "a"]); // chronological
  assert.equal(pendingCaptures(list).length, 1);
  list = keepCapture(list, "a");
  assert.equal(list.find((x) => x.id === "a").imageId, null);
  assert.equal(list.find((x) => x.id === "a").status, "kept");
  assert.equal(toReview(list).length, 3);
  list = dropCapture(list, "b");
  assert.equal(list.length, 3);
});

test("WEB-59: over the limit the oldest kept texts go, never pending ones", () => {
  const list = [...Array.from({ length: LIMIT }, (_, i) => cap(`k${i}`, `2026-01-01T00:00:${String(i % 60).padStart(2, "0")}Z`, { status: "kept", reviewedAt: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString() })), cap("p1", "2026-09-30T10:00:00Z"), cap("p2", "2026-09-30T10:00:00Z")];
  const t = trimCaptures(list);
  assert.equal(t.length, LIMIT);
  assert.ok(t.some((c) => c.id === "p1") && t.some((c) => c.id === "p2"));
  assert.ok(!t.some((c) => c.id === "k0") && !t.some((c) => c.id === "k1"));
});
