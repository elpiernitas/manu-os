import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEvents, launchParams, nextEvent, localDay, LIMITS } from "../core/intake.js";
import { categorise } from "../core/money.js";
import { parse } from "../core/assistant.js";
import { validateVault, emptyVault } from "../core/storage.js";

test("events from a Shortcut: timed, ranges, all-day, junk ignored, sorted", () => {
  const events = parseEvents("13:45 Comida\n9:30-10:15 Reunión\ntodo el día Cumpleaños\nbasura\n25:00 Imposible\n09.00 Café");
  assert.deepEqual(events, [
    { time: null, end: null, title: "Cumpleaños" },
    { time: "09:00", end: null, title: "Café" },
    { time: "09:30", end: "10:15", title: "Reunión" },
    { time: "13:45", end: null, title: "Comida" },
  ]);
});

test("external input is bounded and stripped of control characters", () => {
  const many = Array.from({ length: 80 }, (_, i) => `10:00 E${i}`).join("\n");
  assert.equal(parseEvents(many).length, LIMITS.events);
  const [long] = parseEvents(`10:00 ${"x".repeat(500)}`);
  assert.equal(long.title.length, LIMITS.title);
  const { say } = launchParams(`?di=${encodeURIComponent("hola\u0000<b>" + "y".repeat(900))}`);
  assert.ok(!say.includes("\u0000"));
  assert.equal(say.length, LIMITS.text);
});

test("launch params: di and eventos", () => {
  assert.deepEqual(launchParams("?di=gast%C3%A9%205%20en%20bar"), { say: "gasté 5 en bar", events: null, morning: false });
  assert.deepEqual(launchParams(""), { say: null, events: null, morning: false });
  assert.equal(launchParams("?manana=1").morning, true); // WEB-72
  assert.deepEqual(launchParams("?eventos=").events, []);
  assert.equal(launchParams("?eventos=10%3A00%20Dentista").events[0].title, "Dentista");
});

test("next event only for today and only if not started", () => {
  const now = new Date(2026, 8, 28, 10, 0);
  const agenda = { day: localDay(now), events: parseEvents("todo el día X\n09:00 Antes\n10:00 Ahora\n12:00 Luego") };
  assert.equal(nextEvent(agenda, now).title, "Ahora");
  assert.equal(nextEvent({ ...agenda, day: "2000-01-01" }, now), null);
  assert.equal(nextEvent(null, now), null);
});

test("merchant keeps original spelling and still categorises", () => {
  const e = parse("Gasté 3 en Café Central!");
  assert.equal(e.merchant, "Café Central");
  assert.equal(categorise(e.merchant), "FOOD_AND_DRINK");
});

test("vault with a broken agenda is rejected; without agenda is fine", () => {
  assert.equal(validateVault({ ...emptyVault(), agenda: { day: 1 } }).ok, false);
  assert.equal(validateVault(emptyVault()).ok, true);
  assert.equal(validateVault({ ...emptyVault(), agenda: { day: "2026-09-28", events: [] } }).ok, true);
});

test("QA #4: Shortcut data can come in the fragment (never sent to the server)", () => {
  assert.deepEqual(launchParams("#di=gast%C3%A9%205%20en%20bar"), { say: "gasté 5 en bar", events: null, morning: false });
  assert.equal(launchParams("#manana=1").morning, true);
  assert.equal(launchParams("#access_token=x&refresh_token=y").say, null); // the Supabase link is not a launch
});
