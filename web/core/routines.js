// Rutinas de trabajo (WEB-117): tareas que se repiten (semanal, mensual o trimestral) y que
// MANU apunta solas el día que tocan, como tareas de trabajo (💼). Una vez por periodo: si Manu
// la borra o la completa, no vuelve hasta el periodo siguiente. Puro: reloj y vault como datos.
//
// vault.routines = [{ id, text, every: "weekly"|"monthly"|"quarterly", weekday?: 1-7 (lunes=1),
//                     on: bool }]   (mensual y trimestral: el último día laborable del periodo)
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const iso = (d) => ((d.getDay() + 6) % 7) + 1; // lunes=1 … domingo=7
export const EVERY = { weekly: "Cada semana", monthly: "Cada mes (último día laborable)", quarterly: "Cada trimestre (último día laborable)" };
export const WEEKDAYS = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

// Propuestas para su trabajo de marketing (las confirma y ajusta él; nada se activa solo).
export const MARKETING_PRESETS = [
  { key: "vendidos", text: "Piezas de vendidos de la semana para el grupo", every: "weekly", weekday: 5 },
  { key: "resenas", text: "Historias con las reseñas de la semana", every: "weekly", weekday: 3 },
  { key: "precio", text: "Informe de precio por zona", every: "monthly" },
];

/** El último día laborable (lunes a viernes) de un mes. */
export function lastWorkday(year, month) {
  const d = new Date(year, month + 1, 0);
  while (iso(d) > 5) d.setDate(d.getDate() - 1);
  return d;
}

/** La clave del periodo al que pertenece `now` para una rutina («2026-W47», «2026-11», «2026-Q4»). */
export function periodKey(r, now) {
  if (r.every === "weekly") {
    const t = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dow = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dow);
    const y = t.getUTCFullYear();
    return `${y}-W${pad(Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7))}`;
  }
  if (r.every === "monthly") return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
}

/** ¿Toca hoy? Semanal: el día de la semana elegido. Mensual/trimestral: el último laborable. */
export function dueOn(r, now) {
  if (!r?.on) return false;
  if (r.every === "weekly") return iso(now) === (r.weekday ?? 1);
  const last = lastWorkday(now.getFullYear(), now.getMonth());
  if (dayKey(last) !== dayKey(now)) return false;
  return r.every === "monthly" || (now.getMonth() % 3 === 2);
}

/**
 * Las tareas nuevas que hay que apuntar hoy. No repite una rutina ya apuntada en su periodo
 * (aunque se haya completado o borrado: `done` guarda la marca).
 * @returns {{ tasks: Array, done: object }}  done = { [routineId]: periodKey }
 */
export function routineTasks(routines, now, { done = {}, uid = () => Math.random().toString(36).slice(2) } = {}) {
  const tasks = [];
  const next = { ...done };
  for (const r of routines ?? []) {
    if (!dueOn(r, now)) continue;
    const k = periodKey(r, now);
    if (next[r.id] === k) continue;
    next[r.id] = k;
    tasks.push({ id: uid(), text: String(r.text).slice(0, 140), status: "TASK", work: true, routine: r.id, at: now.toISOString() });
  }
  return { tasks, done: next };
}

export function newRoutine({ id, text, every = "weekly", weekday = 1 }) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  if (!t) throw new Error("Escribe qué hay que hacer");
  if (!EVERY[every]) throw new Error("Frecuencia no válida");
  return { id, text: t, every, ...(every === "weekly" ? { weekday: Math.min(7, Math.max(1, Number(weekday) || 1)) } : {}), on: true };
}

export const routineWhen = (r) => (r.every === "weekly" ? `Cada ${WEEKDAYS[r.weekday ?? 1]}` : EVERY[r.every]);
