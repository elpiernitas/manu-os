import { parse, reply } from "./core/assistant.js";
import { CATEGORIES, CATEGORY_EMOJI, euros, newEntry, learnCategory, summary, toCents, rulesFromRows, applyRules } from "./core/money.js";
import { MODE_TITLES, modeState } from "./core/modes.js";
import { capture, confirm, markUnclassified, pending, tasks, ideas, toggleDone } from "./core/inbox.js";
import { initialRefuge, refugeReply } from "./core/refuge.js";
import { LocalStore, emptyVault, validateVault, wipeDeviceKeys } from "./core/storage.js";
import { notificationStatus, isInstalled, enableNotifications, testNotification } from "./core/notify.js";
import { launchParams, parseEvents, nextEvent, localDay } from "./core/intake.js";
import { fetchForecast, searchCities, advice, WEATHER_TTL_MS } from "./core/weather.js";
import { importStatement, importStatementRows, classifiedFromRows, dropCrossSource } from "./core/bank.js";
import { CITIES, proposeAlarm, shouldAskTomorrow, shortcutUrl, guessCity } from "./core/night.js";
import { isClientId, listEvents, createEvent, newEventBody, monthGrid, listCalendars, mergeDays } from "./core/gcal.js";
import { detectRecurring, upcomingRecurring, spendingPattern } from "./core/insights.js";
import { SCOPE, runServices, planTaskSync, listOpenTasks, insertTask, completeTask, contactBirthdays, mergePeople, saveBackup, loadBackup } from "./core/google.js";
import { weatherEmoji, sceneFor, PARTICLES, MONEY_EMOJI } from "./core/scene.js";
import { isGeminiKey, isSensitive, pickModel, listModels, buildActionPayload, askWithActions, issueUrl } from "./core/ai.js";
import { encryptBackup, decryptBackup, passphraseProblem } from "./core/crypto.js";
import { isSpotifyClientId, pkceValid, randomVerifier, challengeFor, authorizeUrl, exchangeCode, refreshTokens, listDevices, findSpeaker, transferTo, DEFAULT_SPEAKER } from "./core/spotify.js";
import { appsFor, whatsappUrl, askElsewhereUrl } from "./core/hub.js";
import { toggleHabit, streak, lastDays, dayKey, daysUntilBirthday, upcomingBirthdays, longTimeNoTalk, mealSlot, frequentMeals, healthSummary, MOODS, setMood, dueReminders } from "./core/life.js";

export const APP_VERSION = "19";
const SITE = new URL(".", location.href).href;
const SHORTCUT_ALARM = "MANU Alarma";
const SHORTCUT_REMINDER = "MANU Recordatorio";
// Public OAuth client of Manu's Google Cloud project "MANU OS" (not a secret:
// it only works from the authorised origin https://elpiernitas.github.io).
const DEFAULT_GOOGLE_CLIENT_ID = "531306255339-r6gmmrvd0otte4ee4rr9rivb25le09ko.apps.googleusercontent.com";
// Client ID of Manu's Spotify app «MANU OS» (Development mode). Public by design
// with PKCE: there is no client secret in the app (ADR-0014).
const DEFAULT_SPOTIFY_CLIENT_ID = "f5a3acb0124f45179c0d1d0b54e66f3b";

const store = new LocalStore(globalThis.localStorage ?? { getItem: () => null, setItem: () => { throw new Error("no storage"); } });
const loaded = store.load();
let vault = loaded.vault;
let tab = sessionStorage.getItem("manuos.tab") || "hoy";
let sub = null; // Tú subpage
let refuge = null; // Refugio lives only in memory
let sheet = null; // quick add: { kind }
let confirmWipe = false;
let cityResults = null;
let moneyFilter = null; // "review"
let moneyMonth = 0; // months back from the current one in Dinero
let calView = null; // { y, m } month shown in Agenda
let calSelected = null; // "YYYY-MM-DD"
let overlay = null; // "weather"
const gcal = { tokens: {}, busy: false, error: null };
let confirmDriveRestore = null;
// Gemini key: never in the vault (so never in exports or backups). By default it
// lives only for this session; "Recordar" keeps it in this device's storage,
// a risk documented in ADR-0013 (readable by any script running on this origin).
const aiStore = {
  get remember() { try { return localStorage.getItem("manuos.gemini.remember") === "1"; } catch { return false; } },
  set remember(v) { try { v ? localStorage.setItem("manuos.gemini.remember", "1") : localStorage.removeItem("manuos.gemini.remember"); } catch {} },
  store() { return this.remember ? localStorage : sessionStorage; },
  get key() { try { return sessionStorage.getItem("manuos.gemini") || localStorage.getItem("manuos.gemini") || ""; } catch { return ""; } },
  set key(v) {
    try {
      sessionStorage.removeItem("manuos.gemini"); localStorage.removeItem("manuos.gemini");
      if (v) this.store().setItem("manuos.gemini", v);
    } catch {}
  },
  get model() { try { return localStorage.getItem("manuos.gemini.model") || ""; } catch { return ""; } },
  set model(v) { try { v ? localStorage.setItem("manuos.gemini.model", v) : localStorage.removeItem("manuos.gemini.model"); } catch {} },
};
const GOOGLE_FEATURES = [["calendar", "Calendar", "Ver tu agenda y crear eventos"], ["tasks", "Tasks", "Sincronizar tus tareas"], ["contacts", "Contactos", "Leer nombres y cumpleaños"], ["drive", "Drive", "Guardar una copia cifrada (solo cuando tú lo pidas)"]];
const googleOn = (k) => Boolean(vault.settings.google?.[k]);
const gClientId = () => vault.settings.gcalClientId || DEFAULT_GOOGLE_CLIENT_ID;
// Spotify tokens: device storage only, never in the vault or backups.
const spotifyStore = {
  get tokens() { try { return JSON.parse(localStorage.getItem("manuos.spotify.tokens") || "null"); } catch { return null; } },
  set tokens(v) { try { v ? localStorage.setItem("manuos.spotify.tokens", JSON.stringify(v)) : localStorage.removeItem("manuos.spotify.tokens"); } catch {} },
};
const spClientId = () => vault.settings.spotifyClientId || DEFAULT_SPOTIFY_CLIENT_ID;
const spotifyReady = () => isSpotifyClientId(spClientId());
const aiReady = () => Boolean(aiStore.key && aiStore.model && vault.settings.aiEnabled !== false);
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
  document.querySelectorAll(".toast").forEach((old) => old.remove()); // one at a time, the newest wins
  const t = document.createElement("div");
  t.className = "toast glass";
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add("show")));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 250); }, 2400);
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
  sun: svg('<circle cx="12" cy="12" r="4.5"/><path class="rays" d="M12 1.5v2.5M12 20v2.5M3.5 3.5l1.8 1.8M18.7 18.7l1.8 1.8M1.5 12H4M20 12h2.5M3.5 20.5l1.8-1.8M18.7 5.3l1.8-1.8"/>', 'class="wx wx-sun"'),
  "cloud-sun": svg('<path class="cloud" d="M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4 1.6A3.3 3.3 0 0 0 7 18z"/><path class="rays" d="M15 4.5l.7-1.6M19.5 7l1.6-.7"/>', 'class="wx wx-cloud"'),
  cloud: svg('<path class="cloud" d="M7 19h10a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 1.8A3.6 3.6 0 0 0 7 19z"/>', 'class="wx wx-cloud"'),
  fog: svg('<path d="M4 9h16M2 13h20M5 17h14"/>'),
  rain: svg('<path class="cloud" d="M7 15h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4 1.6A3.3 3.3 0 0 0 7 15z"/><path class="drops" d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/>', 'class="wx wx-rain"'),
  snow: svg('<path d="M7 14h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4 1.6A3.3 3.3 0 0 0 7 14z"/><path d="M9 18h.01M13 20h.01M17 18h.01"/>', 'stroke-width="2.6"'),
  storm: svg('<path d="M7 14h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4 1.6A3.3 3.3 0 0 0 7 14z"/><path d="M12 14l-2 4h4l-2 4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>', 'class="wx wx-moon"'),
  "cloud-moon": svg('<path class="cloud" d="M7 19h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4 1.6A3.3 3.3 0 0 0 7 19z"/><path d="M17 3.5a4 4 0 0 0 3.5 5.5"/>', 'class="wx wx-cloud"'),
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

function latestMonthOffset() {
  const last = vault.spending.reduce((m, x) => (x.at > m ? x.at : m), "");
  if (!last) return 0;
  const d = new Date(last), t = today();
  return Math.max(0, (t.getFullYear() - d.getFullYear()) * 12 + t.getMonth() - d.getMonth());
}
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

const wxE = (icon, cls = "") => `<span class="wx-emoji${cls ? ` ${cls}` : ""}" aria-hidden="true">${weatherEmoji(icon)}</span>`;
const sceneLayer = (scene) => `<div class="scene scene-${scene}" aria-hidden="true">${"<i></i>".repeat(PARTICLES[scene] ?? 0)}</div>`;
function currentWeather() {
  const city = activeCity();
  return vault.weather && vault.weather.city?.name === city.name ? vault.weather : null;
}
let celebrateMoney = false; // short money shower, only when entering Dinero
const moneyRain = () => `<div class="money-rain" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i>${MONEY_EMOJI[i % MONEY_EMOJI.length]}</i>`).join("")}</div>`;
const catLabel = (c) => `${CATEGORY_EMOJI[c] ?? "📦"} ${CATEGORIES[c] ?? c}`;

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
  const scene = sceneFor(f.now.icon);
  return `<section class="card hero scene-card sc-${scene}" aria-label="Tiempo en ${esc(city.name)}">
    ${sceneLayer(scene)}
    <button class="hero-tap" data-act="weather-open" aria-label="Ver el tiempo completo"></button>
    <div class="row"><h2>${esc(city.name)}</h2><span class="muted small">${age < 2 ? "ahora" : `hace ${age} min`} ›</span></div>
    <div class="weather-now">${wxE(f.now.icon, "big")}<div><div class="temp"><span data-count="${f.now.temp}">${f.now.temp}</span>°</div><div class="muted">${esc(f.now.text)} · ${f.today.min}° / ${f.today.max}°</div></div></div>
    ${f.hours?.length ? `<div class="hours">${f.hours.slice(0, 8).map((h) => `<div><span class="muted small">${esc(h.time)}</span>${wxE(h.icon)}<b>${h.temp}°</b></div>`).join("")}</div>` : ""}
    <p>${esc(advice(f))}</p>
    ${f.tomorrow ? `<p class="muted small">Mañana: ${esc(f.tomorrow.text.toLowerCase())}, ${f.tomorrow.min}°–${f.tomorrow.max}°${f.tomorrow.rain !== null ? `, lluvia ${f.tomorrow.rain} %` : ""}.</p>` : ""}
    <div class="btns">${cityChips}</div></section>`;
}

// Step-by-step Gemini setup, opened from «Activar». Disappears once the key works.
let guideStep = 0;
function geminiGuide() {
  const step = (n, title, body, action = "") => `<section class="card guide-step${guideStep > n ? " done" : ""}"><div class="row"><span class="step-n" aria-hidden="true">${guideStep > n ? I.check : n + 1}</span><h2 class="grow">${title}</h2></div><p class="muted small">${body}</p>${action}</section>`;
  return `<button class="link" data-act="overlay-close">${I.back} Volver</button><h1>Activar la IA</h1><p class="subtitle">Gratis, con tu cuenta de Google. Unos 2 minutos.</p>
    <div class="stack">
    ${step(0, "Abre Google AI Studio", "Se abre la página de claves de Google. Si te lo pide, entra con tu Gmail y acepta las condiciones.", '<a class="btn block" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" data-act="guide-step" data-n="1">Abrir la página de claves</a>')}
    ${step(1, "Crea la clave", "Pulsa <b>«Create API key»</b> (puede aparecer como «Crear clave de API»). Si te pregunta por un proyecto, elige el que te proponga o uno nuevo. <b>No actives la facturación</b>: la clave gratuita no la necesita.")}
    ${step(2, "Cópiala", "En «Clave de API» aparece una clave larga que empieza por <b>AQ.</b> (las antiguas empiezan por <b>AIza</b>). Pulsa el icono de copiar que tiene al lado; no copies el nombre ni el número del proyecto.")}
    ${step(3, "Vuelve aquí y pégala", "MANU la lee del portapapeles, la prueba y la recuerda en este móvil. No va a Google Drive, ni a las copias, ni al repositorio.", '<button class="btn block" data-act="ai-paste">Pegar y activar</button><form id="guideForm" class="stack"><label for="guideKey" class="muted small">¿No funciona el botón? Pégala aquí a mano:</label><input id="guideKey" type="password" autocomplete="off" spellcheck="false" placeholder="AQ.… o AIza…"><button class="btn ghost" type="submit">Activar con esta clave</button></form>')}
    </div>`;
}

function weatherPage() {
  const city = activeCity();
  const w = vault.weather && vault.weather.city?.name === city.name ? vault.weather : null;
  if (!w || !w.data.hours) return `<button class="link" data-act="overlay-close">${I.back} Hoy</button><h1>${esc(city.name)}</h1><p class="muted">${weather.loading ? "Cargando…" : "Sin datos todavía."}</p>`;
  const f = w.data;
  const lo = Math.min(...f.days.map((d) => d.min)), hi = Math.max(...f.days.map((d) => d.max));
  const span = Math.max(1, hi - lo);
  return `<button class="link" data-act="overlay-close">${I.back} Hoy</button>
    <div class="weather-head scene-card sc-${sceneFor(f.now.icon)}">${sceneLayer(sceneFor(f.now.icon))}<p class="muted">${esc(city.name)}</p>${wxE(f.now.icon, "xl")}<div class="temp xl"><span data-count="${f.now.temp}">${f.now.temp}</span>°</div><p>${esc(f.now.text)}</p><p class="muted">Máx. ${f.today.max}° · Mín. ${f.today.min}°</p></div>
    <section class="card"><p class="small">${esc(advice(f))}</p><div class="hours scroll">${f.hours.map((h) => `<div><span class="muted small">${esc(h.time)}</span>${wxE(h.icon)}${h.rain >= 20 ? `<span class="rain small">${h.rain}%</span>` : ""}<b>${h.temp}°</b></div>`).join("")}</div></section>
    ${sectionTitle("Próximos 7 días")}
    <section class="card">${f.days.map((d) => `<div class="row day"><span class="wd">${esc(d.weekday)}</span><span class="dicon">${wxE(d.icon)}${d.rain >= 20 ? `<span class="rain small">${d.rain}%</span>` : ""}</span><span class="num muted">${d.min}°</span><span class="range"><i data-l="${Math.round(((d.min - lo) / span) * 100)}" data-w="${Math.max(6, Math.round(((d.max - d.min) / span) * 100))}"></i></span><span class="num">${d.max}°</span></div>`).join("")}</section>
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

// ---------- iOS Shortcuts Manu creates once ----------
const SHORTCUTS = [
  { id: "alarm", name: SHORTCUT_ALARM, purpose: "poner alarmas desde MANU", test: shortcutUrl(SHORTCUT_ALARM, "07:00"), steps: [
    "Abre <b>Atajos</b> → <b>+</b> → toca el nombre y escribe <b>MANU Alarma</b>.",
    "Añade la acción <b>«Obtener fechas de»</b> y elige <b>Entrada del atajo</b>.",
    "Añade <b>«Crear alarma»</b> (Reloj) y en la hora elige la variable <b>Fechas</b>.",
    "Listo. «Probar» debería crear una alarma a las 07:00 (bórrala después)."] },
  { id: "reminder", name: SHORTCUT_REMINDER, purpose: "recordatorios que suenan aunque MANU esté cerrada", test: shortcutUrl(SHORTCUT_REMINDER, "Prueba de MANU | mañana 10:00"), steps: [
    "Nuevo atajo llamado <b>MANU Recordatorio</b>.",
    "<b>«Dividir texto»</b> la Entrada del atajo con separador personalizado <code>|</code>.",
    "<b>«Obtener elemento de la lista»</b> → primer elemento (el texto).",
    "<b>«Obtener elemento de la lista»</b> → último elemento → <b>«Obtener fechas de»</b>.",
    "<b>«Añadir nuevo recordatorio»</b> con el texto y la alerta en esa fecha."] },
  { id: "agenda", name: "MANU Agenda", purpose: "traer tus eventos de hoy (si no usas Google)", test: null, steps: [
    "Nuevo atajo llamado <b>MANU Agenda</b>.",
    "<b>«Buscar eventos del calendario»</b> con fecha de inicio hoy.",
    "<b>«Repetir con cada»</b> → <b>«Texto»</b>: hora de inicio (HH:mm), espacio y título.",
    "<b>«Combinar texto»</b> con saltos de línea → <b>«Copiar al portapapeles»</b>.",
    "Abre MANU → Agenda → «Pegar eventos de hoy»."] },
  { id: "siri", name: "Apuntar en MANU", purpose: "decirle a Siri algo para MANU", test: null, steps: [
    "Nuevo atajo llamado <b>Apuntar en MANU</b>.",
    "<b>«Solicitar entrada»</b> (texto).",
    `<b>«URL»</b>: <code>${esc(SITE)}?di=</code> seguido de la variable Entrada proporcionada.`,
    "<b>«Abrir URL»</b>. Aviso: se abre en Safari, que guarda sus datos aparte del icono de MANU (NO_VERIFICADO)."] },
];
const shortcutsPending = () => SHORTCUTS.filter((x) => !(vault.settings.shortcutsDone ?? {})[x.id]).length;

// ---------- Hub: shortcuts to Manu's apps by moment of the day ----------
function hubCard(mode) {
  const s = vault.settings;
  const oviedoToday = (s.tomorrow?.day === localDay() && s.tomorrow.work && s.tomorrow.city === "OVIEDO") || (mode === "NIGHT" && s.tomorrow?.day === tomorrowKey() && s.tomorrow.work && s.tomorrow.city === "OVIEDO");
  const apps = appsFor(mode, { oviedoToday });
  const speaker = s.spotifySpeaker || DEFAULT_SPEAKER;
  return `<section class="card"><h2>Accesos</h2>
    ${mode !== "WORK" ? `<button class="btn block" data-act="music">Música en el ${esc(speaker)}</button>` : ""}
    <div class="apps">${apps.map((a) => `<a class="app-link" href="${esc(a.url)}" target="_blank" rel="noopener"><span class="ico ${a.color}">${esc(a.label.slice(0, 1))}</span><span class="small">${esc(a.label)}</span></a>`).join("")}</div></section>`;
}

async function spotifyToken() {
  let t = spotifyStore.tokens;
  if (!t) return null;
  if (Date.now() > t.expires - 60000) {
    if (!t.refresh) return null;
    t = await refreshTokens({ clientId: spClientId(), refresh: t.refresh });
    spotifyStore.tokens = t;
  }
  return t.access;
}

async function startSpotifyAuth() {
  const verifier = randomVerifier();
  const state = randomVerifier(24);
  try { localStorage.setItem("manuos.spotify.pkce", JSON.stringify({ verifier, state, at: Date.now() })); } catch {}
  location.assign(authorizeUrl({ clientId: spClientId(), redirectUri: SITE, challenge: await challengeFor(verifier), state }));
}

function openSpotifyApp() {
  location.href = "spotify:";
}

async function musicToSpeaker() {
  if (!spotifyReady()) { openSpotifyApp(); return; }
  try {
    const token = await spotifyToken();
    if (!token) { await startSpotifyAuth(); return; }
    const speakerName = vault.settings.spotifySpeaker || DEFAULT_SPEAKER;
    const device = findSpeaker(await listDevices(token), speakerName);
    if (!device) { toast(`No veo el altavoz «${speakerName}». Enciéndelo o ábrelo una vez en Spotify.`); openSpotifyApp(); return; }
    await transferTo(token, device.id);
    toast(`Spotify en «${device.name}». Elige qué poner.`);
  } catch (err) {
    if (err.code === "auth") { spotifyStore.tokens = null; toast("Vuelve a conectar Spotify en Tú → Spotify"); }
    else toast(err.message || "Spotify no ha respondido");
  }
  setTimeout(openSpotifyApp, 600);
}

async function finishSpotifyAuth(params) {
  let pkce = null;
  try { pkce = JSON.parse(localStorage.getItem("manuos.spotify.pkce") || "null"); localStorage.removeItem("manuos.spotify.pkce"); } catch {}
  if (!pkceValid(pkce, params.get("state"))) { toast("No he podido conectar Spotify (sesión caducada). Inténtalo otra vez."); return; }
  try {
    spotifyStore.tokens = await exchangeCode({ clientId: spClientId(), code: params.get("code"), redirectUri: SITE, verifier: pkce.verifier });
    toast("Spotify conectado");
  } catch { toast("Spotify no ha dado permiso"); }
}

// ---------- Money insights ----------
function moneyInsights() {
  if (!vault.spending.length) return "";
  const rec = detectRecurring(vault.spending);
  const soon = new Set(upcomingRecurring(rec).map((r) => r.key));
  const p = spendingPattern(vault.spending);
  const maxW = Math.max(1, ...p.byWeekday.map((x) => x.cents));
  const maxP = Math.max(1, ...p.byMonthPart.map((x) => x.cents));
  return `${rec.length ? `<section class="card"><h2>Cobros fijos</h2>${rec.map((r) => `<div class="row"><div class="grow"><div>${esc(r.merchant)}</div><div class="muted small">Día ${r.dayOfMonth} de cada mes · próximo ${new Date(r.nextExpected).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}${soon.has(r.key) ? ' · <b class="review">esta semana</b>' : ""}</div></div><span class="num">${euros(r.cents)}</span></div>`).join("")}<div class="row"><strong>Al mes</strong><strong class="num">${euros(rec.reduce((a, r) => a + r.cents, 0))}</strong></div></section>` : ""}
    <section class="card"><h2>Cuándo gastas</h2>
      <div class="week-bars">${p.byWeekday.map((d) => `<div><i data-h="${Math.max(4, Math.round((d.cents / maxW) * 100))}"></i><span class="small muted">${d.label}</span></div>`).join("")}</div>
      ${p.byMonthPart.map((x) => `<div class="stack"><div class="row"><span>${x.label}</span><span class="num">${euros(x.cents)}</span></div><div class="bar"><i data-w="${Math.max(3, Math.round((x.cents / maxP) * 100))}"></i></div></div>`).join("")}
      ${p.byMoment ? `<p class="muted small">Por momento del día (solo gastos apuntados a mano): ${p.byMoment.map((x) => `${x.label.toLowerCase()} ${euros(x.cents)}`).join(" · ")}</p>` : `<p class="muted small">El banco no da la hora de cada pago; los que apuntes en MANU sí la guardan.</p>`}
      ${p.topWeekday ? `<p class="small">Tu día de más gasto: <b>${esc(p.topWeekday)}</b>.</p>` : ""}</section>`;
}

// ---------- Month calendar (Apple Calendar style) ----------
function animateCal(dir) {
  const g = $("calGrid");
  if (!g || reduceMotion()) return;
  g.style.setProperty("--dir", String(dir));
  g.classList.remove("slide"); void g.offsetWidth; g.classList.add("slide");
}
// Swipe left/right on the month to change it.
let touchX = null;
document.addEventListener("touchstart", (e) => { if (e.target.closest("#calGrid")) touchX = e.touches[0].clientX; }, { passive: true });
document.addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX; touchX = null;
  if (Math.abs(dx) < 50) return;
  const base = calView ?? { y: today().getFullYear(), m: today().getMonth() };
  const d = new Date(base.y, base.m + (dx < 0 ? 1 : -1), 1);
  calView = { y: d.getFullYear(), m: d.getMonth() };
  render(); animateCal(dx < 0 ? 1 : -1);
}, { passive: true });
function eventsFor(day) {
  const fromGoogle = vault.calendar?.days?.[day];
  if (fromGoogle) return fromGoogle;
  if (vault.agenda?.day === day) return vault.agenda.events;
  if (vault.agendaTomorrow?.day === day) return vault.agendaTomorrow.events;
  return [];
}

// «Lo próximo»: the next 48 h as a short timeline (events and reminders).
function upcomingItems(now = today(), hours = 48) {
  const until = new Date(now.getTime() + hours * 3600000);
  const items = [];
  for (let d = 0; d < 3; d++) {
    const day = new Date(now); day.setDate(day.getDate() + d);
    const key = dayKey(day);
    for (const ev of eventsFor(key)) {
      if (ev.multi && !ev.first && d > 0) continue; // an ongoing multi-day event shows once, today
      const at = ev.time ? new Date(`${key}T${ev.time}:00`) : new Date(`${key}T00:00:00`);
      const end = ev.end ? new Date(`${key}T${ev.end}:00`) : null;
      if ((end ?? at) < now && ev.time) continue;
      if (at > until) continue;
      items.push({ at, allDay: !ev.time, title: ev.title, color: ev.color ?? null, kind: "event" });
    }
  }
  for (const r of vault.reminders) {
    const at = new Date(r.at);
    if (!r.done && at >= now && at <= until) items.push({ at, allDay: false, title: r.text, color: null, kind: "reminder" });
  }
  return items.sort((a, b) => a.at - b.at || (a.allDay ? -1 : 1)).slice(0, 6);
}

function upcomingCard() {
  const items = upcomingItems();
  const dayWord = (d) => { const k = dayKey(d); return k === localDay() ? "Hoy" : k === tomorrowKey() ? "Mañana" : cap(d.toLocaleDateString("es-ES", { weekday: "long" })); };
  return `<section class="card upcoming"><h2>Lo próximo</h2>${items.length ? `<ol class="timeline">${items.map((it) => `<li class="tl-item${it.kind === "reminder" ? " rem" : ""}"><span class="tl-dot" data-c="${esc(it.color ?? "")}"></span><div class="grow"><div>${it.kind === "reminder" ? "🔔 " : ""}${esc(it.title)}</div><div class="muted small">${dayWord(it.at)} · ${it.allDay ? "todo el día" : hhmm(it.at)}</div></div></li>`).join("")}</ol>` : '<p class="muted">Nada en las próximas 48 horas. 🌿</p>'}</section>`;
}

function calendarCard(canCreate) {
  const now = today();
  const view = calView ?? { y: now.getFullYear(), m: now.getMonth() };
  const selected = calSelected ?? localDay();
  const grid = monthGrid(view.y, view.m);
  const title = cap(new Date(view.y, view.m, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" }));
  const tasksDue = vault.reminders.filter((r) => !r.done && dayKey(new Date(r.at)) === selected);
  const events = eventsFor(selected);
  const selDate = new Date(`${selected}T12:00:00`);
  const monthEmpty = grid.every((d) => !d.inMonth || !eventsFor(d.day).length);
  return `<section class="card cal${monthEmpty ? " compact" : ""}" aria-label="Calendario">
      <div class="row cal-head"><button class="link" data-act="cal-prev" aria-label="Mes anterior">${I.back}</button><strong class="cal-title">${esc(title)}</strong><button class="link" data-act="cal-next" aria-label="Mes siguiente">${I.chev}</button></div>
      <div class="cal-grid" id="calGrid">${["L", "M", "X", "J", "V", "S", "D"].map((d) => `<span class="cal-dow">${d}</span>`).join("")}
        ${grid.map((d) => { const evs = eventsFor(d.day); const n = evs.length; return `<button class="cal-day${d.inMonth ? "" : " out"}${d.day === localDay() ? " today" : ""}${d.day === selected ? " sel" : ""}" data-act="cal-day" data-day="${d.day}" aria-label="${d.day}${n ? `, ${n} eventos` : ""}"><span class="num-d">${d.date}</span><span class="chips">${evs.slice(0, 3).map((ev) => `<i class="ev${ev.multi ? " multi" : ""}${ev.multi && !ev.first ? " cont" : ""}${ev.multi && !ev.last ? " open" : ""}" data-c="${esc(ev.color ?? "")}">${ev.multi && !ev.first && (new Date(`${d.day}T12:00:00`).getDay() !== 1) ? "&nbsp;" : esc(ev.title)}</i>`).join("")}${n > 3 ? `<i class="more">+${n - 3}</i>` : ""}</span></button>`; }).join("")}</div>
      ${d0(selected) ? "" : `<button class="link small" data-act="cal-today">Hoy</button>`}
    </section>
    ${sectionTitle(esc(cap(selDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }))), canCreate ? addLink("EVENT", "Nuevo evento") : "")}
    <section class="card">${events.length || tasksDue.length ? events.map((ev) => `<div class="row event"><span class="ev-bar" data-c="${esc(ev.color ?? "")}"></span><div class="grow"><div>${esc(ev.title)}</div><div class="muted small">${esc(ev.time ? ev.time + (ev.end ? " – " + ev.end : "") : "Todo el día")}${ev.location ? ` · ${esc(ev.location)}` : ""}${ev.calendar ? ` · ${esc(ev.calendar)}` : ""}</div></div></div>`).join("") + tasksDue.map(reminderRow).join("")
      : `<p class="muted">${vault.calendar ? "Nada este día." : "Conecta Google para ver tu calendario completo."}</p>`}</section>`;
}
const d0 = (day) => day === localDay() && (!calView || (calView.y === today().getFullYear() && calView.m === today().getMonth()));

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
      ${hubCard(m.mode)}
      <section class="card"><div class="row"><h2>Tareas</h2>${addLink("TASK")}</div>${open.length ? open.slice(0, 5).map(taskRow).join("") + (open.length > 5 ? `<p class="muted small">Y ${open.length - 5} más en Agenda.</p>` : "") : '<p class="muted">Nada pendiente. Toca «+» para añadir.</p>'}</section>
      ${bdays.length ? `<section class="card"><h2>${I.people} Cumpleaños</h2>${bdays.map((b) => { const wa = b.days === 0 ? whatsappUrl(b.person.phone, `¡Feliz cumpleaños, ${b.person.name.split(" ")[0]}! 🎉`) : null; return `<div class="row"><span class="grow">${esc(b.person.name)}</span>${wa ? `<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">Felicitar por WhatsApp</a>` : `<span class="muted">${b.days === 0 ? "¡Hoy!" : b.days === 1 ? "Mañana" : `En ${b.days} días`}</span>`}</div>`; }).join("")}</section>` : ""}
      <section class="card"><div class="row"><h2>Este mes</h2><button class="link small" data-tab="dinero">Ver dinero</button></div><div class="big-money">${euros(month.total)}</div></section>
      </div>`;
  },
  agenda() {
    const open = tasks(vault.inbox);
    const done = vault.inbox.filter((i) => i.status === "TASK" && i.done).slice(-10);
    const idea = ideas(vault.inbox);
    const rems = vault.reminders.filter((r) => !r.done).sort((a, b) => (a.at < b.at ? -1 : 1));
    const g = isClientId(gClientId()) && GOOGLE_FEATURES.some(([k]) => googleOn(k));
    const synced = vault.settings.gcalSyncedAt ? new Date(vault.settings.gcalSyncedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : null;
    const gCal = isClientId(gClientId()) && googleOn("calendar");
    return `<h1>Agenda</h1><p class="subtitle">${esc(longDate())}</p>
      ${g ? `<div class="btns"><button class="btn ghost" data-act="gcal-sync">${gcal.busy ? "Sincronizando…" : "Sincronizar con Google"}</button></div><p class="muted small">${synced ? `Última sincronización: ${synced}` : "Aún sin sincronizar."}${gcal.error ? ` · ${esc(gcal.error)}` : ""}${validToken(SCOPE.calendar) ? " · se actualiza sola cada 10 min" : ""}</p>` : `<p class="muted small"><button class="link small" data-act="goto-gcal">Conectar Google (Calendar, Tasks, Contactos y Drive)</button></p>`}
      ${upcomingCard()}
      ${calendarCard(gCal)}
      <details class="card"><summary class="muted small">Sin Google: pegar los eventos de hoy</summary><p class="muted small">Si tu calendario no es de Google, pega aquí tus eventos (o usa el atajo «MANU Agenda»).</p>${agendaToday() && vault.agenda.source !== "GOOGLE"
        ? (vault.agenda.events.length ? vault.agenda.events.map((ev) => `<div class="row"><span class="num chip">${esc(ev.time ? ev.time + (ev.end ? "–" + ev.end : "") : "Todo el día")}</span><span class="grow">${esc(ev.title)}</span></div>`).join("") : "") : ""}
      <form id="pasteEvents" class="stack"><label for="eventsText" class="muted small">Uno por línea: «09:30 Dentista», «10:00-11:00 Reunión», «todo el día Cumpleaños».</label><textarea id="eventsText" rows="3" placeholder="09:30 Dentista"></textarea><button class="btn ghost" type="submit">Guardar agenda de hoy</button></form></details>
      ${sectionTitle("Recordatorios", addLink("REMINDER"))}
      <section class="card">${rems.length ? rems.map(reminderRow).join("") : '<p class="muted">Sin recordatorios. Dile a MANU «recuérdame … a las 18».</p>'}</section>
      ${sectionTitle("Tareas", addLink("TASK"))}
      <section class="card">${open.length ? open.map(taskRow).join("") : '<p class="muted">Sin tareas pendientes.</p>'}${done.length ? `<details><summary>Hechas (${done.length})</summary>${done.map(taskRow).join("")}</details>` : ""}</section>
      ${sectionTitle("Ideas", addLink("IDEA"))}
      <section class="card">${idea.length ? idea.map((i) => `<div class="row"><span class="grow">${esc(i.text)}</span><button class="link small" data-act="idea-to-task" data-id="${esc(i.id)}">Hacer tarea</button></div>`).join("") : '<p class="muted">Tus ideas quedan aquí, sin convertirse en proyectos sin tu permiso.</p>'}</section>`;
  },
  manu() {
    const chips = refuge ? ["quiero entender por qué", "buscar una solución", "necesito desconectar"] : null;
    // Short cards: «fill» starts the sentence for Manu; «say» sends it directly.
    const cards = [["💸", "Apuntar gasto", "fill", "gasté "], ["⏰", "Crear alarma", "fill", "pon una alarma a las "], ["🔔", "Recordatorio", "fill", "recuérdame "], ["💡", "Guardar idea", "fill", "apunta idea: "], ["🗓️", "¿Qué tengo hoy?", "say", "qué tengo hoy"], ["🌿", "Refugio", "say", "refugio"]];
    const thinking = vault.chat.at(-1)?.text === "Pensando…";
    const empty = !vault.chat.length && !refuge;
    const history = vault.chat.length ? vault.chat : [{ from: "manu", text: "Hola, Manu. Puedo apuntar gastos, ideas y tareas, crear recordatorios y alarmas, y acompañarte en el Refugio. Aún funciono sin IA: habla claro y corto." }];
    return `<div class="manu-head${empty ? " big" : ""}"><div class="orb${thinking ? " thinking" : ""}" id="orb" aria-hidden="true"><span>M</span></div><div><h1>MANU</h1><p class="subtitle">Tu asistente · ${aiReady() ? "IA disponible, siempre con tu confirmación" : '<button class="link small" data-act="gemini-guide">activar IA</button>'}</p></div></div>
      ${refuge ? `<div class="refuge-bar"><span>Refugio · no se guarda</span><button class="link" data-act="leave-refuge">Salir</button></div>` : ""}
      ${chips ? `<div class="suggest" aria-label="Sugerencias">${chips.map((s) => `<button data-say="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : `<div class="quick-cards" aria-label="Sugerencias">${cards.map(([e, label, how, text]) => `<button class="qcard" ${how === "say" ? `data-say="${esc(text)}"` : `data-fill="${esc(text)}"`}><span class="qe" aria-hidden="true">${e}</span><span>${esc(label)}</span></button>`).join("")}</div>`}
      <div class="chat" id="chat" aria-live="polite">${[...history, ...(refuge?.messages ?? [])].map((b) => `<div class="bubble ${b.from}${b.safety ? " safety" : ""}">${b.ai ? '<span class="ai-tag">IA</span>' : ""}${esc(b.text)}${b.proposal ? `${b.proposal.state ? `<details><summary class="muted small">Ver lo enviado</summary><pre class="payload">${esc(shownPayload(b.proposal))}</pre></details>` : `<pre class="payload">${esc(shownPayload(b.proposal))}</pre>`}${b.proposal.state ? `<p class="muted small">${b.proposal.state === "sent" ? (b.proposal.auto ? "Enviado a Gemini sin preguntar (lo activaste en Tú → IA)." : "Enviado a Gemini.") : "No enviado."}</p>` : `<div class="btns"><button class="btn" data-act="ai-send" data-id="${esc(b.proposal.id)}">Enviar a Gemini</button><button class="btn ghost" data-act="ai-cancel" data-id="${esc(b.proposal.id)}">No</button></div><div class="btns"><button class="link small" data-act="ask-elsewhere" data-app="chatgpt" data-id="${esc(b.proposal.id)}">Preguntar en ChatGPT</button><button class="link small" data-act="ask-elsewhere" data-app="claude" data-id="${esc(b.proposal.id)}">Preguntar en Claude</button></div>`}` : ""}${b.action ? `<div class="btns"><a class="btn" href="${esc(b.action.href)}">${esc(b.action.label)}</a></div>` : ""}${(b.calls ?? []).map((c, i) => callCard(b, c, i)).join("")}</div>`).join("")}</div>
      <form class="composer glass" id="composer"><label for="msg" class="sr">Mensaje para MANU</label><input id="msg" autocomplete="off" enterkeyhint="send" placeholder="${refuge ? "Cuéntame" : "Escribe a MANU"}"><button class="btn" type="submit">Enviar</button></form>`;
  },
  dinero() {
    const ref = today(); ref.setDate(1); ref.setMonth(ref.getMonth() - moneyMonth);
    const [s, e] = monthRange(ref);
    const month = summary(vault.spending, s, e);
    const monthName = ref.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    const ri = vault.settings.lastRulesImport;
    const toReview = vault.spending.filter((x) => x.review).length;
    const entries = [...vault.spending].filter((x) => moneyFilter !== "review" || x.review).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, moneyFilter === "review" ? 500 : 60);
    const rulesCount = Object.keys(vault.settings.categoryRules ?? {}).length;
    const cats = Object.entries(month.byCategory).sort((a, b) => b[1] - a[1]);
    const max = cats[0]?.[1] ?? 1;
    const imp = vault.settings.lastImport;
    return `<h1>Dinero</h1><p class="subtitle">${esc(cap(monthName))}</p>
      <div class="stack">
      <section class="card hero money-hero">${celebrateMoney ? moneyRain() : ""}<div class="row cal-head"><button class="link" data-act="money-prev" aria-label="Mes anterior">${I.back}</button><h2>${moneyMonth === 0 ? "Gastado este mes" : `Gastado en ${esc(monthName.replace(/ de \d{4}$/, ""))}`}</h2><button class="link" data-act="money-next" aria-label="Mes siguiente"${moneyMonth === 0 ? " disabled" : ""}>${I.chev}</button></div><div class="big-money" data-count-money="${month.total}">${euros(month.total)}</div>
        ${cats.map(([c, v]) => `<div class="stack"><div class="row"><span>${esc(catLabel(c))}</span><span class="num">${euros(v)}</span></div><div class="bar"><i data-w="${Math.max(3, Math.round((v / max) * 100))}"></i></div></div>`).join("")}</section>
      <section class="card"><h2>${I.box} Importar del banco</h2>
        <p class="muted small">Descarga los movimientos de tu banco (Sabadell: Excel .xls; también vale CSV) y elígelo aquí. Se analiza en tu móvil y no se envía a nadie. Solo importo gastos y no duplico los que ya tengas. Si corriges la categoría de un comercio, la aprendo para todos sus movimientos.</p>
        <label class="btn ghost" for="bankFile" role="button" tabindex="0">Elegir archivo (Excel o CSV)</label><input id="bankFile" type="file" accept=".xls,.xlsx,.csv,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="sr">
        <label class="btn ghost" for="rulesFile" role="button" tabindex="0">Importar reglas (Excel de ChatGPT)</label><input id="rulesFile" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="sr">
        ${rulesCount ? `<p class="muted small">${rulesCount} reglas de categorías guardadas en este móvil.</p>` : ""}
        ${ri ? `<p class="muted small">Excel de ChatGPT: ${ri.rules} reglas, ${ri.added} gastos nuevos${ri.duplicates ? `, ${ri.duplicates} ya estaban` : ""}${ri.review ? `, ${ri.review} por revisar` : ""}${ri.reclassified ? `, ${ri.reclassified} reclasificados` : ""}.</p>` : ""}
        ${rulesCount && !vault.spending.length ? '<p class="small"><b>Las reglas solas no son gastos.</b> Importa el extracto del banco o vuelve a elegir el Excel de ChatGPT, que trae la hoja «Gastos clasificados», y verás aquí tus números.</p>' : ""}
        ${imp ? `<p class="muted small">Última importación: ${imp.added} gastos nuevos, ${imp.duplicates} repetidos, ${imp.income} ingresos ignorados${imp.invalid ? `, ${imp.invalid} filas no reconocidas` : ""}.</p>` : ""}</section>
      ${moneyInsights()}
      ${sectionTitle("Movimientos", `${toReview ? `<button class="link small" data-act="money-filter">${moneyFilter === "review" ? "Ver todos" : `Por revisar (${toReview})`}</button>` : ""}${addLink("EXPENSE")}`)}
      <section class="card">${entries.length ? entries.map((x) => `<div class="row"><span class="cat-emoji" aria-hidden="true">${CATEGORY_EMOJI[x.category] ?? "📦"}</span><div class="grow"><div>${esc(x.merchant ?? "Sin concepto")}</div><div class="muted small">${new Date(x.at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}${x.sub ? ` · ${esc(x.sub)}` : ""}${x.source === "BANK" ? " · banco" : ""}${x.review ? ' · <b class="review">revisar</b>' : x.inferred ? " · categoría propuesta" : x.ruled ? " · según tus reglas" : ""}</div></div>
          <div class="stack"><span class="num">${euros(x.cents)}</span><label class="sr" for="cat-${esc(x.id)}">Categoría</label><select id="cat-${esc(x.id)}" data-cat="${esc(x.id)}">${Object.keys(CATEGORIES).map((k) => `<option value="${k}"${k === x.category ? " selected" : ""}>${esc(catLabel(k))}</option>`).join("")}</select></div></div>`).join("")
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
      ${setupCard()}
      ${sectionTitle("¿Cómo estás hoy?")}
      <section class="card"><div class="mood">${MOODS.map((m) => `<button data-act="mood" data-v="${m.value}" aria-pressed="${mood === m.value}" aria-label="${m.label}"><b class="mood-e" aria-hidden="true">${m.emoji}</b>${m.label}</button>`).join("")}</div>
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
        ${item("gcal", "google", "blue", "Google", isClientId(gClientId()) ? "Calendar, Tasks, Contactos y Drive" : "Conectar tus servicios de Google")}
        ${item("spotify", "leaf", "green", "Spotify", spotifyStore.tokens ? `Conectado · altavoz «${vault.settings.spotifySpeaker || DEFAULT_SPEAKER}»` : "Sin conectar: un toque")}
        ${item("ia", "bolt", "purple", "IA (Gemini)", aiReady() ? `Activada · ${aiStore.model}` : "Chat con IA opcional")}
        ${item("atajos", "bolt", "orange", "Atajos del iPhone", shortcutsPending() ? `${shortcutsPending()} pendientes de crear` : "Todos creados")}
        ${item("avisos", "bell", "red", "Avisos", "Notificaciones de MANU")}
        ${item("datos", "box", "gray", "Tus datos", "Copia, restaurar y borrar")}
      </div>
      <p class="muted small">MANU OS web · versión ${APP_VERSION} · datos solo en este dispositivo</p>`;
  },
};

// «Puesta a punto»: what is still missing, each with one button.
function setupCard() {
  const steps = [];
  if (!["calendar", "tasks", "contacts", "drive"].some(googleOn)) steps.push(["Google", "Calendar, Tasks y Contactos con un toque", '<button class="btn small-btn" data-act="google-connect-all">Conectar</button>']);
  if (!aiReady()) steps.push(["IA (Gemini)", "Crear la clave y pegarla: 2 toques", '<button class="btn small-btn" data-act="gemini-guide">Activar</button>']);
  if (notificationStatus() === "default") steps.push(["Avisos", "Para que MANU te avise", '<button class="btn small-btn" data-act="notify-on">Activar</button>']);
  if (!spotifyStore.tokens) steps.push(["Spotify", `Música en tu altavoz «${vault.settings.spotifySpeaker || DEFAULT_SPEAKER}»: un toque`, '<button class="btn small-btn" data-act="spotify-connect">Conectar</button>']);
  if (shortcutsPending()) steps.push(["Atajos del iPhone", `${shortcutsPending()} por crear (alarmas y recordatorios que suenan siempre)`, '<button class="btn small-btn" data-sub-go="atajos">Ver</button>']);
  if (!steps.length) return "";
  return `${sectionTitle("Puesta a punto")}<section class="card">${steps.map(([t, d, b]) => `<div class="row"><div class="grow"><div>${t}</div><div class="muted small">${esc(d)}</div></div>${b}</div>`).join("")}</section>`;
}

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
        <div class="inner">${p.notes ? `<p>${esc(p.notes)}</p>` : '<p class="muted small">Sin notas.</p>'}<div class="btns">${whatsappUrl(p.phone, "") ? `<a class="btn ghost" href="${esc(whatsappUrl(p.phone, `¡Hola, ${p.name.split(" ")[0]}!`))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}<button class="btn ghost" data-act="talked" data-id="${esc(p.id)}">Hablé hoy</button><button class="btn danger" data-act="del" data-list="people" data-id="${esc(p.id)}">Quitar</button></div></div></details>`; }).join("") : '<p class="muted item">Aún no hay nadie.</p>'}</div>
      <form class="card" id="addPerson"><h2>Añadir persona</h2>
        <label for="pName" class="muted small">Nombre</label><input id="pName" maxlength="60" required>
        <label for="pBirthday" class="muted small">Cumpleaños (el año no hace falta)</label><input id="pBirthday" type="date">
        <label for="pPhone" class="muted small">Móvil (opcional, para felicitar por WhatsApp; se queda en este móvil)</label><input id="pPhone" inputmode="tel" maxlength="20">
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
    const id = gClientId();
    const ok = isClientId(id);
    const st = vault.settings.googleStatus ?? {};
    const anyOn = GOOGLE_FEATURES.some(([k]) => googleOn(k));
    return `${backBar("Google")}
      <section class="card"><h2>ID de cliente</h2>
        <form id="gcalForm" class="stack"><label for="gcalId" class="muted small">ID de cliente OAuth (termina en .apps.googleusercontent.com). No es una contraseña.</label><input id="gcalId" value="${esc(id)}" autocomplete="off" spellcheck="false" placeholder="123-abc.apps.googleusercontent.com"><button class="btn ghost" type="submit">Guardar ID</button></form></section>
      ${ok && !anyOn ? `<section class="card"><h2>Conectar Google</h2><p class="muted small">Activa Calendar, Tasks y los cumpleaños de Contactos y pide los permisos en una sola ventana. Puedes desactivar cualquiera después.</p><button class="btn block" data-act="google-connect-all">Conectar Google</button></section>` : ""}
      ${ok ? `<section class="card"><h2>Servicios</h2><p class="muted small">Cada servicio pide solo su permiso. Al sincronizar, los que actives se piden juntos en una sola ventana; si rechazas uno, los demás siguen funcionando.</p>
        ${GOOGLE_FEATURES.map(([k, label, desc]) => `<div class="row"><div class="grow"><div>${label}</div><div class="muted small">${esc(desc)}${st[k] && st[k] !== "off" ? ` · ${esc(st[k].replace(/^ok: /, "").replace(/^error: /, "⚠︎ "))}` : ""}</div></div><button class="check" data-act="gfeature" data-k="${k}" aria-pressed="${googleOn(k)}" aria-label="${label}">${I.check}</button></div>`).join("")}
        ${["calendar", "tasks", "contacts"].some(googleOn) ? `<button class="btn" data-act="gcal-sync">${gcal.busy ? "Sincronizando…" : "Sincronizar ahora"}</button>` : ""}</section>` : ""}
      ${ok && googleOn("drive") ? `<section class="card"><h2>Copia cifrada en Drive</h2>
        <p class="muted small">Se cifra en tu móvil (AES-256-GCM) con una frase que eliges tú y que nunca se guarda ni se sube. Sin la frase, nadie puede leerla, tampoco Google ni MANU. Si la olvidas, la copia no se puede recuperar. La copia solo se sube cuando pulsas el botón.</p>
        <form id="driveForm" class="stack"><label for="drivePass" class="muted small">Frase de la copia (mínimo 10 caracteres)</label><input id="drivePass" type="password" autocomplete="new-password" minlength="10">
          <div class="btns"><button class="btn ghost" type="submit" data-drive="save">Cifrar y subir</button><button class="btn ghost" type="submit" data-drive="restore">Descargar y restaurar</button></div></form>
        ${confirmDriveRestore ? `<p>La copia de Drive es del ${esc(new Date(confirmDriveRestore.file.modifiedTime).toLocaleString("es-ES"))} y se ha descifrado bien. Reemplazará lo que hay en este móvil.</p><div class="btns"><button class="btn danger" data-act="drive-restore-yes">Sí, restaurar</button><button class="btn ghost" data-act="drive-restore-no">Cancelar</button></div>` : ""}</section>` : ""}
      <section class="card"><h2>Cómo conseguir el ID (una vez, mejor desde el ordenador)</h2><ol class="muted small">
        <li>Entra en <b>console.cloud.google.com</b> y crea un proyecto «MANU OS». Es gratis.</li>
        <li>«APIs y servicios» → «Biblioteca»: habilita las APIs que vayas a usar (Google Calendar API, Google Tasks API, People API, Google Drive API).</li>
        <li>«Pantalla de consentimiento de OAuth»: tipo <b>Externo</b>, nombre «MANU OS», tu correo; añade tu Gmail en «Usuarios de prueba».</li>
        <li>«Credenciales» → «Crear credenciales» → <b>ID de cliente de OAuth</b> → «Aplicación web».</li>
        <li>«Orígenes de JavaScript autorizados»: <code>https://elpiernitas.github.io</code></li>
        <li>Copia el <b>ID de cliente</b> y pégalo arriba. El «secreto de cliente» no se usa: no lo pegues en ningún sitio.</li></ol></section>`;
  },
  atajos() {
    const done = vault.settings.shortcutsDone ?? {};
    const pending = SHORTCUTS.filter((x) => !done[x.id]);
    const created = SHORTCUTS.filter((x) => done[x.id]);
    const card = (x) => `<details class="card"${done[x.id] ? "" : " open"}><summary><b>${esc(x.name)}</b> · <span class="muted small">${esc(x.purpose)}</span></summary>
      <ol class="muted small">${x.steps.map((st) => `<li>${st}</li>`).join("")}</ol>
      <div class="btns">${x.test ? `<a class="btn ghost" href="${esc(x.test)}">Probar</a>` : ""}${done[x.id] ? `<button class="btn ghost" data-act="shortcut-undo" data-id="${x.id}">Marcar como pendiente</button>` : `<button class="btn" data-act="shortcut-done" data-id="${x.id}">Ya lo tengo</button>`}</div></details>`;
    return `${backBar("Atajos")}
      <p class="muted small">Apple no deja que una web instale atajos por ti: cada uno se crea una vez en la app Atajos con el nombre exacto (unos 2 minutos). Pulsa «Probar» para comprobarlo y «Ya lo tengo» para quitarlo de pendientes. Los nombres de las acciones pueden variar según tu iOS.</p>
      ${sectionTitle(`Pendientes (${pending.length})`)}
      <div class="stack">${pending.map(card).join("") || '<p class="muted">Nada pendiente.</p>'}</div>
      ${created.length ? `${sectionTitle(`Creados (${created.length})`)}<div class="stack">${created.map(card).join("")}</div>` : ""}`;
  },
  spotify() {
    const id = vault.settings.spotifyClientId ?? "";
    return `${backBar("Spotify")}
      <section class="card"><h2>Estado</h2><p>${spotifyStore.tokens ? `Conectado · altavoz «${esc(vault.settings.spotifySpeaker || DEFAULT_SPEAKER)}».` : "Tu app «MANU OS» de Spotify ya está creada. Solo falta conectarla: se abre Spotify, aceptas y vuelves a MANU."}</p>
        <div class="btns"><button class="btn${spotifyStore.tokens ? " ghost" : " block"}" type="button" data-act="spotify-connect">${spotifyStore.tokens ? "Reconectar" : "Conectar Spotify"}</button>${spotifyStore.tokens ? '<button class="btn danger" type="button" data-act="spotify-forget">Desconectar</button>' : ""}</div>
        <p class="muted small">MANU solo pide ver y cambiar el altavoz de reproducción, nunca reproduce por su cuenta. Cambiar de altavoz desde fuera de Spotify suele requerir Premium.</p></section>
      <details class="card"><summary>Ajustes avanzados</summary>
        <form id="spotifyForm" class="stack">
          <label for="spSpeaker" class="muted small">Nombre del altavoz</label><input id="spSpeaker" value="${esc(vault.settings.spotifySpeaker || DEFAULT_SPEAKER)}" maxlength="40">
          <label for="spId" class="muted small">Client ID de otra app de Spotify (vacío = la tuya, «MANU OS»)</label><input id="spId" value="${esc(id)}" autocomplete="off" spellcheck="false" placeholder="${DEFAULT_SPOTIFY_CLIENT_ID}">
          <button class="btn ghost" type="submit">Guardar</button></form></details>`;
  },
  ia() {
    const key = aiStore.key;
    return `${backBar("IA (Gemini)")}
      ${aiReady() ? "" : `<section class="card"><h2>Actívala paso a paso</h2><p class="muted small">Te guío: crear la clave gratis, copiarla y pegarla aquí.</p><button class="btn block" data-act="gemini-guide">Empezar</button></section>`}
      <section class="card"><h2>Estado</h2><p>${aiReady() ? `Activada con <b>${esc(aiStore.model)}</b>.` : key ? "Clave guardada. Pulsa «Probar clave»." : "Sin clave: MANU funciona sin IA."}</p>
        <form id="aiForm" class="stack"><label for="aiKey" class="muted small">Clave de API de Gemini. Nunca va en las copias. Por defecto solo dura mientras MANU está abierta.</label><input id="aiKey" type="password" value="${esc(key)}" autocomplete="off" spellcheck="false" placeholder="AQ.… o AIza…"><div class="btns"><button class="btn" type="submit">Guardar y probar clave</button>${key ? '<button class="btn danger" type="button" data-act="ai-forget">Borrar clave</button>' : ""}</div></form>
        <div class="row"><div class="grow"><div>Recordar la clave en este móvil</div><div class="muted small">Más cómodo, pero cualquier código que corra en esta web podría leerla (ADR-0013).</div></div><button class="check" data-act="ai-remember" aria-pressed="${aiStore.remember}" aria-label="Recordar clave">${I.check}</button></div>
        ${key ? `<div class="row"><span>Ofrecer la IA en el chat</span><button class="check" data-act="ai-toggle" aria-pressed="${vault.settings.aiEnabled !== false}" aria-label="Usar IA">${I.check}</button></div>
        <div class="row"><div class="grow"><div>Enviar a Gemini sin preguntar</div><div class="muted small">Desactivado por defecto. Si lo activas, lo que MANU no entienda irá directo a Gemini. Lo que parezca privado (salud, dinero, ánimo, teléfonos…) seguirá sin enviarse nunca.</div></div><button class="check" data-act="ai-auto" aria-pressed="${vault.settings.aiAutoSend === true}" aria-label="Enviar sin preguntar">${I.check}</button></div>` : ""}</section>
      <section class="card"><h2>Qué puede hacer</h2><p class="muted small">Dile cosas normales: «apúntame llamar al taller», «recuérdame el viernes a las 10 pagar el seguro», «llévame a Hábitos», «quiero importar el extracto» o «me gustaría que el calendario tuviera vista semanal». Gemini <b>propone</b> y tú confirmas cada acción con un toque; nada se hace solo.</p><p class="muted small">Las mejoras de la app se preparan como una petición en GitHub que tú envías y que Claude lee. Ese repositorio es <b>público</b>: no pongas datos personales.</p></section>
      <section class="card"><h2>Privacidad</h2><ul class="muted small">
        <li>MANU responde primero sin IA. Cuando no entiende algo, te enseña <b>exactamente</b> lo que enviaría y solo lo manda si pulsas «Enviar a Gemini» (o si activaste «Enviar sin preguntar»).</li>
        <li>Solo se envía tu frase, una instrucción fija con la fecha y hora, y la lista fija de acciones que puede proponer: ni historial, ni tareas, ni agenda, ni gastos.</li>
        <li>MANU bloquea lo que reconoce como salud, dinero, ánimo, teléfonos, tarjetas o contraseñas, pero ese filtro no es perfecto: revisa siempre lo que vas a enviar.</li>
        <li>Con la clave gratuita, Google puede usar lo que le envías para mejorar sus productos. Consulta sus condiciones en AI Studio.</li>
        <li>Si se acaba el cupo gratuito, MANU sigue funcionando sin IA.</li></ul></section>
      <section class="card"><h2>Cómo conseguir la clave</h2><ol class="muted small"><li>Entra en <b>aistudio.google.com</b> con tu Gmail.</li><li>«Get API key» o «Crear clave de API». Es gratis y no pide tarjeta. Si te pide activar facturación, no lo hagas.</li><li>Cópiala y pégala arriba.</li></ol></section>`;
  },
  avisos() {
    const n = notificationStatus();
    const status = { unsupported: isInstalled() ? "Este dispositivo no permite avisos web." : "Primero añade MANU a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde ahí.", default: "Desactivados.", granted: "Activados.", denied: "Bloqueados. Actívalos en Ajustes → Notificaciones → MANU." }[n];
    return `${backBar("Avisos y Atajos")}
      <section class="card"><h2>${I.bell} Avisos de MANU</h2><p class="muted">${esc(status)}</p>
        <div class="btns">${n === "default" ? '<button class="btn" data-act="notify-on">Activar avisos</button>' : ""}${n === "granted" ? '<button class="btn ghost" data-act="notify-test">Probar un aviso</button>' : ""}</div>
        <p class="muted small">Los recordatorios avisan mientras MANU está abierta. Para que suenen siempre, mándalos al iPhone con los atajos de abajo.</p></section>
      <section class="card"><h2>${I.bolt} Atajos</h2><p class="muted small">Los atajos del iPhone tienen ahora su propia sección.</p><button class="btn ghost" data-sub-go="atajos">Ir a Atajos</button></section>
      <section class="card" hidden><h2>${I.bolt} Atajos (se crean una vez)</h2>
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
// ---------- Motion (QAL/animate rules: ease-out entrances, <300ms UI, reduced motion) ----------
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let lastChatLength = 0;
let renderedSheetKind = null;

function renderTabs() {
  const nav = $("tabs");
  if (!nav.querySelector(".tab")) {
    nav.innerHTML = `<span class="tab-pill" aria-hidden="true"></span>` + TABS.map(([id, label]) => `<button class="tab" role="tab" data-tab="${id}">${id === "manu" ? '<span class="dot" aria-hidden="true">M</span>' : I[id]}<span>${label}</span></button>`).join("");
  }
  const index = TABS.findIndex(([id]) => id === tab);
  nav.querySelectorAll(".tab").forEach((b, i) => b.setAttribute("aria-selected", String(i === index)));
  nav.style.setProperty("--tab-index", String(index));
}

function countUp(el, to, format) {
  if (reduceMotion()) return;
  const start = performance.now();
  const dur = 600;
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = format(Math.round(to * eased));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function animateEnter(kind) {
  if (reduceMotion() || !kind) return;
  const screen = $("screen");
  screen.classList.remove("enter-tab", "enter-page");
  void screen.offsetWidth; // restart the animation
  screen.classList.add(kind === "tab" ? "enter-tab" : "enter-page");
  {
    screen.querySelectorAll("[data-count]").forEach((el) => countUp(el, Number(el.dataset.count), (v) => String(v)));
    screen.querySelectorAll("[data-count-money]").forEach((el) => countUp(el, Number(el.dataset.countMoney), euros));
  }
}

function openSheet(kind) {
  sheet = { kind };
  render();
}

function closeSheet() {
  const bg = $("sheetBg");
  if (!bg || reduceMotion()) { sheet = null; render(); return; }
  bg.dataset.state = "closing";
  setTimeout(() => { sheet = null; render(); }, 280);
}

function render({ focus = false, enter = null } = {}) {
  celebrateMoney = Boolean(enter) && tab === "dinero" && !overlay && !reduceMotion();
  const w = currentWeather();
  if (w?.data?.now) document.body.dataset.wx = sceneFor(w.data.now.icon); else delete document.body.dataset.wx;
  const todayMood = vault.moods.find((m) => m.day === localDay())?.value;
  if (todayMood) document.body.dataset.mood = String(todayMood); else delete document.body.dataset.mood;
  if (tab === "tu" && (!sub || sub === "gcal") && isClientId(gClientId())) loadGis().catch(() => {});
  document.body.dataset.mode = modeState(today(), undefined, vault.settings.override).mode;
  renderTabs();
  $("screen").innerHTML = overlay === "weather" ? weatherPage() : overlay === "gemini" ? geminiGuide() : (screens[tab] ?? screens.hoy)();
  animateEnter(enter);
  const bars = $("screen").querySelectorAll(".bar > i[data-w]");
  if (enter && !reduceMotion()) { bars.forEach((el) => { el.style.width = "0%"; }); requestAnimationFrame(() => requestAnimationFrame(() => bars.forEach((el) => { el.style.width = `${el.dataset.w}%`; }))); }
  else bars.forEach((el) => { el.style.width = `${el.dataset.w}%`; });
  $("screen").querySelectorAll(".range > i").forEach((el) => { el.style.left = `${el.dataset.l}%`; el.style.width = `${el.dataset.w}%`; });
  $("screen").querySelectorAll(".week-bars i[data-h]").forEach((el) => { el.style.height = `${el.dataset.h}%`; });
  $("screen").querySelectorAll("[data-c]").forEach((el) => { if (/^#[0-9a-f]{6}$/i.test(el.dataset.c)) el.style.setProperty("--ev", el.dataset.c); });
  $("topTitle").textContent = sub ? { habitos: "Hábitos", salud: "Salud", comidas: "Comidas", personas: "Personas", tiempo: "Tiempo", avisos: "Avisos", datos: "Tus datos", gcal: "Google", ia: "IA", spotify: "Spotify", atajos: "Atajos" }[sub] : TABS.find(([id]) => id === tab)[1];
  $("fab").hidden = tab === "manu" || Boolean(sheet);
  const sheetKey = sheet ? sheet.kind : null;
  if (sheetKey !== renderedSheetKind || !sheet) {
    const wasOpen = Boolean(renderedSheetKind);
    $("sheetRoot").innerHTML = sheetHtml();
    renderedSheetKind = sheetKey;
    const bg = $("sheetBg");
    if (bg && !wasOpen && !reduceMotion()) { bg.dataset.state = "opening"; requestAnimationFrame(() => requestAnimationFrame(() => { bg.dataset.state = "open"; })); }
    else if (bg) bg.dataset.state = "open";
    if (sheet) $("qText")?.focus();
  }
  if (tab === "manu") {
    const chat = $("chat");
    const count = chat?.children.length ?? 0;
    if (count > lastChatLength && lastChatLength > 0 && !reduceMotion()) [...chat.children].slice(lastChatLength - count).forEach((b) => b.classList.add("pop"));
    lastChatLength = count;
    chat?.lastElementChild?.scrollIntoView({ block: "end", behavior: reduceMotion() ? "auto" : "smooth" });
  } else lastChatLength = 0;
  if (focus) $("screen").focus();
}

function go(newTab) {
  tab = newTab;
  sub = null;
  overlay = null;
  sessionStorage.setItem("manuos.tab", tab);
  render({ focus: true, enter: "tab" });
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
  if (intent.kind === "expense") vault.spending.push(newEntry({ id: uid("s"), cents: intent.cents, merchant: intent.merchant, at }, vault.settings.categoryRules ?? {}));
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
  if (intent.kind === "unknown" && aiReady() && navigator.onLine) {
    if (isSensitive(clean)) {
      vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text: `${reply(intent, variant++)} (Parece privado: no te ofrezco enviarlo a la IA.)`, at });
      persist(); render(); return;
    }
    const proposal = { id: uid("q"), message: clean, at };
    if (vault.settings.aiAutoSend === true) {
      vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text: "Se lo pregunto a Gemini. Se envía exactamente esto:", at, proposal: { ...proposal, auto: true } });
      askAi(proposal.id, { auto: true }); return;
    }
    vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text: "No lo entiendo sin IA. ¿Se lo pregunto a Gemini? Se enviaría exactamente esto:", at, proposal });
    persist(); render(); return;
  }
  vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text: reply(intent, variant++), at, ...(action ? { action } : {}) });
  persist();
  render();
}

// The payload is built from the proposal's own timestamp, so what Manu saw is what is sent.
const proposalPayload = (p) => buildActionPayload(p.message, new Date(p.at ?? Date.now()));
function shownPayload(p) {
  const { tools, ...rest } = proposalPayload(p);
  return `${JSON.stringify(rest, null, 1)}\n+ lista fija de ${tools[0].functionDeclarations.length} acciones que puede proponer`;
}

async function activateGemini(key) {
  aiStore.key = key;
  try {
    const model = pickModel(await listModels(key));
    if (!model) { toast("Tu clave no tiene modelos de texto disponibles"); return false; }
    aiStore.model = model; vault.settings.aiEnabled = true; persist(); render(); toast(`IA lista: ${model}`);
    return true;
  } catch (err) { aiStore.model = ""; render(); toast(err.message); return false; }
}


async function askAi(proposalId, { auto = false } = {}) {
  const bubble = vault.chat.find((b) => b.proposal?.id === proposalId);
  if (!bubble || bubble.proposal.state) return;
  // Consent is the tap on «Enviar a Gemini», or Manu's own opt-in to auto-send.
  const consent = auto ? vault.settings.aiAutoSend === true : true;
  bubble.proposal.state = "sent";
  const answer = { from: "manu", text: "Pensando…", at: new Date().toISOString(), ai: true };
  vault.chat.push(answer);
  persist(); render();
  try {
    const { text, calls } = await askWithActions({ key: aiStore.key, model: aiStore.model, payload: proposalPayload(bubble.proposal), confirmed: consent });
    answer.text = text || (calls.length === 1 ? "Te propongo esto:" : "Te propongo esto (confirma lo que quieras):");
    if (calls.length) answer.calls = calls.map((c) => ({ ...c, state: null }));
  } catch (err) {
    answer.ai = false;
    answer.text = err.code === "quota" ? "Hoy ya no queda IA gratuita. Sigo sin IA." : err.code === "key" ? "La clave de Gemini no funciona. Revísala en Tú → IA." : err.code === "sensitive" ? "Eso parece privado: no lo envío." : err.code === "unconfirmed" ? "No lo envío sin tu permiso." : "La IA no ha respondido ahora.";
  }
  persist();
  if (tab === "manu") render();
}

const SCREENS = { hoy: ["hoy"], agenda: ["agenda"], dinero: ["dinero"], tu: ["tu"], tiempo: ["hoy", null, "weather"], google: ["tu", "gcal"], ia: ["tu", "ia"], atajos: ["tu", "atajos"], habitos: ["tu", "habitos"], salud: ["tu", "salud"], comidas: ["tu", "comidas"], personas: ["tu", "personas"] };
const SCREEN_NAMES = { hoy: "Hoy", agenda: "Agenda", dinero: "Dinero", tu: "Tú", tiempo: "El tiempo", google: "Google", ia: "IA", atajos: "Atajos", habitos: "Hábitos", salud: "Salud", comidas: "Comidas", personas: "Personas" };

function callLabel(c) {
  switch (c.name) {
    case "anadir_tarea": return `Añadir tarea «${c.texto}»`;
    case "anadir_idea": return `Guardar idea «${c.texto}»`;
    case "apuntar_gasto": return `Apuntar gasto de ${euros(c.cents)}${c.concepto ? ` · ${c.concepto}` : ""}`;
    case "crear_recordatorio": { const d = new Date(c.at); return `Recordatorio «${c.texto}» · ${d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })} ${hhmm(d)}`; }
    case "ir_a": return `Ir a ${SCREEN_NAMES[c.pantalla]}`;
    case "importar_extracto": return "Elegir el extracto del banco";
    case "sugerir_mejora": return `Mejora: ${c.titulo}`;
    default: return c.name;
  }
}

function callCard(b, c, i) {
  const at = esc(b.at), n = i;
  if (c.name === "sugerir_mejora") {
    if (c.sensitive) return `<div class="ai-call"><b>${esc(callLabel(c))}</b><p class="muted small">Parece que incluye datos privados: no la preparo para GitHub. Díselo sin datos personales.</p></div>`;
    return `<div class="ai-call"><b>${esc(callLabel(c))}</b><p class="small">${esc(c.descripcion)}</p>${c.state ? `<p class="muted small">${c.state === "done" ? "Abierta en GitHub." : "Descartada."}</p>` : `<p class="muted small">Se abre GitHub con la petición escrita; la envías tú. El repositorio es público.</p><div class="btns"><a class="btn" href="${esc(issueUrl(c, APP_VERSION))}" target="_blank" rel="noopener" data-act="ai-issue" data-at="${at}" data-n="${n}">Abrir en GitHub</a><button class="btn ghost" data-act="ai-skip" data-at="${at}" data-n="${n}">No</button></div>`}</div>`;
  }
  return `<div class="ai-call"><b>${esc(callLabel(c))}</b>${c.state ? `<p class="muted small">${c.state === "done" ? "Hecho." : "Descartado."}</p>` : `<div class="btns"><button class="btn" data-act="ai-do" data-at="${at}" data-n="${n}">${c.name === "ir_a" || c.name === "importar_extracto" ? "Ir" : "Hacer"}</button><button class="btn ghost" data-act="ai-skip" data-at="${at}" data-n="${n}">No</button></div>`}</div>`;
}

const findCall = (el) => { const b = vault.chat.find((x) => x.at === el.dataset.at && x.calls); return b ? b.calls[Number(el.dataset.n)] : null; };

// Runs one action Gemini proposed, only after Manu's tap. Everything stays local.
function runCall(c) {
  if (!c || c.state) return;
  c.state = "done";
  const at = new Date().toISOString();
  switch (c.name) {
    case "anadir_tarea": vault.inbox.push({ ...capture({ id: uid("c"), text: c.texto, at }), status: "TASK" }); toast("Tarea añadida"); break;
    case "anadir_idea": vault.inbox.push({ ...capture({ id: uid("c"), text: c.texto, at }), status: "IDEA" }); toast("Idea guardada"); break;
    case "apuntar_gasto": vault.spending.push(newEntry({ id: uid("s"), cents: c.cents, merchant: c.concepto, at }, vault.settings.categoryRules ?? {})); toast("Gasto apuntado"); break;
    case "crear_recordatorio": vault.reminders.push({ id: uid("r"), text: c.texto, at: c.at, done: false, notified: false }); toast("Recordatorio creado"); break;
    case "ir_a": case "importar_extracto": {
      persist();
      const [t, s2, ov] = c.name === "ir_a" ? SCREENS[c.pantalla] : ["dinero"];
      go(t);
      if (s2 || ov) { sub = s2 ?? null; overlay = ov ?? null; render({ focus: true, enter: "page" }); if (ov) refreshWeather(); }
      // Opening the picker must happen inside this tap; Manu still chooses the file.
      if (c.name === "importar_extracto") $("bankFile")?.click();
      return;
    }
    default: c.state = null; return;
  }
  persist(); render();
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
  const sg = e.target.closest("[data-sub-go]");
  if (sg) { tab = "tu"; sub = sg.dataset.subGo; render({ focus: true }); scrollTo(0, 0); return; }
  const sb = e.target.closest("[data-sub]");
  if (sb) { sub = sb.dataset.sub; cityResults = null; render({ focus: true, enter: "page" }); scrollTo(0, 0); return; }
  const s = e.target.closest("[data-say]");
  if (s) { say(s.dataset.say); return; }
  const fill = e.target.closest("[data-fill]");
  if (fill) { const m = $("msg"); if (m) { m.value = fill.dataset.fill; m.focus(); m.setSelectionRange(m.value.length, m.value.length); $("orb")?.classList.add("listening"); } return; }
  if (e.target.id === "fab" || e.target.closest("#fab")) { openSheet(tab === "dinero" ? "EXPENSE" : "TASK"); return; }
  if (e.target.id === "sheetBg") { closeSheet(); return; }
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
    case "sheet": openSheet(a.dataset.kind); break;
    case "sheet-close": closeSheet(); break;
    case "refuge": refuge = { state: initialRefuge(), messages: [{ from: "manu", text: "Estoy aquí. ¿Qué te vendría mejor ahora: entender por qué estás así, buscar una solución o cambiar de aire?" }] }; go("manu"); break;
    case "leave-refuge": refuge = null; render(); break;
    case "back": sub = null; render({ focus: true, enter: "tab" }); break;
    case "weather-open": overlay = "weather"; render({ focus: true, enter: "page" }); scrollTo(0, 0); refreshWeather(); break;
    case "gemini-guide": overlay = "gemini"; guideStep = 0; render({ focus: true, enter: "page" }); scrollTo(0, 0); break;
    case "guide-step": guideStep = Math.max(guideStep, Number(a.dataset.n)); setTimeout(render, 400); break;
    case "overlay-close": overlay = null; render({ focus: true, enter: "tab" }); scrollTo(0, 0); break;
    case "goto-gcal": tab = "tu"; sub = "gcal"; render({ focus: true }); scrollTo(0, 0); break;
    case "gcal-sync": syncGoogle(); break;
    case "google-connect-all": vault.settings.google = { ...(vault.settings.google ?? {}), calendar: true, tasks: true, contacts: true }; persist(); syncGoogle(); break;
    case "drive-restore-no": confirmDriveRestore = null; render(); break;
    case "drive-restore-yes": { const r = validateVault(confirmDriveRestore?.data); confirmDriveRestore = null; if (!r.ok) { toast(r.reason); render(); break; } vault = r.vault; persist(); render(); toast("Copia de Drive restaurada"); break; }
    case "gfeature": { const k = a.dataset.k; vault.settings.google = { ...(vault.settings.google ?? {}), [k]: !googleOn(k) }; if (!googleOn(k)) delete gcal.tokens[SCOPE[k]]; persist(); render(); break; }
    case "ai-send": askAi(id); break;
    case "ai-do": runCall(findCall(a)); break;
    case "ai-skip": { const c = findCall(a); if (c && !c.state) { c.state = "no"; persist(); render(); } break; }
    case "ai-issue": { const c = findCall(a); if (c && !c.state) { c.state = "done"; persist(); setTimeout(render, 300); } break; }
    case "ai-auto": vault.settings.aiAutoSend = vault.settings.aiAutoSend !== true; persist(); render(); toast(vault.settings.aiAutoSend ? "Enviará sin preguntar (nunca lo privado)" : "Volverá a preguntarte antes de enviar"); break;
    case "music": musicToSpeaker(); break;
    case "shortcut-done": vault.settings.shortcutsDone = { ...(vault.settings.shortcutsDone ?? {}), [id]: true }; persist(); render(); toast("Quitado de pendientes"); break;
    case "shortcut-undo": { const d = { ...(vault.settings.shortcutsDone ?? {}) }; delete d[id]; vault.settings.shortcutsDone = d; persist(); render(); break; }
    case "cal-prev": case "cal-next": {
      const base = calView ?? { y: today().getFullYear(), m: today().getMonth() };
      const d = new Date(base.y, base.m + (a.dataset.act === "cal-next" ? 1 : -1), 1);
      calView = { y: d.getFullYear(), m: d.getMonth() };
      render(); animateCal(a.dataset.act === "cal-next" ? 1 : -1); break;
    }
    case "cal-day": calSelected = a.dataset.day; { const d = new Date(`${calSelected}T12:00:00`); if (calView && (d.getMonth() !== calView.m)) calView = { y: d.getFullYear(), m: d.getMonth() }; } render(); break;
    case "cal-today": calView = null; calSelected = null; render(); break;
    case "money-prev": moneyMonth++; render(); break;
    case "money-next": moneyMonth = Math.max(0, moneyMonth - 1); render(); break;
    case "money-filter": moneyFilter = moneyFilter === "review" ? null : "review"; render(); break;
    case "spotify-connect": startSpotifyAuth(); break;
    case "spotify-forget": spotifyStore.tokens = null; render(); toast("Spotify desconectado de este móvil"); break;
    case "ask-elsewhere": { const b = vault.chat.find((x) => x.proposal?.id === id); if (b) { try { await navigator.clipboard.writeText(b.proposal.message); } catch {} window.open(askElsewhereUrl(a.dataset.app, b.proposal.message), "_blank", "noopener"); } break; }
    case "ai-cancel": { const b = vault.chat.find((x) => x.proposal?.id === id); if (b) { b.proposal.state = "cancelled"; persist(); render(); } break; }
    case "ai-paste": {
      let text = "";
      try { text = (await navigator.clipboard.readText()).trim(); } catch { toast("No he podido leer lo copiado. Si el iPhone muestra «Pegar», tócalo; si no, pega la clave en el campo de abajo."); break; }
      if (!isGeminiKey(text)) { toast("No veo una clave de Gemini copiada (empieza por «AQ.» o «AIza»). Pulsa el icono de copiar junto a «Clave de API»."); break; }
      aiStore.remember = true; // the button says it: remembered on this phone (ADR-0013)
      if (await activateGemini(text) && overlay === "gemini") { overlay = null; tab = "tu"; sub = null; render({ focus: true, enter: "tab" }); scrollTo(0, 0); toast("IA activada. Ya puedes hablar con MANU."); }
      break;
    }
    case "ai-remember": { const k = aiStore.key; aiStore.remember = !aiStore.remember; aiStore.key = k; render(); break; }
    case "ai-forget": aiStore.key = ""; aiStore.model = ""; render(); toast("Clave borrada de este móvil"); break;
    case "ai-toggle": vault.settings.aiEnabled = vault.settings.aiEnabled === false; persist(); render(); break;
    case "mood": {
      vault.moods = setMood(vault.moods, localDay(), Number(a.dataset.v)); persist(); render();
      if (!reduceMotion()) document.querySelector(`[data-act="mood"][data-v="${Number(a.dataset.v)}"] .mood-e`)?.classList.add("bounce");
      break;
    }
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
    case "wipe-yes": { let ss = null, ls = null; try { ss = sessionStorage; ls = localStorage; } catch {} wipeDeviceKeys([ls, ss]); gcal.tokens = {}; vault = emptyVault(); confirmWipe = false; persist(); render(); toast("Datos borrados de este dispositivo"); break; }
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
    vault.settings.gcalClientId = id && id !== DEFAULT_GOOGLE_CLIENT_ID ? id : null; gcal.client = null; gcal.token = null;
    persist(); render(); toast(id ? "ID guardado" : "Google Calendar desconectado"); return;
  }
  if (f === "workStartForm") return;
  if (f === "spotifyForm") {
    const id = $("spId").value.trim();
    if (id && !isSpotifyClientId(id)) { toast("Ese no parece un Client ID de Spotify"); return; }
    const next = id && id !== DEFAULT_SPOTIFY_CLIENT_ID ? id : null;
    if (next !== (vault.settings.spotifyClientId ?? null)) spotifyStore.tokens = null; // tokens belong to the app that issued them
    vault.settings.spotifyClientId = next;
    vault.settings.spotifySpeaker = $("spSpeaker").value.trim().slice(0, 40) || DEFAULT_SPEAKER;
    persist(); render(); toast("Spotify guardado"); return;
  }
  if (f === "driveForm") {
    const pass = $("drivePass").value;
    const problem = passphraseProblem(pass);
    if (problem) { toast(problem); return; }
    const action = e.submitter?.dataset.drive ?? "save";
    try {
      if (action === "save") {
        const envelope = await encryptBackup(vault, pass);
        await withRetry(SCOPE.drive, (tk) => saveBackup(tk, envelope));
        vault.settings.googleStatus = { ...(vault.settings.googleStatus ?? {}), drive: `ok: copia cifrada ${new Date().toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` };
        persist(); render(); toast("Copia cifrada guardada en tu Drive");
      } else {
        const b = await withRetry(SCOPE.drive, (tk) => loadBackup(tk));
        if (!b) { toast("No hay copia en Drive todavía"); return; }
        confirmDriveRestore = { file: b.file, data: await decryptBackup(b.data, pass) };
        render();
      }
    } catch (err) { toast(err.message || "No se pudo completar la copia"); }
    return;
  }
  if (f === "guideForm") {
    const key = $("guideKey").value.trim();
    if (!isGeminiKey(key)) { toast("Eso no parece una clave de Gemini (empieza por «AQ.» o «AIza»)."); return; }
    aiStore.remember = true;
    if (await activateGemini(key)) { overlay = null; tab = "tu"; sub = null; render({ focus: true, enter: "tab" }); scrollTo(0, 0); toast("IA activada. Ya puedes hablar con MANU."); }
    return;
  }
  if (f === "aiForm") {
    const key = $("aiKey").value.trim();
    if (!key) { aiStore.key = ""; aiStore.model = ""; render(); return; }
    await activateGemini(key);
    return;
  }
  if (f === "addHabit") { const n = $("habitName").value.trim(); if (n) { vault.habits.push({ id: uid("h"), name: n.slice(0, 60), done: [] }); persist(); render(); } return; }
  if (f === "addMeal") { addMeal($("mealText").value); return; }
  if (f === "addPerson") {
    const name = $("pName").value.trim();
    if (!name) return;
    const b = $("pBirthday").value; // YYYY-MM-DD
    vault.people.push({ id: uid("p"), name: name.slice(0, 60), birthday: b ? b.slice(5) : null, phone: $("pPhone").value.trim().slice(0, 20) || null, notes: $("pNotes").value.trim().slice(0, 300) || null, lastContact: null });
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
      vault.spending.push(newEntry({ id: uid("s"), cents, merchant: text || null, at }, vault.settings.categoryRules ?? {}));
    } else if (k === "EVENT" && text) {
      const minutes = Math.min(1440, Math.max(5, Number($("qMinutes").value) || 60));
      try {
        const token = await googleToken(SCOPE.calendar);
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

document.addEventListener("input", (e) => {
  if (e.target.id === "msg") $("orb")?.classList.toggle("listening", e.target.value.trim().length > 0);
});

document.addEventListener("change", async (e) => {
  if (e.target.id === "workStart" && /^\d{2}:\d{2}$/.test(e.target.value)) { vault.settings.workStart = e.target.value; persist(); toast(`Entrada: ${e.target.value}`); return; }
  if (e.target.dataset.cat) {
    const r = learnCategory(vault.spending, vault.settings.categoryRules ?? {}, e.target.dataset.cat, e.target.value);
    vault.spending = r.entries; vault.settings.categoryRules = r.learned;
    if (r.applied) toast(`Aprendido: ${r.applied} movimiento${r.applied === 1 ? "" : "s"} más del mismo comercio`);
    persist(); render(); return;
  }
  if (e.target.id === "rulesFile" && e.target.files?.[0]) {
    try {
      const XLSX = await loadSheetJs();
      const wb = XLSX.read(new Uint8Array(await e.target.files[0].arrayBuffer()), { type: "array" });
      let result = { error: "No encuentro reglas en ese Excel." };
      let classified = null;
      for (const name of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" });
        const r = rulesFromRows(rows);
        if (!r.error && result.error) result = r;
        classified ??= classifiedFromRows(rows, vault.spending, vault.settings.categoryRules ?? {});
      }
      if (result.error && !classified?.entries.length) { toast(result.error); return; }
      if (result.error) result = { rules: {} };
      // Manu's own corrections (plain ids) always win over imported rules.
      const current = vault.settings.categoryRules ?? {};
      const merged = { ...result.rules };
      for (const [k, v] of Object.entries(current)) if (typeof v === "string" || !merged[k]) merged[k] = v;
      vault.settings.categoryRules = merged;
      const applied = applyRules(vault.spending, merged);
      vault.spending = applied.entries;
      const added = classified?.entries ?? [];
      vault.spending.push(...added);
      vault.settings.lastRulesImport = { at: new Date().toISOString(), rules: Object.keys(result.rules).length, reclassified: applied.changed, added: added.length, duplicates: classified?.duplicates ?? 0, review: added.filter((x) => x.review).length };
      // Show the month with the most recent movement, so the numbers are visible at once.
      moneyMonth = latestMonthOffset();
      persist(); render(); scrollTo(0, 0);
      toast(`${Object.keys(result.rules).length} reglas · ${added.length} gastos importados`);
    } catch { toast("No he podido leer ese Excel."); }
    return;
  }
  if (e.target.id === "bankFile" && e.target.files?.[0]) {
    const file = e.target.files[0];
    const ids = new Set(vault.spending.map((x) => x.id));
    const legacy = new Map(vault.spending.filter((x) => /^bank-[0-9a-z]+$/.test(x.id)).map((x) => [x.id, x]));
    const rules = vault.settings.categoryRules ?? {};
    let r;
    try {
      if (/\.xlsx?$/i.test(file.name)) {
        toast("Leyendo el Excel…");
        const XLSX = await loadSheetJs();
        const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
        r = importStatementRows(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" }), ids, rules, legacy);
      } else {
        r = importStatement(await file.text(), ids, rules, legacy);
      }
    } catch { toast("No he podido leer ese archivo."); return; }
    if (r.error) { toast(r.error); return; }
    const cross = dropCrossSource(r.entries, vault.spending, "CHATGPT");
    r.entries = cross.entries; r.duplicates += cross.duplicates;
    vault.spending.push(...r.entries);
    moneyMonth = latestMonthOffset();
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
// Loaded once and ahead of the tap (Tú, Google), so the consent window opens
// inside Manu's gesture: iOS blocks it after a network wait (QAL-015).
let gisLoading = null;
function loadGis() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "https://accounts.google.com/gsi/client";
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => { gisLoading = null; el.remove(); reject(new Error("No se pudo cargar el acceso de Google. ¿Tienes conexión?")); };
    document.head.appendChild(el);
  });
  return gisLoading;
}

// One token per scope. Scopes of the features Manu enabled are requested
// together in ONE consent window (iOS allows one popup per tap); each scope is
// cached only if Google granted it, so a partial "no" degrades per feature.
async function googleConsent(scopes) {
  const missing = scopes.filter((sc) => { const t = gcal.tokens[sc]; return !(t && Date.now() < t.expires - 60000); });
  if (!missing.length) return scopes;
  if (!isClientId(gClientId())) throw new Error("Configura Google en Tú → Google");
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: gClientId(),
      scope: missing.join(" "),
      include_granted_scopes: false,
      callback: (resp) => {
        if (resp.error || !resp.access_token) { reject(new Error("Permiso no concedido")); return; }
        const granted = missing.filter((sc) => google.accounts.oauth2.hasGrantedAllScopes(resp, sc));
        for (const sc of granted) gcal.tokens[sc] = { token: resp.access_token, expires: Date.now() + (Number(resp.expires_in) || 3600) * 1000 };
        resolve(granted);
      },
      error_callback: () => reject(new Error("Se cerró la ventana de Google")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

async function googleToken(scope) {
  await googleConsent([scope]);
  const t = gcal.tokens[scope];
  if (!t) throw new Error("Permiso no concedido");
  return t.token;
}

// Never opens a window: used inside a sync, after googleConsent.
function cachedToken(scope) {
  const t = gcal.tokens[scope];
  if (t && Date.now() < t.expires - 60000) return Promise.resolve(t.token);
  return Promise.reject(new Error("Permiso no concedido"));
}

async function withRetry(scope, fn) {
  try { return await fn(await googleToken(scope)); }
  catch (err) { if (err.code !== "auth") throw err; delete gcal.tokens[scope]; return fn(await googleToken(scope)); }
}

// silent: automatic refresh. Never opens a Google window (iOS would block it
// and it would interrupt Manu); it only uses tokens still valid in memory.
async function syncGoogle({ silent = false } = {}) {
  if (gcal.busy) return;
  gcal.busy = true; gcal.lastRun = Date.now(); if (!silent) { gcal.error = null; render(); }
  const services = [
    { key: "calendar", scope: SCOPE.calendar, run: async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 1);
      const calToken = await cachedToken(SCOPE.calendar);
      const listToken = await cachedToken(SCOPE.calendarList).catch(() => null);
      const calendars = listToken ? await listCalendars(listToken).catch(() => []) : [];
      const sources = calendars.length ? calendars : [{ id: "primary", color: null, name: null }];
      const days = mergeDays(await Promise.all(sources.map((c) => listEvents(calToken, start, end, fetch, { calendarId: c.id, color: c.color, calendar: c.name }).catch(() => new Map()))));
      vault.calendar = { from: localDay(start), to: localDay(end), days: Object.fromEntries(days), syncedAt: new Date().toISOString() };
      const t = localDay(); const tk = tomorrowKey();
      vault.agenda = { day: t, events: days.get(t) ?? [], importedAt: new Date().toISOString(), source: "GOOGLE" };
      vault.agendaTomorrow = { day: tk, events: days.get(tk) ?? [] };
      return `${sources.length} calendario${sources.length === 1 ? "" : "s"} · ${vault.agenda.events.length} hoy · ${vault.agendaTomorrow.events.length} mañana`;
    } },
    { key: "tasks", scope: SCOPE.tasks, run: async (token) => {
      const remote = await listOpenTasks(token);
      const plan = planTaskSync(vault.inbox, remote.tasks, { complete: remote.complete });
      for (const item of plan.push) { const created = await insertTask(token, item.text); vault.inbox = vault.inbox.map((i) => (i.id === item.id ? { ...i, googleId: created.id } : i)); }
      for (const item of plan.complete) { await completeTask(token, item.googleId); vault.inbox = vault.inbox.map((i) => (i.id === item.id ? { ...i, googleDone: true } : i)); }
      const closed = new Set(plan.closedRemotely.map((i) => i.id));
      vault.inbox = vault.inbox.map((i) => (closed.has(i.id) ? { ...i, done: true, googleDone: true } : i));
      for (const t of plan.pull) vault.inbox.push({ ...capture({ id: uid("c"), text: t.title, at: new Date().toISOString() }), status: "TASK", googleId: t.id });
      return `↑${plan.push.length} ↓${plan.pull.length} ✓${plan.complete.length + plan.closedRemotely.length}${remote.complete ? "" : " (lista incompleta: no cierro nada)"}`;
    } },
    { key: "contacts", scope: SCOPE.contacts, run: async (token) => {
      const fromGoogle = await contactBirthdays(token);
      const merged = mergePeople(vault.people, fromGoogle.people, () => uid("p"));
      vault.people = merged.people;
      return `${fromGoogle.total} leídos · ${fromGoogle.people.length} con cumpleaños · ${merged.added} nuevos${fromGoogle.complete ? "" : " (lista incompleta)"}`;
    } },
  ];
  const enabled = Object.fromEntries(["calendar", "tasks", "contacts"].map((k) => [k, googleOn(k)]));
  const wanted = Object.keys(enabled).filter((k) => enabled[k]).map((k) => SCOPE[k]);
  if (enabled.calendar) wanted.push(SCOPE.calendarList); // to show all of Manu's calendars
  if (silent) {
    // Only the services whose permission is still valid; the rest wait for a tap.
    for (const k of Object.keys(enabled)) if (enabled[k] && !validToken(SCOPE[k])) enabled[k] = false;
    if (!Object.values(enabled).some(Boolean)) { gcal.busy = false; return; }
  } else {
    try { await googleConsent(wanted); } catch { /* each service reports its own missing permission */ }
  }
  const status = await runServices(services, enabled, cachedToken);
  vault.settings.googleStatus = { ...(vault.settings.googleStatus ?? {}), ...status };
  if (status.calendar?.startsWith("ok")) vault.settings.gcalSyncedAt = new Date().toISOString();
  const failed = Object.values(status).filter((v) => v.startsWith("error"));
  gcal.error = failed.length ? failed.map((v) => v.replace(/^error: /, "")).join(" · ") : null;
  gcal.busy = false;
  persist();
  if (silent) { if (!sheet && !document.activeElement?.matches("input, textarea")) render(); return; }
  render();
  toast(failed.length ? "Google: algo no se ha sincronizado" : "Google sincronizado");
}

const validToken = (scope) => { const t = gcal.tokens[scope]; return Boolean(t && Date.now() < t.expires - 60000); };
const AUTO_SYNC_MS = 10 * 60000;
function autoSyncGoogle() {
  if (document.visibilityState !== "visible" || !navigator.onLine || gcal.busy) return;
  if (!["calendar", "tasks", "contacts"].some((k) => googleOn(k) && validToken(SCOPE[k]))) return;
  const last = Math.max(Date.parse(vault.settings.gcalSyncedAt ?? "") || 0, gcal.lastRun ?? 0);
  if (Date.now() - last < AUTO_SYNC_MS) return;
  syncGoogle({ silent: true }).catch(() => { gcal.busy = false; });
}

// SheetJS (vendor/, Apache-2.0) is loaded only when an Excel file is imported.
function loadSheetJs() {
  if (globalThis.XLSX) return Promise.resolve(globalThis.XLSX);
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "vendor/xlsx.full.min.js";
    el.onload = () => (globalThis.XLSX ? resolve(globalThis.XLSX) : reject(new Error("SheetJS")));
    el.onerror = () => reject(new Error("SheetJS"));
    document.head.appendChild(el);
  });
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

// Spotify redirect back (Authorization Code with PKCE).
const returned = new URLSearchParams(location.search);
if (returned.has("code") && returned.has("state")) {
  history.replaceState(null, "", location.pathname);
  tab = "tu"; sub = "spotify";
  finishSpotifyAuth(returned).then(() => render());
} else if (returned.has("error") && returned.has("state")) {
  history.replaceState(null, "", location.pathname);
  try { localStorage.removeItem("manuos.spotify.pkce"); } catch {}
  toast("Has cancelado la conexión con Spotify");
}

const launch = launchParams(location.search);
if (launch.say || launch.events) {
  history.replaceState(null, "", location.pathname);
  if (launch.events) { vault.agenda = { day: localDay(), events: launch.events, importedAt: new Date().toISOString() }; persist(); tab = "agenda"; }
  if (launch.say) { tab = "manu"; say(launch.say); }
}
render({ enter: "page" });
refreshWeather();
if (isClientId(gClientId()) && GOOGLE_FEATURES.some(([k]) => googleOn(k))) loadGis().catch(() => {});
checkReminders();
setInterval(checkReminders, 30000);
setInterval(autoSyncGoogle, 60000);
document.addEventListener("visibilitychange", autoSyncGoogle);
setInterval(() => { if (tab === "hoy" && !sheet && !document.activeElement?.matches("input, textarea")) render(); }, 60000);
