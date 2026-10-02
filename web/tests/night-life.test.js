import { test } from "node:test";
import assert from "node:assert/strict";
import { guessCity, proposeAlarm, shouldAskTomorrow, shortcutUrl, CITIES } from "../core/night.js";
import { toggleHabit, streak, lastDays, dayKey, daysUntilBirthday, upcomingBirthdays, longTimeNoTalk, mealSlot, frequentMeals, healthSummary, setMood, dueReminders } from "../core/life.js";

test("night: city guess and alarm (ported from Swift NightPlanner)", () => {
  assert.equal(guessCity([{ time: "10:00", title: "Reunión", location: "Oviedo centro" }]).city, "OVIEDO");
  assert.equal(guessCity([{ time: "10:00", title: "Médico" }]).city, "GIJON");
  assert.equal(proposeAlarm({ events: [] }).time, "08:00");
  // 09:00 in Oviedo with breakfast: 30+10+20+40 = 100 min -> 07:20
  assert.equal(proposeAlarm({ events: [{ time: "09:00", title: "Trabajo" }], city: "OVIEDO" }).time, "07:20");
  assert.equal(proposeAlarm({ events: [{ time: "09:00", title: "Trabajo" }], city: "GIJON", wantsBreakfast: false }).time, "08:20");
  const early = proposeAlarm({ events: [{ time: "06:30", title: "Tren" }], city: "OVIEDO" });
  assert.equal(early.time, "06:00");
  assert.match(early.explanation, /No te pongo la alarma antes/);
  assert.ok(CITIES.GIJON.latitude > CITIES.OVIEDO.latitude);
});

test("night: question timing and shortcut link", () => {
  assert.equal(shouldAskTomorrow(new Date(2026, 8, 28, 17, 59), null, "2026-09-29"), false);
  assert.equal(shouldAskTomorrow(new Date(2026, 8, 28, 21, 0), null, "2026-09-29"), true);
  assert.equal(shouldAskTomorrow(new Date(2026, 8, 28, 21, 0), "2026-09-29", "2026-09-29"), false);
  assert.equal(shortcutUrl("MANU Alarma", "07:20"), "shortcuts://run-shortcut?name=MANU%20Alarma&input=text&text=07%3A20");
});

test("habits: toggle and streak", () => {
  const today = new Date(2026, 8, 28, 12);
  let h = { id: "h", name: "Caminar", done: [] };
  for (const d of [26, 27]) h = toggleHabit(h, dayKey(new Date(2026, 8, d)));
  assert.equal(streak(h, today), 2, "today pending does not break the streak");
  h = toggleHabit(h, dayKey(today));
  assert.equal(streak(h, today), 3);
  assert.equal(streak(toggleHabit(h, dayKey(today)), today), 2);
  assert.equal(lastDays(h, today).filter((d) => d.done).length, 3);
});

test("people: birthdays and long time no talk", () => {
  const today = new Date(2026, 8, 28);
  assert.equal(daysUntilBirthday("09-28", today), 0);
  assert.equal(daysUntilBirthday("09-27", today), 364);
  assert.equal(daysUntilBirthday("02-30", today), null);
  const people = [{ id: "a", name: "Persona A", birthday: "10-05" }, { id: "b", name: "Persona B", birthday: "12-01", lastContact: "2026-07-01" }];
  assert.deepEqual(upcomingBirthdays(people, today).map((x) => x.person.id), ["a"]);
  assert.deepEqual(longTimeNoTalk(people, today).map((p) => p.id), ["b"]);
});

test("meals, health, mood, reminders", () => {
  assert.equal(mealSlot(new Date(2026, 8, 28, 8)), "Desayuno");
  assert.equal(mealSlot(new Date(2026, 8, 28, 14)), "Comida");
  assert.equal(mealSlot(new Date(2026, 8, 28, 2)), "Cena");
  assert.deepEqual(frequentMeals([{ text: "Tostada" }, { text: "tostada" }, { text: "Pizza" }]), ["Tostada"]);
  const today = new Date(2026, 8, 28);
  const h = healthSummary([{ day: "2026-09-28", kind: "SLEEP", value: 7 }, { day: "2026-09-27", kind: "SLEEP", value: 6 }, { day: "2026-09-01", kind: "SLEEP", value: 1 }], today);
  assert.equal(h.sleep, 6.5);
  assert.equal(h.steps, null);
  const m = setMood(setMood([], "2026-09-28", 2), "2026-09-28", 4);
  assert.deepEqual(m, [{ day: "2026-09-28", value: 4 }]);
  const now = new Date(2026, 8, 28, 10);
  const r = [{ id: 1, at: new Date(2026, 8, 28, 9).toISOString() }, { id: 2, at: new Date(2026, 8, 28, 11).toISOString() }, { id: 3, at: new Date(2026, 8, 28, 9).toISOString(), done: true }];
  assert.deepEqual(dueReminders(r, now).map((x) => x.id), [1]);
});

test("WEB-79: the «where tomorrow» question only before a workday", () => {
  assert.equal(shouldAskTomorrow(new Date(2026, 9, 2, 18, 28), null, "2026-10-03"), false); // Friday → Saturday
  assert.equal(shouldAskTomorrow(new Date(2026, 9, 3, 21, 0), null, "2026-10-04"), false); // Saturday → Sunday
  assert.equal(shouldAskTomorrow(new Date(2026, 9, 4, 21, 0), null, "2026-10-05"), true); // Sunday → Monday
});
