// Capturar una vez y relacionar (WEB-120). Datos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import { similarity, findRepeat, addRepeat, timesSaved, whenIn, conexiones } from "../core/relate.js";

const now = new Date(2026, 10, 20, 10, 0); // viernes 20 nov 2026, 10:00

test("la misma idea con otras palabras se reconoce; ideas distintas no", () => {
  assert.equal(similarity("App para apuntar recetas de cocina", "app para apuntar las recetas"), 1);
  assert.ok(similarity("Montar un podcast de marketing", "montar podcast marketing local") >= 0.75);
  assert.equal(similarity("Comprar pilas", "Comprar leche"), 0, "una palabra común no basta");
  assert.equal(similarity("Podcast", "Montar un podcast sobre fotografía analógica con invitados del barrio"), 0, "no junta lo corto con lo muy largo");
  const items = [{ id: "a", text: "Montar un podcast de marketing" }, { id: "b", text: "Viaje a Lisboa en primavera" }, { id: "c", text: "x", url: "https://www.ejemplo.com/receta/" }];
  assert.equal(findRepeat({ text: "podcast de marketing: montarlo" }, items)?.id, "a");
  assert.equal(findRepeat({ text: "Aprender a tocar el piano" }, items), null);
  assert.equal(findRepeat({ text: "otra", url: "https://ejemplo.com/receta" }, items)?.why, "Mismo enlace");
});

test("repetir no crea otro registro ni pierde fechas", () => {
  let i = { id: "a", text: "Montar un podcast", at: "2026-11-01T10:00:00Z" };
  i = addRepeat(i, "2026-11-05T10:00:00Z"); i = addRepeat(i, "2026-11-09T10:00:00Z", { note: "con invitados" });
  assert.equal(timesSaved(i), 3);
  assert.deepEqual(i.repeats, ["2026-11-05T10:00:00Z", "2026-11-09T10:00:00Z"]);
  assert.equal(i.at, "2026-11-01T10:00:00Z", "la fecha original se queda");
  assert.deepEqual(i.notes, ["con invitados"]);
});

test("fechas en español: día, mes, hora y días de la semana", () => {
  const k = (w) => w && `${w.at.getFullYear()}-${w.at.getMonth() + 1}-${w.at.getDate()} ${w.allDay ? "día" : `${w.at.getHours()}:${String(w.at.getMinutes()).padStart(2, "0")}`}`;
  assert.equal(k(whenIn("Dentista el 3 de diciembre a las 17:30", now)), "2026-12-3 17:30");
  assert.equal(k(whenIn("cita mañana a las 10", now)), "2026-11-21 10:00");
  assert.equal(k(whenIn("pasado mañana a las 9 de la noche", now)), "2026-11-22 21:00");
  assert.equal(k(whenIn("revisión ITV 4/1", now)), "2027-1-4 día", "sin año y ya pasado este año → el que viene");
  assert.equal(k(whenIn("cena el lunes 21:00", now)), "2026-11-23 21:00");
  assert.equal(k(whenIn("el viernes", now)), "2026-11-27 día", "el viernes es el que viene, no hoy");
  assert.equal(k(whenIn("hoy a las 18h", now)), "2026-11-20 18:00");
  assert.equal(whenIn("hoy a las 8", now), null, "una hora de hoy que ya pasó no se propone");
  assert.equal(whenIn("idea para el blog", now), null);
  assert.equal(whenIn("31/02", now), null, "fecha imposible");
  assert.equal(whenIn("me levanto por la mañana", now), null, "«por la mañana» no es mañana");
  assert.match(whenIn("Dentista el 3 de diciembre a las 17:30", now).label, /jueves 3 de diciembre a las 17:30/);
});

test("conexiones: proponen, explican y respetan lo descartado", () => {
  const v = {
    inbox: [
      { id: "i1", status: "IDEA", text: "Cena con el equipo el 3 de diciembre a las 21:00" },
      { id: "i2", status: "IDEA", text: "Montar un podcast", repeats: ["a", "b"] },
      { id: "i3", status: "IDEA", text: "Montar un blog", repeats: ["a", "b"], filed: "p1" },
      { id: "t1", status: "TASK", text: "Llamar al taller mañana a las 9", done: true },
    ],
    reminders: [], docs: [{ id: "d1", title: "Seguro de prueba", expires: "2026-12-10" }, { id: "d2", title: "Lejano", expires: "2027-08-01" }],
  };
  const c = conexiones(v, now);
  assert.deepEqual(c.map((x) => x.key), ["agenda:i1", "proyecto:i2", "doc:d1"]);
  assert.match(c[0].why, /suposición/, "la fecha se presenta como inferencia");
  assert.equal(new Date(c[2].at).getDate(), 3, "aviso una semana antes del vencimiento");
  assert.deepEqual(conexiones(v, now, { dismissed: ["agenda:i1"] }).map((x) => x.key), ["proyecto:i2", "doc:d1"]);
  const v2 = { ...v, reminders: [{ id: "r", from: { list: "inbox", id: "i1" } }] };
  assert.ok(!conexiones(v2, now).some((x) => x.key === "agenda:i1"), "ya pasado a Agenda: no se repite");
  assert.deepEqual(conexiones({}, now), []);
});

// WEB-124 · flujo B: fecha explícita frente a interpretada, y por qué.
test("whenIn distingue fecha explícita de interpretada y lo explica", () => {
  const now = new Date(2026, 10, 20, 10);
  const a = whenIn("Dentista el 3 de diciembre a las 17:30", now);
  assert.equal(a.certainty, "explicita"); assert.match(a.how, /escrito tal cual/);
  assert.equal(whenIn("boda 12/12/2026", now).certainty, "explicita");
  const b = whenIn("cita mañana a las 10", now);
  assert.equal(b.certainty, "interpretada"); assert.match(b.how, /«mañana a las 10» contado desde el 20\/11/);
  const c = whenIn("revisión ITV 4/1", now);
  assert.equal(c.certainty, "interpretada"); assert.match(c.how, /sin año: entiendo el de 2027/);
  assert.equal(whenIn("el viernes", now).certainty, "interpretada");
});

test("conexiones: la propuesta de Agenda dice si la fecha es explícita o interpretada", () => {
  const now = new Date(2026, 10, 20, 10);
  const v = { inbox: [{ id: "a", status: "IDEA", text: "Dentista el 3 de diciembre a las 17:30", at: "x" }, { id: "b", status: "IDEA", text: "llamar mañana a las 10", at: "x" }] };
  const [x, y] = conexiones(v, now);
  assert.equal(x.certainty, "explicita"); assert.match(x.why, /^Fecha explícita/);
  assert.equal(y.certainty, "interpretada"); assert.match(y.why, /^Fecha interpretada.*suposición/);
});

// WEB-124 · flujo A: idea suelta → proyecto existente, con el motivo y sin duplicar.
test("conexiones: propone añadir una idea suelta al proyecto con el que comparte palabras, diciendo cuáles", () => {
  const now = new Date(2026, 10, 20, 10);
  const v = { inbox: [{ id: "i1", status: "IDEA", text: "Diseñar el logo nuevo para la marca personal", at: "x" }, { id: "i2", status: "IDEA", text: "Comprar pan", at: "x" }],
    projects: [{ id: "p1", name: "Marca personal", emoji: "🎨", why: "web y logo" }, { id: "p2", name: "Huerto" }] };
  const list = conexiones(v, now).filter((c) => c.kind === "al-proyecto");
  assert.equal(list.length, 1);
  assert.equal(list[0].projectId, "p1");
  assert.match(list[0].why, /«logo»/); assert.match(list[0].why, /Marca personal/); assert.match(list[0].why, /suposición/);
  // Ya archivada en un proyecto → no se vuelve a proponer.
  v.inbox[0].filed = "p1";
  assert.equal(conexiones(v, now).filter((c) => c.kind === "al-proyecto").length, 0);
  // Descartada → no vuelve.
  v.inbox[0].filed = undefined;
  assert.equal(conexiones(v, now, { dismissed: ["al-proyecto:i1:p1"] }).filter((c) => c.kind === "al-proyecto").length, 0);
});
