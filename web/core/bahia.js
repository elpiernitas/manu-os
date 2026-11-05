// Bahía 00 (WEB-91): MANU as a cozy game. Manu's real life builds a small
// coastal town: moving, his projects, saving, his ideas and resting. Rules
// agreed with Manu (and ChatGPT's review of what keeps him playing):
//   - nothing is ever lost: levels come from his whole history and only grow;
//   - no streaks, no punishments, no rankings;
//   - vitality is a temporary, non-clinical mood of the character: a night out
//     lowers it a little (only what he says), moving and resting bring it back;
//   - the town is generic here; anything personal lives in his vault, never in
//     this public code.
// Pure: vault in, town out. State the game itself keeps: vault.settings.game.

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyOf = (iso) => (typeof iso === "string" && /^\d{4}-\d{2}-\d{2}/.test(iso) ? dayKey(new Date(iso)) : null);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export const DEFAULT_STEP_GOAL = 10000;
export const MAX_PROJECT_MIN_PER_DAY = 180; // more hours do not build more: no reward for overworking
export const MAX_IDEAS_PER_DAY = 3;          // capturing is good, hoarding is not

// The five places of the first version. `at`: [needed for level 2, level 3].
export const PLACES = [
  { id: "muro", name: "El Muro de las Vueltas", area: "Moverte", unit: ["vuelta", "vueltas"], at: [8, 30],
    how: "Tus 200 kcal en la cinta o tus pasos del día. Cuenta una vuelta por día, sin duplicar.",
    looks: ["Un banco y una barandilla frente al mar.", "Un paseo con farolas, bancos y vecinos.", "Un gran malecón con miradores."] },
  { id: "oficina", name: "La Oficina de Uno", area: "Tus proyectos", unit: ["punto de obra", "puntos de obra"], at: [12, 45],
    how: "Cada hora con el cronómetro en un proyecto (hasta 3 al día) y cada tarea terminada.",
    looks: ["Un portátil y un organigrama dibujado en papel.", "Un estudio con varias pantallas.", "Una sede de tres plantas con un solo empleado: tú."] },
  { id: "faro", name: "El Faro de las Reservas", area: "Tu ahorro", unit: ["luz", "luces"], at: [2, 6],
    how: "Cada mes cerrado en el que entró más dinero del que salió enciende una luz.",
    looks: ["Una caseta con una hucha azul.", "Un faro pequeño con su almacén.", "Un gran faro iluminado sobre la bahía."] },
  { id: "cafe", name: "El Café de la Servilleta", area: "Tus ideas", unit: ["servilleta", "servilletas"], at: [10, 40],
    how: "Cada idea que sueltas en MANU (hasta 3 al día).",
    looks: ["Una mesa, un café y una servilleta escrita.", "Una cafetería con las paredes llenas de ideas.", "Un laboratorio de inventos imposibles."] },
  { id: "azotea", name: "La Azotea del Día Siguiente", area: "Descansar", unit: ["tarde tranquila", "tardes tranquilas"], at: [5, 20],
    how: "Cada día que marcas que has descansado o te has cuidado.",
    looks: ["Un sofá con una manta y una maceta.", "Una terraza con plantas y luces.", "Un jardín elevado con vistas a toda la bahía."] },
];

export const NIGHT_OPTIONS = [
  { value: 0, label: "Nada o refrescos", vitality: 0 },
  { value: 1, label: "1 o 2", vitality: -10 },
  { value: 2, label: "De 3 a 5", vitality: -25 },
  { value: 3, label: "Más", vitality: -40 },
];

export function gameState(vault) {
  const g = vault?.settings?.game ?? {};
  return {
    stepGoal: Number(g.stepGoal) > 0 ? Number(g.stepGoal) : DEFAULT_STEP_GOAL,
    treadmill: g.treadmill ?? {}, // { "YYYY-MM-DD": true }
    rest: g.rest ?? {},           // { "YYYY-MM-DD": true }
    nights: g.nights ?? {},       // { "YYYY-MM-DD": 0..3 } the night of that day
    sessions: Array.isArray(g.sessions) ? g.sessions : [], // [{ id, projectId, start, end }]
    timer: g.timer ?? null,       // { projectId, start }
    seen: g.seen ?? {},           // { placeId: level already celebrated }
  };
}

// Days on which he moved enough (treadmill or steps), as a Set of day keys.
export function moveDays(vault) {
  const g = gameState(vault);
  const days = new Set(Object.keys(g.treadmill).filter((k) => g.treadmill[k]));
  for (const h of vault?.health ?? []) if (h?.kind === "STEPS" && Number(h.value) >= g.stepGoal) days.add(h.day);
  return days;
}

// Minutes of project work per day, each day capped.
export function projectMinutesByDay(vault, now = new Date()) {
  const g = gameState(vault);
  const by = {};
  const add = (start, end) => {
    const s = Date.parse(start), e = Date.parse(end);
    if (!(e > s)) return;
    const k = dayKey(new Date(s));
    by[k] = Math.min(MAX_PROJECT_MIN_PER_DAY, (by[k] ?? 0) + Math.round((e - s) / 60000));
  };
  for (const s of g.sessions) add(s.start, s.end);
  if (g.timer?.start) add(g.timer.start, now.toISOString());
  return by;
}

function savedMonths(vault, now) {
  const months = {};
  const put = (iso, cents) => { const k = keyOf(iso); if (!k) return; const m = k.slice(0, 7); months[m] = (months[m] ?? 0) + cents; };
  for (const i of vault?.income ?? []) put(i.at, Number(i.cents) || 0);
  for (const s of vault?.spending ?? []) put(s.at, -(Number(s.cents) || 0));
  const current = dayKey(now).slice(0, 7);
  return { closed: Object.entries(months).filter(([m, v]) => m < current && v > 0).length, current: months[current] ?? 0 };
}

const level = (place, points) => (points >= place.at[1] ? 3 : points >= place.at[0] ? 2 : 1);

/** Points, level and progress of each place, from all of his history. */
export function town(vault, now = new Date()) {
  const g = gameState(vault);
  const ideasByDay = {};
  for (const i of vault?.inbox ?? []) if (i?.status === "IDEA") { const k = keyOf(i.at); if (k) ideasByDay[k] = Math.min(MAX_IDEAS_PER_DAY, (ideasByDay[k] ?? 0) + 1); }
  const tasksDone = (vault?.inbox ?? []).filter((i) => i?.status === "TASK" && i.done).length;
  const minutes = Object.values(projectMinutesByDay(vault, now)).reduce((a, b) => a + b, 0);
  const saved = savedMonths(vault, now);
  const points = {
    muro: moveDays(vault).size,
    oficina: Math.floor(minutes / 60) + tasksDone,
    faro: saved.closed,
    cafe: Object.values(ideasByDay).reduce((a, b) => a + b, 0),
    azotea: Object.keys(g.rest).filter((k) => g.rest[k]).length,
  };
  return PLACES.map((p) => {
    const pts = points[p.id];
    const lv = level(p, pts);
    const from = lv === 1 ? 0 : p.at[lv - 2], to = lv === 3 ? null : p.at[lv - 1];
    return { ...p, points: pts, level: lv, next: to, progress: to === null ? 1 : (pts - from) / (to - from), look: p.looks[lv - 1], isNew: lv > (g.seen[p.id] ?? 1), extra: p.id === "faro" ? { thisMonthPositive: saved.current > 0 } : undefined };
  });
}

/**
 * Vitality today (20–100). Each day recovers a bit by itself, more if he moved
 * or rested; the morning after a night out it drops by what he said.
 */
export function vitality(vault, now = new Date()) {
  const g = gameState(vault);
  const moved = moveDays(vault);
  let v = 100;
  for (let i = 14; i >= 0; i--) {
    const d = addDays(now, -i), k = dayKey(d), prev = dayKey(addDays(d, -1));
    const night = NIGHT_OPTIONS.find((o) => o.value === g.nights[prev]);
    if (night) v += night.vitality;
    v += 10 + (moved.has(k) ? 15 : 0) + (g.rest[k] ? 10 : 0);
    v = Math.max(20, Math.min(100, v));
  }
  return v;
}

/** How the character feels today, in order of priority. */
export function mood(vault, now = new Date()) {
  const t = town(vault, now), v = vitality(vault, now), k = dayKey(now), g = gameState(vault);
  if (t.some((p) => p.isNew)) return "celebrando";
  if (v < 60) return "cansado";
  if ((vault?.inbox ?? []).some((i) => i?.status === "IDEA" && keyOf(i.at) === k)) return "inspirado";
  if (g.timer || projectMinutesByDay(vault, now)[k]) return "trabajando";
  if (v >= 90 && (moveDays(vault).has(k) || g.rest[k])) return "descansado";
  return "tranquilo";
}

const NIGHT_CATS = new Set(["NIGHTLIFE"]);
/**
 * The morning question after a night out: yesterday's nightlife spending (or
 * bars for 15 € or more), unless he already answered. Null when there is
 * nothing to ask. It lists the places, never asks for a full log.
 */
export function nightQuestion(vault, now = new Date()) {
  if (now.getHours() < 6) return null;
  const g = gameState(vault);
  const y = dayKey(addDays(now, -1));
  if (g.nights[y] !== undefined) return null;
  const spends = (vault?.spending ?? []).filter((s) => keyOf(s.at) === y && (NIGHT_CATS.has(s.category) || s.category === "FOOD_AND_DRINK"));
  const night = spends.filter((s) => NIGHT_CATS.has(s.category));
  const bars = spends.filter((s) => s.category === "FOOD_AND_DRINK");
  const barTotal = bars.reduce((a, s) => a + (Number(s.cents) || 0), 0);
  if (!night.length && barTotal < 1500) return null;
  const items = [...night, ...bars].sort((a, b) => b.cents - a.cents).slice(0, 3).map((s) => ({ merchant: s.merchant ?? "Sin concepto", cents: s.cents }));
  return { day: y, items };
}

// A dry-humour line for the day (stable within the day).
const LINES = {
  celebrando: ["Nueva construcción. Urbanismo ha aprobado la obra. Urbanismo eres tú."],
  cansado: ["Hoy toca agua, paseo y poca épica. La ciudad sigue en pie."],
  inspirado: ["Una idea nueva en una servilleta. Ya se considera patrimonio municipal."],
  trabajando: ["El Departamento de Proyectos informa de que el Departamento de Proyectos está trabajando."],
  descansado: ["Te has cuidado. Recursos Humanos lo aprueba por unanimidad (de uno)."],
  tranquilo: ["La ciudad sigue existiendo. Qué sorpresa.", "Día tranquilo en la bahía. Nadie te pide nada.", "El mar está ahí. Tú también. Con eso vale."],
};
export function lineFor(m, now = new Date()) {
  const list = LINES[m] ?? LINES.tranquilo;
  const n = [...dayKey(now)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return list[n % list.length];
}

// State changes (pure: they return a new settings.game).
const put = (vault, patch) => ({ ...(vault?.settings?.game ?? {}), ...patch });
export function setTreadmill(vault, day, on = true) { const t = { ...gameState(vault).treadmill }; if (on) t[day] = true; else delete t[day]; return put(vault, { treadmill: t }); }
export function setRest(vault, day, on = true) { const r = { ...gameState(vault).rest }; if (on) r[day] = true; else delete r[day]; return put(vault, { rest: r }); }
export function answerNight(vault, day, value) {
  if (!NIGHT_OPTIONS.some((o) => o.value === value)) throw new Error("Respuesta no válida");
  return put(vault, { nights: { ...gameState(vault).nights, [day]: value } });
}
export function startTimer(vault, projectId = null, now = new Date()) {
  if (gameState(vault).timer) return put(vault, {});
  return put(vault, { timer: { projectId, start: now.toISOString() } });
}
export function stopTimer(vault, id, now = new Date()) {
  const g = gameState(vault);
  if (!g.timer) return put(vault, {});
  const session = { id, projectId: g.timer.projectId ?? null, start: g.timer.start, end: now.toISOString() };
  const keep = Date.parse(session.end) - Date.parse(session.start) >= 60000; // less than a minute does not count
  return put(vault, { timer: null, sessions: keep ? [...g.sessions, session].slice(-2000) : g.sessions });
}
export function markSeen(vault, now = new Date()) {
  return put(vault, { seen: Object.fromEntries(town(vault, now).map((p) => [p.id, p.level])) });
}
