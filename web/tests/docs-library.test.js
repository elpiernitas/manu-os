import test from "node:test";
import assert from "node:assert/strict";
import { daysLeft, expiringSoon, leftText, buildDocPayload, parseDocReply, isDocQuestion, findDocs, answerDoc } from "../core/docs.js";
import { kindFromUrl, newItem, setStatus, ideasPayload, parseIdeas, isLibraryQuestion, answerLibrary } from "../core/library.js";

const now = new Date(2026, 9, 3, 12);
const docs = [
  { id: "d1", title: "Seguro del coche", kind: "seguro", company: "Aseguradora Demo", cents: 32050, period: "anual", expires: "2026-10-20", autoRenew: true, phone: "900000000" },
  { id: "d2", title: "Contrato de alquiler", kind: "contrato", expires: "2027-06-30" },
  { id: "d3", title: "Garantía portátil", kind: "garantia", expires: "2026-09-30" },
  { id: "d4", title: "Seguro de hogar", kind: "seguro", company: "Otra" },
];

test("WEB-84: expiry", () => {
  assert.equal(daysLeft(docs[0], now), 17);
  assert.equal(daysLeft(docs[3], now), null);
  assert.deepEqual(expiringSoon(docs, now).map((x) => [x.doc.id, x.left]), [["d3", -3], ["d1", 17]]);
  assert.equal(leftText(0), "vence hoy");
  assert.equal(leftText(1), "vence mañana");
  assert.equal(leftText(-3), "venció hace 3 días");
});

test("WEB-84: Gemini reads a photo or PDF; secrets are dropped", () => {
  const p = buildDocPayload({ base64: "AAA", mime: "application/pdf" }, now);
  assert.equal(p.contents[0].parts[1].inlineData.mimeType, "application/pdf");
  assert.equal(p.generationConfig.responseMimeType, "application/json");
  assert.throws(() => buildDocPayload({ base64: "x", mime: "text/html" }, now));
  const d = parseDocReply("```json\n" + JSON.stringify({ titulo: "Seguro del coche", tipo: "Seguro", entidad: "Demo", importe: "320,50", periodicidad: "anual", vence: "2027-03-12", renovacion_automatica: true, referencia: "ES12 3456 7890 1234 5678 9012", telefono: "900 000 000", resumen: "Todo riesgo con franquicia." }) + "\n```");
  assert.deepEqual(d, { title: "Seguro del coche", kind: "seguro", company: "Demo", expires: "2027-03-12", cents: 32050, period: "anual", autoRenew: true, phone: "900 000 000", summary: "Todo riesgo con franquicia." });
  assert.equal(parseDocReply("no"), null);
  assert.equal(parseDocReply(JSON.stringify({ titulo: "x", vence: "pronto" })).expires, undefined);
});

test("WEB-84: «¿cuándo vence el seguro del coche?» answered on the device", () => {
  assert.ok(isDocQuestion("¿cuándo vence el seguro del coche?"));
  assert.ok(isDocQuestion("cuánto pago de seguro de hogar?"));
  assert.ok(!isDocQuestion("apunta comprar pan"));
  assert.equal(findDocs(docs, "cuándo vence el seguro del coche")[0].id, "d1");
  assert.equal(answerDoc("¿cuándo vence el seguro del coche?", docs, now), "Seguro del coche (Aseguradora Demo), vence el 20 de octubre de 2026 (dentro de 17 días), se renueva sola, 320,50 € anual.");
  assert.match(answerDoc("teléfono del seguro del coche", docs, now), /teléfono 900000000/);
  assert.match(answerDoc("¿qué vence pronto?", docs, now), /Lo próximo que vence: Garantía portátil \(venció hace 3 días\); Seguro del coche/);
  assert.match(answerDoc("x", [], now), /Aún no tienes documentos/);
  assert.match(answerDoc("seguros", docs, now), /Seguro del coche.*Seguro de hogar \(Otra\), no tengo apuntado/); // a tie: both
});

test("WEB-85: library items", () => {
  assert.equal(kindFromUrl("https://youtu.be/abc"), "video");
  assert.equal(kindFromUrl("https://open.spotify.com/episode/1"), "podcast");
  assert.equal(kindFromUrl("https://blog.example.com/post"), "articulo");
  assert.equal(kindFromUrl(""), "libro");
  const b = newItem({ id: "l1", title: "  El hombre en busca de sentido ", author: "Viktor Frankl", notes: "Sentido incluso en el sufrimiento." }, now);
  assert.equal(b.title, "El hombre en busca de sentido");
  assert.equal(b.kind, "libro");
  assert.equal(b.status, "quiero");
  assert.throws(() => newItem({ id: "x", title: " " }, now), /título/);
  const done = setStatus(b, "hecho", now);
  assert.ok(done.doneAt);
  assert.equal(setStatus(done, "en curso", now).doneAt, undefined);
  assert.match(ideasPayload(b).contents[0].parts[0].text, /Sentido incluso en el sufrimiento/);
  assert.deepEqual(parseIdeas('["Uno", {"idea":"Dos"}, ""]'), ["Uno", "Dos"]);
  assert.deepEqual(parseIdeas("no"), []);
});

test("WEB-85: «¿qué aprendí de …?»", () => {
  const lib = [
    { id: "a", kind: "libro", title: "Hábitos atómicos", author: "James Clear", status: "hecho", ideas: ["Mejora un 1 % cada día.", "Diseña el entorno."] },
    { id: "b", kind: "podcast", title: "Episodio de finanzas", status: "en curso", notes: "Fondos indexados y gastos bajos." },
    { id: "c", kind: "libro", title: "Meditaciones", status: "quiero" },
  ];
  assert.ok(isLibraryQuestion("¿qué aprendí de hábitos atómicos?"));
  assert.ok(isLibraryQuestion("qué estoy leyendo"));
  assert.ok(!isLibraryQuestion("gasté 5 en café"));
  assert.equal(answerLibrary("¿qué aprendí de hábitos atómicos?", lib), "📚 Libro «Hábitos atómicos» (James Clear):\n• Mejora un 1 % cada día.\n• Diseña el entorno.");
  assert.match(answerLibrary("resumen de finanzas", lib), /Tus notas: Fondos indexados/);
  assert.equal(answerLibrary("qué estoy leyendo", lib), "Ahora mismo: 🎧 Podcast Episodio de finanzas.");
  assert.equal(answerLibrary("libros pendientes", lib), "Pendientes: Meditaciones.");
  assert.match(answerLibrary("qué aprendí de cocina", lib), /No encuentro/);
});
