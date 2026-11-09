import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fableHoyIntro, fableHoyServices } from "../design/fable-today.js";

const read = (file) => readFileSync(new URL(file, new URL("../", import.meta.url)), "utf8");

test("Fable Hoy uses real values supplied by the app, without demo data", () => {
  const html = fableHoyIntro({
    greeting: "Buenos días", date: "lunes, 9 de noviembre", mode: "Trabajo", city: "Gijón",
    weather: { now: { temp: 14.8, text: "Nubes" }, today: { min: 9, max: 17 } },
    next: { time: "12:30", title: "Reunión" }, tasks: 3, reminders: 1,
  });
  assert.match(html, /Buenos días, Manu/);
  assert.match(html, /15<span aria-hidden="true">°/);
  assert.match(html, /Gijón/);
  assert.match(html, /12:30/);
  assert.match(html, /3 tareas abiertas/);
  assert.match(html, /1 recordatorio/);
  assert.match(html, /data-act="weather-open"/);
  assert.match(html, /data-tab="agenda"/);
});

test("Today never invents weather or agenda when no data are supplied", () => {
  const html = fableHoyIntro({ greeting: "Hola", city: "Oviedo", weather: null, next: null, tasks: 0, reminders: 0 });
  assert.match(html, /Sin previsión confirmada/);
  assert.match(html, /Sin un próximo evento confirmado/);
  assert.doesNotMatch(html, /21°|Sol y despejado/);
});

test("Today and its service cards escape untrusted data", () => {
  const malicious = '<img src=x onerror=alert(1)>';
  const a = fableHoyIntro({ date: malicious, next: { title: malicious, time: "10:00" }, weather: { now: { temp: 12, text: malicious }, today: {} }, city: malicious });
  const b = fableHoyServices({ cloud: { signedIn: true, lastAt: malicious }, push: { enabled: true, here: false } });
  assert.doesNotMatch(a, /<img/);
  assert.match(a, /&lt;img/);
  assert.doesNotMatch(b, /<img/);
});

test("Cloud status distinguishes a token from verified sync; no invented Supabase connection", () => {
  const offline = fableHoyServices();
  assert.match(offline, /Sin conectar/);
  assert.match(offline, /Desactivados/);
  assert.match(offline, /Integración de lectura pendiente/);
  assert.doesNotMatch(offline, /Lectura conectada/);
  const signedIn = fableHoyServices({ cloud: { signedIn: true }, push: { enabled: true, here: true } });
  assert.match(signedIn, /Sesión iniciada · sin verificar/);
  assert.match(signedIn, /Activados en este dispositivo/);
  const conflict = fableHoyServices({ cloud: { signedIn: true, conflict: true, dirty: true, error: true } });
  assert.match(conflict, /Conflicto pendiente/);
});

test("Cards navigate to existing Tu nube, avisos and Dinero, not external services", () => {
  const html = fableHoyServices({});
  for (const target of ['data-sub-go="nube"', 'data-sub-go="avisos"', 'data-tab="dinero"']) assert.ok(html.includes(target));
  assert.doesNotMatch(html, /https?:\/\//);
});

test("Main app uses Fable presentation fed by real cloud, push, weather, task state", () => {
  const app = read("app.js");
  const html = read("index.html");
  const sw = read("sw.js");
  assert.match(app, /fableHoyIntro\(/);
  assert.match(app, /fableHoyServices\(/);
  assert.match(app, /cloudState\.lastAt/);
  assert.match(app, /Boolean\(pushDev\.v\.endpoint\)/);
  assert.match(app, /const actualWeather = vault\.weather/);
  assert.match(app, /bank: \{ connected: bankAisUi\.checked && bankAisUi\.connected, available: bankAisUi\.checked \}/);
  assert.match(html, /design\/fable-today\.css/);
  for (const path of ["design/fable-today.js", "design/fable-today.css"]) assert.ok(sw.includes('"' + path + '"'));
});
