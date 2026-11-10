// HORIZONTE (prototipo web/vivo): adaptadores del vault real y acciones. Solo datos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import { vaultDemo, ES_DEMO, ORIGEN } from "../vivo/src/demo.js";
import * as A from "../vivo/src/adaptadores.js";
import * as X from "../vivo/src/acciones.js";
import { CATEGORIES } from "../core/money.js";
import { FRESH_DAYS } from "../core/brain.js";

const AHORA = new Date(2026, 10, 9, 13, 0);
const v = () => vaultDemo(AHORA);

test("la demo está marcada como demo y es estable", () => {
  assert.equal(ES_DEMO, true);
  assert.ok(v().spending.every((s) => s.source === ORIGEN && /\(DEMO\)/.test(s.merchant)));
  assert.deepEqual(v().spending.slice(0, 5), v().spending.slice(0, 5));
});

test("los adaptadores hablan el mismo idioma que la app real", () => {
  for (const s of v().spending) assert.ok(CATEGORIES[s.category], `categoría real: ${s.category}`);
  for (const id of Object.keys(CATEGORIES)) assert.equal(A.CATEGORIAS[id], CATEGORIES[id]);
  // La caducidad de la constelación es la misma que FRESH_DAYS de brain.js.
  const viejo = { id: "x", text: "t", kind: "DECISION", status: "ACTIVE", validFrom: new Date(AHORA.getTime() - (FRESH_DAYS.DECISION + 1) * 864e5).toISOString() };
  assert.equal(A.nivelDe(viejo, AHORA), "confirmar");
  assert.equal(A.nivelDe({ ...viejo, validFrom: AHORA.toISOString() }, AHORA), "sabe");
  assert.equal(A.nivelDe({ ...viejo, kind: "HYPOTHESIS", status: "PROPOSED", validFrom: AHORA.toISOString() }, AHORA), "sospecha");
});

test("dinero: la marea cuadra con los movimientos y los hallazgos separan hecho de hipótesis", () => {
  const d = A.dinero(v(), { ahora: AHORA });
  assert.equal(d.marea.length, 90);
  assert.equal(d.categorias.reduce((n, c) => n + c.cents, 0), d.total);
  assert.equal(d.momentos.flat().reduce((n, c) => n + c, 0), d.total);
  assert.ok(d.noches.length >= 1 && d.noches.every((n) => n.paradas.length >= 3));
  assert.ok(d.hallazgos.every((h) => (h.tipo === "HECHO" || h.tipo === "HIPOTESIS") && h.base));
  assert.ok(d.hallazgos.some((h) => h.tipo === "HIPOTESIS" && /fiesta/.test(h.texto)), "la fiesta es una hipótesis, nunca un hecho");
  assert.equal(A.dinero({}, { ahora: AHORA }).vacio, true);
  assert.deepEqual(A.noches([{ at: AHORA.toISOString(), cents: 100, merchant: "X" }], { ahora: AHORA }), [], "un pago de día no es una noche");
});

test("memoria: confirmar, corregir, dudar y olvidar (con lápida sin texto)", () => {
  let x = v();
  assert.equal(A.constelacion(x.brain, { ahora: AHORA }).estrellas.find((e) => e.id === "m5").nivel, "sospecha");
  x = X.confirmar(x, "m5", AHORA);
  assert.equal(A.constelacion(x.brain, { ahora: AHORA }).estrellas.find((e) => e.id === "m5").nivel, "sabe");
  x = X.corregir(x, "m1", "  Trabajo en   publicidad ", AHORA);
  assert.equal(x.brain.claims.find((c) => c.id === "m1").text, "Trabajo en publicidad");
  assert.equal(X.corregir(x, "m1", "   ", AHORA), x, "una corrección vacía no cambia nada");
  x = X.dudar(x, "m2");
  assert.equal(A.nivelDe(x.brain.claims.find((c) => c.id === "m2"), AHORA), "confirmar");
  x = X.olvidar(x, "m2", AHORA);
  assert.ok(!x.brain.claims.some((c) => c.id === "m2"));
  assert.deepEqual(Object.keys(x.brain.forgotten[0]).sort(), ["at", "id"], "la lápida no guarda el texto");
  const { hilos, estrellas } = A.constelacion(x.brain, { ahora: AHORA });
  assert.ok(hilos.every((h) => h.comun.length > 0), "no hay hilos inventados");
  assert.ok(estrellas.every((e) => e.x > 0 && e.x < 1 && e.y > 0 && e.y < 1));
  // Regresión: dos estrellas no pueden caer una sobre otra (no se podrían tocar).
  const todas = A.constelacion(v().brain, { ahora: AHORA }).estrellas;
  for (let i = 0; i < todas.length; i++) for (let j = i + 1; j < todas.length; j++) assert.ok(Math.hypot(todas[i].x - todas[j].x, todas[i].y - todas[j].y) >= A.HUECO * 0.9, `${todas[i].id} y ${todas[j].id} se pisan`);
});

test("astillero: los muelles no se mezclan y solo se bota lo terminado", () => {
  let x = v();
  const a = A.astillero(x.projects);
  assert.ok(a.muelles.every((m) => m.barcos.every((b) => b.area === m.id)));
  assert.equal(X.botar(x, "p1", AHORA).projects.find((p) => p.id === "p1").botado, undefined, "faltan piezas: no se bota");
  x = X.marcarTarea(x, "p1", "t4");
  x = X.botar(x, "p1", AHORA);
  assert.ok(x.projects.find((p) => p.id === "p1").botado);
  assert.equal(X.botar(x, "p5", AHORA).projects.find((p) => p.id === "p5").botado, undefined, "un plano sin tareas no se bota");
  assert.equal(A.astillero([{ id: "r", name: "Real", emoji: "📁", sources: [], chat: [] }]).barcos[0].avance, null, "un proyecto real de hoy (sin tareas) no se rompe");
});

test("bahía: solo suma; descansar no resta", () => {
  const antes = A.bahia(v());
  const descanso = A.bahia({ ...v(), inbox: v().inbox });
  assert.equal(descanso.puntos, antes.puntos);
  let x = X.marcarTarea(v(), "p1", "t4"); x = X.botar(x, "p1", AHORA);
  assert.ok(A.bahia(x).puntos > antes.puntos && A.bahia(x).faro);
});

test("importar (demo): pide lo mismo dos veces y no duplica", () => {
  const uno = X.importarDemo(v(), AHORA);
  assert.equal(uno.nuevos, 3); assert.equal(uno.duplicados, 14);
  const dos = X.importarDemo(uno.vault, AHORA);
  assert.equal(dos.nuevos, 0); assert.equal(dos.vault.spending.length, uno.vault.spending.length);
});

test("portada, agenda y sonda", () => {
  const p = A.portada(v(), { ahora: new Date(2026, 10, 9, 10, 30), tiempo: "lluvia", real: AHORA });
  assert.match(p.titular, /^12:00: presentar rutas de logo\. Y llueve, claro\.$/);
  assert.match(A.portada({}, { ahora: AHORA, real: AHORA }).titular, /Día en blanco/);
  assert.equal(A.semana(v().eventos, v().reminders, { ahora: AHORA }).length, 7);
  const x = X.citar(v(), { title: "Probar", at: new Date(2026, 10, 10, 18) });
  assert.equal(x.eventos.length, v().eventos.length + 1);
  assert.equal(X.citar(v(), { title: " ", at: AHORA }).eventos.length, v().eventos.length);
  assert.deepEqual(A.sonda("l", v()), []);
  assert.ok(A.sonda("logo", v()).length >= 2, "busca en agenda y proyectos a la vez");
  assert.deepEqual(A.sonda("zzzz", v()), []);
});

test("el guion de MANU: sabe, sospecha, duda y admite no saber", () => {
  const x = v();
  const vm = { euros: A.euros, dinero: A.dinero(x, { ahora: AHORA }), memoria: A.constelacion(x.brain, { ahora: AHORA }) };
  assert.equal(X.responder("¿estoy ahorrando?", vm).cara, "zasca");
  assert.ok(X.responder("¿estoy ahorrando?", vm).pruebas.length >= 2, "un zasca sin pruebas no es un zasca");
  assert.equal(X.responder("¿madrugo?", vm).nivel, "confirmar");
  assert.equal(X.responder("los domingos", vm).nivel, "sospecha");
  const nose = X.responder("¿qué me regalo por Reyes?", vm);
  assert.equal(nose.nose, true); assert.match(nose.texto, /no lo sé/i);
});
