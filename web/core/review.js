// Repaso (WEB-83), from the idea «agente de revisión»: every night, what went
// well and what to improve; every Sunday, the week and a plan for the next.
// Everything is computed on the device from what MANU already knows (tasks,
// habits, fichaje, spending, agenda). Mood is never judged here.
// Pure: data in, lines out.
import { tally, clockState, dur } from "./clock.js";
import { CATEGORIES } from "./money.js";

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const eur = (c) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const list = (xs, max = 3) => (xs.length > max ? `${xs.slice(0, max).join(", ")}…` : xs.join(", ").replace(/, ([^,]*)$/, " y $1"));
const dayOf = (iso) => (iso ? dayKey(new Date(iso)) : null);

const openTasks = (inbox) => (inbox ?? []).filter((i) => i.status === "TASK" && !i.done).sort((a, b) => String(a.at).localeCompare(String(b.at)));
const spentOn = (spending, days) => (spending ?? []).filter((s) => days.has(dayOf(s.at))).reduce((t, s) => t + (s.cents ?? 0), 0);

// The worked time of a day, if «Salida» was punched.
function workday(clock, day, targetMin, now) {
  const rec = (clock ?? []).find((d) => d.day === day);
  if (!rec?.events?.length) return null;
  const t = tally(rec.events, now);
  return { done: clockState(rec.events) === "done", worked: t.workedMin, diff: t.workedMin - targetMin };
}

/**
 * Tonight's review. Shown on Hoy from 20:00 until he marks it done.
 * @param {object} d { now, inbox, habits, spending, clock, targetMin, tomorrowEvents, reminders }
 */
export function nightReview({ now = new Date(), inbox = [], habits = [], spending = [], clock = [], targetMin = 240, tomorrowEvents = [], reminders = [] } = {}) {
  const today = dayKey(now);
  const wins = [], improve = [], tomorrow = [];

  const doneToday = (inbox ?? []).filter((i) => i.status === "TASK" && i.done && dayOf(i.doneAt) === today);
  if (doneToday.length) wins.push(`Has cerrado ${plural(doneToday.length, "tarea", "tareas")}: ${list(doneToday.map((t) => t.text))}.`);

  if (habits.length) {
    const done = habits.filter((h) => (h.done ?? []).includes(today));
    const left = habits.filter((h) => !(h.done ?? []).includes(today));
    if (done.length) wins.push(`Hábitos: ${done.length} de ${habits.length} (${list(done.map((h) => h.name))}).`);
    if (left.length) improve.push(`Te ${left.length === 1 ? "falta" : "faltan"} ${list(left.map((h) => h.name))}. Aún estás a tiempo.`);
  }

  const w = workday(clock, today, targetMin, now);
  if (w?.done) wins.push(`Jornada fichada: ${dur(w.worked)}${w.diff ? ` (${w.diff > 0 ? "+" : "−"}${dur(w.diff)})` : ", justa"}.`);
  else if (w) improve.push("No fichaste la salida: corrígelo en Tú → Fichaje.");

  const spentToday = spentOn(spending, new Set([today]));
  const lastDays = new Set(Array.from({ length: 28 }, (_, i) => dayKey(addDays(now, -1 - i))));
  const avg = Math.round(spentOn(spending, lastDays) / 28);
  if (!spentToday && avg > 0) wins.push("Hoy no has gastado nada.");
  else if (avg > 0 && spentToday > avg * 1.5 && spentToday - avg > 1000) improve.push(`Hoy has gastado ${eur(spentToday)}, bastante más que tu media diaria (${eur(avg)}).`);

  const old = openTasks(inbox).filter((t) => now.getTime() - Date.parse(t.at) > 7 * DAY);
  if (old.length) improve.push(`${old.length === 1 ? "Una tarea lleva" : `${old.length} tareas llevan`} más de una semana abierta${old.length === 1 ? "" : "s"}: «${old[0].text}».`);

  const timed = (tomorrowEvents ?? []).filter((e) => e.time && !String(e.title ?? "").startsWith("🎂")).sort((a, b) => a.time.localeCompare(b.time));
  if (timed.length) tomorrow.push(`Mañana empiezas a las ${timed[0].time}: ${timed[0].title}${timed.length > 1 ? ` (y ${plural(timed.length - 1, "cosa más", "cosas más")})` : ""}.`);
  const remTomorrow = (reminders ?? []).filter((r) => !r.done && dayOf(r.at) === dayKey(addDays(now, 1)));
  if (remTomorrow.length) tomorrow.push(`${plural(remTomorrow.length, "recordatorio", "recordatorios")} para mañana.`);
  const first = openTasks(inbox)[0];
  if (first) tomorrow.push(`Si te da tiempo, empieza por «${first.text}».`);

  return { day: today, wins, improve, tomorrow, empty: !wins.length && !improve.length && !tomorrow.length };
}

/**
 * The week (the 7 days ending today) and a plan for the next one.
 * @param {object} d { now, inbox, habits, spending, clock, targetMin, nextWeekEvents, budgets }
 */
export function weekReview({ now = new Date(), inbox = [], habits = [], spending = [], clock = [], targetMin = 240, nextWeekEvents = [] } = {}) {
  const days = Array.from({ length: 7 }, (_, i) => dayKey(addDays(now, -6 + i)));
  const set = new Set(days);
  const prev = new Set(Array.from({ length: 7 }, (_, i) => dayKey(addDays(now, -13 + i))));
  const wins = [], improve = [], plan = [];

  const done = (inbox ?? []).filter((i) => i.status === "TASK" && i.done && set.has(dayOf(i.doneAt)));
  if (done.length) wins.push(`Has cerrado ${plural(done.length, "tarea", "tareas")}.`);

  const rates = habits.map((h) => ({ name: h.name, n: (h.done ?? []).filter((d) => set.has(d)).length })).sort((a, b) => b.n - a.n);
  if (rates.length && rates[0].n >= 5) wins.push(`${rates[0].name}: ${rates[0].n} de 7 días. Muy bien.`);
  const weak = rates.filter((r) => r.n < 4).at(-1);
  if (weak) improve.push(`${weak.name} se ha quedado en ${weak.n} de 7 días.`);

  let balance = 0, worked = 0, workdays = 0, open = 0;
  for (const day of days) {
    const w = workday(clock, day, targetMin, now);
    if (!w) continue;
    if (!w.done) { open++; continue; }
    balance += w.diff; worked += w.worked; workdays++;
  }
  if (workdays) (balance >= 0 ? wins : improve).push(`Trabajo: ${plural(workdays, "día", "días")}, ${dur(worked)}${balance ? `, ${balance > 0 ? "+" : "−"}${dur(balance)} sobre tu jornada` : ", justo"}.`);
  if (open) improve.push(`${plural(open, "día", "días")} sin fichar la salida: corrígelos en Fichaje.`);

  const spent = spentOn(spending, set), before = spentOn(spending, prev);
  if (spent || before) {
    const pct = before ? Math.round(((spent - before) / before) * 100) : null;
    const line = `Has gastado ${eur(spent)}${pct === null ? "" : ` (${pct > 0 ? "+" : ""}${pct} % que la semana anterior)`}.`;
    if (pct !== null && pct > 15) {
      const by = {};
      for (const s of spending) if (set.has(dayOf(s.at))) by[s.category ?? "OTHER"] = (by[s.category ?? "OTHER"] ?? 0) + s.cents;
      const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
      improve.push(`${line}${top ? ` Lo que más: ${(CATEGORIES[top[0]] ?? "otros").toLowerCase()}.` : ""}`);
    } else wins.push(line);
  }

  const open2 = openTasks(inbox);
  const stale = open2.filter((t) => now.getTime() - Date.parse(t.at) > 7 * DAY);
  if (stale.length >= 3) improve.push(`${stale.length} tareas llevan más de una semana abiertas.`);

  if (open2.length) plan.push(`Cierra primero: ${list(open2.slice(0, 2).map((t) => `«${t.text}»`), 2)}.`);
  if (weak) plan.push(`Foco en un solo hábito: ${weak.name}, todos los días.`);
  if (before || spent) { const cap = Math.round(((spent + before) / 2) / 100) * 100; if (cap > 0) plan.push(`Gasto: intenta no pasar de ${eur(cap)} la semana que viene.`); }
  const ev = (nextWeekEvents ?? []).filter((e) => !String(e.title ?? "").startsWith("🎂"));
  if (ev.length) plan.push(`Tienes ${plural(ev.length, "cosa", "cosas")} en la agenda la semana que viene; la primera: ${ev[0].title}${ev[0].label ? ` (${ev[0].label})` : ""}.`);

  return { week: weekKey(now), from: days[0], to: days[6], wins, improve, plan, empty: !wins.length && !improve.length && !plan.length };
}

// «2026-W40»: the ISO week, to mark the weekly review as seen.
export function weekKey(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / DAY + 1) / 7);
  return `${y}-W${pad(w)}`;
}

// When the cards show on Hoy.
export const nightDue = (now, reviewedDay) => now.getHours() >= 20 && reviewedDay !== dayKey(now);
// Sunday from 18:00 until Monday at 14:00, once per week.
export function weekDue(now, seenWeek) {
  const sun = now.getDay() === 0 && now.getHours() >= 18;
  const mon = now.getDay() === 1 && now.getHours() < 14;
  const key = weekKey(sun ? now : addDays(now, -1));
  return (sun || mon) && seenWeek !== key ? key : null;
}
