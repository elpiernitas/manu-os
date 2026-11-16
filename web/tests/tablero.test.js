// Tablero de marketing, solo lectura. Datos ficticios.
import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeFeed, boardSummary, boardItems, tableroRequest, COLUMNS } from "../core/tablero.js";
import * as server from "../../supabase/functions/manu-tablero/tablero-core.js";
import { cloudPayload } from "../core/cloudprivacy.js";

const NOW = new Date(2026, 10, 16, 10, 0);
const feed = () => ({ version: 1, generatedAt: "2026-11-16T08:50:00Z", openUrl: "https://app.ejemplo.test/marketing/tablero", cards: [
  { id: "c1", title: "Reel piso centro", column: "HACIENDO", due: "2026-11-16", estimateMin: 60, updatedAt: "2026-11-16T08:00:00Z" },
  { id: "c2", title: "Historias de reseñas", column: "POR_HACER", due: "2026-11-14" },
  { id: "c3", title: "Fotos chalet: llamar a Ana 600 123 456 o ana@ejemplo.test", column: "POR_HACER", requestedBy: "comercial", estimateMin: 30 },
  { id: "c4", title: "Copy aprobado", column: "ESPERANDO_OK" },
  { id: "c5", title: "Datos del comercial", column: "ESPERANDO_COMERCIAL", due: "2026-11-10" },
  { id: "c6", title: "Vendidos del viernes", column: "HECHO", updatedAt: "2026-11-13T12:00:00Z" },
  { id: "c7", title: "Idea", column: "EN_MENTE" },
  { id: "bad", title: "Columna rara", column: "OTRA" },
  { id: "c1", title: "Duplicada", column: "HACIENDO" },
  { id: "", title: "Sin id", column: "HACIENDO" },
  { id: "x", title: "   ", column: "HACIENDO" },
  { id: "c8", title: "Con campos de más", column: "POR_HACER", description: "texto privado largo", comments: ["x"], client: { phone: "1" } },
] });

test("contrato: solo título, columna, fecha y poco más; sin teléfonos ni correos", () => {
  const f = sanitizeFeed(feed());
  assert.deepEqual(f.cards.map((c) => c.id), ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"], "fuera lo inválido y lo duplicado");
  const c3 = f.cards.find((c) => c.id === "c3");
  assert.equal(c3.title, "Fotos chalet: llamar a Ana [teléfono] o [correo]");
  assert.ok(!JSON.stringify(f).includes("texto privado") && !JSON.stringify(f).includes("comments"), "nada de descripciones ni comentarios");
  assert.equal(f.openUrl, "https://app.ejemplo.test/marketing/tablero");
  assert.equal(sanitizeFeed({ ...feed(), openUrl: "javascript:alert(1)" }).openUrl, null);
  assert.equal(sanitizeFeed({ ...feed(), openUrl: "http://inseguro.test" }).openUrl, null);
  assert.throws(() => sanitizeFeed({ version: 2, cards: [] }), /contrato v1/);
  assert.throws(() => sanitizeFeed(null));
  assert.equal(sanitizeFeed({ version: 1, cards: Array.from({ length: 500 }, (_, i) => ({ id: `k${i}`, title: "t", column: "POR_HACER" })) }).cards.length, 200, "con tope");
  assert.equal(sanitizeFeed({ version: 1, cards: [{ id: "z", title: "a‮b\u0000c", column: "HACIENDO" }] }).cards[0].title, "a b c", "sin caracteres de control");
});

test("el servidor limpia exactamente igual que el navegador", () => {
  assert.deepEqual(server.sanitizeFeed(feed()), sanitizeFeed(feed()));
  assert.deepEqual(server.COLUMNS, COLUMNS);
});

test("resumen para Hoy: vencido urgente, hoy y empezado importante, esperas como información", () => {
  const f = sanitizeFeed(feed());
  const s = boardSummary(f, NOW);
  assert.deepEqual(s.overdue.map((c) => c.id), ["c2"], "lo que espera a otros no cuenta como vencido tuyo");
  assert.deepEqual(s.dueToday.map((c) => c.id), ["c1"]);
  assert.equal(s.next.id, "c2");
  assert.deepEqual(s.waiting, { ok: 1, comercial: 1 });
  assert.equal(s.minutes, 90); assert.equal(s.doneWeek, 1); assert.equal(s.count, 6);
  const items = boardItems(f, NOW, { readAt: "a las 09:50" });
  assert.equal(items.find((x) => x.title === "Historias de reseñas").level, "URGENT");
  assert.equal(items.find((x) => x.title === "Reel piso centro").level, "IMPORTANT");
  assert.equal(items.filter((x) => x.title === "Reel piso centro").length, 1, "sin repetir lo que vence hoy y está empezado");
  assert.ok(items.some((x) => /Esperando: 1 el OK y 1 al comercial/.test(x.title)));
  assert.ok(items.some((x) => /Carga estimada: 1,5 h|Carga estimada: 1.5 h/.test(x.title)));
  assert.ok(items.every((x) => x.source === "Tablero RK · leído a las 09:50" && x.go.sub === "tablero"));
});

test("cliente: solo habla con la función propia de Manu y explica lo pendiente", async () => {
  const cfg = { url: "https://propio.supabase.co", key: "anon" }, session = { access: "jwt" };
  let called = null;
  const ok = async (url, opts) => { called = { url, opts }; return { ok: true, status: 200, json: async () => feed() }; };
  const f = await tableroRequest(cfg, session, ok);
  assert.equal(called.url, "https://propio.supabase.co/functions/v1/manu-tablero");
  assert.equal(called.opts.method, "POST"); assert.equal(called.opts.headers.authorization, "Bearer jwt");
  assert.ok(!JSON.stringify(f).includes("[correo]") || f.cards.some((c) => c.id === "c3"));
  const st = (status) => async () => ({ ok: false, status, json: async () => ({ error: "x" }) });
  await assert.rejects(tableroRequest(cfg, session, st(404)), (e) => e.code === "pending" && /todavía no está publicada/.test(e.message));
  await assert.rejects(tableroRequest(cfg, session, st(503)), (e) => e.code === "pending");
  await assert.rejects(tableroRequest(cfg, session, st(401)), (e) => e.code === "setup");
  await assert.rejects(tableroRequest(cfg, null, ok), (e) => e.code === "setup");
  await assert.rejects(tableroRequest({ url: "https://evil.example.com", key: "k" }, session, ok), (e) => e.code === "setup");
  await assert.rejects(tableroRequest(cfg, session, async () => { throw new Error("offline"); }), (e) => e.code === "network");
});

test("privacidad: el Tablero no está en el vault ni sube a Tu nube; el ajuste sí", () => {
  const v = { schema: 1, chat: [], settings: { tablero: { on: true } } };
  const up = cloudPayload(v);
  assert.deepEqual(up.settings.tablero, { on: true });
  assert.ok(!JSON.stringify(up).includes("cards"));
});
