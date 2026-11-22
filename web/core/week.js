// La semana (WEB-121, misión maestra ideas 01, 06, 10, 12, 13): ver los próximos 7 días con cada
// cosa por lo que ES, reservar tiempo sin compromisos y preparar la semana en 10 minutos o a fondo.
//
// Tipos (nunca se mezclan ni se presentan como otra cosa):
//   evento     → está en un calendario (Google, pegado o cumpleaños de Personas): un hecho.
//   recordatorio → lo puso Manu.
//   tarea      → pendiente sin hora.
//   reservado  → tiempo que Manu se guarda para nada (o para una afición). No es un hueco libre.
//   propuesta  → algo que MANU cree que tiene fecha (relate.js): una suposición hasta que Manu la acepta.
// Los huecos libres NO se rellenan: MANU solo señala conflictos y días muy cargados, y propone,
// como mucho, proteger un rato. Nunca escribe a nadie (las respuestas se preparan para que Manu
// las copie y las mande él).
import { conexiones } from "./relate.js";

const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? "")); return m ? +m[1] * 60 + +m[2] : null; };
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// ---------- Tiempo reservado ----------
export const RESERVE_KINDS = { descanso: "Descanso, sin planes", aficion: "Para una afición", nada: "Sin compromisos" };
/** Valida un bloque reservado: un día concreto (YYYY-MM-DD) o cada semana (weekday 0–6). */
export function newReserve({ id, day = null, weekday = null, from = "18:00", to = "21:00", kind = "descanso", label = "" }) {
  const f = toMin(from), t = toMin(to);
  if (f === null || t === null || t <= f) throw new Error("Pon una hora de inicio y otra de fin posterior");
  const hasDay = /^\d{4}-\d{2}-\d{2}$/.test(String(day ?? ""));
  const wd = Number.isInteger(+weekday) && weekday !== null && weekday !== "" && +weekday >= 0 && +weekday <= 6 ? +weekday : null;
  if (!hasDay && wd === null) throw new Error("Elige un día o un día de la semana");
  return { id, ...(hasDay ? { day } : { weekday: wd }), from: `${pad(Math.floor(f / 60))}:${pad(f % 60)}`, to: `${pad(Math.floor(t / 60))}:${pad(t % 60)}`, kind: RESERVE_KINDS[kind] ? kind : "descanso", label: String(label ?? "").replace(/\s+/g, " ").trim().slice(0, 60) };
}
export const reservesOn = (reserves, d) => (reserves ?? []).filter((r) => r.day === dayKey(d) || (r.day === undefined && r.weekday === d.getDay()));

/** ¿Choca un evento con un bloque reservado? */
const overlaps = (ev, r) => { const s = toMin(ev.time), e = toMin(ev.end) ?? (s === null ? null : s + 60); if (s === null) return false; return s < toMin(r.to) && e > toMin(r.from); };

// ---------- La semana ----------
/**
 * Siete días desde `start`. `eventsFor(dayKey)` da los eventos de calendario de ese día.
 * Devuelve [{ key, label, items: [{ type, time, title, ...}], load, conflicts: [], heavy }].
 */
export function weekView(v, start = new Date(), { eventsFor = () => [], days = 7 } = {}) {
  const base = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const props = conexiones(v, start, { dismissed: v?.settings?.relDismissed ?? [], max: 50 }).filter((c) => c.kind === "agenda");
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(base); d.setDate(base.getDate() + i);
    const key = dayKey(d);
    const items = [];
    for (const ev of eventsFor(key) ?? []) items.push({ type: "evento", time: ev.time ?? null, end: ev.end ?? null, title: ev.title, calendar: ev.calendar ?? null });
    for (const r of v?.reminders ?? []) if (!r.done && dayKey(new Date(r.at)) === key) { const t = new Date(r.at); items.push({ type: "recordatorio", time: `${pad(t.getHours())}:${pad(t.getMinutes())}`, title: r.text, id: r.id }); }
    const reserves = reservesOn(v?.settings?.reserved, d);
    for (const r of reserves) items.push({ type: "reservado", time: r.from, end: r.to, title: r.label || RESERVE_KINDS[r.kind], id: r.id, kind: r.kind });
    for (const p of props) if (dayKey(new Date(p.at)) === key) items.push({ type: "propuesta", time: p.allDay ? null : `${pad(new Date(p.at).getHours())}:${pad(new Date(p.at).getMinutes())}`, title: p.title, key: p.key, why: p.why });
    items.sort((a, b) => (a.time ?? "00:00").localeCompare(b.time ?? "00:00"));
    const events = items.filter((x) => x.type === "evento" && x.time);
    const conflicts = [];
    for (const r of reserves) for (const ev of events) if (overlaps(ev, r)) conflicts.push({ event: ev.title, reserve: r.label || RESERVE_KINDS[r.kind], from: r.from, to: r.to });
    const busyMin = events.reduce((s, ev) => s + Math.max(30, (toMin(ev.end) ?? toMin(ev.time) + 60) - toMin(ev.time)), 0);
    const load = items.filter((x) => x.type === "evento" || x.type === "recordatorio").length;
    out.push({ key, date: d, label: i === 0 ? "Hoy" : i === 1 ? "Mañana" : `${DAYS[d.getDay()]} ${d.getDate()}`, items, conflicts, load, busyMin, heavy: load >= 5 || busyMin >= 6 * 60, rest: reserves.length > 0 });
  }
  return out;
}

/**
 * Ajustes razonables para una semana cargada. Solo propone; nunca mueve ni cancela nada.
 * - Conflicto con tiempo reservado → «decide cuál se queda» (y Manu prepara la respuesta).
 * - 3+ días cargados sin ningún rato reservado → proteger una tarde.
 */
export function weekAdvice(week) {
  const out = [];
  for (const d of week) for (const c of d.conflicts) out.push({ kind: "conflicto", day: d.key, text: `${d.label}: «${c.event}» choca con tu rato reservado (${c.from}–${c.to}). Tú decides cuál se queda.` });
  const heavy = week.filter((d) => d.heavy);
  if (heavy.length >= 3 && !week.some((d) => d.rest)) {
    const calm = week.find((d) => !d.heavy && d.date.getDay() !== 0 && d.date.getDay() !== 6) ?? week.find((d) => !d.heavy);
    out.push({ kind: "proteger", day: calm?.key ?? null, text: `Semana cargada (${heavy.length} días llenos) y sin ningún rato para ti. ${calm ? `¿Reservas la tarde del ${calm.label.toLowerCase()} sin planes?` : "¿Reservas un rato sin planes?"}` });
  }
  return out;
}

/** Respuesta para decir que no, lista para que Manu la copie. Sin excusas inventadas. */
export function declineText(title, { tone = "neutro" } = {}) {
  const t = String(title ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const lines = {
    neutro: `Hola. Gracias por contar conmigo${t ? ` para «${t}»` : ""}, pero esta vez no puedo. ¿Lo vemos otro día?`,
    corto: `Esta vez no puedo${t ? ` (${t})` : ""}. ¡Gracias!`,
    mover: `Hola. ${t ? `Lo de «${t}» ` : "Eso "}me encaja mal ese día. ¿Podemos moverlo?`,
  };
  return lines[tone] ?? lines.neutro;
}

// ---------- Preparar la semana (rápido o completo) ----------
/**
 * Reúne lo que importa para la semana que empieza. `mode` = "rapido" (5 bloques, 3 cosas cada uno)
 * o "completo" (todo). Cada bloque dice de dónde sale. Nada se inventa: si no hay datos, bloque vacío.
 */
export function prepareWeek(v, now = new Date(), { mode = "rapido", eventsFor = () => [], recurring = [] } = {}) {
  const n = mode === "rapido" ? 3 : 50;
  const week = weekView(v, now, { eventsFor });
  const citas = week.flatMap((d) => d.items.filter((x) => x.type === "evento" || x.type === "recordatorio").map((x) => `${d.label}${x.time ? ` ${x.time}` : ""} · ${x.title}`));
  const tareas = (v?.inbox ?? []).filter((i) => i.status === "TASK" && !i.done).sort((a, b) => String(a.at).localeCompare(String(b.at))).map((i) => i.text);
  const end = new Date(now.getTime() + 30 * 864e5);
  const docs = (v?.docs ?? []).filter((d) => d.expires && new Date(`${d.expires}T12:00:00`) >= now && new Date(`${d.expires}T12:00:00`) <= end).sort((a, b) => a.expires.localeCompare(b.expires)).map((d) => `${d.title} · vence el ${+d.expires.slice(8)}/${+d.expires.slice(5, 7)}`);
  const pagos = (recurring ?? []).map((r) => `${r.label ?? r.merchant}${r.nextDay ? ` · hacia el ${r.nextDay}` : ""}`);
  const ideas = (v?.inbox ?? []).filter((i) => i.status === "IDEA" && !i.done && !i.filed).sort((a, b) => String(b.at).localeCompare(String(a.at))).map((i) => i.text);
  const proyectos = (v?.projects ?? []).filter((p) => !p.archived).map((p) => p.name);
  const libre = week.filter((d) => d.rest).map((d) => `${d.label}: ${d.items.filter((x) => x.type === "reservado").map((x) => `${x.time}–${x.end}`).join(", ")}`);
  const blocks = [
    { key: "citas", title: "Citas y compromisos", items: citas, from: "Agenda y recordatorios" },
    { key: "tareas", title: "Tareas pendientes", items: tareas, from: "Tus tareas abiertas" },
    { key: "docs", title: "Documentos con fecha (30 días)", items: docs, from: "Documentos" },
    { key: "pagos", title: "Pagos que suelen llegar", items: pagos, from: "Cargos repetidos detectados en Dinero (estimación)" },
    { key: "libre", title: "Tu tiempo reservado", items: libre, from: "Tus ratos reservados" },
  ];
  if (mode === "completo") blocks.push(
    { key: "ideas", title: "Ideas aparcadas", items: ideas, from: "Ideas sin proyecto" },
    { key: "proyectos", title: "Proyectos", items: proyectos, from: "Proyectos" },
  );
  return { mode, minutes: mode === "rapido" ? 10 : null, advice: weekAdvice(week), blocks: blocks.map((b) => ({ ...b, total: b.items.length, items: b.items.slice(0, n) })) };
}
