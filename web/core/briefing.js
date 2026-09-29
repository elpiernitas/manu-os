// «Tu día de un vistazo» (WEB-46): what matters today in a few lines, without
// Manu typing anything. Morning and afternoon look ahead; from 20:00 it reviews
// the day and previews tomorrow. Pure: every input comes from the vault.
import { euros } from "./money.js";

const pad = (n) => String(n).padStart(2, "0");
const hm = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const sameDay = (iso, d) => { const x = new Date(iso); return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate(); };

// Spending of this month up to now vs the same days of last month.
export function monthPace(spending, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const daysInPrev = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const prevCut = new Date(prevStart.getFullYear(), prevStart.getMonth(), Math.min(now.getDate(), daysInPrev), now.getHours(), now.getMinutes()).getTime();
  let cur = 0, prev = 0;
  for (const s of spending ?? []) {
    const t = Date.parse(s.at);
    if (t >= start && t <= now.getTime()) cur += s.cents;
    else if (t >= prevStart.getTime() && t <= prevCut) prev += s.cents;
  }
  const diff = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
  return { cur, prev, diff };
}

const eventText = (e) => (e.time ? `${e.time} ${e.title}` : `${e.title} (todo el día)`);
// Birthdays have their own line: they are not repeated as «events».
const realEvents = (list) => (list ?? []).filter((e) => !String(e.title ?? "").startsWith("🎂"));

/**
 * @param {object} x
 * @param {Date} x.now
 * @param {object|null} x.weather   parsed forecast (weather.js) or null
 * @param {string|null} x.advice    advice(forecast) or null
 * @param {Array} x.today           events today [{time,title}]
 * @param {Array} x.tomorrow        events tomorrow
 * @param {Array} x.reminders       vault.reminders
 * @param {Array} x.tasks           open tasks
 * @param {Array} x.birthdays       upcomingBirthdays(...) within 1 day
 * @param {Array} x.spending        vault.spending
 * @param {Array} x.inbox           vault.inbox (to count tasks done today)
 * @param {number} x.importantMail  unread important mails (or 0)
 */
export function briefing({ now = new Date(), weather = null, advice = null, today = [], tomorrow = [], reminders = [], tasks = [], birthdays = [], spending = [], inbox = [], importantMail = 0, budgetAlerts = [] }) {
  const h = now.getHours();
  const evening = h >= 20 || h < 5;
  const lines = [];
  const nowMs = now.getTime();
  const pendingToday = (reminders ?? []).filter((r) => !r.done && sameDay(r.at, now) && Date.parse(r.at) >= nowMs).sort((a, b) => a.at.localeCompare(b.at));
  today = realEvents(today); tomorrow = realEvents(tomorrow);
  const upcoming = today.filter((e) => !e.time || e.time >= `${pad(h)}:${pad(now.getMinutes())}`);

  if (!evening) {
    if (advice) lines.push({ e: weather?.today?.rain >= 50 ? "☔" : "🌤️", t: advice });
    if (upcoming.length) lines.push({ e: "🗓️", t: upcoming.length === 1 ? `Hoy tienes ${eventText(upcoming[0])}.` : `${plural(upcoming.length, "evento", "eventos")} hoy; el próximo: ${eventText(upcoming[0])}.` });
    else if ((today ?? []).length) lines.push({ e: "🗓️", t: "Ya no te queda nada en la agenda de hoy." });
    if (pendingToday.length) lines.push({ e: "🔔", t: pendingToday.length === 1 ? `A las ${hm(pendingToday[0].at)}: ${pendingToday[0].text}.` : `${plural(pendingToday.length, "recordatorio", "recordatorios")}; el primero a las ${hm(pendingToday[0].at)}: ${pendingToday[0].text}.` });
    if ((tasks ?? []).length) lines.push({ e: "✅", t: `${plural(tasks.length, "tarea pendiente", "tareas pendientes")}${tasks.length ? `: ${tasks[0].text}${tasks.length > 1 ? "…" : "."}` : "."}` });
  } else {
    const spentToday = (spending ?? []).filter((s) => sameDay(s.at, now));
    const doneToday = (inbox ?? []).filter((i) => i.status === "TASK" && i.done && i.doneAt && sameDay(i.doneAt, now));
    lines.push({ e: "🧾", t: spentToday.length ? `Hoy has gastado ${euros(spentToday.reduce((s, x) => s + x.cents, 0))} en ${plural(spentToday.length, "compra", "compras")}.` : "Hoy no has apuntado gastos." });
    if (doneToday.length) lines.push({ e: "✅", t: `Has terminado ${plural(doneToday.length, "tarea", "tareas")}. Bien.` });
    if ((tomorrow ?? []).length) lines.push({ e: "🌅", t: `Mañana: ${eventText(tomorrow[0])}${tomorrow.length > 1 ? ` y ${plural(tomorrow.length - 1, "cosa más", "cosas más")}` : ""}.` });
    else lines.push({ e: "🌅", t: "Mañana no tienes nada en la agenda." });
    const tw = weather?.days?.[1];
    if (tw) lines.push({ e: tw.rain >= 50 ? "☔" : "🌤️", t: `Mañana ${tw.min}°–${tw.max}°${tw.rain >= 30 ? `, lluvia ${tw.rain} %` : ""}.` });
  }
  for (const b of birthdays ?? []) if (b.days <= 1) lines.push({ e: "🎂", t: `${b.person.name} cumple ${b.days === 0 ? "hoy" : "mañana"}.` });
  if (importantMail > 0 && !evening) lines.push({ e: "📬", t: `${plural(importantMail, "correo importante", "correos importantes")} sin leer.` });
  // WEB-47: budgets that are over or going too fast (already worded).
  for (const t of budgetAlerts ?? []) lines.push({ e: "🎯", t });
  const pace = monthPace(spending, now);
  if (pace.cur > 0 && !evening) lines.push({ e: "💶", t: `Llevas ${euros(pace.cur)} este mes${pace.diff === null ? "." : pace.diff === 0 ? ", igual que el mes pasado a estas alturas." : `, un ${Math.abs(pace.diff)} % ${pace.diff < 0 ? "menos" : "más"} que el mes pasado a estas alturas.`}` });
  return { title: evening ? "Tu día, en resumen" : "Tu día de un vistazo", evening, lines: lines.slice(0, 7) };
}

export const briefingText = (b) => `${b.title}:\n${b.lines.map((l) => `${l.e} ${l.t}`).join("\n")}`;
export const isBriefingQuestion = (t) => /(resumen del dia|resumeme el dia|resumen de hoy|como va mi dia|como va el dia|que tal voy|mi dia de un vistazo|buenos dias manu|como ha ido (el|mi) dia)/.test(t);
