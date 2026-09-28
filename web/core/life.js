// Tú: habits, people, meals, health and mood. Local-only, sensitive by nature:
// never shown on locked surfaces, never sent to an AI provider (AGENTS.md).
import { normalise } from "./text.js";

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// ---- Habits ----
export function toggleHabit(habit, day) {
  const done = new Set(habit.done ?? []);
  done.has(day) ? done.delete(day) : done.add(day);
  return { ...habit, done: [...done].sort() };
}

// Consecutive days up to today (today may still be pending without breaking it).
export function streak(habit, today = new Date()) {
  const done = new Set(habit.done ?? []);
  let d = done.has(dayKey(today)) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(dayKey(d))) { n++; d = addDays(d, -1); }
  return n;
}

export function lastDays(habit, today = new Date(), n = 7) {
  const done = new Set(habit.done ?? []);
  return Array.from({ length: n }, (_, i) => { const d = addDays(today, i - n + 1); return { day: dayKey(d), done: done.has(dayKey(d)) }; });
}

// ---- People ----
// birthday: "MM-DD" (year optional and not needed)
export function daysUntilBirthday(birthday, today = new Date()) {
  const m = /^(\d{2})-(\d{2})$/.exec(birthday ?? "");
  if (!m) return null;
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(today.getFullYear(), Number(m[1]) - 1, Number(m[2]));
  if (next.getMonth() !== Number(m[1]) - 1) return null;
  if (next < base) next = new Date(today.getFullYear() + 1, Number(m[1]) - 1, Number(m[2]));
  return Math.round((next - base) / 86400000);
}

export function upcomingBirthdays(people, today = new Date(), within = 30) {
  return people
    .map((p) => ({ person: p, days: daysUntilBirthday(p.birthday, today) }))
    .filter((x) => x.days !== null && x.days <= within)
    .sort((a, b) => a.days - b.days);
}

export function longTimeNoTalk(people, today = new Date(), days = 30) {
  return people.filter((p) => p.lastContact && (today - new Date(p.lastContact)) / 86400000 >= days);
}

// ---- Meals ----
const MEAL_SLOTS = [[5 * 60, "Desayuno"], [11 * 60 + 30, "Media mañana"], [13 * 60, "Comida"], [17 * 60, "Merienda"], [20 * 60, "Cena"]];
export function mealSlot(date = new Date()) {
  const m = date.getHours() * 60 + date.getMinutes();
  let slot = "Cena";
  for (const [from, name] of MEAL_SLOTS) if (m >= from) slot = name;
  return m < 5 * 60 ? "Cena" : slot;
}

// Most repeated meals, to offer as one-tap "habituales".
export function frequentMeals(meals, n = 4) {
  const count = new Map();
  for (const meal of meals) {
    const key = normalise(meal.text);
    const prev = count.get(key);
    count.set(key, { text: prev?.text ?? meal.text, n: (prev?.n ?? 0) + 1 });
  }
  return [...count.values()].filter((x) => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, n).map((x) => x.text);
}

// ---- Health (manual or from a Shortcut) ----
export function healthSummary(entries, today = new Date()) {
  const week = new Set(Array.from({ length: 7 }, (_, i) => dayKey(addDays(today, -i))));
  const inWeek = entries.filter((e) => week.has(e.day));
  const avg = (kind) => {
    const v = inWeek.filter((e) => e.kind === kind).map((e) => e.value);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  return { sleep: avg("SLEEP"), steps: avg("STEPS"), weight: avg("WEIGHT") };
}

// ---- Mood ----
export const MOODS = [
  { value: 1, label: "Mal" },
  { value: 2, label: "Regular" },
  { value: 3, label: "Bien" },
  { value: 4, label: "Muy bien" },
];

export function setMood(moods, day, value) {
  return [...moods.filter((m) => m.day !== day), { day, value }].sort((a, b) => (a.day < b.day ? -1 : 1)).slice(-400);
}

// ---- Reminders ----
export function dueReminders(reminders, now = new Date()) {
  return reminders.filter((r) => !r.done && !r.notified && new Date(r.at) <= now);
}
