// Hoy como centro de control: niveles con reglas fijas, fuentes y frescura. Datos ficticios.
import test from "node:test";
import assert from "node:assert/strict";
import { controlItems, freshness } from "../core/control.js";

const NOW = new Date(2026, 10, 16, 10, 0); // 10:00 local
const iso = (h, m = 0, d = 16) => new Date(2026, 10, d, h, m).toISOString();

test("niveles: urgente solo por hora o vencimiento, nunca por intuición", () => {
  const items = controlItems({
    now: NOW,
    events: [{ title: "Dentista", time: "11:30", end: "12:00", calendar: "Personal" }, { title: "Cena", time: "21:00" }, { title: "Desayuno", time: "08:00", end: "09:00" }, { title: "Vacaciones", allDay: true }],
    reminders: [{ id: "r1", text: "Llamar al taller", at: iso(9), done: false }, { id: "r2", text: "Regar", at: iso(18), done: false }, { id: "r3", text: "Hecho", at: iso(9), done: true }],
    docs: [{ doc: { title: "Seguro del coche" }, left: 2 }, { doc: { title: "Garantía" }, left: 20 }, { doc: { title: "Lejano" }, left: 90 }],
  });
  const lv = Object.fromEntries(items.map((x) => [x.title, x.level]));
  assert.equal(lv["Dentista"], "URGENT", "en menos de 2 horas");
  assert.equal(lv["Cena"], "IMPORTANT", "hoy, pero más tarde");
  assert.equal(lv["Desayuno"], undefined, "lo que ya pasó no sale");
  assert.equal(lv["Vacaciones"], undefined, "lo de todo el día no se vuelve urgente");
  assert.equal(lv["Llamar al taller"], "URGENT", "recordatorio vencido");
  assert.equal(lv["Regar"], "IMPORTANT");
  assert.equal(lv["Hecho"], undefined);
  assert.equal(lv["Seguro del coche"], "URGENT"); assert.equal(lv["Garantía"], "IMPORTANT"); assert.equal(lv["Lejano"], undefined);
  assert.equal(items[0].level, "URGENT");
  assert.ok(items.every((x) => x.source && x.why && x.go), "cada cosa dice de dónde sale, por qué y adónde lleva");
  assert.equal(items.find((x) => x.title === "Dentista").source, "Google Calendar · Personal");
});

test("correo, dinero y cumpleaños: importantes o informativos, nunca urgentes", () => {
  const mail = Array.from({ length: 7 }, (_, i) => ({ subject: `Asunto ${i}`, name: "Ana Prueba", kind: "REPLY", why: ["El asunto pregunta algo"] }));
  const money = { bank: { count: 10 }, consumo: 14250, pending: { count: 3, cents: 62000 }, fiable: false, nivelLabel: "Provisional: falta revisar" };
  const items = controlItems({ now: NOW, mail, money, birthdays: [{ name: "Luis", days: 0 }, { name: "Ana", days: 3 }], tomorrow: [{ title: "Tren", time: "07:15" }, { title: "Comida", time: "14:00" }] });
  assert.ok(!items.some((x) => x.level === "URGENT"));
  assert.equal(items.filter((x) => x.source === "Gmail").length, 6, "5 y un resumen del resto");
  assert.match(items.find((x) => x.source === "Gmail").why, /suposición/);
  assert.equal(items.find((x) => /sin atribuir/.test(x.title)).level, "IMPORTANT");
  const consumo = items.find((x) => /Consumo del mes/.test(x.title));
  assert.equal(consumo.level, "INFO"); assert.match(consumo.why, /Provisional/);
  assert.equal(items.find((x) => x.title === "Cumpleaños de Luis").level, "IMPORTANT");
  assert.equal(items.find((x) => x.title === "Cumpleaños de Ana").level, "INFO");
  assert.equal(items.find((x) => /Mañana/.test(x.title)).title, "Mañana empiezas a las 07:15");
});

test("sin datos, sin inventos: lista vacía", () => {
  assert.deepEqual(controlItems({ now: NOW }), []);
  const fiable = controlItems({ now: NOW, money: { bank: { count: 3 }, consumo: 100, pending: { count: 0, cents: 0 }, fiable: true, nivelLabel: "Confirmada por ti" } });
  assert.equal(fiable.length, 1, "con todo revisado no se pide revisar");
});

test("frescura: cuándo se leyó cada fuente, y lo viejo se marca", () => {
  const f = freshness([{ name: "Agenda", on: true, at: iso(9, 45) }, { name: "Correo", on: true, at: iso(9, 0, 15), maxAgeH: 6 }, { name: "Banco", on: true, at: null }, { name: "Apagado", on: false, at: iso(9) }], NOW);
  assert.deepEqual(f.map((x) => x.name), ["Agenda", "Correo", "Banco"]);
  assert.equal(f[0].text, "a las 09:45"); assert.equal(f[0].stale, false);
  assert.equal(f[1].stale, true);
  assert.equal(f[2].text, "sin leer aún");
});
