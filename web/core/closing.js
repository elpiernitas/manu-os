// Cierre de jornada (WEB-63). Manu works 9:00–13:00 on weekdays. At 13:00
// MANU closes the day for him: what he finished, what waits for tomorrow and
// the first thing tomorrow, so he can let work go until the next morning.
// Pure: everything comes from the vault, the schedule and the clock.
import { DEFAULT_SCHEDULE } from "./modes.js";
import { normalise } from "./text.js";

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameDay = (iso, d) => { const x = new Date(iso); return !Number.isNaN(x.getTime()) && dayKey(x) === dayKey(d); };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const CLOSING_WINDOW = 120; // minutes after workEnd the card stays up

const isWorkDay = (now, schedule) => schedule.workDays.includes(((now.getDay() + 6) % 7) + 1);
const minutes = (now) => now.getHours() * 60 + now.getMinutes();

// Is it closing time? Workday, between workEnd and workEnd + CLOSING_WINDOW,
// and not closed yet today.
export function closingDue(now, { schedule = DEFAULT_SCHEDULE, closedDay = null } = {}) {
  if (!isWorkDay(now, schedule) || closedDay === dayKey(now)) return false;
  const m = minutes(now);
  return m >= schedule.workEnd && m < schedule.workEnd + CLOSING_WINDOW;
}

/**
 * @param {object} x
 * @param {Date} x.now
 * @param {Array} x.inbox      vault.inbox (tasks with done/doneAt)
 * @param {Array} x.tomorrow   events of the next working day [{time,title}]
 * @param {Array} x.reminders  vault.reminders
 * @returns {{ done: string[], open: string[], openCount: number, first: string|null, lines: Array<{e,t}> }}
 */
export function workClosing({ now = new Date(), inbox = [], tomorrow = [], reminders = [], schedule = DEFAULT_SCHEDULE } = {}) {
  const next = nextWorkDay(now, schedule);
  const label = next.gap === 1 ? "mañana" : `el ${next.date.toLocaleDateString("es-ES", { weekday: "long" })}`;
  const tasks = (inbox ?? []).filter((i) => i.status === "TASK" && i.text);
  const done = tasks.filter((i) => i.done && i.doneAt && sameDay(i.doneAt, now)).map((i) => i.text);
  const openAll = tasks.filter((i) => !i.done).sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
  const open = openAll.slice(0, 3).map((i) => i.text);
  const ev = (tomorrow ?? []).filter((e) => !String(e.title ?? "").startsWith("🎂")).find((e) => e.time) ?? null;
  const rem = (reminders ?? []).filter((r) => !r.done && sameDay(r.at, next.date)).sort((a, b) => a.at.localeCompare(b.at))[0] ?? null;
  const remTime = rem ? `${pad(new Date(rem.at).getHours())}:${pad(new Date(rem.at).getMinutes())}` : null;
  const first = ev && (!rem || ev.time <= remTime) ? `${ev.time} ${ev.title}` : rem ? `${remTime} ${rem.text}` : null;

  const lines = [];
  lines.push(done.length
    ? { e: "✅", t: `Hoy has terminado ${plural(done.length, "tarea", "tareas")}: ${done.slice(0, 3).join(", ")}${done.length > 3 ? "…" : "."}` }
    : { e: "✅", t: "Hoy no has tachado nada. No pasa nada: apunta lo que hiciste si quieres acordarte." });
  if (openAll.length) lines.push({ e: "📌", t: `Queda para ${label}: ${open.join(", ")}${openAll.length > 3 ? ` y ${openAll.length - 3} más` : ""}.` });
  if (first) lines.push({ e: "🌅", t: `Lo primero ${label}: ${first}.` });
  return { done, open, openCount: openAll.length, first, label, lines };
}

// The next working day after `now` (Friday → Monday). `gap` in days.
export function nextWorkDay(now, schedule = DEFAULT_SCHEDULE) {
  for (let gap = 1; gap <= 7; gap++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + gap);
    if (isWorkDay(d, schedule)) return { date: d, gap, key: dayKey(d) };
  }
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { date: d, gap: 1, key: dayKey(d) };
}

export const closingText = (c) => ["🏁 Cierre de jornada", ...c.lines.map((l) => `${l.e} ${l.t}`), "", `Desconecta: el trabajo se queda aquí hasta ${c.label}.`].join("\n");

// «cierra la jornada», «he terminado de currar», «salgo del trabajo».
export function isClosingQuestion(text) {
  const t = normalise(text).replace(/[¿?¡!.,]+/g, " ").replace(/\s+/g, " ").trim();
  return /^(cierra(r)? (la )?jornada|cierre( de jornada| del dia| de hoy)?|fin de (la )?jornada)( manu)?$/.test(t)
    || /^(ya )?(he terminado|termine|acabe|he acabado|salgo|he salido) (de (currar|trabajar)|del (curro|trabajo))( ya)?$/.test(t);
}
