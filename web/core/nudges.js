// Avisos de MANU (WEB-77). Manu asked for more notifications, starting with
// «weeknights at 22:00, ask me where I work tomorrow». Each nudge has a time,
// the days it applies, and a condition: it only fires when there is something
// to do (the question is not answered yet, a habit is left…). Pure: the app
// passes what it knows (`ctx`); this decides what is due.
//
// Texts avoid names and details: they show on the lock screen.

const DAY = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const WEEKDAYS = [1, 2, 3, 4, 5];
const BEFORE_WORKDAY = [0, 1, 2, 3, 4]; // Sunday–Thursday nights: tomorrow is a weekday
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WINDOW_MIN = 120; // a late opening still shows it; after that it is stale

/**
 * The catalogue, in the order shown in Tú → Avisos.
 * `time: null` → the time comes from elsewhere (fichaje: his start time).
 */
export const NUDGES = [
  { id: "buenosdias", label: "Buenos días", hint: "Lo que tienes hoy, si hay algo", time: "08:00", days: WEEKDAYS },
  { id: "ficharEntrada", label: "¿Fichaste ya?", hint: "Un minuto después de tu hora de entrada, si no has fichado", time: null, days: WEEKDAYS },
  { id: "ficharSalida", label: "Ficha al salir", hint: "Al cumplir la jornada, si sigues dentro", time: null, days: WEEKDAYS },
  { id: "animo", label: "¿Qué tal el día?", hint: "Si hoy no has marcado cómo estás", time: "21:00", days: EVERY_DAY },
  { id: "habitos", label: "Hábitos", hint: "Si te queda alguno por marcar hoy", time: "21:30", days: EVERY_DAY },
  { id: "manana", label: "¿Dónde trabajas mañana?", hint: "De domingo a jueves, si no lo has dicho", time: "22:00", days: BEFORE_WORKDAY },
  { id: "copia", label: "Copia de seguridad", hint: "Los domingos, si hace más de una semana", time: "20:00", days: [DAY.sun] },
];

const toMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? "")); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Prefs: vault.settings.nudges = { [id]: { on: bool, time: "HH:MM" } }. All on by default.
export function nudgePrefs(saved = {}) {
  return Object.fromEntries(NUDGES.map((n) => {
    const s = saved?.[n.id] ?? {};
    return [n.id, { on: s.on !== false, time: n.time === null ? null : (toMin(s.time) !== null ? s.time : n.time) }];
  }));
}

// What each nudge says, or null when there is nothing to say.
const TEXT = {
  buenosdias: (c) => {
    const bits = [];
    if (c.eventsToday) bits.push(`${plural(c.eventsToday, "cosa", "cosas")} en la agenda${c.firstAt ? ` (la primera a las ${c.firstAt})` : ""}`);
    if (c.remindersToday) bits.push(plural(c.remindersToday, "recordatorio", "recordatorios"));
    if (c.birthdaysToday) bits.push(c.birthdaysToday === 1 ? "un cumpleaños" : `${c.birthdaysToday} cumpleaños`);
    return bits.length ? `Buenos días. Hoy tienes ${bits.join(", ").replace(/, ([^,]*)$/, " y $1")}.` : null;
  },
  animo: (c) => (c.moodToday ? null : "¿Qué tal el día? Márcalo en MANU en un toque."),
  habitos: (c) => (c.habitsLeft ? `Te ${c.habitsLeft === 1 ? "queda 1 hábito" : `quedan ${c.habitsLeft} hábitos`} por marcar hoy.` : null),
  manana: (c) => (c.tomorrowAnswered ? null : "¿Dónde trabajas mañana? Dímelo y te propongo la alarma."),
  copia: (c) => (c.backupDays === null || c.backupDays >= 7 ? (c.backupDays === null ? "Aún no tienes ninguna copia de MANU. Hazla hoy: tarda un momento." : `Hace ${c.backupDays} días que no haces copia de MANU.`) : null),
};

/**
 * Nudges due now (the fichaje ones are decided by clockNudge and are not here).
 * @param {object} ctx  what the app knows: eventsToday, firstAt, remindersToday,
 *   birthdaysToday, moodToday, habitsLeft, tomorrowAnswered, backupDays
 * @param {{ now?: Date, prefs?: object, sent?: { day: string, ids: string[] } }} o
 * @returns {Array<{ id: string, text: string, go: string }>} `go`: where a tap takes him
 */
export function dueNudges(ctx, { now = new Date(), prefs = nudgePrefs(), sent = null } = {}) {
  const day = dayKey(now);
  const done = new Set(sent?.day === day ? sent.ids ?? [] : []);
  const m = now.getHours() * 60 + now.getMinutes();
  const out = [];
  for (const n of NUDGES) {
    const p = prefs[n.id];
    if (!TEXT[n.id] || !p?.on || done.has(n.id) || !n.days.includes(now.getDay())) continue;
    const at = toMin(p.time);
    if (at === null || m < at || m >= at + WINDOW_MIN) continue;
    const text = TEXT[n.id](ctx ?? {});
    if (text) out.push({ id: n.id, text, go: GO[n.id] ?? "hoy" });
  }
  return out;
}

// Where tapping the notification takes him: "tab" or "tab/subpage".
const GO = { animo: "tu", habitos: "tu/habitos", copia: "tu/datos" };

// Marks what was shown today (device-local: each device nudges on its own).
export function markSent(sent, day, id) {
  const ids = sent?.day === day ? sent.ids ?? [] : [];
  return { day, ids: [...new Set([...ids, id])] };
}
