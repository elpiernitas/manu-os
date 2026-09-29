// «Tu diario» (WEB-41): one archive document per day with what went through
// MANU (money, tasks, ideas, reminders, agenda, mood, habits, meals, health).
// Built on the device from the vault; stored with «Tu archivo» (IndexedDB),
// so MANU can answer «¿qué hice el martes?» and recall it in conversation.
import { euros } from "./money.js";
import { normalise } from "./text.js";

const MOOD = ["", "Mal", "Regular", "Bien", "Muy bien"];
const pad = (n) => String(n).padStart(2, "0");
export const dayKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localDayOf = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : dayKeyOf(d); };
const hm = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const dayTitle = (day) => { const [y, m, d] = day.split("-").map(Number); const dt = new Date(y, m - 1, d); return `${WEEKDAYS[dt.getDay()]} ${d} de ${MONTHS[m - 1]} de ${y}`; };

// The lines of one day. Empty array when nothing happened.
export function dayLines(vault, day, { calendar = null } = {}) {
  const on = (x) => x?.at && localDayOf(x.at) === day;
  const lines = [];
  const spent = (vault.spending ?? []).filter(on);
  if (spent.length) lines.push(`Gastos (${euros(spent.reduce((s, x) => s + (x.cents ?? 0), 0))}): ${spent.slice(0, 20).map((x) => `${euros(x.cents)} ${x.merchant ?? "sin concepto"}`).join("; ")}.`);
  const inc = (vault.income ?? []).filter(on);
  if (inc.length) lines.push(`Ingresos: ${inc.slice(0, 10).map((x) => `${euros(x.cents)} ${x.concept ?? ""}`.trim()).join("; ")}.`);
  const items = (vault.inbox ?? []).filter(on);
  const tasks = items.filter((i) => i.status === "TASK"), ideas = items.filter((i) => i.status === "IDEA");
  if (tasks.length) lines.push(`Tareas apuntadas: ${tasks.slice(0, 15).map((t) => `${t.text}${t.done ? " (hecha)" : ""}`).join("; ")}.`);
  if (ideas.length) lines.push(`Ideas: ${ideas.slice(0, 15).map((t) => t.text).join("; ")}.`);
  const rems = (vault.reminders ?? []).filter(on);
  if (rems.length) lines.push(`Recordatorios: ${rems.slice(0, 15).map((r) => `${hm(r.at)} ${r.text}`).join("; ")}.`);
  const events = calendar?.[day] ?? (vault.agenda?.day === day ? vault.agenda.events : null) ?? [];
  if (events.length) lines.push(`Agenda: ${events.slice(0, 15).map((e) => `${e.time ?? "todo el día"} ${e.title}`).join("; ")}.`);
  const mood = (vault.moods ?? []).find((m) => m.day === day)?.value;
  if (mood) lines.push(`Ánimo: ${MOOD[mood] ?? mood}.`);
  const habits = (vault.habits ?? []).filter((h) => (h.done ?? []).includes(day)).map((h) => h.name);
  if (habits.length) lines.push(`Hábitos hechos: ${habits.join(", ")}.`);
  const meals = (vault.meals ?? []).filter((m) => m.day === day);
  if (meals.length) lines.push(`Comidas: ${meals.slice(0, 10).map((m) => `${m.time ?? ""} ${m.text}`.trim()).join("; ")}.`);
  const health = (vault.health ?? []).filter((h) => h.day === day);
  if (health.length) lines.push(`Salud: ${health.map((h) => `${h.kind} ${h.value}`).join(", ")}.`);
  const places = (vault.places ?? []).filter(on);
  if (places.length) lines.push(`Lugares: ${places.slice(0, 12).map((x) => `${hm(x.at)} ${x.text}`).join("; ")}.`);
  return lines;
}

// Every day with something, from the oldest data up to today (max `limit`).
export function diaryDocs(vault, { now = new Date(), limit = 400, calendar = null } = {}) {
  const days = new Set();
  for (const list of [vault.spending, vault.income, vault.inbox, vault.reminders, vault.places]) for (const x of list ?? []) { const d = x?.at && localDayOf(x.at); if (d) days.add(d); }
  for (const x of vault.moods ?? []) if (x.day) days.add(x.day);
  for (const x of vault.meals ?? []) if (x.day) days.add(x.day);
  for (const x of vault.health ?? []) if (x.day) days.add(x.day);
  for (const h of vault.habits ?? []) for (const d of h.done ?? []) days.add(d);
  for (const d of Object.keys(calendar ?? {})) days.add(d);
  const today = dayKeyOf(now);
  return [...days].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today).sort().slice(-limit)
    .map((day) => ({ day, lines: dayLines(vault, day, { calendar }) }))
    .filter((x) => x.lines.length)
    .map(({ day, lines }) => ({ id: `diario:${day}`, source: "diario", title: `Diario del ${dayTitle(day)}`, at: new Date(`${day}T12:00:00`).getTime(), day, messages: lines.map((text) => ({ role: "me", text })) }));
}

// «ayer», «anteayer», «hoy», «el lunes», «el 12», «el 12 de septiembre», «12/9».
export function dayFromText(text, now = new Date()) {
  const t = normalise(text);
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = (n) => { const d = new Date(base); d.setDate(d.getDate() - n); return dayKeyOf(d); };
  if (/\banteayer\b/.test(t)) return shift(2);
  if (/\bayer\b/.test(t)) return shift(1);
  if (/\bhoy\b/.test(t)) return shift(0);
  const wd = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"].findIndex((w) => new RegExp(`\\b(el |este |el pasado )?${w}( pasado)?\\b`).test(t));
  if (wd >= 0) { const back = (base.getDay() - wd + 7) % 7 || 7; return shift(back); }
  const m = t.match(/\b(\d{1,2})(?: de ([a-z]+)|\/(\d{1,2}))?\b/);
  if (m && /\b(el|dia)\s+\d/.test(t) || (m && (m[2] || m[3]))) {
    const day = Number(m[1]);
    let month = m[2] ? MONTHS.map((x) => normalise(x)).indexOf(m[2]) : m[3] ? Number(m[3]) - 1 : base.getMonth();
    if (month < 0 || day < 1 || day > 31) return null;
    let d = new Date(base.getFullYear(), month, day);
    if (d > base) d = new Date(base.getFullYear() - 1, month, day);
    return dayKeyOf(d);
  }
  return null;
}

// «¿Qué hice ayer?», «¿qué pasó el martes?», «¿cuánto gasté el 12?».
export const isDiaryQuestion = (text) => /(que hice|que paso|que tal fue|que tal el|como fue|resumen de|cuanto gaste|que gaste|que apunte|mi dia|mi diario)/.test(normalise(text)) && dayFromText(text) !== null;
