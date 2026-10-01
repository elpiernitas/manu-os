// «¿Qué hago ahora?» (WEB-58): the heart of MANU OS. Manu doesn't want
// another list to keep tidy; he wants to open MANU and know the next thing.
// One clear suggestion with its reason, plus up to two alternatives. Pure:
// everything comes from the vault and the clock.
import { normalise } from "./text.js";

const pad = (n) => String(n).padStart(2, "0");
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DAY = 86400000;

// Things that help him when he's low, in his own words (from his answers).
export const LIFTS = [
  "Ponte música que te guste y sal a caminar un rato, aunque sea a la cinta.",
  "Escribe a alguien con quien estés a gusto y quedad, aunque sea un café.",
  "Sal de casa sin plan: una vuelta por el Muro o Cimadevilla.",
  "Ponte un capítulo de algo que te enganche (¿Loki otra vez?).",
  "Haz algo creativo de 15 minutos: una idea en la libreta, un diseño, lo que sea.",
];

// When a project was last touched: its creation, sources or chat.
export function lastTouched(p) {
  const ts = [p.createdAt, p.updatedAt, ...(p.sources ?? []).map((s) => s.at), ...(p.chat ?? []).map((c) => c.at)]
    .map((x) => Date.parse(x ?? "")).filter((x) => !Number.isNaN(x));
  return ts.length ? Math.max(...ts) : null;
}

export function staleProjects(projects, now = new Date(), days = 14) {
  return (projects ?? [])
    .map((p) => ({ p, last: lastTouched(p) }))
    .filter((x) => x.last !== null && (now.getTime() - x.last) / DAY >= days)
    .sort((a, b) => a.last - b.last)
    .map((x) => ({ project: x.p, days: Math.floor((now.getTime() - x.last) / DAY) }));
}

const lowMood = (moods, now) => {
  const y = new Date(now.getTime() - DAY);
  const recent = (moods ?? []).filter((m) => m.day === dayKey(now) || m.day === dayKey(y));
  return recent.length > 0 && recent[recent.length - 1].value <= 2;
};

/**
 * @param {object} x
 * @param {Date} x.now
 * @param {string} x.mode       modeState(...).mode: NIGHT|MORNING|WORK|AFTERNOON|WEEKEND
 * @param {Array} x.events      today's events [{time,title}]
 * @param {Array} x.tomorrow    tomorrow's events
 * @param {Array} x.reminders   vault.reminders
 * @param {Array} x.tasks       open tasks (oldest first is fine)
 * @param {Array} x.projects    vault.projects
 * @param {Array} x.birthdays   upcomingBirthdays(people, now, 0)
 * @param {Array} x.quiet       longTimeNoTalk(people, now, 30)
 * @param {Array} x.moods       vault.moods
 * @param {number} x.captures   screenshots waiting in the tray
 * @param {object|null} x.closing  workClosing(...) when closingDue(...), else null
 * @param {boolean} x.gentle    modo bajón (WEB-70): no stale projects, softer tasks
 * @returns {{ main: {e,t,why,go}, more: Array<{e,t,go}> }}
 */
export function whatNow({ now = new Date(), mode = "AFTERNOON", events = [], tomorrow = [], reminders = [], tasks = [], projects = [], birthdays = [], quiet = [], moods = [], captures = 0, closing = null, gentle = false } = {}) {
  const out = [];
  const nowMs = now.getTime();
  const clock = hm(now);
  const firstTask = [...(tasks ?? [])].sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")))[0];

  // 1. Something already due and not done (last 12 h).
  const due = (reminders ?? []).filter((r) => !r.done && Date.parse(r.at) <= nowMs && nowMs - Date.parse(r.at) < 12 * 3600000)
    .sort((a, b) => a.at.localeCompare(b.at));
  if (due.length) out.push({ e: "🔔", t: `Te toca: ${due[0].text}.`, why: `Era a las ${hm(new Date(due[0].at))} y sigue sin hacer.`, go: { tab: "agenda" } });

  // 2. An event in the next 90 minutes.
  const soon = (events ?? []).filter((e) => e.time && e.time >= clock).map((e) => {
    const [h, m] = e.time.split(":").map(Number);
    const at = new Date(now); at.setHours(h, m, 0, 0);
    return { e, mins: Math.round((at.getTime() - nowMs) / 60000) };
  }).filter((x) => x.mins >= 0 && x.mins <= 90).sort((a, b) => a.mins - b.mins);
  if (soon.length) out.push({ e: "🗓️", t: `Prepárate: ${soon[0].e.title} a las ${soon[0].e.time}.`, why: soon[0].mins < 5 ? "Es ya." : `Queda${soon[0].mins === 1 ? "" : "n"} ${soon[0].mins} minuto${soon[0].mins === 1 ? "" : "s"}.`, go: { tab: "agenda" } });

  // 2b. Work just ended (WEB-63): close the day before anything else.
  if (closing) out.push({ e: "🏁", t: "Cierra la jornada.", why: closing.openCount ? `Dos minutos: repasa lo de hoy y deja ${closing.openCount === 1 ? "la tarea pendiente" : `las ${closing.openCount} pendientes`} para ${closing.label ?? "mañana"}. Luego, desconecta.` : "Dos minutos: repasa lo de hoy y desconecta.", go: null });

  // 3. Late night: sleep.
  const h = now.getHours();
  if (h >= 1 && h < 6) {
    const first = (tomorrow ?? []).find((e) => e.time) ?? null;
    const today0 = (events ?? []).find((e) => e.time) ?? null; // after midnight «tomorrow» is today
    const next = today0 ?? first;
    out.push({ e: "🌙", t: "A dormir.", why: next ? `Tienes ${next.title} a las ${next.time}.` : "Mañana no tienes nada temprano, pero el cuerpo lo agradece.", go: null });
  }

  // 4. Low mood: something that helps, and an open door.
  if (lowMood(moods, now)) {
    const lift = LIFTS[now.getDate() % LIFTS.length];
    const item = { e: "💙", t: lift, why: "Ayer o hoy no estabas bien. Si quieres hablarlo, escríbeme «estoy de bajón».", go: { tab: "manu" } };
    if (mode === "WORK") out.push({ ...item, why: "Cuando salgas del trabajo. " + item.why }); else out.push(item);
  }

  // 5. Work hours: the next task, nothing else.
  if (mode === "WORK" && firstTask) out.push({ e: "💼", t: `Lo siguiente: ${firstTask.text}.`, why: "Es la tarea abierta más antigua. Termínala y te digo la siguiente.", go: { tab: "agenda" } });

  // 6. Birthdays today.
  for (const b of birthdays ?? []) if (b.days === 0) out.push({ e: "🎂", t: `Hoy cumple ${b.person.name}: escríbele.`, why: "Mejor por la mañana que a las 23:59.", go: { sub: "personas" } });

  // 6b. Screenshots waiting (WEB-59): from the afternoon on, not at work.
  if (captures > 0 && mode !== "WORK" && h >= 15) out.push({ e: "🖼️", t: `Revisa ${captures === 1 ? "tu captura" : `tus ${captures} capturas`}.`, why: "Cinco minutos: te las agrupo por tema y te quedas solo con lo que sirve.", go: { sub: "capturas" } });

  // 7. A project gone quiet (not during work).
  const stale = mode === "WORK" || gentle ? [] : staleProjects(projects, now);
  if (stale.length) out.push({ e: stale[0].project.emoji ?? "📁", t: `Diez minutos para «${stale[0].project.name}».`, why: `Llevas ${stale[0].days} días sin tocarlo. Ábrelo y apunta el siguiente paso, solo eso. Si ya no te interesa, archívalo y quítatelo de la cabeza.`, go: { project: stale[0].project.id } });

  // 8. Someone he hasn't talked to in a while.
  if ((quiet ?? []).length && mode !== "WORK") {
    const p = quiet[0];
    const d = Math.floor((nowMs - Date.parse(p.lastContact)) / DAY);
    out.push({ e: "👋", t: `Escribe a ${p.name}.`, why: `Hace ${d} días que no habláis.`, go: { sub: "personas" } });
  }

  // 9. Any open task.
  if (firstTask && mode !== "WORK") out.push(gentle
    ? { e: "🌱", t: `Si te apetece, solo una: ${firstTask.text}.`, why: "Y si no, mañana. Hoy no pasa nada por no hacerla.", go: { tab: "agenda" } }
    : { e: "✅", t: `Quítate de encima: ${firstTask.text}.`, why: `Tienes ${tasks.length === 1 ? "solo esta tarea" : `${tasks.length} tareas abiertas`}; empieza por la más antigua.`, go: { tab: "agenda" } });

  // 10. Nothing pending.
  if (!out.length) {
    if (mode === "WORK") out.push({ e: "💼", t: "No tienes tareas apuntadas.", why: "Apunta lo que tengas entre manos («tarea: …») y te lo ordeno.", go: { tab: "manu" } });
    else out.push({ e: "✨", t: mode === "NIGHT" ? "Nada pendiente: desconecta." : "Nada pendiente. Descansa o haz algo que te apetezca.", why: "Si te aburres: una idea en la libreta, una vuelta o escribir a alguien.", go: null });
  }

  const seen = new Set();
  const uniq = out.filter((x) => (seen.has(x.t) ? false : seen.add(x.t)));
  return { main: uniq[0], more: uniq.slice(1, 3) };
}

export const whatNowText = (r) => [`${r.main.e} ${r.main.t}`, r.main.why, ...(r.more.length ? ["", "Después:", ...r.more.map((m) => `${m.e} ${m.t}`)] : [])].join("\n");

// «¿qué hago ahora?», «y ahora qué», «me aburro». Not «qué hago para …».
export function isWhatNowQuestion(text) {
  const t = normalise(text).replace(/[¿?¡!.,]+/g, " ").replace(/\s+/g, " ").trim();
  return /^(y )?(ahora )?(que|q) (hago|me toca|deberia hacer|puedo hacer)( ahora| hoy| ya| manu)?$/.test(t)
    || /^(y )?ahora que( hago)?$/.test(t)
    || /^(estoy aburrid[oa]|me aburro|no se que hacer)( ahora| hoy)?$/.test(t)
    || /^que es lo siguiente$/.test(t);
}
