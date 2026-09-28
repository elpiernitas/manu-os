import { test } from "node:test";
import assert from "node:assert/strict";
import { detectRecurring, upcomingRecurring, spendingPattern } from "../core/insights.js";
import { monthGrid, listEvents } from "../core/gcal.js";
import { contactBirthdays } from "../core/google.js";

const e = (merchant, cents, iso, extra = {}) => ({ id: `${merchant}${iso}`, merchant, cents, at: new Date(iso).toISOString(), category: "OTHER", ...extra });

test("fixed monthly charges are found, with day of month and next date", () => {
  const entries = [
    e("PAGO SPOTIFY EJEMPLO", 1199, "2026-07-05T12:00:00", { category: "SUBSCRIPTIONS" }),
    e("PAGO SPOTIFY EJEMPLO", 1199, "2026-08-05T12:00:00", { category: "SUBSCRIPTIONS" }),
    e("TELEFONOS EJEMPLO", 2000, "2026-07-20T12:00:00"),
    e("TELEFONOS EJEMPLO", 2100, "2026-08-20T12:00:00"),
    e("TELEFONOS EJEMPLO", 2050, "2026-09-19T12:00:00"),
    e("COMPRA TARJ. BAR EJEMPLO", 800, "2026-07-01T12:00:00"),
    e("COMPRA TARJ. BAR EJEMPLO", 900, "2026-07-02T12:00:00"),
    e("COMPRA TARJ. BAR EJEMPLO", 700, "2026-08-02T12:00:00"),
  ];
  const r = detectRecurring(entries, { now: new Date("2026-09-29T12:00:00") });
  assert.deepEqual(r.map((x) => x.merchant), ["PAGO SPOTIFY EJEMPLO", "TELEFONOS EJEMPLO"]);
  assert.equal(r[0].dayOfMonth, 5);
  assert.ok(r[0].nextExpected.startsWith("2026-09-0"));
  assert.equal(r[0].overdue, true, "September Spotify not seen yet");
  assert.equal(upcomingRecurring(r, new Date("2026-10-15T12:00:00")).length, 1);
});

test("spending pattern by weekday, part of month and moment (bank lines have no time)", () => {
  const p = spendingPattern([
    e("A", 1000, "2026-09-26T22:30:00"), // Saturday night, manual
    e("B", 500, "2026-09-28T12:00:00", { source: "BANK" }), // Monday
  ]);
  assert.equal(p.byWeekday[5].cents, 1000);
  assert.equal(p.byWeekday[0].cents, 500);
  assert.equal(p.byMonthPart[2].cents, 1500);
  assert.equal(p.byMoment[2].cents, 1000);
  assert.equal(p.byMoment[0].cents, 0, "bank line not counted by hour");
  assert.equal(p.topWeekday, "Sáb");
  assert.equal(spendingPattern([e("B", 5, "2026-09-28T12:00:00", { source: "BANK" })]).byMoment, null);
});

test("month grid starts on Monday and covers the month", () => {
  const g = monthGrid(2026, 8); // September 2026 starts on Tuesday
  assert.equal(g[0].day, "2026-08-31");
  assert.equal(g[1].day, "2026-09-01");
  assert.equal(g.filter((d) => d.inMonth).length, 30);
  assert.equal(g.length % 7, 0);
});

test("calendar events are paginated", async () => {
  const pages = [{ items: [{ summary: "Uno", start: { date: "2026-09-29" } }], nextPageToken: "p2" }, { items: [{ summary: "Dos", start: { date: "2026-09-30" } }] }];
  const calls = [];
  const days = await listEvents("t", new Date(0), new Date(1), async (url) => { calls.push(url); return { ok: true, status: 200, json: async () => pages[calls.length - 1] }; });
  assert.equal(calls.length, 2);
  assert.ok(calls[1].includes("pageToken=p2"));
  assert.equal(days.get("2026-09-30")[0].title, "Dos");
});

test("contacts report how many were read, not only birthdays", async () => {
  const r = await contactBirthdays("t", async () => ({ ok: true, status: 200, json: async () => ({ connections: [{ resourceName: "people/1", names: [{ displayName: "Sin cumple" }] }] }) }));
  assert.equal(r.total, 1);
  assert.equal(r.people.length, 0);
});

import { groupByDay, mergeDays, listCalendars } from "../core/gcal.js";
import { APPS } from "../core/hub.js";

test("multi-day events cover every day (end.date exclusive) and keep colour and calendar", () => {
  const days = groupByDay({ items: [
    { id: "v", summary: "Vacaciones de ejemplo", start: { date: "2026-09-28" }, end: { date: "2026-10-01" } },
    { id: "m", summary: "Reunión", start: { dateTime: new Date(2026, 8, 29, 10).toISOString() }, end: { dateTime: new Date(2026, 8, 29, 11).toISOString() } },
    { id: "n", summary: "Noche", start: { dateTime: new Date(2026, 8, 29, 23).toISOString() }, end: { dateTime: new Date(2026, 8, 30, 0).toISOString() } },
  ] }, { color: "#9e69af", calendar: "Equipo" });
  assert.deepEqual([...days.keys()].sort(), ["2026-09-28", "2026-09-29", "2026-09-30"]);
  const d29 = days.get("2026-09-29");
  assert.equal(d29[0].title, "Vacaciones de ejemplo", "multi-day first");
  assert.equal(d29[0].first, false);
  assert.equal(days.get("2026-09-30")[0].last, true);
  assert.equal(d29[0].color, "#9e69af");
  assert.equal(d29[0].calendar, "Equipo");
  assert.ok(!days.get("2026-09-30").some((e) => e.id === "n"), "an event ending at 00:00 does not spill into the next day");
  assert.equal(groupByDay({ items: [{ summary: "x", start: { date: "2026-09-28" } }] }, { color: "javascript:alert(1)" }).get("2026-09-28")[0].color, null, "colours are sanitised");
  const merged = mergeDays([days, groupByDay({ items: [{ id: "p", summary: "Personal", start: { date: "2026-09-29" }, end: { date: "2026-09-30" } }] })]);
  assert.equal(merged.get("2026-09-29").length, 4);
});

test("calendar list keeps visible calendars with safe colours; WhatsApp access opens the app", async () => {
  const cals = await listCalendars("t", async () => ({ ok: true, status: 200, json: async () => ({ items: [
    { id: "a@x", summary: "Personal", backgroundColor: "#4285f4", primary: true },
    { id: "b@x", summary: "Oculto", selected: false },
    { id: "c@x", summary: "Equipo", backgroundColor: "red" },
  ] }) }));
  assert.deepEqual(cals.map((c) => [c.name, c.color]), [["Personal", "#4285f4"], ["Equipo", null]]);
  assert.equal(APPS.whatsapp.url, "whatsapp://");
});
