import { parse, reply } from "./core/assistant.js";
import { CATEGORIES, euros, newEntry, correctCategory, summary, toCents } from "./core/money.js";
import { MODE_TITLES, modeState } from "./core/modes.js";
import { capture, confirm, markUnclassified, pending, tasks, ideas, toggleDone } from "./core/inbox.js";
import { initialRefuge, refugeReply } from "./core/refuge.js";
import { LocalStore, emptyVault, validateVault } from "./core/storage.js";
import { notificationStatus, isInstalled, enableNotifications, testNotification } from "./core/notify.js";
import { launchParams, parseEvents, nextEvent, localDay } from "./core/intake.js";
import { fetchForecast, searchCities, advice, WEATHER_TTL_MS } from "./core/weather.js";
import { importStatement } from "./core/bank.js";
import { CITIES, proposeAlarm, shouldAskTomorrow, shortcutUrl, guessCity } from "./core/night.js";
import { isClientId, listEvents, createEvent, newEventBody, GCAL_SCOPE } from "./core/gcal.js";
import { toggleHabit, streak, lastDays, dayKey, daysUntilBirthday, upcomingBirthdays, longTimeNoTalk, mealSlot, frequentMeals, healthSummary, MOODS, setMood, dueReminders } from "./core/life.js";

export const APP_VERSION = "4";
const SITE = new URL(".", location.href).href;
const SHORTCUT_ALARM = "MANU Alarma";
const SHORTCUT_REMINDER = "MANU Recordatorio";

const store = new LocalStore(globalThis.localStorage ?? { getItem: () => null, setItem: () => { throw new Error("no storage"); } });
const loaded = store.load();
let vault = loaded.vault;
let tab = sessionStorage.getItem("manuos.tab") || "hoy";
let sub = null; // Tú subpage
let refuge = null; // Refugio lives only in memory
let sheet = null; // quick add: { kind }
let confirmWipe = false;
let cityResults = null;
let overlay = null; // "weather"
const gcal = { token: null, expires: 0, busy: false, error: null, client: null };
let variant = vault.chat.length;
const weather = { loading: false, error: null };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const today = () => new Date();
const tomorrowKey = () => { const d = today(); d.setDate(d.getDate() + 1); return dayKey(d); };
const hhmm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function persist() {
  if (vault.chat.length > 200) vault.chat = vault.chat.slice(-200);
  if (!store.save(vault)) toast("No he podido guardar en este dispositivo.");
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast glass";
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

// ---------- Icons (inline SVG, stroke) ----------
const svg = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const I = {
  hoy: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  agenda: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  dinero: svg('<rect x="2" y="6" width="20" height="13" rx="3"/><circle cx="12" cy="12.5" r="2.5"/>'),
  tu: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="3"'),
  chev: svg('<path d="M9 6l6 6-6 6"/>'),
  back: svg('<path d="M15 6l-6 6 6 6"/>'),
  sun: svg('<circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v2.5M12 20v2.5M3.5 3.5l1.8 1.8M18.7 18.7l1.8 1.8M1.5 12H4M20 12h2.5M3.5 20.5l1.8-1.8M18.7 5.3l1.8-1.8"/>'),
  "cloud-sun": svg('<path d="M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4 1.6A3.3 3.3 0 0 0 7 18z"/><path d="M15 4.5l.7-1.6M19.5 7l1.6-.7"/>'),
  cloud: svg('<path d="M7 19h10a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 1.8A3.6 3.6 0 0 0 7 19z"/>'),
  fog: svg('<path d="M4 9h16M2 13h20M5 17h14"/>'),
  rain: svg('<path d="M7 15h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4 1.6A3.3 3.3 0 0 0 7 15z"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/>'),
  snow: svg('<path d="M7 14h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4 1.6A3.3 3.3 0 0 0 7 14z"/><path d="M9 18h.01M13 20h.01M17 18h.01"/>', 'stroke-width="2.6"'),
  storm: svg('<path d="M7 14h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4 1.6A3.3 3.3 0 0 0 7 14z"/><path d="M12 14l-2 4h4l-2 4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
  "cloud-moon": svg('<path d="M7 19h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4 1.6A3.3 3.3 0 0 0 7 19z"/><path d="M17 3.5a4 4 0 0 0 3.5 5.5"/>'),
  drop: svg('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
  wind: svg('<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3"/>'),
  sunrise: svg('<path d="M4 18h16M7 14a5 5 0 0 1 10 0M12 3v5M9 6l3-3 3 3"/>'),
  sunset: svg('<path d="M4 18h16M7 14a5 5 0 0 1 10 0M12 3v5M9 5l3 3 3-3"/>'),
  google: svg('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M12 12v6M9 15h6"/>'),
  heart: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  repeat: svg('<path d="M4 12a6 6 0 0 1 6-6h8M15 3l3 3-3 3M20 12a6 6 0 0 1-6 6H6M9 21l-3-3 3-3"/>'),
  people: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3 2.2 3.5 5"/>'),
  fork: svg('<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1.5-3 4-3 7h3"/>'),
  pulse: svg('<path d="M3 12h4l2-5 4 10 2-5h6"/>'),
  leaf: svg('<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19l7-7"/>'),
  pin: svg('<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>'),
  bell: svg('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  bolt: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  box: svg('<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>'),
  alarm: svg('<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 2M4 4l3 2.5M20 4l-3 2.5"/>'),
};

const TABS = [["hoy", "Hoy"], ["agenda", "Agenda"], ["manu", "MANU"], ["dinero", "Dinero"], ["tu", "Tú"]];

function monthRange(d = today()) {
  return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 1)];
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const longDate = (d = today()) => cap(d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }));
const dec = (n) => (n === null ? "—" : n.toLocaleString("es-ES", { maximumFractionDigits: 1 }));
function greeting(d = today()) {
  const h = d.getHours();
  return h < 6 ? "Buenas noches" : h < 13 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
}

function agendaToday() {
  return vault.agenda && vault.agenda.day === localDay() ? vault.agenda : null;
}

// ---------- Weather ----------
function activeCity() {
  const s = vault.settings;
  if (s.cityOverride && s.cityOverride.day === localDay()) return s.cityOverride.city;
  if (s.tomorrow && s.tomorrow.day === localDay() && s.tomorrow.work) return CITIES[s.tomorrow.city] ?? CITIES.GIJON;
  return s.homeCity ?? CITIES.GIJON;
}

async function refreshWeather(force = false) {
  const city = activeCity();
  const cache = vault.weather;
  const fresh = cache && cache.city?.name === city.name && Array.isArray(cache.data?.hours) && Date.now() - new Date(cache.at).getTime() < WEATHER_TTL_MS;
  if ((fresh && !force) || weather.loading || !navigator.onLine) return;
  weather.loading = true;
  weather.error = null;
  try {
    const data = await fetchForecast(city);
    vault.weather = { city, at: new Date().toISOString(), data };
    persist();
  } catch {
    weather.error = "No he podido traer el tiempo ahora.";
  } finally {
    weather.loading = false;
    if (tab === "hoy" && !sheet && !document.activeElement?.matches("input, textarea")) render();
  }
}

function weatherCard() {
  const city = activeCity();
  const w = vault.weather && vault.weather.city?.name === city.name ? vault.weather : null;
  const cityChips = [CITIES.GIJON, CITIES.OVIEDO, ...(vault.settings.homeCity && ![CITIES.GIJON.name, CITIES.OVIEDO.name].includes(vault.settings.homeCity.name) ? [vault.settings.homeCity] : [])]
    .map((c) => `<button class="chip" data-act="city" data-city="${esc(c.name)}" aria-pressed="${c.name === city.name}">${esc(c.name)}</button>`).join("");
  if (!w) {
    return `<section class="card hero"><div class="row"><h2>${I.pin} ${esc(city.name)}</h2></div>
      <p class="muted">${weather.loading ? "Cargando el tiempo…" : navigator.onLine ? esc(weather.error ?? "Sin datos todavía.") : "Sin conexión: el tiempo vuelve cuando haya red."}</p>
      <div class="btns">${cityChips}</div></section>`;
  }
  const f = w.data;
  const age = Math.round((Date.now() - new Date(w.at).getTime()) / 60000);
  return `<section class="card hero" aria-label="Tiempo en ${esc(city.name)}">
    <button class="hero-tap" data-act="weather-open" aria-label="Ver el tiempo completo"></button>
    <div class="row"><h2>${esc(city.name)}</h2><span class="muted small">${age < 2 ? "ahora" : `hace ${age} min`} ›</span></div>
    <div class="weather-now">${I[f.now.icon] ?? I.cloud}<div><div class="temp">${f.now.temp}°</div><div class="muted">${esc(f.now.text)} · ${f.today.min}° / ${f.today.max}°</div></div></div>
    ${f.hours?.length ? `<div class="hours">${f.hours.slice(0, 8).map((h) => `<div><span class="muted small">${esc(h.time)}</span>${I[h.icon] ?? I.cloud}<b>${h.temp}°</b></div>`).join("")}</div>` : ""}
    <p>${esc(advice(f))}</p>
    ${f.tomorrow ? `<p class="muted small">Mañana: ${esc(f.tomorrow.text.toLowerCase())}, ${f.tomorrow.min}°–${f.tomorrow.max}°${f.tomorrow.rain !== null ? `, lluvia ${f.tomorrow.rain} %` : ""}.</p>` : ""}
    <div class="btns">${cityChips}</div></section>`;
}

function weatherPage() {
  const city = activeCity();
  const w = vault.weather && vault.weather.city?.name === city.name ? vault.weather : null;
  if (!w || !w.data.hours) return `<button class="link" data-act="overlay-close">${I.back} Hoy</button><h1>${esc(city.name)}</h1><p class="muted">${weather.loading ? "Cargando…" : "Sin datos todavía."}</p>`;
  const f = w.data;
  const lo = Math.min(...f.days.map((d) => d.min)), hi = Math.max(...f.days.map((d) => d.max));
  const span = Math.max(1, hi - lo);
  return `<button class="link" data-act="overlay-close">${I.back} Hoy</button>
    <div class="weather-head"><p class="muted">${esc(city.name)}</p><div class="temp xl">${f.now.temp}°</div><p>${esc(f.now.text)}</p><p class="muted">Máx. ${f.today.max}° · Mín. ${f.today.min}°</p></div>
    <section class="card"><p class="small">${esc(advice(f))}</p><div class="hours scroll">${f.hours.map((h) => `<div><span class="muted small">${esc(h.time)}</span>${I[h.icon] ?? I.cloud}${h.rain >= 20 ? `<span class="rain small">${h.rain}%</span>` : ""}<b>${h.temp}°</b></div>`).join("")}</div></section>
    ${sectionTitle("Próximos 7 días")}
    <section class="card">${f.days.map((d) => `<div class="row day"><span class="wd">${esc(d.weekday)}</span><span class="dicon">${I[d.icon] ?? I.cloud}${d.rain >= 20 ? `<span class="rain small">${d.rain}%</span>` : ""}</span><span class="num muted">${d.min}°</span><span class="range"><i data-l="${Math.round(((d.min - lo) / span) * 100)}" data-w="${Math.max(6, Math.round(((d.max - d.min) / span) * 100))}"></i></span><span class="num">${d.max}°</span></div>`).join("")}</section>
    <div class="tiles">
      <section class="card"><h2>${I["cloud-sun"]} Sensación</h2><div class="tile-v">${f.now.feels ?? "—"}°</div><p class="muted small">${f.now.feels !== null && f.now.feels > f.now.temp ? "Se nota más calor por la humedad." : "Parecida a la real."}</p></section>
      <section class="card"><h2>${I.drop} Humedad</h2><div class="tile-v">${f.now.humidity ?? "—"} %</div></section>
      <section class="card"><h2>${I.wind} Viento</h2><div class="tile-v">${f.now.wind ?? "—"}<span class="small"> km/h</span></div><p class="muted small">Máx. hoy ${f.today.windMax ?? "—"} km/h</p></section>
      <section class="card"><h2>${I.sun} Índice UV</h2><div class="tile-v">${f.today.uv !== null ? Math.round(f.today.uv) : "—"}</div><p class="muted small">${f.today.uv >= 6 ? "Alto: protección solar." : f.today.uv >= 3 ? "Moderado." : "Bajo."}</p></section>
      <section class="card"><h2>${I.sunrise} Amanecer</h2><div class="tile-v">${esc(f.today.sunrise ?? "—")}</div></section>
      <section class="card"><h2>${I.sunset} Atardecer</h2><div class="tile-v">${esc(f.today.sunset ?? "—")}</div></section>
    </div>
    <p class="muted small">Datos de Open-Meteo · actualizado ${new Date(w.at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</p>`;
}

// ---------- Night question ----------
function nightCard() {
  const s = vault.settings;
  const tk = tomorrowKey();
  if (s.tomorrow && s.tomorrow.day === tk) {
    if (!s.tomorrow.work) return "";
    const real = vault.agendaTomorrow?.day === tk ? vault.agendaTomorrow.events : null;
    const p = proposeAlarm({ events: real?.some((e) => e.time) ? real : [{ time: s.workStart ?? "09:00", title: "Trabajo" }], city: s.tomorrow.city, wantsBreakfast: s.wantsBreakfast !== false });
    return `<section class="card"><h2>${I.alarm} Mañana</h2>
      <div class="row"><span>Trabajas en <b>${esc(CITIES[s.tomorrow.city].name)}</b></span><span class="temp num">${p.time}</span></div>
      <p class="muted small">${esc(p.explanation)}${real?.some((e) => e.time) ? " Según tu Google Calendar." : ` Entrada supuesta: ${esc(s.workStart ?? "09:00")} (cámbiala en Tú → Tiempo y ciudades).`}</p>
      <div class="btns"><a class="btn" href="${esc(shortcutUrl(SHORTCUT_ALARM, p.time))}">Poner alarma ${p.time}</a><button class="btn ghost" data-act="tomorrow-reset">Cambiar</button></div></section>`;
  }
  if (!shouldAskTomorrow(today(), s.tomorrow?.day, tk)) return "";
  const tomorrowEvents = vault.agendaTomorrow?.day === tk ? vault.agendaTomorrow.events : null;
  const guess = tomorrowEvents ? guessCity(tomorrowEvents) : null;
  return `<section class="card"><h2>${I.alarm} Antes de dormir</h2><p><b>¿Mañana trabajas en Oviedo?</b></p>${guess ? `<p class="muted small">Tu calendario: ${esc(guess.reason)}.</p>` : ""}
    <div class="btns"><button class="btn" data-act="tomorrow" data-city="OVIEDO">Sí, en Oviedo</button><button class="btn ghost" data-act="tomorrow" data-city="GIJON">En Gijón</button><button class="btn ghost" data-act="tomorrow" data-city="NONE">No trabajo</button></div></section>`;
}

// ---------- Shared bits ----------
const taskRow = (t) => `<div class="row"><button class="check" data-act="toggle" data-id="${esc(t.id)}" aria-pressed="${Boolean(t.done)}" aria-label="${t.done ? "Reabrir" : "Completar"}: ${esc(t.text)}">${I.check}</button><span class="grow ${t.done ? "done-text" : ""}">${esc(t.text)}</span></div>`;
const reminderAt = (r) => { const d = new Date(r.at); return `${d.toDateString() === today().toDateString() ? "Hoy" : d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })} ${hhmm(d)}`; };
const reminderIphoneUrl = (r) => { const d = new Date(r.at); return shortcutUrl(SHORTCUT_REMINDER, `${r.text} | ${dayKey(d)} ${hhmm(d)}`); };
const reminderRow = (r) => `<div class="row"><button class="check" data-act="rem-done" data-id="${esc(r.id)}" aria-pressed="${Boolean(r.done)}" aria-label="Hecho: ${esc(r.text)}">${I.check}</button><div class="grow"><div class="${r.done ? "done-text" : ""}">${esc(r.text)}</div><div class="muted small">${esc(reminderAt(r))}</div></div><a class="link small" href="${esc(reminderIphoneUrl(r))}">Al iPhone</a></div>`;
const sectionTitle = (t, extra = "") => `<div class="section-title"><h2>${t}</h2>${extra}</div>`;
const addLink = (kind, label = "Añadir") => `<button class="link small" data-act="sheet" data-kind="${kind}">${label}</button>`;

// ---------- Screens ----------
const screens = {
  hoy() {
    const m = modeState(today(), undefined, vault.settings.override);
    const inbox = pending(vault.inbox);
    const open = tasks(vault.inbox);
    const [s, e] = monthRange();
    const month = summary(vault.spending, s, e);
    const next = agendaToday() ? nextEvent(vault.agenda) : null;
    const rems = vault.reminders.filter((r) => !r.done && dayKey(new Date(r.at)) === localDay()).sort((a, b) => (a.at < b.at ? -1 : 1));
    const bdays = upcomingBirthdays(vault.people, today(), 7);
    return `<h1>${greeting()}, Manu</h1><p class="subtitle">${esc(longDate())} · <span class="chip">${esc(MODE_TITLES[m.mode])}</span></p>
      <div class="stack">
      ${nightCard()}
      ${weatherCard()}
      ${next || agendaToday() ? `<section class="card"><h2>Próximo</h2>${next ? `<div class="row"><span class="chip num">${esc(next.time)}</span><span class="grow">${esc(next.title)}</span></div>` : '<p class="muted">No te queda nada más hoy.</p>'}</section>` : ""}
      ${rems.length ? `<section class="card"><h2>${I.bell} Recordatorios de hoy</h2>${rems.map(reminderRow).join("")}</section>` : ""}
      ${inbox.length ? `<section class="card"><h2>Bandeja · ${inbox.length}</h2>${inbox.map((c) => `<div class="stack"><div>${esc(c.text)}</div><div class="btns">
          <button class="btn" data-act="task" data-id="${esc(c.id)}">Tarea</button><button class="btn ghost" data-act="idea" data-id="${esc(c.id)}">Idea</button><button class="btn ghost" data-act="forget" data-id="${esc(c.id)}">No recuerdo</button></div></div>`).join("")}</section>` : ""}
      <section class="card"><div class="row"><h2>Tareas</h2>${addLink("TASK")}</div>${open.length ? open.slice(0, 5).map(taskRow).join("") + (open.length > 5 ? `<p class="muted small">Y ${open.length - 5} más en Agenda.</p>` : "") : '<p class="muted">Nada pendiente. Toca «+» para añadir.</p>'}</section>
      ${bdays.length ? `<section class="card"><h2>${I.people} Cumpleaños</h2>${bdays.map((b) => `<div class="row"><span class="grow">${esc(b.person.name)}</span><span class="muted">${b.days === 0 ? "¡Hoy!" : b.days === 1 ? "Mañana" : `En ${b.days} días`}</span></div>`).join("")}</section>` : ""}
      <section class="card"><div class="row"><h2>Este mes</h2><button class="link small" data-tab="dinero">Ver dinero</button></div><div class="big-money">${euros(month.total)}</div></section>
      </div>`;
  },
  agenda() {
    const open = tasks(vault.inbox);
    const done = vault.inbox.filter((i) => i.status === "TASK" && i.done).slice(-10);
    const idea = ideas(vault.inbox);
    const rems = vault.reminders.filter((r) => !r.done).sort((a, b) => (a.at < b.at ? -1 : 1));
    const g = isClientId(vault.settings.gcalClientId);
    const synced = vault.settings.gcalSyncedAt ? new Date(vault.settings.gcalSyncedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : null;
    return `<h1>Agenda</h1><p class="subtitle">${esc(longDate())}</p>
      ${g ? `<div class="btns"><button class="btn ghost" data-act="gcal-sync">${gcal.busy ? "Sincronizando…" : "Sincronizar Google Calendar"}</button></div><p class="muted small">${synced ? `Última sincronización: ${synced}` : "Aún sin sincronizar."}${gcal.error ? ` · ${esc(gcal.error)}` : ""}</p>` : `<p class="muted small"><button class="link small" data-act="goto-gcal">Conectar Google Calendar</button></p>`}
      ${sectionTitle("Hoy", g ? addLink("EVENT", "Nuevo evento") : "")}
      <section class="card">${agendaToday()
        ? (vault.agenda.events.length ? vault.agenda.events.map((ev) => `<div class="row"><span class="num chip">${esc(ev.time ? ev.time + (ev.end ? "–" + ev.end : "") : "Todo el día")}</span><span class="grow">${esc(ev.title)}</span></div>`).join("") : '<p class="muted">Hoy no tienes eventos.</p>')
        : '<p class="muted">La web no puede leer el Calendario de Apple. Pega tus eventos o usa el atajo (Tú → Atajos del iPhone).</p>'}
        <details><summary>Pegar eventos de hoy</summary><form id="pasteEvents" class="stack"><label for="eventsText" class="muted small">Uno por línea: «09:30 Dentista», «10:00-11:00 Reunión», «todo el día Cumpleaños».</label><textarea id="eventsText" rows="3" placeholder="09:30 Dentista"></textarea><button class="btn ghost" type="submit">Guardar agenda de hoy</button></form></details>
      </section>
      ${sectionTitle("Recordatorios", addLink("REMINDER"))}
      <section class="card">${rems.length ? rems.map(reminderRow).join("") : '<p class="muted">Sin recordatorios. Dile a MANU «recuérdame … a las 18».</p>'}</section>
      ${sectionTitle("Tareas", addLink("TASK"))}
      <section class="card">${open.length ? open.map(taskRow).join("") : '<p class="muted">Sin tareas pendientes.</p>'}${done.length ? `<details><summary>Hechas (${done.length})</summary>${done.map(taskRow).join("")}</details>` : ""}</section>
      ${sectionTitle("Ideas", addLink("IDEA"))}
      <section class="card">${idea.length ? idea.map((i) => `<div class="row"><span class="grow">${esc(i.text)}</span><button class="link small" data-act="idea-to-task" data-id="${esc(i.id)}">Hacer tarea</button></div>`).join("") : '<p class="muted">Tus ideas quedan aquí, sin convertirse en proyectos sin tu permiso.</p>'}</section>`;
  },
  manu() {
    const chips = refuge ? ["quiero entender por qué", "buscar una solución", "necesito desconectar"] : ["gasté 3,20 en café", "recuérdame llamar al taller a las 18", "pon una alarma a las 7:30", "apunta idea: viaje", "refugio"];
    const history = vault.chat.length ? vault.chat : [{ from: "manu", text: "Hola, Manu. Puedo apuntar gastos, ideas y tareas, crear recordatorios y alarmas, y acompañarte en el Refugio. Aún funciono sin IA: habla claro y corto." }];
    return `<h1>MANU</h1><p class="subtitle">Tu asistente · sin IA por ahora</p>
      ${refuge ? `<div class="refuge-bar"><span>Refugio · no se guarda</span><button class="link" data-act="leave-refuge">Salir</button></div>` : ""}
      <div class="suggest" aria-label="Sugerencias">${chips.map((s) => `<button data-say="${esc(s)}">${esc(s)}</button>`).join("")}</div>
      <div class="chat" id="chat" aria-live="polite">${[...history, ...(refuge?.messages ?? [])].map((b) => `<div class="bubble ${b.from}${b.safety ? " safety" : ""}">${esc(b.text)}${b.action ? `<div class="btns"><a class="btn" href="${esc(b.action.href)}">${esc(b.action.label)}</a></div>` : ""}</div>`).join("")}</div>
      <form class="composer glass" id="composer"><label for="msg" class="sr">Mensaje para MANU</label><input id="msg" autocomplete="off" enterkeyhint="send" placeholder="${refuge ? "Cuéntame" : "Escribe a MANU"}"><button class="btn" type="submit">Enviar</button></form>`;
  },
  dinero() {
    const [s, e] = monthRange();
    const month = summary(vault.spending, s, e);
    const entries = [...vault.spending].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 60);
    const cats = Object.entries(month.byCategory).sort((a, b) => b[1] - a[1]);
    const max = cats[0]?.[1] ?? 1;
    const imp = vault.settings.lastImport;
    return `<h1>Dinero</h1><p class="subtitle">${esc(cap(today().toLocaleDateString("es-ES", { month: "long", year: "numeric" })))}</p>
      <div class="stack">
      <section class="card hero"><h2>Gastado este mes</h2><div class="big-money">${euros(month.total)}</div>
        ${cats.map(([c, v]) => `<div class="stack"><div class="row"><span>${esc(CATEGORIES[c])}</span><span class="num">${euros(v)}</span></div><div class="bar"><i data-w="${Math.max(3, Math.round((v / max) * 100))}"></i></div></div>`).join("")}</section>
      <section class="card"><h2>${I.box} Importar del banco</h2>
        <p class="muted small">Descarga los movimientos de tu banco en CSV y elígelo aquí. Se analiza en tu móvil y no se envía a nadie. Solo importo gastos y no duplico los que ya tengas.</p>
        <label class="btn ghost" for="bankFile" role="button" tabindex="0">Elegir archivo CSV</label><input id="bankFile" type="file" accept=".csv,text/csv,text/plain" class="sr">
        ${imp ? `<p class="muted small">Última importación: ${imp.added} gastos nuevos, ${imp.duplicates} repetidos, ${imp.income} ingresos ignorados${imp.invalid ? `, ${imp.invalid} filas no reconocidas` : ""}.</p>` : ""}</section>
      ${sectionTitle("Movimientos", addLink("EXPENSE"))}
      <section class="card">${entries.length ? entries.map((x) => `<div class="row"><div class="grow"><div>${esc(x.merchant ?? "Sin concepto")}</div><div class="muted small">${new Date(x.at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}${x.source === "BANK" ? " · banco" : ""}${x.inferred ? " · categoría propuesta" : ""}</div></div>
          <div class="stack"><span class="num">${euros(x.cents)}</span><label class="sr" for="cat-${esc(x.id)}">Categoría</label><select id="cat-${esc(x.id)}" data-cat="${esc(x.id)}">${Object.entries(CATEGORIES).map(([k, t]) => `<option value="${k}"${k === x.category ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div></div>`).join("")
        : '<p class="muted">Sin gastos. Toca «+», escribe a MANU «gasté 12,50 en café» o importa el CSV del banco.</p>'}</section>
      </div>`;
  },
  tu() {
    if (sub && subpages[sub]) return subpages[sub]();
    const t = localDay();
    const mood = vault.moods.find((m) => m.day === t)?.value;
    const week = Array.from({ length: 7 }, (_, i) => { const d = today(); d.setDate(d.getDate() - 6 + i); const k = dayKey(d); return vault.moods.find((m) => m.day === k)?.value ?? 0; });
    const habitsDone = vault.habits.filter((h) => (h.done ?? []).includes(t)).length;
    const hs = healthSummary(vault.health);
    const item = (key, icon, color, title, detail) => `<button class="item" data-sub="${key}"><span class="ico ${color}">${I[icon]}</span><span class="grow"><span>${title}</span><br><span class="muted small">${esc(detail)}</span></span><span class="chev">${I.chev}</span></button>`;
    return `<div class="row"><div class="avatar" aria-hidden="true">M</div><div class="grow"><h1>Manu</h1><p class="muted">${esc(longDate())}</p></div></div>
      ${sectionTitle("¿Cómo estás hoy?")}
      <section class="card"><div class="mood">${MOODS.map((m) => `<button data-act="mood" data-v="${m.value}" aria-pressed="${mood === m.value}"><b>${m.value}</b>${m.label}</button>`).join("")}</div>
        <div class="row"><span class="muted small">Últimos 7 días</span><span class="dots">${week.map((v) => `<i data-v="${v}" title="${v ? MOODS[v - 1].label : "Sin dato"}"></i>`).join("")}</span></div>
        ${mood === 1 ? '<button class="btn ghost" data-act="refuge">Abrir el Refugio</button>' : ""}</section>
      ${sectionTitle("Tu vida")}
      <div class="list">
        ${item("habitos", "repeat", "green", "Hábitos", vault.habits.length ? `${habitsDone} de ${vault.habits.length} hechos hoy` : "Crea tu primer hábito")}
        ${item("salud", "pulse", "red", "Salud", hs.sleep !== null || hs.steps !== null ? [hs.sleep !== null ? `${dec(hs.sleep)} h de sueño` : null, hs.steps !== null ? `${Math.round(hs.steps)} pasos` : null].filter(Boolean).join(" · ") + " (media semanal)" : "Sueño, pasos y peso")}
        ${item("comidas", "fork", "orange", "Comidas", `${vault.meals.filter((m) => m.day === t).length} apuntadas hoy`)}
        ${item("personas", "people", "purple", "Personas", vault.people.length ? `${vault.people.length} personas` : "Cumpleaños y detalles")}
        <button class="item" data-act="refuge"><span class="ico teal">${I.leaf}</span><span class="grow"><span>Refugio</span><br><span class="muted small">Para cuando no estás bien</span></span><span class="chev">${I.chev}</span></button>
      </div>
      ${sectionTitle("Ajustes")}
      <div class="list">
        ${item("tiempo", "pin", "blue", "Tiempo y ciudades", `Casa: ${(vault.settings.homeCity ?? CITIES.GIJON).name}`)}
        ${item("gcal", "google", "blue", "Google Calendar", isClientId(vault.settings.gcalClientId) ? "Configurado" : "Conectar tu calendario")}
        ${item("avisos", "bell", "red", "Avisos, alarmas y Atajos", "Recordatorios que suenan en el iPhone")}
        ${item("datos", "box", "gray", "Tus datos", "Copia, restaurar y borrar")}
      </div>
      <p class="muted small">MANU OS web · versión ${APP_VERSION} · datos solo en este dispositivo</p>`;
  },
};

const backBar = (title) => `<button class="link" data-act="back">${I.back} Tú</button><h1>${title}</h1>`;

const subpages = {
  habitos() {
    const t = localDay();
    return `${backBar("Hábitos")}<p class="subtitle">Sin presión: lo que cuenta es volver.</p>
      <div class="stack">${vault.habits.map((h) => `<section class="card"><div class="row"><button class="check" data-act="habit" data-id="${esc(h.id)}" aria-pressed="${(h.done ?? []).includes(t)}" aria-label="Hecho hoy: ${esc(h.name)}">${I.check}</button><span class="grow">${esc(h.name)}</span><span class="chip">${streak(h)} días</span></div>
        <div class="row"><span class="dots">${lastDays(h).map((d) => `<i data-v="${d.done ? 4 : 0}" title="${d.day}"></i>`).join("")}</span><button class="link small" data-act="del" data-list="habits" data-id="${esc(h.id)}">Quitar</button></div></section>`).join("")}
      <form class="card" id="addHabit"><label for="habitName" class="muted small">Nuevo hábito</label><input id="habitName" maxlength="60" placeholder="Caminar 20 minutos"><button class="btn" type="submit">Añadir hábito</button></form></div>`;
  },
  salud() {
    const t = localDay();
    const get = (k) => vault.health.find((e) => e.day === t && e.kind === k)?.value ?? "";
    const hs = healthSummary(vault.health);
    return `${backBar("Salud")}<p class="subtitle">Lo que quieras apuntar. Nunca sale de tu móvil.</p>
      <form class="card" id="healthForm"><h2>Hoy</h2>
        <label class="muted small" for="hSleep">Horas de sueño</label><input id="hSleep" inputmode="decimal" value="${esc(get("SLEEP"))}" placeholder="7,5">
        <label class="muted small" for="hSteps">Pasos</label><input id="hSteps" inputmode="numeric" value="${esc(get("STEPS"))}" placeholder="8000">
        <label class="muted small" for="hWeight">Peso (kg)</label><input id="hWeight" inputmode="decimal" value="${esc(get("WEIGHT"))}" placeholder="75">
        <button class="btn" type="submit">Guardar</button></form>
      <section class="card"><h2>Media de 7 días</h2>
        <div class="row"><span>Sueño</span><span class="num">${dec(hs.sleep)} h</span></div>
        <div class="row"><span>Pasos</span><span class="num">${hs.steps !== null ? Math.round(hs.steps) : "—"}</span></div>
        <div class="row"><span>Peso</span><span class="num">${dec(hs.weight)} kg</span></div></section>
      <p class="muted small">La web no puede leer Salud de Apple. Un atajo podría copiar tus pasos y sueño; lo añadiré en una próxima versión.</p>`;
  },
  comidas() {
    const t = localDay();
    const todays = vault.meals.filter((m) => m.day === t);
    const fav = frequentMeals(vault.meals);
    return `${backBar("Comidas")}<p class="subtitle">Ahora toca: ${esc(mealSlot())}</p>
      <form class="card" id="addMeal"><label for="mealText" class="muted small">¿Qué has comido?</label><input id="mealText" maxlength="100" placeholder="Tostada con tomate y café"><button class="btn" type="submit">Apuntar ${esc(mealSlot().toLowerCase())}</button>
        ${fav.length ? `<div class="suggest">${fav.map((f) => `<button type="button" data-act="meal-fav" data-text="${esc(f)}">${esc(f)}</button>`).join("")}</div>` : ""}</form>
      ${sectionTitle("Hoy")}
      <section class="card">${todays.length ? todays.map((m) => `<div class="row"><div class="grow"><div>${esc(m.text)}</div><div class="muted small">${esc(m.slot)} · ${esc(m.time)}</div></div><button class="link small" data-act="del" data-list="meals" data-id="${esc(m.id)}">Quitar</button></div>`).join("") : '<p class="muted">Aún nada hoy.</p>'}</section>`;
  },
  personas() {
    const soon = upcomingBirthdays(vault.people, today(), 30);
    const quiet = longTimeNoTalk(vault.people);
    return `${backBar("Personas")}<p class="subtitle">Fechas y detalles que no quieres olvidar.</p>
      ${soon.length ? `<section class="card"><h2>Cumpleaños próximos</h2>${soon.map((b) => `<div class="row"><span class="grow">${esc(b.person.name)}</span><span class="muted">${b.days === 0 ? "¡Hoy!" : `En ${b.days} días`}</span></div>`).join("")}</section>` : ""}
      ${quiet.length ? `<section class="card"><h2>Hace tiempo que no hablas con</h2>${quiet.map((p) => `<div class="row"><span class="grow">${esc(p.name)}</span><button class="link small" data-act="talked" data-id="${esc(p.id)}">Hablé hoy</button></div>`).join("")}</section>` : ""}
      ${sectionTitle("Todas")}
      <div class="list">${vault.people.length ? vault.people.map((p) => { const d = daysUntilBirthday(p.birthday); return `<details><summary class="item"><span class="ico purple">${esc(p.name.slice(0, 1).toUpperCase())}</span><span class="grow"><span>${esc(p.name)}</span><br><span class="muted small">${d !== null ? `Cumple en ${d} días` : "Sin cumpleaños"}${p.lastContact ? ` · última vez ${new Date(p.lastContact).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}` : ""}</span></span></summary>
        <div class="inner">${p.notes ? `<p>${esc(p.notes)}</p>` : '<p class="muted small">Sin notas.</p>'}<div class="btns"><button class="btn ghost" data-act="talked" data-id="${esc(p.id)}">Hablé hoy</button><button class="btn danger" data-act="del" data-list="people" data-id="${esc(p.id)}">Quitar</button></div></div></details>`; }).join("") : '<p class="muted item">Aún no hay nadie.</p>'}</div>
      <form class="card" id="addPerson"><h2>Añadir persona</h2>
        <label for="pName" class="muted small">Nombre</label><input id="pName" maxlength="60" required>
        <label for="pBirthday" class="muted small">Cumpleaños (el año no hace falta)</label><input id="pBirthday" type="date">
        <label for="pNotes" class="muted small">Detalles (gustos, regalos, planes)</label><textarea id="pNotes" rows="2" maxlength="300"></textarea>
        <button class="btn" type="submit">Guardar</button></form>`;
  },
  tiempo() {
    const home = vault.settings.homeCity ?? CITIES.GIJON;
    return `${backBar("Tiempo y ciudades")}
      <section class="card"><h2>Ciudad de casa</h2><p>${esc(home.name)}</p><p class="muted small">Cuando dices que mañana trabajas en Oviedo, ese día el tiempo es el de Oviedo.</p>
        <form id="citySearch" class="stack"><label for="cityName" class="muted small">Buscar otra ciudad</label><input id="cityName" type="search" maxlength="80" placeholder="Gijón"><button class="btn ghost" type="submit">Buscar</button></form>
        ${cityResults ? (cityResults.length ? cityResults.map((c, i) => `<button class="item" data-act="home-city" data-i="${i}"><span class="grow">${esc(c.name)}<br><span class="muted small">${esc(c.region)}</span></span></button>`).join("") : '<p class="muted">No he encontrado esa ciudad.</p>') : ""}
        ${home.name !== CITIES.GIJON.name ? '<button class="link" data-act="home-gijon">Volver a Gijón</button>' : ""}</section>
      <section class="card"><h2>Mañanas</h2><form class="row" id="workStartForm"><label for="workStart" class="grow">Hora de entrada al trabajo</label><input id="workStart" type="time" value="${esc(vault.settings.workStart ?? "09:00")}"></form><div class="row"><span>Contar tiempo para desayunar</span><button class="check" data-act="breakfast" aria-pressed="${vault.settings.wantsBreakfast !== false}" aria-label="Desayuno">${I.check}</button></div></section>
      <p class="muted small">Datos del tiempo: Open-Meteo. Solo se envían las coordenadas de la ciudad.</p>`;
  },
  gcal() {
    const id = vault.settings.gcalClientId ?? "";
    const ok = isClientId(id);
    return `${backBar("Google Calendar")}
      <section class="card"><h2>Estado</h2><p>${ok ? (gcal.token && Date.now() < gcal.expires ? "Conectado en esta sesión." : "Configurado. Al sincronizar, Google te pedirá permiso.") : "Sin configurar."}</p>
        ${ok ? '<button class="btn" data-act="gcal-sync">Sincronizar ahora</button>' : ""}
        <form id="gcalForm" class="stack"><label for="gcalId" class="muted small">ID de cliente OAuth (termina en .apps.googleusercontent.com). No es una contraseña.</label><input id="gcalId" value="${esc(id)}" autocomplete="off" spellcheck="false" placeholder="123-abc.apps.googleusercontent.com"><button class="btn ghost" type="submit">Guardar ID</button></form></section>
      <section class="card"><h2>Cómo conseguir el ID (una vez, mejor desde el ordenador)</h2><ol class="muted small">
        <li>Entra en <b>console.cloud.google.com</b> con tu cuenta de Google y crea un proyecto llamado «MANU OS». Es gratis.</li>
        <li>«APIs y servicios» → «Biblioteca» → busca <b>Google Calendar API</b> → Habilitar.</li>
        <li>«Pantalla de consentimiento de OAuth» → tipo <b>Externo</b> → nombre «MANU OS» y tu correo. En «Usuarios de prueba» añade tu propio Gmail.</li>
        <li>«Credenciales» → «Crear credenciales» → <b>ID de cliente de OAuth</b> → tipo «Aplicación web».</li>
        <li>En «Orígenes de JavaScript autorizados» añade <code>https://elpiernitas.github.io</code>.</li>
        <li>Copia el <b>ID de cliente</b> y pégalo arriba. El «secreto de cliente» no hace falta: no lo pegues en ningún sitio.</li></ol>
        <p class="muted small">MANU solo pide permiso para ver y crear eventos. El permiso dura una hora; luego vuelve a pedirlo al sincronizar. Los nombres de los menús de Google pueden variar.</p></section>`;
  },
  avisos() {
    const n = notificationStatus();
    const status = { unsupported: isInstalled() ? "Este dispositivo no permite avisos web." : "Primero añade MANU a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde ahí.", default: "Desactivados.", granted: "Activados.", denied: "Bloqueados. Actívalos en Ajustes → Notificaciones → MANU." }[n];
    return `${backBar("Avisos y Atajos")}
      <section class="card"><h2>${I.bell} Avisos de MANU</h2><p class="muted">${esc(status)}</p>
        <div class="btns">${n === "default" ? '<button class="btn" data-act="notify-on">Activar avisos</button>' : ""}${n === "granted" ? '<button class="btn ghost" data-act="notify-test">Probar un aviso</button>' : ""}</div>
        <p class="muted small">Los recordatorios avisan mientras MANU está abierta. Para que suenen siempre, mándalos al iPhone con los atajos de abajo.</p></section>
      <section class="card"><h2>${I.bolt} Atajos (se crean una vez)</h2>
        <p class="muted small">Crea estos atajos en la app Atajos con el nombre exacto. Los nombres de las acciones pueden variar según tu iOS. NO_VERIFICADO en tu iPhone.</p>
        <details><summary>«${SHORTCUT_ALARM}»: alarmas</summary><ol class="muted small"><li>Nuevo atajo llamado <b>${SHORTCUT_ALARM}</b>.</li><li>Acción «Obtener fechas de» → Entrada del atajo.</li><li>Acción «Crear alarma» (Reloj) con esa hora.</li><li>En MANU, «Poner alarma» abre este atajo con la hora.</li></ol></details>
        <details><summary>«${SHORTCUT_REMINDER}»: recordatorios que suenan</summary><ol class="muted small"><li>Nuevo atajo llamado <b>${SHORTCUT_REMINDER}</b>.</li><li>«Dividir texto» la Entrada del atajo por el separador personalizado <code>|</code>.</li><li>«Obtener elemento de la lista» → primer elemento (el texto).</li><li>«Obtener elemento de la lista» → último elemento → «Obtener fechas de».</li><li>«Añadir nuevo recordatorio» con el texto y alerta en esa fecha.</li></ol></details>
        <details><summary>Apuntar a MANU desde Siri</summary><ol class="muted small"><li>«Solicitar entrada» (texto).</li><li>«URL»: <code>${esc(SITE)}?di=</code> + Entrada proporcionada.</li><li>«Abrir URL». Se abre en Safari, que guarda sus datos aparte del icono (NO_VERIFICADO).</li></ol></details>
        <details><summary>Traer la agenda de hoy</summary><ol class="muted small"><li>«Buscar eventos del calendario» de hoy.</li><li>«Repetir con cada» → «Texto»: hora de inicio (HH:mm), espacio y título.</li><li>«Combinar texto» con saltos de línea → «Copiar al portapapeles».</li><li>Abre MANU → Agenda → Pegar eventos de hoy.</li></ol></details></section>`;
  },
  datos() {
    return `${backBar("Tus datos")}
      <section class="card"><p class="muted">Todo se guarda solo en este dispositivo. Si borras los datos de Safari, se pierden: descarga una copia de vez en cuando.</p>
        <div class="btns"><button class="btn ghost" data-act="export">Descargar copia</button><label class="btn ghost" for="import" role="button" tabindex="0">Restaurar copia</label><input id="import" type="file" accept="application/json,.json" class="sr"></div>
        ${confirmWipe ? '<p>¿Seguro? Se borra todo lo guardado en este dispositivo.</p><div class="btns"><button class="btn danger" data-act="wipe-yes">Sí, borrar todo</button><button class="btn ghost" data-act="wipe-no">Cancelar</button></div>' : '<button class="link" data-act="wipe">Borrar todos los datos…</button>'}</section>`;
  },
};

// ---------- Quick add sheet ----------
const KINDS = [["TASK", "Tarea"], ["IDEA", "Idea"], ["EXPENSE", "Gasto"], ["REMINDER", "Aviso"]];
const kindsFor = (k) => (k === "EVENT" ? [["EVENT", "Evento en Google"]] : KINDS);
function sheetHtml() {
  if (!sheet) return "";
  const k = sheet.kind;
  const soon = new Date(Date.now() + 3600e3);
  soon.setMinutes(0, 0, 0);
  const local = `${dayKey(soon)}T${hhmm(soon)}`;
  const fields = {
    TASK: '<label for="qText" class="sr">Tarea</label><input id="qText" maxlength="140" placeholder="¿Qué tienes que hacer?" required>',
    IDEA: '<label for="qText" class="sr">Idea</label><textarea id="qText" rows="3" maxlength="400" placeholder="Apunta la idea" required></textarea>',
    EXPENSE: '<label for="qAmount" class="muted small">Importe (€)</label><input id="qAmount" inputmode="decimal" placeholder="12,50" required><label for="qText" class="muted small">Concepto</label><input id="qText" maxlength="80" placeholder="Café">',
    EVENT: `<label for="qText" class="sr">Evento</label><input id="qText" maxlength="140" placeholder="Título del evento" required><label for="qWhen" class="muted small">Empieza</label><input id="qWhen" type="datetime-local" value="${local}" required><label for="qMinutes" class="muted small">Duración (minutos)</label><input id="qMinutes" inputmode="numeric" value="60">`,
    REMINDER: `<label for="qText" class="sr">Recordatorio</label><input id="qText" maxlength="140" placeholder="¿Qué te recuerdo?" required><label for="qWhen" class="muted small">Cuándo</label><input id="qWhen" type="datetime-local" value="${local}" required>`,
  }[k];
  return `<div class="sheet-bg" id="sheetBg"><form class="sheet glass" id="quickAdd" role="dialog" aria-modal="true" aria-label="Añadir">
    <div class="grabber"></div>
    <div class="segmented${k === "EVENT" ? " one" : ""}" role="group" aria-label="Tipo">${kindsFor(k).map(([id, label]) => `<button type="button" data-kind="${id}" data-act="sheet" aria-pressed="${id === k}">${label}</button>`).join("")}</div>
    ${fields}<button class="btn block" type="submit">Guardar</button><button class="btn ghost block" type="button" data-act="sheet-close">Cancelar</button></form></div>`;
}

// ---------- Render ----------
function render({ focus = false } = {}) {
  document.body.dataset.mode = modeState(today(), undefined, vault.settings.override).mode;
  $("tabs").innerHTML = TABS.map(([id, label]) => `<button class="tab" role="tab" data-tab="${id}" aria-selected="${tab === id}">${id === "manu" ? '<span class="dot" aria-hidden="true">M</span>' : I[id]}<span>${label}</span></button>`).join("");
  $("screen").innerHTML = overlay === "weather" ? weatherPage() : (screens[tab] ?? screens.hoy)();
  $("screen").querySelectorAll(".bar > i[data-w]").forEach((el) => { el.style.width = `${el.dataset.w}%`; });
  $("screen").querySelectorAll(".range > i").forEach((el) => { el.style.left = `${el.dataset.l}%`; el.style.width = `${el.dataset.w}%`; });
  $("topTitle").textContent = sub ? { habitos: "Hábitos", salud: "Salud", comidas: "Comidas", personas: "Personas", tiempo: "Tiempo", avisos: "Avisos", datos: "Tus datos", gcal: "Google Calendar" }[sub] : TABS.find(([id]) => id === tab)[1];
  $("fab").hidden = tab === "manu" || Boolean(sheet);
  $("sheetRoot").innerHTML = sheetHtml();
  if (sheet) $("qText")?.focus();
  if (tab === "manu") $("chat")?.lastElementChild?.scrollIntoView({ block: "end" });
  if (focus) $("screen").focus();
}

function go(newTab) {
  tab = newTab;
  sub = null;
  overlay = null;
  sessionStorage.setItem("manuos.tab", tab);
  render({ focus: true });
  scrollTo(0, 0);
  if (tab === "hoy") refreshWeather();
}

// ---------- Chat ----------
function say(text) {
  const clean = text.trim();
  if (!clean) return;
  if (refuge) {
    const r = refugeReply(refuge.state, clean);
    refuge = { state: r.state, messages: [...refuge.messages, { from: "me", text: clean }, { from: "manu", text: r.reply, safety: r.state.phase === "HUMAN_HELP" }] };
    render();
    return;
  }
  const intent = parse(clean);
  const now = new Date();
  const at = now.toISOString();
  if (intent.kind === "refuge" || intent.kind === "lowMood") {
    refuge = { state: initialRefuge(), messages: [{ from: "me", text: clean }, { from: "manu", text: reply(intent, variant++) }] };
    render();
    return;
  }
  if (intent.kind === "crisis") {
    refuge = { state: { phase: "HUMAN_HELP", turn: 0 }, messages: [{ from: "me", text: clean }, { from: "manu", text: reply(intent), safety: true }] };
    render();
    return;
  }
  let action = null;
  if (intent.kind === "expense") vault.spending.push(newEntry({ id: uid("s"), cents: intent.cents, merchant: intent.merchant, at }));
  if (intent.kind === "idea") vault.inbox.push(capture({ id: uid("c"), text: intent.text, at }));
  if (intent.kind === "alarm") action = { label: `Poner en el iPhone · ${intent.time}`, href: shortcutUrl(SHORTCUT_ALARM, intent.time) };
  if (intent.kind === "reminder") {
    const when = new Date(now);
    if (intent.tomorrow) when.setDate(when.getDate() + 1);
    const [h, m] = intent.time.split(":").map(Number);
    when.setHours(h, m, 0, 0);
    if (!intent.tomorrow && when < now) when.setDate(when.getDate() + 1);
    const r = { id: uid("r"), text: intent.text, at: when.toISOString(), done: false, notified: false };
    vault.reminders.push(r);
    action = { label: "Añadir al iPhone", href: reminderIphoneUrl(r) };
  }
  if (intent.kind === "agenda") { setTimeout(() => go("agenda"), 900); }
  vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text: reply(intent, variant++), at, ...(action ? { action } : {}) });
  persist();
  render();
}

// ---------- Events ----------
function updateItem(id, fn) {
  vault.inbox = vault.inbox.map((i) => (i.id === id ? fn(i) : i));
  persist();
  render();
}

document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-tab]");
  if (t) { go(t.dataset.tab); return; }
  const sb = e.target.closest("[data-sub]");
  if (sb) { sub = sb.dataset.sub; cityResults = null; render({ focus: true }); scrollTo(0, 0); return; }
  const s = e.target.closest("[data-say]");
  if (s) { say(s.dataset.say); return; }
  if (e.target.id === "fab" || e.target.closest("#fab")) { sheet = { kind: tab === "dinero" ? "EXPENSE" : "TASK" }; render(); return; }
  if (e.target.id === "sheetBg") { sheet = null; render(); return; }
  const a = e.target.closest("[data-act]");
  if (!a) return;
  const id = a.dataset.id;
  switch (a.dataset.act) {
    case "task": updateItem(id, (i) => confirm(i, "TASK")); toast("Guardada como tarea"); break;
    case "idea": updateItem(id, (i) => confirm(i, "IDEA")); toast("Guardada como idea"); break;
    case "idea-to-task": updateItem(id, (i) => ({ ...i, status: "TASK" })); toast("Ahora es una tarea"); break;
    case "forget": updateItem(id, markUnclassified); break;
    case "toggle": updateItem(id, toggleDone); break;
    case "rem-done": vault.reminders = vault.reminders.map((r) => (r.id === id ? { ...r, done: !r.done } : r)); persist(); render(); break;
    case "sheet": sheet = { kind: a.dataset.kind }; render(); break;
    case "sheet-close": sheet = null; render(); break;
    case "refuge": refuge = { state: initialRefuge(), messages: [{ from: "manu", text: "Estoy aquí. ¿Qué te vendría mejor ahora: entender por qué estás así, buscar una solución o cambiar de aire?" }] }; go("manu"); break;
    case "leave-refuge": refuge = null; render(); break;
    case "back": sub = null; render({ focus: true }); break;
    case "weather-open": overlay = "weather"; render({ focus: true }); scrollTo(0, 0); refreshWeather(); break;
    case "overlay-close": overlay = null; render({ focus: true }); scrollTo(0, 0); break;
    case "goto-gcal": tab = "tu"; sub = "gcal"; render({ focus: true }); scrollTo(0, 0); break;
    case "gcal-sync": syncGoogle(); break;
    case "mood": vault.moods = setMood(vault.moods, localDay(), Number(a.dataset.v)); persist(); render(); break;
    case "habit": vault.habits = vault.habits.map((h) => (h.id === id ? toggleHabit(h, localDay()) : h)); persist(); render(); break;
    case "talked": vault.people = vault.people.map((p) => (p.id === id ? { ...p, lastContact: new Date().toISOString() } : p)); persist(); render(); toast("Anotado"); break;
    case "del": vault[a.dataset.list] = vault[a.dataset.list].filter((x) => x.id !== id); persist(); render(); break;
    case "meal-fav": addMeal(a.dataset.text); break;
    case "city": {
      const c = [CITIES.GIJON, CITIES.OVIEDO, vault.settings.homeCity].find((x) => x && x.name === a.dataset.city);
      if (c) { vault.settings.cityOverride = { day: localDay(), city: c }; persist(); render(); refreshWeather(true); }
      break;
    }
    case "home-city": { const c = cityResults?.[Number(a.dataset.i)]; if (c) { vault.settings.homeCity = c; vault.settings.cityOverride = null; cityResults = null; persist(); render(); refreshWeather(true); toast(`Casa: ${c.name}`); } break; }
    case "home-gijon": vault.settings.homeCity = CITIES.GIJON; persist(); render(); refreshWeather(true); break;
    case "breakfast": vault.settings.wantsBreakfast = vault.settings.wantsBreakfast === false; persist(); render(); break;
    case "tomorrow": {
      const c = a.dataset.city;
      vault.settings.tomorrow = { day: tomorrowKey(), work: c !== "NONE", city: c === "NONE" ? "GIJON" : c };
      persist(); render(); break;
    }
    case "tomorrow-reset": vault.settings.tomorrow = null; persist(); render(); break;
    case "notify-on": await enableNotifications(); render(); break;
    case "notify-test": if (!(await testNotification())) toast("No se ha podido mostrar el aviso."); break;
    case "export": exportBackup(); break;
    case "wipe": confirmWipe = true; render(); break;
    case "wipe-no": confirmWipe = false; render(); break;
    case "wipe-yes": vault = emptyVault(); confirmWipe = false; persist(); render(); toast("Datos borrados de este dispositivo"); break;
  }
});

document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("label[for]") && e.target.getAttribute("role") === "button") { e.preventDefault(); $(e.target.getAttribute("for"))?.click(); }
  if (e.key === "Escape" && sheet) { sheet = null; render(); }
});

function addMeal(text) {
  const clean = String(text ?? "").trim().slice(0, 100);
  if (!clean) return;
  const now = new Date();
  vault.meals.push({ id: uid("m"), day: localDay(), time: hhmm(now), slot: mealSlot(now), text: clean });
  persist(); render(); toast("Comida apuntada");
}

const num = (v) => { const n = Number(String(v).replace(",", ".")); return v !== "" && Number.isFinite(n) && n >= 0 ? n : null; };

document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target.id;
  if (f === "composer") { const input = $("msg"); const v = input.value; input.value = ""; say(v); $("msg")?.focus(); return; }
  if (f === "pasteEvents") { const events = parseEvents($("eventsText").value); vault.agenda = { day: localDay(), events, importedAt: new Date().toISOString() }; persist(); render(); toast(events.length ? `Agenda de hoy: ${events.length} evento${events.length === 1 ? "" : "s"}` : "No he reconocido ningún evento"); return; }
  if (f === "gcalForm") {
    const id = $("gcalId").value.trim();
    if (id && !isClientId(id)) { toast("Ese no parece un ID de cliente de Google"); return; }
    vault.settings.gcalClientId = id || null; gcal.client = null; gcal.token = null;
    persist(); render(); toast(id ? "ID guardado" : "Google Calendar desconectado"); return;
  }
  if (f === "workStartForm") return;
  if (f === "addHabit") { const n = $("habitName").value.trim(); if (n) { vault.habits.push({ id: uid("h"), name: n.slice(0, 60), done: [] }); persist(); render(); } return; }
  if (f === "addMeal") { addMeal($("mealText").value); return; }
  if (f === "addPerson") {
    const name = $("pName").value.trim();
    if (!name) return;
    const b = $("pBirthday").value; // YYYY-MM-DD
    vault.people.push({ id: uid("p"), name: name.slice(0, 60), birthday: b ? b.slice(5) : null, notes: $("pNotes").value.trim().slice(0, 300) || null, lastContact: null });
    persist(); render(); toast("Persona guardada"); return;
  }
  if (f === "healthForm") {
    const t = localDay();
    const set = (kind, v) => { vault.health = vault.health.filter((x) => !(x.day === t && x.kind === kind)); if (v !== null) vault.health.push({ day: t, kind, value: v }); };
    set("SLEEP", num($("hSleep").value)); set("STEPS", num($("hSteps").value)); set("WEIGHT", num($("hWeight").value));
    persist(); render(); toast("Salud guardada"); return;
  }
  if (f === "citySearch") {
    const q = $("cityName").value.trim();
    if (!q) return;
    try { cityResults = await searchCities(q); } catch { cityResults = null; toast("No he podido buscar ahora. ¿Tienes conexión?"); }
    render(); return;
  }
  if (f === "quickAdd") {
    const text = $("qText")?.value.trim() ?? "";
    const at = new Date().toISOString();
    const k = sheet.kind;
    if (k === "TASK" && text) vault.inbox.push({ ...capture({ id: uid("c"), text: text.slice(0, 140), at }), status: "TASK" });
    else if (k === "IDEA" && text) vault.inbox.push({ ...capture({ id: uid("c"), text: text.slice(0, 400), at }), status: "IDEA" });
    else if (k === "EXPENSE") {
      const cents = toCents($("qAmount").value.replace(/\s|€/g, ""));
      if (!cents) { toast("Pon un importe válido, por ejemplo 12,50"); return; }
      vault.spending.push(newEntry({ id: uid("s"), cents, merchant: text || null, at }));
    } else if (k === "EVENT" && text) {
      const minutes = Math.min(1440, Math.max(5, Number($("qMinutes").value) || 60));
      try {
        const token = await googleToken();
        await createEvent(token, newEventBody({ title: text, start: $("qWhen").value, minutes }));
        sheet = null; render(); toast("Evento creado en Google Calendar"); syncGoogle();
      } catch (err) { toast(err.message || "No se pudo crear el evento"); }
      return;
    } else if (k === "REMINDER" && text) {
      const when = new Date($("qWhen").value);
      if (Number.isNaN(when.getTime())) { toast("Elige cuándo"); return; }
      vault.reminders.push({ id: uid("r"), text: text.slice(0, 140), at: when.toISOString(), done: false, notified: false });
    } else return;
    sheet = null; persist(); render();
    toast({ TASK: "Tarea añadida", IDEA: "Idea guardada", EXPENSE: "Gasto apuntado", REMINDER: "Recordatorio creado" }[k]);
  }
});

document.addEventListener("change", async (e) => {
  if (e.target.id === "workStart" && /^\d{2}:\d{2}$/.test(e.target.value)) { vault.settings.workStart = e.target.value; persist(); toast(`Entrada: ${e.target.value}`); return; }
  if (e.target.dataset.cat) {
    vault.spending = vault.spending.map((x) => (x.id === e.target.dataset.cat ? correctCategory(x, e.target.value) : x));
    persist(); render(); return;
  }
  if (e.target.id === "bankFile" && e.target.files?.[0]) {
    const r = importStatement(await e.target.files[0].text(), new Set(vault.spending.map((x) => x.id)));
    if (r.error) { toast(r.error); return; }
    vault.spending.push(...r.entries);
    vault.settings.lastImport = { at: new Date().toISOString(), added: r.entries.length, duplicates: r.duplicates, income: r.skippedIncome, invalid: r.skippedInvalid };
    persist(); render(); toast(`${r.entries.length} gastos importados`); return;
  }
  if (e.target.id === "import" && e.target.files?.[0]) {
    try {
      const result = validateVault(JSON.parse(await e.target.files[0].text()));
      if (!result.ok) { toast(result.reason); return; }
      vault = result.vault; persist(); render(); toast("Copia restaurada");
    } catch { toast("Ese archivo no es una copia de MANU OS."); }
  }
});

// ---------- Google Calendar (Google Identity Services token model) ----------
function loadGis() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "https://accounts.google.com/gsi/client";
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("No se pudo cargar el acceso de Google. ¿Tienes conexión?"));
    document.head.appendChild(el);
  });
}

async function googleToken() {
  if (gcal.token && Date.now() < gcal.expires - 60000) return gcal.token;
  const id = vault.settings.gcalClientId;
  if (!isClientId(id)) throw new Error("Configura Google Calendar en Tú → Google Calendar");
  await loadGis();
  return new Promise((resolve, reject) => {
    gcal.client = google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: GCAL_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) { reject(new Error("Google no ha dado permiso")); return; }
        gcal.token = resp.access_token;
        gcal.expires = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        resolve(gcal.token);
      },
      error_callback: () => reject(new Error("Se cerró la ventana de Google")),
    });
    gcal.client.requestAccessToken({ prompt: "" });
  });
}

async function syncGoogle() {
  if (gcal.busy) return;
  gcal.busy = true; gcal.error = null; render();
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 2);
    let days;
    try { days = await listEvents(await googleToken(), start, end); }
    catch (err) { if (err.code !== "auth") throw err; gcal.token = null; days = await listEvents(await googleToken(), start, end); }
    const t = localDay(); const tk = tomorrowKey();
    vault.agenda = { day: t, events: days.get(t) ?? [], importedAt: new Date().toISOString(), source: "GOOGLE" };
    vault.agendaTomorrow = { day: tk, events: days.get(tk) ?? [] };
    vault.settings.gcalSyncedAt = new Date().toISOString();
    persist();
    toast(`Google Calendar: ${vault.agenda.events.length} hoy, ${vault.agendaTomorrow.events.length} mañana`);
  } catch (err) {
    gcal.error = err.message || "No se pudo sincronizar";
  } finally {
    gcal.busy = false; render();
  }
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(vault, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `manu-os-copia-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// Reminders while the app is open (for always-on alerts, the iOS Shortcut).
async function checkReminders() {
  const due = dueReminders(vault.reminders);
  if (!due.length) return;
  for (const r of due) {
    let shown = false;
    if (notificationStatus() === "granted") {
      try { const reg = await navigator.serviceWorker.ready; await reg.showNotification("MANU", { body: r.text, tag: r.id, icon: "icons/icon-192.png" }); shown = true; } catch {}
    }
    if (!shown) toast(`⏰ ${r.text}`);
  }
  const ids = new Set(due.map((r) => r.id));
  vault.reminders = vault.reminders.map((r) => (ids.has(r.id) ? { ...r, notified: true } : r));
  persist();
  render();
}

// Scroll-edge glass bar.
addEventListener("scroll", () => $("topbar").classList.toggle("show", scrollY > 48), { passive: true });
addEventListener("online", () => refreshWeather());

if (loaded.warning) { $("banner").textContent = loaded.warning; $("banner").hidden = false; }
if ("serviceWorker" in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController) toast("MANU se ha actualizado"); });
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

const launch = launchParams(location.search);
if (launch.say || launch.events) {
  history.replaceState(null, "", location.pathname);
  if (launch.events) { vault.agenda = { day: localDay(), events: launch.events, importedAt: new Date().toISOString() }; persist(); tab = "agenda"; }
  if (launch.say) { tab = "manu"; say(launch.say); }
}
render();
refreshWeather();
checkReminders();
setInterval(checkReminders, 30000);
setInterval(() => { if (tab === "hoy" && !sheet && !document.activeElement?.matches("input, textarea")) render(); }, 60000);
