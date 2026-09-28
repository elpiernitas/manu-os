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
