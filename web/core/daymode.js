// Franjas del día para Hoy (WEB-115): Hoy cambia de contenido con la hora, nunca de colores.
// Se apoya en modes.js (el horario de Manu) y en el cierre de jornada (closing.js).
// - Mañana, Trabajo (L–V 09:00–13:00), Desconexión (tras las 13:00, hasta cerrar la jornada o
//   2 horas), Tarde, Noche y Fin de semana.
// - Las tareas de trabajo (`work: true`) solo se ven en días laborables, de la mañana al cierre.
// - El fin de semana Manu aún decide si descansa o lo usa: se le pregunta cada fin de semana.
// Puro: reloj, horario y ajustes entran como datos.
import { modeState, DEFAULT_SCHEDULE } from "./modes.js";
import { CLOSING_WINDOW } from "./closing.js";

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const FRANJAS = {
  MORNING: { title: "Mañana", hint: "Lo de hoy, para arrancar" },
  WORK: { title: "Trabajo", hint: "Solo lo de trabajo; lo tuyo, a la salida" },
  DISCONNECT: { title: "Desconexión", hint: "Cierra la jornada y suelta el trabajo" },
  AFTERNOON: { title: "Tarde", hint: "Lo tuyo" },
  NIGHT: { title: "Noche", hint: "Mañana y poco más" },
  WEEKEND: { title: "Fin de semana", hint: "Sin trabajo" },
};

/** «2026-W47» del sábado/domingo: la clave de un fin de semana. */
export function weekendKey(now) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d.getDay() === 0) d.setDate(d.getDate() - 1); // el domingo es del mismo fin de semana que el sábado
  return dayKey(d);
}

/**
 * @param {Date} now
 * @param {{schedule?, override?, closedDay?, weekendPlans?}} o
 * @returns {{key, title, hint, showsWork, weekendPlan: "descanso"|"proyectos"|null}}
 */
export function franja(now, { schedule = DEFAULT_SCHEDULE, override = null, closedDay = null, weekendPlans = {} } = {}) {
  const m = modeState(now, schedule, override);
  const mins = now.getHours() * 60 + now.getMinutes();
  let key = m.mode;
  if (key === "AFTERNOON" && closedDay !== dayKey(now) && mins < schedule.workEnd + CLOSING_WINDOW && mins >= schedule.workEnd) key = "DISCONNECT";
  const workDay = schedule.workDays.includes(((now.getDay() + 6) % 7) + 1);
  const isWeekend = !workDay;
  // El trabajo se ve en un día laborable desde la mañana hasta que se cierra la jornada.
  const showsWork = workDay && closedDay !== dayKey(now) && key !== "NIGHT" && (key === "MORNING" || key === "WORK" || key === "DISCONNECT");
  const plan = isWeekend ? (weekendPlans?.[weekendKey(now)] ?? null) : null;
  const f = FRANJAS[isWeekend && key !== "NIGHT" ? "WEEKEND" : key];
  return { key: isWeekend && key !== "NIGHT" ? "WEEKEND" : key, title: f.title, hint: plan === "descanso" ? "Toca descansar" : plan === "proyectos" ? "Para tus cosas" : f.hint, showsWork, weekend: isWeekend, weekendPlan: plan };
}

/** Las tareas que se ven ahora: las de trabajo solo cuando toca. */
export const visibleTasks = (tasks, f) => (tasks ?? []).filter((t) => f.showsWork || !t.work);
/** Cuántas de trabajo esperan (para decirlo en una línea, sin enseñarlas). */
export const hiddenWork = (tasks, f) => (f.showsWork ? 0 : (tasks ?? []).filter((t) => t.work && !t.done).length);

// ---------- Dinero en una línea, con el humor justo ----------
const eur = (c) => `${(c / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pick = (list, seed) => list[((seed % list.length) + list.length) % list.length];
// humor: 0 sobrio, 1 natural (por defecto), 2 con chispa. Nunca juzga: compara y ya.
const MONEY = {
  less: [["Un {p} % menos que el mes pasado a estas alturas."], ["Un {p} % menos que el mes pasado a estas alturas. Bien llevado.", "Un {p} % menos que el mes pasado por estas fechas."], ["Un {p} % menos que el mes pasado a estas alturas. La cartera respira.", "Un {p} % menos que el mes pasado. Ni lo has notado y ahí está."]],
  same: [["Igual que el mes pasado a estas alturas."], ["Como el mes pasado a estas alturas: ni sustos ni milagros.", "Igual que el mes pasado por estas fechas."], ["Calcado al mes pasado: ni sustos ni milagros.", "Igual que el mes pasado. Constante como el orbayu."]],
  more: [["Un {p} % más que el mes pasado a estas alturas."], ["Un {p} % más que el mes pasado a estas alturas. Solo para que lo sepas.", "Un {p} % más que el mes pasado por estas fechas; sin drama."], ["Un {p} % más que el mes pasado a estas alturas. Sin drama, solo el dato.", "Un {p} % más que el mes pasado. Lo dejo aquí y no digo nada más."]],
};
/**
 * @param {{consumo:number, fiable:boolean, pending:{cents:number}}} s  summary del mes (ledger)
 * @param {number|null} diff  % frente al mes pasado a estas alturas (monthPace) o null
 */
export function moneyLine(s, diff, { humor = 1, seed = 0 } = {}) {
  if (!s) return null;
  const h = Math.max(0, Math.min(2, Number(humor ?? 1)));
  if (!s.fiable) return `Llevas ${eur(s.consumo)} este mes, pero es provisional: hay ${eur(s.pending.cents)} sin atribuir.`;
  if (diff === null || diff === undefined) return `Llevas ${eur(s.consumo)} este mes.`;
  const kind = diff <= -10 ? "less" : diff >= 10 ? "more" : "same";
  return `Llevas ${eur(s.consumo)} este mes. ${pick(MONEY[kind][h], seed).replace("{p}", String(Math.abs(Math.round(diff))))}`;
}
