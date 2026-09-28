import { test } from "node:test";
import assert from "node:assert/strict";
import { isClientId, eventsUrl, groupByDay, newEventBody, listEvents, createEvent } from "../core/gcal.js";
import { guessCity } from "../core/night.js";

test("client id format", () => {
  assert.ok(isClientId("1234567890-abcdefghijklmnop0123456789abcd.apps.googleusercontent.com"));
  assert.ok(!isClientId("AIzaSyEXAMPLE"));
  assert.ok(!isClientId(""));
});

test("events grouped by local day, all-day first, cancelled ignored", () => {
  const d = (h) => new Date(2026, 8, 29, h, 0).toISOString();
  const json = { items: [
    { summary: "Trabajo", location: "Oviedo", start: { dateTime: d(9) }, end: { dateTime: d(13) } },
    { summary: "Cumple", start: { date: "2026-09-29" } },
    { summary: "Anulado", status: "cancelled", start: { dateTime: d(10) } },
    { summary: "Sin fecha" },
  ] };
  const days = groupByDay(json);
  const tomorrow = days.get("2026-09-29");
  assert.deepEqual(tomorrow.map((e) => e.title), ["Cumple", "Trabajo"]);
  assert.equal(tomorrow[1].time, "09:00");
  assert.equal(tomorrow[1].end, "13:00");
  assert.equal(guessCity(tomorrow).city, "OVIEDO", "tomorrow's real events feed the night planner");
});

test("urls, bodies and adapter errors", async () => {
  assert.match(eventsUrl(new Date(0), new Date(1000)), /singleEvents=true&orderBy=startTime/);
  const body = newEventBody({ title: "Dentista", start: "2026-09-29T10:00", minutes: 30 });
  assert.equal(new Date(body.end.dateTime) - new Date(body.start.dateTime), 30 * 60000);
  assert.throws(() => newEventBody({ title: "", start: "x" }));
  await assert.rejects(listEvents("t", new Date(), new Date(), async () => ({ status: 401, ok: false })), (e) => e.code === "auth");
  let sent;
  await createEvent("tok", body, async (url, init) => { sent = init; return { ok: true, status: 200, json: async () => ({ id: "x" }) }; });
  assert.equal(sent.headers.Authorization, "Bearer tok");
  assert.equal(JSON.parse(sent.body).summary, "Dentista");
});
