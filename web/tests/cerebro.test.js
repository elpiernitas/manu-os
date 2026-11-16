// El cerebro compartido: ramas, validación, limpieza de secretos, árbol y búsqueda. Datos ficticios.
import test from "node:test";
import assert from "node:assert/strict";
import { validarEntrada, arbol, deProyecto, buscar, slug, RAMAS, cerebroRequest } from "../core/cerebro.js";
import * as server from "../../supabase/functions/manu-cerebro/cerebro-core.js";

const e = (x = {}) => ({ rama: "manu-os", subrama: "salud", titulo: "Rutina de sueño", resumen: "Acostarse antes de las 0:00 entre semana.", etiquetas: ["Sueño", "rutina", "sueño"], ...x });

test("valida ramas y subramas; las IAs no inventan ramas", () => {
  const v = validarEntrada(e(), { origen: "chatgpt" });
  assert.equal(v.rama, "manu-os"); assert.equal(v.subrama, "salud"); assert.equal(v.origen, "chatgpt");
  assert.deepEqual(v.etiquetas, ["sueno", "rutina"], "etiquetas limpias y sin repetir");
  assert.throws(() => validarEntrada(e({ rama: "deportes" }), { origen: "claude" }), /Rama no válida/);
  assert.throws(() => validarEntrada(e({ subrama: "coches" }), { origen: "claude" }), /Subrama no válida/);
  assert.throws(() => validarEntrada(e({ rama: "proyectos", subrama: null }), { origen: "claude" }), /nombre del proyecto/);
  const p = validarEntrada(e({ rama: "proyectos", subrama: "Reforma Baño" }), { origen: "codex" });
  assert.equal(p.subrama, "reforma-bano"); assert.equal(p.proyecto, "reforma-bano");
  assert.equal(validarEntrada(e({ rama: "trabajo", subrama: "marketing" }), { origen: "claude-code" }).subrama, "marketing");
  assert.throws(() => validarEntrada(e(), { origen: "gemini" }), /Origen/);
  assert.throws(() => validarEntrada(e({ titulo: " " }), { origen: "claude" }), /título/);
});

test("nunca guarda claves, tokens ni IBAN aunque una IA los copie", () => {
  for (const s of ["sbp_0123456789abcdef0123456789", "sk-proj-abcdefghijklmnopqrstuvwxyz", "ghp_abcdefghijklmnopqrstuvwxyz12", "ES91 2100 0418 4502 0005 1332", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcd"]) {
    assert.throws(() => validarEntrada(e({ resumen: `Aquí va ${s}` }), { origen: "chatgpt" }), /clave|token|IBAN/, s);
  }
  assert.equal(validarEntrada(e({ resumen: "texto‮con\u0000control" }), { origen: "claude" }).resumen, "texto con control");
});

test("servidor y navegador validan igual", () => {
  for (const x of [e(), e({ rama: "proyectos", subrama: "Web personal" }), e({ etiquetas: ["A", "a", "b"] })]) assert.deepEqual(server.validarEntrada(x, { origen: "claude" }), validarEntrada(x, { origen: "claude" }));
  assert.deepEqual(server.RAMAS, RAMAS);
});

test("árbol, proyecto y búsqueda para MANU", () => {
  const all = [
    { id: "1", rama: "manu-os", subrama: "salud", titulo: "Rutina de sueño", resumen: "Antes de las 0:00", estado: "sin_revisar", etiquetas: ["sueno"] },
    { id: "2", rama: "proyectos", subrama: "reforma-bano", titulo: "Presupuesto fontanero", resumen: "Cobra por horas", estado: "revisado", proyecto: "reforma-bano" },
    { id: "3", rama: "trabajo", subrama: "marketing", titulo: "Reels de los viernes", resumen: "Funcionan mejor con precio", estado: "archivado" },
  ];
  const t = arbol(all);
  assert.equal(t["manu-os"].total, 1); assert.equal(t["manu-os"].sinRevisar, 1); assert.equal(t["manu-os"].subramas.salud.label, "Salud");
  assert.equal(t.trabajo.total, 0, "lo archivado no cuenta");
  assert.deepEqual(deProyecto(all, "Reforma baño").map((x) => x.id), ["2"]);
  assert.deepEqual(buscar(all, "sueño").map((x) => x.id), ["1"]);
  assert.deepEqual(buscar(all, "fontanero horas").map((x) => x.id), ["2"]);
  assert.equal(slug("Vida y Casa"), "vida-y-casa");
});

test("cliente de MANU: solo su función y mensajes de pendiente", async () => {
  const cfg = { url: "https://propio.supabase.co", key: "anon" }, s = { access: "jwt" };
  let u = null; const ok = async (url) => { u = url; return { ok: true, status: 200, json: async () => ({ entradas: [] }) }; };
  await cerebroRequest(cfg, s, "leer", {}, ok);
  assert.equal(u, "https://propio.supabase.co/functions/v1/manu-cerebro");
  await assert.rejects(cerebroRequest(cfg, s, "borrar-todo", {}, ok), /no permitida/);
  await assert.rejects(cerebroRequest(cfg, s, "leer", {}, async () => ({ ok: false, status: 404, json: async () => ({}) })), (x) => x.code === "pending");
  await assert.rejects(cerebroRequest(cfg, null, "leer", {}, ok), (x) => x.code === "setup");
});
