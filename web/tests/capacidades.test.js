// WEB-97 — Centro de permisos y conexiones. Entornos de navegador simulados; datos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import { catalog, probe, badgeCount, roundCoord, locateOnce, requestPersist, setBadge, summary, ROUTES, STATES, GROUPS } from "../core/capabilities.js";

const NOW = new Date("2026-11-09T10:00:00+01:00");
const fakeEnv = (o = {}) => ({
  matchMedia: () => ({ matches: o.installed ?? false }),
  Notification: { permission: o.notif ?? "default" },
  navigator: {
    serviceWorker: {},
    storage: o.noStorage ? undefined : { persisted: async () => o.persisted ?? false, persist: async () => o.grant ?? false, estimate: async () => ({ usage: 10, quota: 100 }) },
    permissions: { query: async () => ({ state: o.geo ?? "prompt" }) },
    geolocation: o.noGeo ? undefined : { getCurrentPosition: (ok, ko) => (o.geoFail ? ko({ code: o.geoFail }) : ok({ coords: { latitude: 43.53821, longitude: -5.66112 } })) },
    ...(o.badge ? { setAppBadge: async (n) => { o.badgeLog.push(n); }, clearAppBadge: async () => { o.badgeLog.push(0); } } : {}),
    share: async () => {},
  },
  speechSynthesis: {},
});

test("probe reads real state and never asks", async () => {
  let asked = 0;
  const env = fakeEnv({ notif: "granted", persisted: true, geo: "granted", installed: true });
  env.Notification.requestPermission = () => { asked++; };
  env.navigator.storage.persist = async () => { asked++; return true; };
  const p = await probe(env);
  assert.equal(asked, 0, "probing shows no prompt");
  assert.deepEqual([p.installed, p.notification, p.persisted, p.geo, p.badgeSupported, p.bluetooth, p.contactPicker], [true, "granted", true, "granted", false, false, false]);
  const bare = await probe({ navigator: {} });
  assert.equal(bare.notification, "unsupported"); assert.equal(bare.geo, "unsupported"); assert.equal(bare.persisted, null);
});

test("every capability has a concrete function, a route, a state and a way to revoke", () => {
  const items = catalog({});
  assert.ok(items.length >= 25);
  const ids = new Set();
  for (const x of items) {
    assert.ok(!ids.has(x.id), `duplicate ${x.id}`); ids.add(x.id);
    assert.ok(ROUTES[x.route], x.id); assert.ok(STATES[x.state], `${x.id}: ${x.state}`);
    assert.ok(GROUPS.some(([g]) => g === x.group), x.id);
    for (const k of ["title", "what", "data", "detail", "settings"]) assert.ok(typeof x[k] === "string" && x[k].length, `${x.id}.${k}`);
  }
  for (const r of Object.keys(ROUTES)) assert.ok(items.some((x) => x.route === r), `route ${r} used`);
});

test("states follow the probe, not assumptions", () => {
  const by = (ctx) => Object.fromEntries(catalog(ctx).map((x) => [x.id, x]));
  let c = by({ probe: { notification: "denied", geo: "denied", persisted: false, persistSupported: true, badgeSupported: false } });
  assert.equal(c.notificaciones.state, "denied"); assert.match(c.notificaciones.detail, /Ajustes → Notificaciones/);
  assert.equal(c.ubicacion.state, "denied"); assert.equal(c.ubicacion.action, null, "no button that cannot work");
  assert.equal(c.almacenamiento.state, "off"); assert.equal(c.almacenamiento.action.act, "cap-persist");
  assert.equal(c.globo.state, "unavailable"); assert.equal(c.globo.action, null);
  c = by({ probe: { notification: "unsupported", geo: "unsupported", persistSupported: false } });
  assert.equal(c.notificaciones.state, "unavailable"); assert.match(c.notificaciones.detail, /pantalla de inicio/);
  assert.equal(c.ubicacion.state, "unavailable"); assert.equal(c.almacenamiento.state, "unavailable");
  c = by({ probe: { notification: "granted", badgeSupported: true }, settings: { badge: true } });
  assert.equal(c.globo.state, "on");
  c = by({ probe: { notification: "default", badgeSupported: true }, settings: { badge: true } });
  assert.equal(c.globo.state, "pending", "badge needs notification permission on iOS");
});

test("shortcuts are «lo marcas tú», never claimed as verified", () => {
  const c = Object.fromEntries(catalog({ shortcutsDone: { salud: true } }).map((x) => [x.id, x]));
  assert.equal(c.salud.state, "manual"); assert.match(c.salud.detail, /MANU no puede ver tus atajos/);
  assert.equal(c.lugar.state, "pending");
  assert.ok(catalog({}).filter((x) => x.route === "atajos").every((x) => x.state !== "on"));
});

test("connections reflect MANU's settings; nothing native or forbidden is offered as a button", () => {
  const items = catalog({ google: { calendar: true, gmail: true }, ai: true, nube: false, style: false });
  const c = Object.fromEntries(items.map((x) => [x.id, x]));
  assert.equal(c.google.state, "on"); assert.match(c.google.detail, /calendar, gmail/);
  assert.equal(c.gemini.state, "on"); assert.equal(c.nube.state, "off"); assert.equal(c.estilo.state, "off");
  assert.equal(c.banco.state, "pending"); assert.equal(c.push.state, "off", "WEB-99: push is real now; off until Manu turns it on");
  const pc = (push) => catalog({ push }).find((x) => x.id === "push").state;
  assert.deepEqual([pc({ on: true, here: true }), pc({ on: true, here: false }), pc({ on: false })], ["on", "pending", "off"]);
  for (const x of items.filter((x) => x.route === "nativa" || x.route === "no")) { assert.ok(!x.action, `${x.id} has no action`); assert.ok(["unavailable", "never"].includes(x.state)); }
  assert.match(c.att.detail, /no lo usa ni lo usará/);
  assert.match(c.mensajes.detail, /nunca escribe a nadie/);
});

test("no capability requests contacts, motion, Bluetooth or the microphone from the web", () => {
  const acts = catalog({ probe: { notification: "default", geo: "prompt", persistSupported: true, badgeSupported: true } }).map((x) => x.action?.act).filter(Boolean);
  assert.deepEqual([...new Set(acts)].sort(), ["cap-badge", "cap-here", "cap-persist", "notify-on"]);
});

test("badge counts reminders left today or overdue, nothing else", () => {
  const r = [{ at: "2026-11-09T18:00:00+01:00" }, { at: "2026-11-08T09:00:00+01:00" }, { at: "2026-11-09T08:00:00+01:00", done: true }, { at: "2026-11-10T09:00:00+01:00" }, { at: "nope" }];
  assert.equal(badgeCount(r, NOW), 2);
  assert.equal(badgeCount([], NOW), 0);
});

test("location: one shot, coarse, and a clear message when denied", async () => {
  assert.equal(roundCoord(43.53821), 43.5); assert.equal(roundCoord(-5.66112), -5.7); assert.equal(roundCoord(NaN), null);
  let opts = null;
  const env = fakeEnv(); const real = env.navigator.geolocation.getCurrentPosition;
  env.navigator.geolocation.getCurrentPosition = (a, b, o) => { opts = o; real(a, b, o); };
  assert.deepEqual(await locateOnce(env), { latitude: 43.5, longitude: -5.7 });
  assert.equal(opts.enableHighAccuracy, false);
  await assert.rejects(locateOnce(fakeEnv({ geoFail: 1 })), /denegada/);
  await assert.rejects(locateOnce(fakeEnv({ noGeo: true })), /no da la ubicación/);
});

test("persist and badge report what the browser answered", async () => {
  assert.equal(await requestPersist(fakeEnv({ grant: true })), true);
  assert.equal(await requestPersist(fakeEnv({ grant: false })), false);
  assert.equal(await requestPersist(fakeEnv({ noStorage: true })), null);
  const o = { badge: true, badgeLog: [] };
  const env = fakeEnv(o);
  assert.equal(await setBadge(3, env), true); assert.equal(await setBadge(0, env), true);
  assert.deepEqual(o.badgeLog, [3, 0]);
  assert.equal(await setBadge(2, fakeEnv()), false);
});

test("summary counts active and to-enable items", () => {
  const s = summary(catalog({ probe: { notification: "granted", persisted: true, persistSupported: true, shareSupported: true, geo: "prompt" } }));
  assert.match(s, /^\d+ activos/); assert.match(s, /por activar/);
});
