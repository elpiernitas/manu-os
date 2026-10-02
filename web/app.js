import { normalise } from "./core/text.js";
import { parse, reply, quickDetect, amountCents } from "./core/assistant.js";
import { CATEGORIES, CATEGORY_EMOJI, euros, newEntry, learnCategory, summary, toCents, rulesFromRows, applyRules } from "./core/money.js";
import { MODE_TITLES, modeState } from "./core/modes.js";
import { capture, confirm, markUnclassified, pending, tasks, ideas, toggleDone } from "./core/inbox.js";
import { initialRefuge, refugeReply } from "./core/refuge.js";
import { LocalStore, emptyVault, validateVault, wipeDeviceKeys, storageUse } from "./core/storage.js";
import { notificationStatus, isInstalled, enableNotifications, testNotification } from "./core/notify.js";
import { launchParams, parseEvents, nextEvent, localDay } from "./core/intake.js";
import { fetchForecast, searchCities, advice, WEATHER_TTL_MS } from "./core/weather.js";
import { importStatement, importStatementRows, classifiedFromRows, dropCrossSource } from "./core/bank.js";
import { CITIES, oviedoTrip, proposeAlarm, shouldAskTomorrow, shortcutUrl, guessCity } from "./core/night.js";
import { birthdayEventBody, isClientId, listEvents, createEvent, newEventBody, monthGrid, listCalendars, mergeDays } from "./core/gcal.js";
import { detectRecurring, upcomingRecurring, spendingPattern, monthStats, monthlySeries } from "./core/insights.js";
import { fetchSnapshot, summarize as mailSummary, mailSuggestions, findSender, mailOrder, idsFrom, archive as mailArchive, unarchive as mailUnarchive, trash as mailTrash, untrash as mailUntrash, ensureLabel, addLabel, removeLabel, messageUrl } from "./core/gmail.js";
import { SCOPE, runServices, planTaskSync, listOpenTasks, insertTask, completeTask, contactBirthdays, setContactBirthday, mergePeople, saveBackup, loadBackup } from "./core/google.js";
import { detectLink, linkInfo, PROVIDER_NAME, safeHref } from "./core/links.js";
import { allowedToSend, buildContext, buildConversationPayload, CONTEXT_CATEGORIES, BASIC_CONTEXT, FULL_CONTEXT, AUTO_SAFE } from "./core/converse.js";
import { newProject, addSource, buildProjectPayload, citations, PRESETS } from "./core/projects.js";
import { putImage, getImage, deleteImage, clearImages } from "./core/imagestore.js";
import { readChatgptExport, search as archiveSearch, stats as archiveStats, chatToDoc, staleChat } from "./core/archive.js";
import { putDocs, allDocs, clearArchive } from "./core/archivestore.js";
import { findExcerpts, askPayload, profileDigest, profilePayload, memoryContext } from "./core/recall.js";
import { diaryDocs, dayLines, dayFromText, isDiaryQuestion, dayTitle } from "./core/diary.js";
import { applyBuzon, buzonSummary } from "./core/buzon.js";
import { briefing, briefingText, isBriefingQuestion, monthPace } from "./core/briefing.js";
import { whatNow, whatNowText, isWhatNowQuestion, morningSpeech } from "./core/now.js";
import { gentleMode, gentlePlan, isGentleQuestion } from "./core/lowmode.js";
import { punch, editPunch, today as shiftToday, monthReport, reportRows, toCsv, monthNote, monthIcs, dur, PAUSE_REASONS, clockState, clockNudge } from "./core/clock.js";
import { closingDue, workClosing, closingText, isClosingQuestion, nextWorkDay } from "./core/closing.js";
import { searchContacts } from "./core/contacts.js";
import { autoFile, projectKeys, parseKeywords, buildSuggestPayload, parseSuggestions, projectMarkdown, projectZip, projectFileName } from "./core/autofile.js";
import { newCapture, toReview, pendingCaptures, groupCaptures, buildCapturesPayload, parseCapturesReply, applyReading, keepCapture, dropCapture, trimCaptures, BATCH } from "./core/captures.js";
import { budgetStatus, budgetLine, budgetCommand } from "./core/budget.js";
import { findInVault, findCommand } from "./core/find.js";
import { weatherEmoji, sceneFor, PARTICLES, SHAPES, MONEY_EMOJI, dayPhase, cityMinutes } from "./core/scene.js";
import { buildImagePayload, buildLinkPayload, isGeminiKey, mayGo, setSensitiveOk, sensitiveAllowed, pickModel, listModels, buildActionPayload, askWithActions, issueUrl, aiErrorText } from "./core/ai.js";
import { encryptBackup, decryptBackup, passphraseProblem, isEnvelope } from "./core/crypto.js";
import { SUPABASE_SQL, parseSyncLink, parseAuthHash, sendCode, verifyCode, refreshSession, needsRefresh, remoteHead, remoteGet, remotePut, decide, isEmptyVault, syncErrorText } from "./core/sync.js";
import { exportFullBackup, downloadBlob, readBackupFile, restoreFullBackup, FORMAT as FULL_FORMAT } from "./core/backup-manager.js";
import { isSpotifyClientId, pkceValid, randomVerifier, challengeFor, authorizeUrl, exchangeCode, refreshTokens, listDevices, findSpeaker, transferTo, DEFAULT_SPEAKER } from "./core/spotify.js";
import { appsFor, whatsappUrl, askElsewhereUrl } from "./core/hub.js";
import { NUDGES, nudgePrefs, dueNudges, markSent } from "./core/nudges.js";
import { parseCommand, suggest } from "./core/commands.js";
import { toAsk, equalSplit, detailSplit, debts, settleAll, debtLine, reminderText } from "./core/split.js";
import { buildBankShotsPayload, parseBankShots, alreadyThere, MAX_SHOTS } from "./core/bankshot.js";
import { incomeKind } from "./core/bank.js";
import { toggleHabit, streak, lastDays, dayKey, daysUntilBirthday, upcomingBirthdays, longTimeNoTalk, mealSlot, frequentMeals, healthSummary, MOODS, setMood, dueReminders } from "./core/life.js";

export const APP_VERSION = "81";
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
let morningLaunch = false; // WEB-72: opened by the morning Shortcut
let refuge = null; // Refugio lives only in memory
let sheet = null; // quick add: { kind }
let confirmWipe = false;
let cityResults = null;
let moneyFilter = null; // "review"
let seriesPick = null; // month tapped in the income vs spending chart
let moneyMonth = 0; // months back from the current one in Dinero
let calView = null; // { y, m } month shown in Agenda
let calSelected = null; // "YYYY-MM-DD"
let overlay = null; // "weather" | "gemini" | "image"
let viewImageId = null;
let chatImage = null; // screenshot attached in the MANU chat (not sent until «Enviar a Gemini»)
let openProject = null; // id of the project being viewed
let catEditing = null; // WEB-49: the only movement whose category <select> is drawn
let projSourceKind = "note";
const gcal = { tokens: {}, busy: false, error: null, consentError: null };
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
const GOOGLE_FEATURES = [["calendar", "Calendar", "Ver tu agenda y crear eventos"], ["tasks", "Tasks", "Sincronizar tus tareas"], ["contacts", "Contactos", "Leer nombres y cumpleaños"], ["drive", "Drive", "Guardar una copia cifrada (solo cuando tú lo pidas)"], ["gmail", "Gmail", "Leer, archivar, etiquetar y mandar a la papelera tus correos (nunca borrar para siempre)"]];
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

let restoring = false; // WEB-44: while a full copy is restored, nothing in memory may overwrite it
function persist() {
  if (restoring) return;
  fileNewItems();
  if (vault.chat.length > 200) vault.chat = vault.chat.slice(-200);
  if (!store.save(vault)) toast("No he podido guardar en este dispositivo.");
  nubeChanged();
}

// ---------- Tu nube (WEB-64, WEB-67): the vault in Manu's Supabase ----------
// WEB-67 (Manu's choice, ADR-0017): he signs in with a code sent to his email
// and there is no encryption phrase to remember. The row is protected by his
// account (RLS): only his user can read it; Supabase itself technically could.
// Device state in «manuos.nube»; the session in «manuos.nube.token» (a secret:
// never in backups). No password is ever kept.
const nube = {
  get state() { try { return JSON.parse(localStorage.getItem("manuos.nube") || "null") ?? {}; } catch { return {}; } },
  set state(v) { try { localStorage.setItem("manuos.nube", JSON.stringify(v)); } catch {} },
  patch(p) { this.state = { ...this.state, ...p }; },
  get session() { try { return JSON.parse(localStorage.getItem("manuos.nube.token") || "null"); } catch { return null; } },
  set session(v) { try { v ? localStorage.setItem("manuos.nube.token", JSON.stringify(v)) : localStorage.removeItem("manuos.nube.token"); } catch {} },
  running: false, edits: 0, timer: null, handoff: null, lastRowExisting: false,
};
const NUBE_URL = "https://xqsexjpuhvmwkclpnvjo.supabase.co"; // Manu's project; also in the CSP
// Supabase's *publishable* key: public by design (it ships in every web app
// that uses Supabase); what protects the data is RLS and Manu's session. The
// secret key never goes here (configProblem refuses it).
const NUBE_KEY = "sb_publishable_sfml3vmi8c7Un7kTi4xjkg_Ioj1eAwQ";
const nubeCfg = () => ({ url: NUBE_URL, key: NUBE_KEY });
const nubeOn = () => Boolean(nube.session);
// WEB-64 kept an encryption key here; removed on this version (and on «Borrar todo»).
const dropNubeKey = () => new Promise((res) => { try { const d = indexedDB.deleteDatabase("manu-sync-key"); d.onsuccess = d.onerror = d.onblocked = () => res(); } catch { res(); } });
const inIosBrowser = () => /iPhone|iPad/.test(navigator.userAgent) && !(navigator.standalone || globalThis.matchMedia?.("(display-mode: standalone)").matches);
const deviceName = () => (/iPhone|iPad/.test(navigator.userAgent) ? "iPhone" : /Mac/.test(navigator.userAgent) ? "Mac" : "otro dispositivo");

async function nubeSession() {
  let s = nube.session;
  if (!s) throw Object.assign(new Error("Sin sesión"), { code: "expired" });
  if (needsRefresh(s)) {
    try { s = await refreshSession(nubeCfg(), s); nube.session = s; } catch (err) { if (err.code === "expired") nube.session = null; throw err; }
  }
  return s;
}

function nubeChanged() {
  if (!nubeOn() || restoring) return;
  nube.edits++;
  if (!nube.state.dirty) nube.patch({ dirty: true });
  clearTimeout(nube.timer);
  nube.timer = setTimeout(() => nubeSync(), 4000);
}

async function nubePush(baseRev) {
  const s = await nubeSession();
  const edits = nube.edits;
  const rev = await remotePut(nubeCfg(), s, { data: vault, baseRev, device: deviceName() });
  nube.patch({ lastRev: rev, lastAt: new Date().toISOString(), conflict: null, error: null, ...(edits === nube.edits ? { dirty: false } : {}) });
}

// What Manu himself writes, leaving out what MANU refreshes on its own (the
// weather, Google's copies, marks like «already nudged today»): those must not
// turn a normal download into a conflict.
const AUTO_KEYS = ["weather", "weatherCities", "calendar", "agenda", "agendaTomorrow", "mail", "contacts"];
const AUTO_SETTINGS = ["gcalSyncedAt", "googleErrors", "googleStatus", "clockNudged"];
function userPrint(v) {
  const rest = { ...v }, set = { ...(v.settings ?? {}) };
  for (const k of AUTO_KEYS) delete rest[k];
  for (const k of AUTO_SETTINGS) delete set[k];
  delete rest.settings;
  return JSON.stringify([rest, set]);
}
// `before`: userPrint(vault) when the sync started. If Manu changed something
// while the cloud copy was on its way, replacing the vault would lose it:
// returns "edited" and the caller turns it into a conflict (QA ChatGPT 2026-10, #1).
async function nubePull(row = null, { before = null } = {}) {
  const s = await nubeSession();
  row = row ?? await remoteGet(nubeCfg(), s);
  if (!row) return;
  if (isEnvelope(row.data)) {
    // Left by WEB-64 (encrypted, phrase no longer used): it can't be read,
    // so this device's data replaces it.
    nube.patch({ dirty: true }); await nubePush(row.rev); return;
  }
  const v = validateVault(row.data);
  if (!v.ok) throw new Error(`Los datos de la nube no son válidos: ${v.reason}`);
  if (before !== null && userPrint(vault) !== before) return "edited";
  // Saved first: if it does not fit on this device, nothing changes (memory,
  // revision, «dirty»), or a reload would bring back the old data marked as
  // the cloud's revision and the next push would overwrite the good copy (#2).
  if (!store.save(v.vault)) throw new Error("No cabe en este dispositivo: libera espacio en Tú → Tus datos y vuelve a sincronizar.");
  // Audit 2026-10: swap the vault in memory instead of reloading the page, so
  // whatever Manu is typing (quick-add sheet, chat) is not lost.
  clearTimeout(nube.timer);
  vault = v.vault;
  nube.patch({ lastRev: row.rev, lastAt: new Date().toISOString(), dirty: false, conflict: null, error: null });
  toast(`Datos del ${row.device ?? "otro dispositivo"} cargados`);
  if (!sheet && !document.activeElement?.matches("input, textarea, select")) render();
}

async function nubeSync({ manual = false } = {}) {
  if (!nubeOn() || nube.running || restoring) return;
  nube.running = true;
  if (tab === "tu" && sub === "nube") render();
  try {
    const st = nube.state;
    const before = userPrint(vault);
    const head = await remoteHead(nubeCfg(), await nubeSession());
    const what = decide({ lastRev: st.lastRev ?? null, dirty: Boolean(st.dirty), remote: head, localEmpty: isEmptyVault(vault) });
    // WEB-68: a device that never synced finds something in the cloud. If it
    // is empty or the unreadable WEB-64 packet, it is not a real conflict.
    let replace = false, what2 = what;
    if (what === "conflict" && (st.lastRev ?? null) === null && head) {
      const row = await remoteGet(nubeCfg(), await nubeSession());
      replace = Boolean(row && (isEnvelope(row.data) || isEmptyVault(row.data)));
    }
    if (what === "push" || replace) await nubePush(head?.rev ?? null);
    else if (what === "pull" && (await nubePull(null, { before })) === "edited") what2 = "conflict";
    if (what2 === "conflict" && !(what === "push" || replace)) { nube.patch({ conflict: { rev: head?.rev ?? null, device: head?.device ?? null, at: head?.updated_at ?? null } }); if (manual || tab === "tu") render(); toast(syncErrorText({ code: "conflict" })); }
    else if (what === "none") nube.patch({ lastAt: new Date().toISOString(), error: null });
    if (manual) toast(what2 === "conflict" ? "Elige con qué datos te quedas" : "Sincronizado");
  } catch (err) {
    if (err.code === "conflict") nube.patch({ conflict: { rev: null } });
    nube.patch({ error: syncErrorText(err) });
    if (manual || err.code !== "network") toast(syncErrorText(err));
  } finally {
    nube.running = false;
    if (tab === "tu" && sub === "nube") render();
  }
}

// Step 1: the code goes to Manu's email.
async function nubeAskCode(email) {
  const cfg = nubeCfg();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Escribe tu correo.");
  await sendCode(cfg, email);
  nube.patch({ email, codeSentAt: new Date().toISOString() });
}

// Step 2: the code opens the session; then, what is already in the cloud decides.
async function nubeEnter(code) {
  const cfg = nubeCfg();
  const c = String(code ?? "").trim();
  if (/^\d[\d\s]{5,12}$/.test(c)) nube.session = await verifyCode(cfg, { email: nube.state.email, token: c });
  else if (/^[A-Za-z0-9_.-]{6,400}$/.test(c)) nube.session = await refreshSession(cfg, { refresh: c }).catch(() => { throw Object.assign(new Error("Ese código ya no vale: pide otro enlace."), { code: "badcode" }); });
  else throw Object.assign(new Error("Pega el código tal cual te lo da el enlace."), { code: "badcode" });
  await nubeAfterSignIn(cfg);
  return nube.lastRowExisting ? "existing" : "new";
}

// After signing in: what is already in the cloud decides.
async function nubeAfterSignIn(cfg = nubeCfg()) {
  const row = await remoteGet(cfg, nube.session);
  // An empty cloud, or the unreadable leftover of WEB-64, is not a conflict:
  // this device's data simply goes up over it.
  const replaceable = row && (isEnvelope(row.data) || isEmptyVault(row.data));
  nube.lastRowExisting = Boolean(row && !replaceable);
  nube.patch({ lastRev: replaceable ? row.rev : null, dirty: Boolean(replaceable), conflict: null, error: null, codeSentAt: null });
}

async function nubeMail(email) {
  toast("Mandando el correo…");
  try { await nubeAskCode(email); render(); toast("Mira tu correo: te ha llegado un enlace"); }
  catch (err) { toast(err.code === "network" ? syncErrorText(err) : err.message); }
}
const nubeCodeAgain = () => nubeMail(nube.state.email ?? "");
async function nubeCodeSubmit(code) {
  toast("Entrando…");
  try {
    const r = await nubeEnter(code);
    render();
    toast(r === "existing" ? "Dentro: traigo tus datos…" : "Dentro: subo tus datos…");
    await nubeSync({ manual: true });
  } catch (err) { toast(["network", "expired", "table", "conflict"].includes(err.code) ? syncErrorText(err) : err.message); }
}

async function nubeLeave() {
  clearTimeout(nube.timer);
  nube.session = null;
  await dropNubeKey();
  const { email } = nube.state;
  nube.state = { email };
}

async function nubeResolve(which) {
  try {
    if (which === "remote") { nube.patch({ dirty: false }); await nubePull(); return; }
    const head = await remoteHead(nubeCfg(), await nubeSession());
    await nubePush(head?.rev ?? null);
    toast("Hecho: la nube tiene ahora lo de este dispositivo");
  } catch (err) { toast(syncErrorText(err)); }
  render();
}

// WEB-60: ideas, tasks and kept screenshots go to their project by themselves.
function fileNewItems(onlyProject = null) {
  if (!(vault.projects ?? []).length) return [];
  const r = autoFile(vault, { onlyProject, uid: () => uid("src") });
  vault.projects = r.projects; vault.inbox = r.inbox; vault.captures = r.captures;
  if (r.filed.length && !onlyProject) setTimeout(() => toast(r.filed.length === 1 ? `Guardado también en «${r.filed[0].project}»` : `${r.filed.length} cosas guardadas en sus proyectos`), 50);
  return r.filed;
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
  proyectos: svg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  clock: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>'),
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
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  shots: svg('<rect x="7" y="3" width="12" height="16" rx="2"/><path d="M4 7v12a2 2 0 002 2h9"/><path d="M10 14l2.5-3 2 2.5 1.5-1.5 2 2"/>'),
  box: svg('<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>'),
  alarm: svg('<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 2M4 4l3 2.5M20 4l-3 2.5"/>'),
};

const TABS = [["hoy", "Hoy"], ["agenda", "Agenda"], ["manu", "MANU"], ["dinero", "Dinero"], ["proyectos", "Proyectos"], ["tu", "Tú"]];

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
    // WEB-54: one copy per city, so swiping between them is instant (and offline).
    vault.weatherCities = { ...Object.fromEntries(Object.entries(vault.weatherCities ?? {}).filter(([k]) => weatherCityList().some((c) => c.name === k))), [city.name]: vault.weather };
    persist();
  } catch {
    weather.error = "No he podido traer el tiempo ahora.";
  } finally {
    weather.loading = false;
    if (tab === "hoy" && !sheet && !document.activeElement?.matches("input, textarea")) render();
  }
}

// ---------- Tiempo: deslizar entre ciudades (WEB-54) ----------
function weatherCityList() {
  const home = vault.settings.homeCity;
  return [CITIES.GIJON, CITIES.OVIEDO, ...(home && ![CITIES.GIJON.name, CITIES.OVIEDO.name].includes(home.name) ? [home] : [])];
}
let weatherSlide = null; // "next" | "prev": direction of the last swipe, for the entrance
function showCity(c, dir = null) {
  vault.settings.cityOverride = { day: localDay(), city: c };
  const cached = vault.weatherCities?.[c.name];
  if (cached) vault.weather = cached;
  weatherSlide = dir;
  persist(); render(); refreshWeather(!cached || Date.now() - Date.parse(cached.at) > WEATHER_TTL_MS);
}
function swipeCity(step) {
  const list = weatherCityList();
  const i = Math.max(0, list.findIndex((c) => c.name === activeCity().name));
  const next = list[(i + step + list.length) % list.length];
  if (next.name !== activeCity().name) showCity(next, step > 0 ? "next" : "prev");
}
const cityDots = () => { const list = weatherCityList(), cur = activeCity().name; return `<div class="city-dots" role="tablist" aria-label="Ciudades">${list.map((c) => `<button role="tab" data-act="city" data-city="${esc(c.name)}" aria-selected="${c.name === cur}" aria-label="${esc(c.name)}"></button>`).join("")}</div>`; };
let swipeStart = null;
document.addEventListener("touchstart", (e) => {
  if (overlay !== "weather" || e.touches.length !== 1 || e.target.closest(".hours, input, select, textarea")) { swipeStart = null; return; }
  swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
}, { passive: true });
document.addEventListener("touchend", (e) => {
  if (!swipeStart || overlay !== "weather") return;
  const t = e.changedTouches[0], dx = t.clientX - swipeStart.x, dy = t.clientY - swipeStart.y;
  const quick = Date.now() - swipeStart.t < 800;
  swipeStart = null;
  if (quick && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) swipeCity(dx < 0 ? 1 : -1);
}, { passive: true });
document.addEventListener("keydown", (e) => {
  if (overlay !== "weather" || e.target.matches("input, textarea, select")) return;
  if (e.key === "ArrowRight") swipeCity(1); else if (e.key === "ArrowLeft") swipeCity(-1);
});

const wxE = (icon, cls = "") => `<span class="wx-emoji${cls ? ` ${cls}` : ""}" aria-hidden="true">${weatherEmoji(icon)}</span>`;
const sceneLayer = (scene) => `<div class="scene scene-${scene}" aria-hidden="true">${(SHAPES[scene] ?? []).map((c) => `<b class="${c}"></b>`).join("")}${"<i></i>".repeat(PARTICLES[scene] ?? 0)}</div>`;
// A redraw rebuilds the screen; without this every animation would restart
// from zero and «jump» (WEB-36). Each one continues from the app clock.
function syncAnimations(root) {
  const t = performance.now() / 1000;
  root?.querySelectorAll(".scene b, .scene i, .wx-emoji.big, .wx-emoji.xl").forEach((el) => {
    const cs = getComputedStyle(el);
    if (!cs.animationName || cs.animationName === "none") return;
    const dur = parseFloat(cs.animationDuration) || 0;
    if (!dur) return;
    const base = el.dataset.delay ?? String(parseFloat(cs.animationDelay) || 0);
    el.dataset.delay = base;
    const period = cs.animationDirection.includes("alternate") ? dur * 2 : dur;
    el.style.animationDelay = `${(Number(base) - (t % period)).toFixed(3)}s`;
  });
}
// WEB-40: dawn/day/dusk/night from the city's real sunrise and sunset.
const phaseOf = (f) => (f?.today ? dayPhase(cityMinutes(Date.now(), f.offset), f.today.sunrise, f.today.sunset) : null);
function currentWeather() {
  const city = activeCity();
  return vault.weather && vault.weather.city?.name === city.name ? vault.weather : null;
}
let celebrateMoney = false; // short money shower, only when entering Dinero
const moneyRain = () => `<div class="money-rain" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i>${MONEY_EMOJI[i % MONEY_EMOJI.length]}</i>`).join("")}</div>`;
const catLabel = (c) => `${CATEGORY_EMOJI[c] ?? "📦"} ${CATEGORIES[c] ?? c}`;

// ---------- Buscar en todo (WEB-48) ----------
// Vault + «Tu archivo» and diary (if already loaded; they load at start).
let findQ = "";
function findEverywhere(q, limit = 30) {
  const local = findInVault(vault, q, { limit });
  const docs = archive.docs ?? [];
  const arch = docs.length ? archiveSearch(docs, q, { limit: 8 }).map((r) => ({ kind: r.doc.source === "diario" ? "Diario" : "Archivo", icon: r.doc.source === "diario" ? "📔" : r.doc.source === "manu" ? "💬" : "🗂️", title: r.doc.title, detail: r.snippet, at: new Date(r.doc.at).toISOString(), go: { sub: "archivo" } })) : [];
  return [...local, ...arch].slice(0, limit);
}
function findCard() {
  const res = findQ ? findEverywhere(findQ) : [];
  const goAttr = (g) => (g.project ? `data-act="find-go" data-project="${esc(g.project)}"` : g.sub ? `data-sub-go="${esc(g.sub)}"` : `data-act="find-go" data-tab="${esc(g.tab)}"`);
  return `<section class="card find"><form id="findForm" class="composer-inline" role="search"><label for="findQ" class="sr">Buscar en todo</label><input id="findQ" type="search" placeholder="🔎 Buscar en todo (ideas, gastos, personas…)" value="${esc(findQ)}" autocomplete="off" enterkeyhint="search"><button class="btn" type="submit">Buscar</button></form>
    ${findQ ? (res.length ? `<p class="muted small">${res.length === 30 ? "Los 30 más recientes" : `${res.length} resultado${res.length === 1 ? "" : "s"}`} para «${esc(findQ)}»</p>${res.map((x) => `<button class="row find-row" ${goAttr(x.go)}><span aria-hidden="true">${esc(x.icon)}</span><span class="grow"><span>${esc(x.title)}</span><br><span class="muted small">${esc(x.detail)}</span></span><span class="chev">${I.chev}</span></button>`).join("")}<button class="link small" data-act="find-clear">Borrar búsqueda</button>` : `<p class="muted small">No encuentro «${esc(findQ)}» en MANU. <button class="link small" data-act="find-clear">Borrar</button></p>`) : ""}</section>`;
}

// ---------- Presupuestos (WEB-47) ----------
const budgetsNow = () => budgetStatus(vault.spending, vault.settings.budgets ?? {}, today());
function budgetCard() {
  const list = budgetsNow();
  const used = new Set(list.map((b) => b.cat));
  const icon = { ok: "🟢", warn: "🟠", over: "🔴" };
  return `<section class="card"><h2>🎯 Presupuestos del mes</h2>
    ${list.length ? list.map((b) => `<div class="row budget-row"><span aria-hidden="true">${icon[b.status]}</span><div class="grow"><div>${esc(catLabel(b.cat))}</div><div class="muted small">${b.status === "over" ? `Te has pasado ${euros(-b.left)}` : `Quedan ${euros(b.left)}`} · ${euros(b.spent)} de ${euros(b.limit)}</div></div><button class="link small" data-act="budget-del" data-cat="${esc(b.cat)}" aria-label="Quitar presupuesto de ${esc(CATEGORIES[b.cat])}">Quitar</button></div>`).join("") : '<p class="muted small">Un límite al mes por categoría. Te aviso si vas demasiado rápido.</p>'}
    <form id="budgetForm" class="budget-form"><label for="budgetCat" class="sr">Categoría</label><select id="budgetCat">${Object.keys(CATEGORIES).filter((k) => !used.has(k)).map((k) => `<option value="${k}">${esc(catLabel(k))}</option>`).join("")}</select><label for="budgetAmount" class="sr">Límite al mes en euros</label><input id="budgetAmount" inputmode="decimal" placeholder="€ al mes" maxlength="9"><button class="btn" type="submit">Poner</button></form></section>`;
}

// ---------- Tu día de un vistazo (WEB-46) ----------
function dayBriefing() {
  const city = activeCity();
  const w = vault.weather && vault.weather.city?.name === city.name ? vault.weather : null;
  const f = w?.data ?? null;
  return briefing({
    now: today(), weather: f, advice: f ? advice(f) : null,
    today: eventsFor(localDay()), tomorrow: eventsFor(tomorrowKey()),
    reminders: vault.reminders, tasks: tasks(vault.inbox), birthdays: upcomingBirthdays(vault.people, today(), 1),
    spending: vault.spending, inbox: vault.inbox, importantMail: googleOn("gmail") ? vault.mail?.important?.length ?? 0 : 0,
    budgetAlerts: budgetsNow().filter((b) => b.status !== "ok").slice(0, 2).map(budgetLine),
    gentle: gentleNow().on,
  });
}
// ---------- Día de Oviedo (WEB-71) ----------
// He answered «Sí, en Oviedo» last night: when to leave, from his first timed
// event today (Google Calendar) or his usual start.
function oviedoToday() {
  const t = vault.settings.tomorrow;
  if (!(t && t.day === localDay() && t.work && t.city === "OVIEDO")) return null;
  const first = eventsFor(localDay()).filter((e) => e.time && !String(e.title ?? "").startsWith("🎂")).sort((a, b) => a.time.localeCompare(b.time))[0];
  return oviedoTrip({ workStart: first?.time ?? vault.settings.workStart ?? "09:00" });
}

const addMinutes = (hhmm, min) => { const [h, m] = String(hhmm).split(":").map(Number); const t = (((h * 60 + m + min) % 1440) + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
// ---------- Fichaje (WEB-74) ----------
const clockTarget = () => Number(vault.settings.clockTarget) > 0 ? Number(vault.settings.clockTarget) : 240;
const clockDay = (key = localDay()) => (vault.clock ?? []).find((d) => d.day === key) ?? { day: key, events: [] };
const shiftNow = () => shiftToday(clockDay().events, { now: today(), targetMin: clockTarget() });
let clockMonth = null; // "YYYY-MM" shown in Tú → Fichaje
let clockEdit = null;  // day being corrected
function doPunch(t, why = null) {
  try {
    vault.clock = punch(vault.clock, t, { at: today(), id: uid("ck"), why });
    persist(); render();
    const s = shiftNow();
    toast({ in: "Dentro. ¡A por ello!", pause: `Pausa${why ? ` (${why.toLowerCase()})` : ""}: paro el reloj`, back: s.leaveAt ? `De vuelta. Puedes salir a las ${s.leaveAt}` : "De vuelta", out: s.extraMin ? `Salida. Hoy +${dur(s.extraMin)} para tu saldo` : s.leftMin ? `Salida. Hoy te faltan ${dur(s.leftMin)}` : "Salida. Jornada clavada" }[t]);
  } catch (err) { toast(err.message); }
}
function clockCard() {
  const s = shiftNow();
  const wd = (today().getDay() + 6) % 7 < 5;
  const h = today().getHours();
  // Before clocking in, only on workdays and around work hours (after 14:00
  // with nothing punched it goes away). WEB-79: after «Salida» it goes away too
  // (the day stays in Tú → Fichaje).
  if (s.state === "off" && (!wd || h < 7 || h >= 14)) return "";
  if (s.state === "done") return "";
  const line = s.state === "off" ? "Cuando fiches en RK, pulsa «Entro»."
    : s.state === "working" ? (s.leftMin ? `Te quedan <b>${esc(dur(s.leftMin))}</b>: puedes salir a las <b>${esc(s.leaveAt)}</b>.` : `Jornada cumplida${s.extraMin ? ` y llevas <b>+${esc(dur(s.extraMin))}</b>` : ""}. Ya puedes salir.`)
    : s.state === "paused" ? `En pausa desde hace un rato. Te quedan <b>${esc(dur(s.leftMin))}</b> de jornada.`
    : s.extraMin ? `Hoy has hecho <b>+${esc(dur(s.extraMin))}</b> de más.` : s.leftMin ? `Hoy te faltaron <b>${esc(dur(s.leftMin))}</b>.` : "Jornada clavada.";
  const btn = { in: `<button class="btn" data-act="punch" data-t="in">🟢 Entro</button>`, out: `<button class="btn ghost" data-act="punch" data-t="out">🚪 Salida</button>`, back: `<button class="btn" data-act="punch" data-t="back">🏢 Vuelvo a la oficina</button>` };
  const actions = s.state === "working" ? `${btn.out}<div class="chips" role="group" aria-label="Pausa">${PAUSE_REASONS.map((r) => `<button class="chip" data-act="punch" data-t="pause" data-why="${esc(r)}">⏸ ${esc(r)}</button>`).join("")}</div>`
    : s.state === "paused" ? btn.back : s.state === "done" ? `<button class="btn ghost" data-act="punch" data-t="in">Vuelvo a entrar</button>` : btn.in;
  return `<section class="card clock" aria-labelledby="clockTitle"><div class="row"><h2 id="clockTitle" class="grow">⏱️ Fichaje</h2><button class="link small" data-sub-go="fichaje">Registro</button></div>
    ${s.state === "off" ? "" : `<div class="clock-stats"><div><span class="muted small">Trabajado</span><b class="num">${esc(dur(s.workedMin))}</b></div><div><span class="muted small">Pausas</span><b class="num">${s.pauses} · ${esc(dur(s.pausedMin))}</b></div><div><span class="muted small">Entrada</span><b class="num">${s.firstIn ? esc(hhmm(new Date(s.firstIn))) : "—"}</b></div></div>`}
    <p>${line}</p><div class="btns">${actions}</div></section>`;
}
async function downloadClock(month, kind) {
  const r = monthReport(vault.clock, month, { targetMin: clockTarget(), now: today() });
  const rows = reportRows(r);
  let file;
  if (kind === "xlsx") {
    try {
      const XLSX = await loadSheetJs();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 11 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 7 }, { wch: 14 }, { wch: 12 }, { wch: 9 }, { wch: 12 }, { wch: 15 }, { wch: 17 }];
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, `Fichaje ${month}`);
      const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      file = new File([bytes], `fichaje-${month}.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    } catch { toast("No he podido crear el Excel: te lo doy en CSV"); kind = "csv"; }
  }
  if (kind === "csv") file = new File([toCsv(rows)], `fichaje-${month}.csv`, { type: "text/csv" });
  if (kind === "ics") file = new File([monthIcs(vault.clock, month, { targetMin: clockTarget(), now: today() })], `fichaje-${month}.ics`, { type: "text/calendar" });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: `Fichaje ${month}` }); return; } } catch (err) { if (err?.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------- Modo bajón (WEB-70) ----------
const gentleNow = () => gentleMode(vault.moods, today(), { pausedDay: vault.settings.gentlePaused ?? null });
// People he talks to most recently: the first is offered by name.
const trustedPeople = () => [...(vault.people ?? [])].filter((p) => p.lastContact).sort((a, b) => String(b.lastContact).localeCompare(String(a.lastContact))).slice(0, 3);
function gentleData() {
  const g = gentleNow();
  // The lift itself is in «Ahora» (whatNow); the card does not repeat it.
  return { g, plan: gentlePlan(g, { trusted: trustedPeople() }) };
}
function gentleCard() {
  const { g, plan } = gentleData();
  if (!plan) return "";
  return `<section class="card brief gentle" aria-labelledby="gentleTitle"><h2 id="gentleTitle">${esc(plan.title)}</h2><p class="muted small">${esc(plan.why)}</p>
    <ul class="brief-list">${plan.lines.map((l) => `<li><span aria-hidden="true">${l.e}</span><span>${esc(l.t)}</span></li>`).join("")}</ul>
    <div class="btns"><button class="btn" data-act="refuge">Hablarlo con MANU</button>${g.level === "heavy" && trustedPeople()[0] ? `<button class="btn ghost" data-sub-go="personas">Escribir a ${esc(trustedPeople()[0].name)}</button>` : ""}<button class="link small" data-act="gentle-pause">Hoy estoy bien, quítalo</button></div></section>`;
}
// ---------- Cierre de jornada (WEB-63) ----------
const dayClosing = () => workClosing({ now: today(), inbox: vault.inbox, tomorrow: eventsFor(nextWorkDay(today()).key), reminders: vault.reminders });
const overrideOn = () => Boolean(vault.settings.override && today() < new Date(vault.settings.override.until));
const closingNow = () => (!overrideOn() && closingDue(today(), { closedDay: vault.settings.closedDay ?? null }) ? dayClosing() : null);
function closingCard() {
  const c = closingNow();
  if (!c) return "";
  return `<section class="card brief closing" aria-labelledby="closeTitle"><h2 id="closeTitle">🏁 Cierre de jornada</h2>
    <ul class="brief-list">${c.lines.map((l) => `<li><span aria-hidden="true">${l.e}</span><span>${esc(l.t)}</span></li>`).join("")}</ul>
    <div class="btns"><button class="btn" data-act="close-day">Jornada cerrada</button><button class="btn ghost" data-act="sheet" data-kind="TASK">Apuntar para ${esc(c.label)}</button></div></section>`;
}
function closeDay() {
  const label = dayClosing().label;
  vault.settings.closedDay = localDay();
  persist(); render();
  toast(`Hecho. Desconecta hasta ${label}.`);
}

// ---------- Ahora (WEB-58): una sola cosa, la siguiente ----------
function nowPlan() {
  return whatNow({ closing: closingNow(), gentle: gentleNow().on, trip: oviedoToday(), shift: shiftNow(),
    now: today(), mode: modeState(today(), undefined, vault.settings.override).mode,
    events: eventsFor(localDay()), tomorrow: eventsFor(tomorrowKey()),
    reminders: vault.reminders, tasks: tasks(vault.inbox), projects: vault.projects,
    birthdays: upcomingBirthdays(vault.people, today(), 0), quiet: longTimeNoTalk(vault.people), moods: vault.moods, captures: toReview(vault.captures).length,
  });
}
const goButton = (go) => (!go ? "" : go.href ? `<a class="btn ghost" href="${esc(safeHref(go.href))}" target="_blank" rel="noopener">${esc(go.label ?? "Abrir")}</a>` : `<button class="btn ghost" ${goAttrs(go)}>Ir</button>`);
const goAttrs = (go) => (!go ? "" : go.project ? `data-act="find-go" data-project="${esc(go.project)}"` : go.sub ? `data-sub-go="${esc(go.sub)}"` : `data-act="find-go" data-tab="${esc(go.tab)}"`);
function nowCard() {
  const r = nowPlan();
  const main = r.main;
  return `<section class="card now-card" aria-labelledby="nowTitle"><h2 id="nowTitle">👉 Ahora</h2>
    <p class="now-main"><span aria-hidden="true">${main.e}</span> <b>${esc(main.t)}</b></p><p class="muted small">${esc(main.why)}</p>
    ${goButton(main.go)}
    ${r.more.length ? `<ul class="brief-list now-more">${r.more.map((m) => `<li><span aria-hidden="true">${m.e}</span><span>${esc(m.t)}</span></li>`).join("")}</ul>` : ""}</section>`;
}
function briefingCard() {
  const b = dayBriefing();
  if (!b.lines.length) return "";
  return `<section class="card brief${b.evening ? " evening" : ""}"><div class="row"><h2 class="grow">${b.evening ? "🌙" : "☀️"} ${esc(b.title)}</h2>${"speechSynthesis" in globalThis ? '<button class="link small" data-act="speak-day" aria-label="Leérmelo en voz alta">🔊 Léemelo</button>' : ""}</div><ul class="brief-list">${b.lines.map((l) => `<li><span aria-hidden="true">${l.e}</span><span>${esc(l.t)}</span></li>`).join("")}</ul></section>`;
}
// WEB-72: MANU reads the morning aloud (needs a tap: iOS only speaks after one).
function speakDay() {
  const synth = globalThis.speechSynthesis;
  if (!synth) { toast("Este navegador no puede leer en voz alta"); return; }
  synth.cancel();
  const u = new SpeechSynthesisUtterance(morningSpeech({ greeting: greeting(), now: nowPlan(), brief: dayBriefing() }));
  u.lang = "es-ES"; u.rate = 1.02;
  const v = synth.getVoices?.().find((x) => /^es[-_]ES/i.test(x.lang));
  if (v) u.voice = v;
  synth.speak(u);
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
  const scene = sceneFor(f.now.icon, f.today);
  return `<section class="card hero scene-card sc-${scene}${phaseOf(f) ? ` ph-${phaseOf(f)}` : ""}" aria-label="Tiempo en ${esc(city.name)}">
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
  const slide = weatherSlide ? ` slide-${weatherSlide}` : ""; weatherSlide = null;
  if (!w || !w.data.hours) return `<button class="link" data-act="overlay-close">${I.back} Hoy</button>${cityDots()}<h1 class="weather-city${slide}">${esc(city.name)}</h1><p class="muted">${weather.loading ? "Cargando…" : navigator.onLine ? "Sin datos todavía." : "Sin conexión: aún no tengo el tiempo de esta ciudad."}</p>`;
  const f = w.data;
  const lo = Math.min(...f.days.map((d) => d.min)), hi = Math.max(...f.days.map((d) => d.max));
  const span = Math.max(1, hi - lo);
  return `<button class="link" data-act="overlay-close">${I.back} Hoy</button>${cityDots()}
    <div class="weather-head${slide}"><p class="muted">${esc(city.name)}</p>${wxE(f.now.icon, "xl")}<div class="temp xl"><span data-count="${f.now.temp}">${f.now.temp}</span>°</div><p>${esc(f.now.text)}</p><p class="muted">Máx. ${f.today.max}° · Mín. ${f.today.min}°</p></div>
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
  { id: "manana", name: "MANU Buenos días", purpose: "que MANU se abra con tu día al parar la alarma", test: `${SITE}#manana=1`, steps: [
    "Atajos → <b>Automatización</b> → <b>+</b> → <b>«Alarma»</b> → <b>«Se detiene»</b> (elige tu alarma de diario) y <b>«Ejecutar inmediatamente»</b>.",
    `Acción <b>«Abrir URL»</b>: <code>${esc(SITE)}#manana=1</code>`,
    "Al parar la alarma, MANU se abre con «Buenos días» y el botón «🔊 Léemelo» (iOS solo deja hablar tras un toque).",
    "Aviso: puede abrirse en Safari en vez de en el icono de MANU (NO_VERIFICADO). Si pasa, en Safari funciona igual pero sin tus datos: dímelo y lo cambiamos."] },
  { id: "fichaje", name: "MANU Fichaje", purpose: "avisos de fichar a las 9:01 y a las 13:00", test: null, steps: [
    "Atajos → <b>Automatización</b> → <b>+</b> → <b>«Hora del día»</b> <b>9:01</b>, <b>Semanalmente</b> de lunes a viernes, <b>«Ejecutar inmediatamente»</b>.",
    "Acción <b>«Mostrar notificación»</b>: <code>¿Fichaste ya? Si no, ficha en RK y pulsa «Entro» en MANU.</code>",
    "Otra automatización igual a las <b>13:00</b> con <code>Acuérdate de fichar al salir.</code>",
    "Ojo: estas dos suenan siempre, también si ya fichaste, porque el iPhone no puede mirar dentro de MANU. MANU, si está abierta, solo te avisa cuando hace falta (y a la salida te dice a qué hora puedes irte)."] },
  { id: "noche", name: "MANU Noche", purpose: "a las 22:00, de domingo a jueves: ¿dónde trabajas mañana?", test: null, steps: [
    "Atajos → <b>Automatización</b> → <b>+</b> → <b>«Hora del día»</b> <b>22:00</b>, <b>Semanalmente</b>: domingo, lunes, martes, miércoles y jueves, <b>«Ejecutar inmediatamente»</b>.",
    "Acción <b>«Mostrar notificación»</b>: <code>¿Dónde trabajas mañana? Dímelo en MANU y te propongo la alarma.</code>",
    "Suena siempre, también si ya lo dijiste (el iPhone no ve dentro de MANU). Contesta en MANU → Hoy: «Sí, en Oviedo», «En Gijón» o «No trabajo»."] },
  { id: "dictado", name: "MANU Dictado", purpose: "dictarle a Siri sin mirar el móvil (conduciendo, andando…)", test: null, steps: [
    "Nuevo atajo llamado <b>MANU Dictado</b> (así se lo dices a Siri: «Oye Siri, MANU Dictado»).",
    "Acción <b>«Dictar texto»</b> (idioma español).",
    "<b>«Formatear fecha»</b>: Fecha actual, formato <code>yyyy-MM-dd HH:mm</code>.",
    "<b>«Texto»</b>: <code>nota|</code> Fecha formateada <code>|</code> Texto dictado. <b>«Añadir al archivo de texto»</b> igual que en Apple Pay (<code>MANU-buzon.txt</code>, nueva línea).",
    "Opcional: <b>«Mostrar notificación»</b> «Apuntado» para oír que ha ido bien.",
    "Luego, MANU → Tú → Atajos → «Importar del buzón»: los gastos («gasté 15 en gasolina»), tareas («tarea llamar al banco») e ideas se colocan solos; lo demás queda en «Por clasificar»."] },
  { id: "llegada", name: "MANU Llegada", purpose: "al llegar o salir del trabajo, que te recuerde fichar", test: null, steps: [
    "Atajos → <b>Automatización</b> → <b>+</b> → <b>«Llegar»</b>: elige la dirección de tu trabajo. <b>«Ejecutar inmediatamente»</b> si tu iOS lo permite (si no, te pedirá confirmarlo: NO_VERIFICADO).",
    "Acción <b>«Mostrar notificación»</b>: <code>¿Fichas la entrada? Ábreme y pulsa «Entro» (o ⚡ entro).</code>",
    "Otra automatización <b>«Salir»</b> del mismo sitio con <code>¿Has fichado la salida?</code>",
    "Usa tu ubicación solo en el iPhone: MANU no la ve."] },
  { id: "agenda", name: "MANU Agenda", purpose: "traer tus eventos de hoy (si no usas Google)", test: null, steps: [
    "Nuevo atajo llamado <b>MANU Agenda</b>.",
    "<b>«Buscar eventos del calendario»</b> con fecha de inicio hoy.",
    "<b>«Repetir con cada»</b> → <b>«Texto»</b>: hora de inicio (HH:mm), espacio y título.",
    "<b>«Combinar texto»</b> con saltos de línea → <b>«Copiar al portapapeles»</b>.",
    "Abre MANU → Agenda → «Pegar eventos de hoy»."] },
  { id: "siri", name: "Apuntar en MANU", purpose: "decirle a Siri algo para MANU", test: null, steps: [
    "Nuevo atajo llamado <b>Apuntar en MANU</b>.",
    "<b>«Solicitar entrada»</b> (texto).",
    `<b>«URL»</b>: <code>${esc(SITE)}#di=</code> seguido de la variable Entrada proporcionada.`,
    "<b>«Abrir URL»</b>. Aviso: se abre en Safari, que guarda sus datos aparte del icono de MANU (NO_VERIFICADO)."] },
  // WEB-43: «buzón». Shortcuts append lines to iCloud Drive/Atajos/MANU-buzon.txt.
  { id: "applepay", name: "MANU Apple Pay", purpose: "apuntar solo cada pago con Apple Pay", test: null, steps: [
    "Atajos → <b>Automatización</b> → <b>+</b> → <b>«Transacción»</b> (Cartera). Elige tus tarjetas y <b>«Ejecutar inmediatamente»</b>.",
    "Acción <b>«Formatear fecha»</b>: Fecha actual, formato <b>Personalizado</b> <code>yyyy-MM-dd HH:mm</code>.",
    "Acción <b>«Texto»</b>: <code>gasto|</code> Fecha formateada <code>|</code> <b>Importe</b> <code>|</code> <b>Comercio</b> (las dos últimas son variables de la transacción).",
    "Acción <b>«Añadir al archivo de texto»</b>: el Texto, archivo <code>MANU-buzon.txt</code> en la carpeta Atajos de iCloud Drive, con <b>«Nueva línea»</b> activado.",
    "Cuando quieras, MANU → Tú → Atajos → <b>«Importar del buzón»</b>."] },
  { id: "salud", name: "MANU Salud", purpose: "pasos (y sueño o peso) de cada día", test: null, steps: [
    "Atajos → <b>Automatización</b> → <b>+</b> → <b>«Hora del día»</b> 23:30, a diario, <b>«Ejecutar inmediatamente»</b>.",
    "<b>«Buscar muestras de salud»</b>: tipo <b>Pasos</b>, fecha de inicio <b>Hoy</b>.",
    "<b>«Calcular estadísticas»</b>: <b>Suma</b> de las muestras.",
    "<b>«Formatear fecha»</b>: Fecha actual, formato <code>yyyy-MM-dd</code>.",
    "<b>«Texto»</b>: <code>pasos|</code> Fecha formateada <code>|</code> Suma. <b>«Añadir al archivo de texto»</b> igual que en Apple Pay.",
    "Opcional, mismo formato: <code>sueño|fecha|horas</code> (por ejemplo 7,5) y <code>peso|fecha|kilos</code>."] },
  { id: "lugar", name: "MANU Lugar", purpose: "dónde has estado (solo en tu iPhone)", test: null, steps: [
    "Atajos → <b>Automatización</b> → <b>+</b> → <b>«Hora del día»</b> (por ejemplo 14:00 y otra a las 21:00), <b>«Ejecutar inmediatamente»</b>.",
    "<b>«Obtener ubicación actual»</b> → <b>«Obtener detalles de ubicaciones»</b>: <b>Ciudad</b> (o Calle, si quieres más detalle).",
    "<b>«Formatear fecha»</b>: Fecha actual, <code>yyyy-MM-dd HH:mm</code>.",
    "<b>«Texto»</b>: <code>lugar|</code> Fecha formateada <code>|</code> Ciudad. <b>«Añadir al archivo de texto»</b> igual que en Apple Pay."] },
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
    <div class="apps">${apps.map((a) => `<a class="app-link" href="${esc(safeHref(a.url))}" target="_blank" rel="noopener"><span class="ico ${a.color}">${esc(a.label.slice(0, 1))}</span><span class="small">${esc(a.label)}</span></a>`).join("")}</div></section>`;
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

// ---------- Projects that create and fill themselves (WEB-60) ----------
const projAuto = { suggestions: null, busy: false };
function suggestCard() {
  const s = projAuto.suggestions;
  if (s?.length) return `<section class="card"><h2>✨ Tus proyectos en marcha</h2><p class="muted small">Sacados de tus conversaciones y apuntes. Lo que apuntes del tema irá entrando solo.</p>
    ${s.map((x, i) => `<div class="row"><span aria-hidden="true">${esc(x.emoji)}</span><div class="grow"><b>${esc(x.name)}</b><div class="muted small">${esc(x.keywords.join(", "))}</div></div><button class="btn ghost" data-act="proj-sug-add" data-i="${i}">Crear</button></div>`).join("")}
    <div class="btns"><button class="btn" data-act="proj-sug-all">Crear todos</button><button class="link small" data-act="proj-sug-close">Ahora no</button></div></section>`;
  if (!aiReady() || !(archive.stats?.count || vault.inbox.length)) return "";
  return `<section class="card"><h2>✨ Que se creen solos</h2><p class="muted small">MANU mira de qué has hablado últimamente y te propone tus proyectos. Se envían a Gemini solo los títulos de tus conversaciones y tus apuntes (sin nada privado).</p><button class="btn block" data-act="proj-suggest">${projAuto.busy ? "Pensando…" : "Proponer mis proyectos"}</button></section>`;
}

async function suggestProjects() {
  if (projAuto.busy) return;
  projAuto.busy = true; render();
  try {
    const docs = (await archiveDocs()).filter((d) => d.source === "chatgpt").sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
    const payload = buildSuggestPayload({ titles: docs.slice(0, 150).map((d) => d.title), notes: vault.inbox.slice(-60).map((i) => i.text) });
    const { text } = await askWithActions({ key: aiStore.key, model: aiStore.model, payload, confirmed: true });
    const got = parseSuggestions(text, vault.projects ?? []);
    projAuto.suggestions = got ?? [];
    if (got === null) toast("La IA ha contestado algo que no entiendo. Vuelve a probar.");
    else if (!got.length) toast(docs.length ? "No he visto proyectos claros. Crea uno a mano." : "Aún no tengo de dónde sacarlos: importa tu ChatGPT en Tú → Tu archivo o apunta ideas.");
  } catch (err) { toast(err.code === "quota" ? "Hoy ya no queda IA gratuita." : `No he podido: ${err.message}`); }
  projAuto.busy = false; render();
}

// Brings his ChatGPT conversations about the project in as sources (top 5).
async function seedFromArchive(p) {
  const docs = (await archiveDocs()).filter((d) => d.source === "chatgpt");
  if (!docs.length) return 0;
  const hits = new Map();
  for (const k of projectKeys(p)) for (const r of archiveSearch(docs, k, { limit: 12 })) hits.set(r.doc.id, { doc: r.doc, n: (hits.get(r.doc.id)?.n ?? 0) + 1 });
  const have = new Set(p.sources.map((s) => s.from));
  const top = [...hits.values()].filter((h) => !have.has(`archive:${h.doc.id}`)).sort((a, b) => b.n - a.n || (b.doc.at ?? 0) - (a.doc.at ?? 0)).slice(0, 5);
  let added = 0;
  vault.projects = vault.projects.map((x) => {
    if (x.id !== p.id) return x;
    let y = x;
    for (const { doc } of top) {
      try {
        y = addSource(y, { id: uid("src"), kind: "note", title: `ChatGPT: ${doc.title}`, text: doc.messages.map((m) => `${m.role === "me" ? "Manu" : "ChatGPT"}: ${m.text}`).join("\n\n"), at: new Date(doc.at ?? Date.now()).toISOString() });
        Object.assign(y.sources[y.sources.length - 1], { from: `archive:${doc.id}`, auto: true });
        added++;
      } catch { break; }
    }
    return y;
  });
  return added;
}

async function createProject({ name, emoji, keywords = [] }) {
  const p = { ...newProject({ id: uid("p"), name, emoji }), keywords };
  vault.projects = [...(vault.projects ?? []), p];
  const filed = fileNewItems(p.id);
  const seeded = await seedFromArchive(p);
  persist();
  return { p, n: filed.length + seeded };
}

// .zip (ChatGPT, Claude) or .md (NotebookLM): the share sheet if the phone has it.
async function exportProject(p, kind) {
  let file;
  if (kind === "zip") {
    const images = {};
    for (const s of p.sources) if (s.imageId) { try { images[s.imageId] = imageCache.get(s.imageId) ?? await getImage(s.imageId); } catch {} }
    const z = projectZip(p, images);
    file = new File([z.bytes], z.name, { type: "application/zip" });
  } else file = new File([projectMarkdown(p)], projectFileName(p, "md"), { type: "text/markdown" });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: p.name }); return; }
  } catch (err) { if (err?.name === "AbortError") return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------- Projects (WEB-25, like NotebookLM) ----------
const currentProject = () => (vault.projects ?? []).find((x) => x.id === openProject) ?? null;
function updateProject(id, fn) {
  vault.projects = (vault.projects ?? []).map((p) => (p.id === id ? fn(p) : p));
  persist(); render();
}
const SOURCE_ICON = { note: "📝", link: "🔗", image: "🖼️" };
function projectPage(p) {
  const kinds = [["note", "📝 Nota"], ["link", "🔗 Enlace"], ["image", "🖼️ Captura"]];
  const form = {
    note: '<label for="projText" class="sr">Texto</label><textarea id="projText" rows="4" maxlength="20000" placeholder="Pega un texto, apuntes, una receta…" required></textarea><label for="projTitle" class="sr">Título</label><input id="projTitle" maxlength="80" placeholder="Título (opcional)"><button class="btn block" type="submit">Añadir nota</button>',
    link: '<label for="projUrl" class="sr">Enlace</label><input id="projUrl" inputmode="url" placeholder="https://www.tiktok.com/… o YouTube" required><label for="projText" class="sr">Notas</label><textarea id="projText" rows="2" maxlength="4000" placeholder="Qué te interesa de este enlace (opcional)"></textarea><p class="muted small">De TikTok y YouTube se guarda el texto del vídeo (se consulta a ese servicio al añadirlo). De otras webs, solo el enlace y tus notas.</p><button class="btn block" type="submit">Añadir enlace</button>',
    image: '<label class="btn ghost block" for="projImage" role="button" tabindex="0">📎 Elegir captura o foto</label><input id="projImage" type="file" accept="image/*" class="sr"><p class="muted small">Se guarda en tu móvil. Solo se envía a Gemini cuando pulsas «Preguntar».</p>',
  }[projSourceKind];
  const ai = aiReady();
  return `<button class="link" data-act="proj-back">${I.back} Proyectos</button>
    <div class="proj-head"><span class="proj-e big" aria-hidden="true">${esc(p.emoji)}</span><div><h1>${esc(p.name)}</h1><p class="subtitle">${p.sources.length} fuente${p.sources.length === 1 ? "" : "s"}</p></div></div>
    <div class="stack">
    <section class="card"><h2>Pregunta al proyecto</h2>
      ${ai ? `<div class="suggest">${[["resumen", "📄 Resumen"], ["claves", "🔑 Puntos clave"], ["preguntas", "❓ Preguntas de repaso"]].map(([k, l]) => `<button type="button" data-act="proj-preset" data-p="${k}" data-label="${esc(l)}"${p.sources.length ? "" : " disabled"}>${l}</button>`).join("")}</div>
      <form id="projAsk" class="composer-inline"><label for="projQ" class="sr">Pregunta</label><input id="projQ" maxlength="2000" placeholder="¿Qué quieres saber?"${p.sources.length ? "" : " disabled"}><button class="btn" type="submit"${p.sources.length ? "" : " disabled"}>Preguntar</button></form>
      <p class="muted small">Al pulsar «Preguntar» o un botón de arriba se envían a Google (Gemini) las fuentes del proyecto: textos y hasta 4 capturas. Las que parecen privadas (teléfonos, IBAN, salud…) no se envían.</p>` : '<button class="btn ghost block" data-act="gemini-guide">✨ Activa la IA para preguntar a tus fuentes</button>'}
      ${(p.chat ?? []).length ? `<div class="proj-chat">${p.chat.map((m) => `<div class="bubble ${m.from}">${m.from === "manu" && m.ai ? '<span class="ai-tag">IA</span>' : ""}${esc(m.text)}${m.cites?.length ? `<div class="cites">${m.cites.map((n) => { const src = p.sources[n - 1]; return src ? `<button class="chip" data-act="proj-src-view" data-id="${esc(src.id)}" data-n="${n}">[${n}] ${esc(src.title.slice(0, 28))}</button>` : ""; }).join("")}</div>` : ""}${m.excluded?.length ? `<p class="muted small">No envié las fuentes ${m.excluded.map((n) => `[${n}]`).join(", ")} por parecer privadas.</p>` : ""}</div>`).join("")}</div>` : ""}
    </section>
    ${sectionTitle(`Fuentes (${p.sources.length})`)}
    <section class="card">${p.sources.length ? p.sources.map((src, i) => `<div class="row"><span class="src-n">${i + 1}</span><span aria-hidden="true">${SOURCE_ICON[src.kind]}</span>${src.imageId ? `<button class="thumb" data-act="img-view" data-img-id="${esc(src.imageId)}" aria-label="Ver captura"><img data-img="${esc(src.imageId)}" alt=""></button>` : ""}<div class="grow"><div>${esc(src.title)}${src.auto ? ' <span class="chip small">auto</span>' : ""}</div>${src.text && src.kind !== "note" ? `<div class="muted small">${esc(src.text.slice(0, 90))}${src.text.length > 90 ? "…" : ""}</div>` : src.kind === "note" ? `<div class="muted small">${src.text.length} caracteres</div>` : ""}</div>${src.url ? `<a class="link small" href="${esc(safeHref(src.url))}" target="_blank" rel="noopener">Abrir</a>` : ""}<button class="link small icon-btn" data-act="proj-del-source" data-id="${esc(src.id)}" aria-label="Quitar fuente">✕</button></div>`).join("") : '<p class="muted">Añade notas, capturas o vídeos. Luego pregunta y MANU te contesta solo con eso.</p>'}</section>
    <section class="card"><h2>Añadir fuente</h2>
      <div class="segmented three" role="group" aria-label="Tipo de fuente">${kinds.map(([k, l]) => `<button type="button" data-act="proj-kind" data-kind="${k}" aria-pressed="${k === projSourceKind}">${l}</button>`).join("")}</div>
      <form id="projSource" class="stack">${form}</form>
    </section>
    <section class="card"><h2>Se llena solo</h2><p class="muted small">Lo que apuntes, las ideas y las capturas que guardes con estas palabras entran aquí sin que hagas nada.</p>
      <form id="projKeys" class="composer-inline"><label for="projKeysIn" class="sr">Palabras clave</label><input id="projKeysIn" maxlength="400" value="${esc((p.keywords ?? []).join(", "))}" placeholder="prao, cimadevilla, fiesta"><button class="btn" type="submit">Guardar</button></form>
      <button class="btn ghost block" data-act="proj-seed">${projAuto.busy === p.id ? "Buscando…" : "🔎 Traer mis conversaciones de ChatGPT sobre esto"}</button></section>
    <section class="card"><h2>Llévatelo a otra IA</h2><p class="muted small">Todo el proyecto (notas, enlaces, capturas y lo que habéis hablado) en un archivo para ChatGPT, Claude o NotebookLM.</p>
      <div class="btns"><button class="btn" data-act="proj-export" data-kind="zip">📦 .zip para ChatGPT o Claude</button><button class="btn ghost" data-act="proj-export" data-kind="md">📄 Texto para NotebookLM</button></div></section>
    <button class="link small danger-link" data-act="proj-delete">Borrar este proyecto</button>
    </div>`;
}

async function addProjectSource() {
  const p = currentProject(); if (!p) return;
  const at = new Date().toISOString();
  try {
    if (projSourceKind === "note") {
      updateProject(p.id, (x) => addSource(x, { id: uid("src"), kind: "note", title: $("projTitle").value, text: $("projText").value, at }));
      toast("Nota añadida");
    } else if (projSourceKind === "link") {
      const link = detectLink($("projUrl").value);
      if (!link) { toast("Pega un enlace que empiece por https://"); return; }
      const notes = $("projText").value.trim();
      let info = null;
      if (link.provider === "tiktok" || link.provider === "youtube") { toast(`Leyendo el vídeo de ${PROVIDER_NAME[link.provider]}…`); try { info = await linkInfo(link); } catch { info = null; } }
      const text = [info?.title, notes].filter(Boolean).join("\n\n");
      updateProject(p.id, (x) => addSource(x, { id: uid("src"), kind: "link", url: link.url, title: info ? `${PROVIDER_NAME[link.provider]}${info.author ? ` · ${info.author}` : ""}` : link.url.replace(/^https?:\/\//, "").slice(0, 60), text, at }));
      toast(info ? "Enlace añadido con el texto del vídeo" : link.provider === "instagram" ? "Instagram no deja leer el reel: añade una captura" : "Enlace añadido");
    }
  } catch (err) { toast(err.message); }
}

async function addProjectImage(file) {
  const p = currentProject(); if (!p) return;
  try {
    const dataUrl = await compressImage(file);
    const imageId = uid("img");
    await putImage(imageId, dataUrl); imageCache.set(imageId, dataUrl);
    updateProject(p.id, (x) => addSource(x, { id: uid("src"), kind: "image", imageId, title: `Captura ${new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" })}` }));
    toast("Captura añadida");
  } catch (err) { toast(err.message); }
}

// Ask the notebook. Only on Manu's tap on «Preguntar a Gemini» or a preset.
async function askProject(question, label = null) {
  const p = currentProject(); if (!p || !aiReady() || !p.sources.length) return;
  const images = {};
  for (const src of p.sources.filter((x) => x.kind === "image")) { try { images[src.imageId] = imageCache.get(src.imageId) ?? await getImage(src.imageId); } catch {} }
  let built;
  try { built = buildProjectPayload({ project: p, question, images }); }
  catch (err) { toast(err.code === "sensitive" ? "Esa pregunta parece privada: no la envío." : err.message); return; }
  const me = { from: "me", text: label ?? question, at: new Date().toISOString() };
  const answer = { from: "manu", text: "Pensando…", at: new Date(Date.now() + 1).toISOString(), ai: true, excluded: built.excluded };
  updateProject(p.id, (x) => ({ ...x, chat: [...(x.chat ?? []), me, answer].slice(-40) }));
  let text;
  try {
    const r = await askWithActions({ key: aiStore.key, model: aiStore.model, payload: built.payload, confirmed: true });
    text = r.text ?? "No he encontrado respuesta en las fuentes.";
  } catch (err) {
    text = err.code === "quota" ? "Hoy ya no queda IA gratuita." : err.code === "key" ? "La clave de Gemini no funciona. Revísala en Tú → IA." : err.code === "sensitive" ? "Algo parece privado: no lo envío." : `No he podido preguntar: ${err.message}`;
  }
  updateProject(p.id, (x) => ({ ...x, chat: (x.chat ?? []).map((m) => (m.at === answer.at ? { ...m, text, cites: citations(text, x.sources.length) } : m)) }));
}

// ---------- Money statistics (WEB-21) ----------
const INCOME_KIND = { PAYROLL: "💼 Nómina", BIZUM: "📲 Bizum recibidos", TRANSFER: "🏦 Transferencias", REFUND: "↩️ Devoluciones", OTHER: "➕ Otros ingresos" };
const pctText = (p) => (p === null ? "" : `${p > 0 ? "▲" : p < 0 ? "▼" : "="} ${Math.abs(p)} %`);
function moneyStatsSection(ref, monthName) {
  const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
  const income = vault.income ?? [];
  const st = monthStats(vault.spending, income, key, today());
  const series = monthlySeries(vault.spending, income, 6, today());
  const top = Math.max(1, ...series.map((m) => Math.max(m.spent, m.earned)));
  const pick = series.find((m) => m.key === seriesPick) ?? null;
  const bal = vault.settings.balance;
  const month = monthName.replace(/ de \d{4}$/, "");
  const tile = (label, value, sub = "", dot = "") => `<div class="stat-tile"><div class="muted small">${dot ? `<i class="dot ${dot}" aria-hidden="true"></i>` : ""}${label}</div><div class="stat-v num">${value}</div>${sub ? `<div class="muted small">${sub}</div>` : ""}</div>`;
  const noIncome = !income.length;
  return `${sectionTitle("Estadísticas")}
    <section class="card">
      <div class="stat-grid">
        ${tile("Ingresado", euros(st.earned), st.earnedDelta !== null ? `${pctText(st.earnedDelta)} vs mes anterior` : "", "inc")}
        ${tile("Gastado", euros(st.spent), st.spentDelta !== null ? `${pctText(st.spentDelta)} vs mes anterior` : "", "exp")}
        ${tile(st.saved >= 0 ? "Ahorrado" : "Has gastado de más", euros(Math.abs(st.saved)), st.savingRate !== null ? `${st.savingRate} % de lo ingresado` : "")}
        ${tile("Nómina", st.payroll.cents ? euros(st.payroll.cents) : "—", st.payroll.days.length ? `Día ${st.payroll.days.join(" y ")}` : noIncome ? "Importa el extracto" : "Aún no ha llegado")}
      </div>
      ${bal ? `<div class="row"><span class="muted small">Saldo en cuenta el ${new Date(bal.at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span><b class="num">${euros(bal.cents)}</b></div>` : ""}
      ${noIncome ? '<p class="small">Para ver ingresos, nómina y ahorro, importa el <b>extracto del banco</b> (el .xls de Sabadell) en «Importar del banco». El Excel de ChatGPT solo trae gastos.</p>' : ""}
    </section>
    <section class="card"><h2>Ingresos vs gastos · 6 meses</h2>
      <div class="legend small"><span><i class="dot inc" aria-hidden="true"></i>Ingresado</span><span><i class="dot exp" aria-hidden="true"></i>Gastado</span></div>
      <div class="ie-chart" role="img" aria-label="Ingresos y gastos de los últimos 6 meses">${series.map((m) => `<button class="ie-col${m.key === seriesPick ? " sel" : ""}" data-act="series-pick" data-k="${m.key}" aria-label="${esc(m.label)}: ingresado ${euros(m.earned)}, gastado ${euros(m.spent)}"><span class="ie-bars"><i class="inc" data-h="${Math.round((m.earned / top) * 100)}"></i><i class="exp" data-h="${Math.round((m.spent / top) * 100)}"></i></span><span class="muted small">${esc(m.label)}</span></button>`).join("")}</div>
      <p class="muted small">${pick ? `${esc(cap(new Date(`${pick.key}-15T12:00:00`).toLocaleDateString("es-ES", { month: "long" })))}: ingresado <b>${euros(pick.earned)}</b> · gastado <b>${euros(pick.spent)}</b> · ${pick.earned - pick.spent >= 0 ? "ahorro" : "déficit"} ${euros(Math.abs(pick.earned - pick.spent))}` : "Toca un mes para ver sus cifras."}</p>
      <details><summary class="muted small">Ver tabla</summary><table class="stat-table"><thead><tr><th>Mes</th><th>Ingresado</th><th>Gastado</th><th>Ahorro</th></tr></thead><tbody>${series.map((m) => `<tr><td>${esc(m.label)}</td><td class="num">${euros(m.earned)}</td><td class="num">${euros(m.spent)}</td><td class="num">${euros(m.earned - m.spent)}</td></tr>`).join("")}</tbody></table></details>
    </section>
    <section class="card"><h2>Ritmo de ${esc(month)}</h2>
      <div class="row"><span>Media diaria</span><b class="num">${euros(st.avgDaily)}</b></div>
      ${st.projection !== null ? `<div class="row"><span>Si sigues así, a fin de mes</span><b class="num">${euros(st.projection)}</b></div>` : ""}
      <div class="row"><span>Movimientos</span><b class="num">${st.count}</b></div>
      ${st.biggest ? `<div class="row"><span class="grow">Mayor gasto<br><span class="muted small">${esc(st.biggest.merchant ?? "Sin concepto")} · ${new Date(st.biggest.at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span></span><b class="num">${euros(st.biggest.cents)}</b></div>` : ""}
    </section>
    ${st.topMerchants.length ? `<section class="card"><h2>Dónde más gastas en ${esc(month)}</h2>${st.topMerchants.map((m, i) => `<div class="row"><span class="rank" aria-hidden="true">${i + 1}</span><span class="grow">${esc(m.name)}<br><span class="muted small">${m.count} ${m.count === 1 ? "vez" : "veces"}</span></span><b class="num">${euros(m.cents)}</b></div>`).join("")}</section>` : ""}
    ${st.income.length ? `<section class="card"><h2>Ingresos de ${esc(month)}</h2>${st.incomeByKind.map(([k, c]) => `<div class="row"><span>${INCOME_KIND[k]}</span><b class="num">${euros(c)}</b></div>`).join("")}
      <details><summary class="muted small">Ver los ${st.income.length} ingresos</summary>${st.income.map((i) => `<div class="row"><div class="grow"><div>${esc(i.concept ?? "Ingreso")}</div><div class="muted small">${new Date(i.at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}${i.payroll ? " · nómina" : ""}</div></div><span class="num">+${euros(i.cents)}</span></div>`).join("")}</details></section>` : ""}`;
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
  // WEB-38: birthdays saved in Personas (unless already an event in Google Calendar).
  const bdays = (vault.people ?? []).filter((p) => p.birthday && p.birthday === String(day).slice(5) && !p.calendarEventId).map((p) => ({ time: null, end: null, title: `🎂 Cumpleaños de ${p.name}` }));
  const fromGoogle = vault.calendar?.days?.[day];
  if (fromGoogle) return bdays.length ? [...bdays, ...fromGoogle] : fromGoogle;
  if (vault.agenda?.day === day) return [...bdays, ...vault.agenda.events];
  if (vault.agendaTomorrow?.day === day) return [...bdays, ...vault.agendaTomorrow.events];
  return bdays;
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
  // WEB-79: Gijón is the usual answer, so it goes first (unless the calendar says Oviedo).
  const oviedo = guess?.city === "OVIEDO";
  const bGijon = `<button class="btn${oviedo ? " ghost" : ""}" data-act="tomorrow" data-city="GIJON">Sí, en Gijón</button>`;
  const bOviedo = `<button class="btn${oviedo ? "" : " ghost"}" data-act="tomorrow" data-city="OVIEDO">En Oviedo</button>`;
  return `<section class="card"><h2>${I.alarm} Antes de dormir</h2><p><b>${oviedo ? "¿Mañana trabajas en Oviedo?" : "¿Mañana en Gijón?"}</b></p>${guess ? `<p class="muted small">Tu calendario: ${esc(guess.reason)}.</p>` : ""}
    <div class="btns">${oviedo ? bOviedo + bGijon : bGijon + bOviedo}<button class="btn ghost" data-act="tomorrow" data-city="NONE">No trabajo</button></div></section>`;
}

// ---------- Shared bits ----------
// Attachments of an item: its screenshot (tap to see it big) and its link.
const attach = (x) => `${x.imageId ? `<button class="thumb" data-act="img-view" data-img-id="${esc(x.imageId)}" aria-label="Ver captura"><img data-img="${esc(x.imageId)}" alt=""></button>` : ""}${x.url ? `<a class="link small" href="${esc(safeHref(x.url))}" target="_blank" rel="noopener">Abrir</a>` : ""}`;
const taskRow = (t) => `<div class="row"><button class="check" data-act="toggle" data-id="${esc(t.id)}" aria-pressed="${Boolean(t.done)}" aria-label="${t.done ? "Reabrir" : "Completar"}: ${esc(t.text)}">${I.check}</button><span class="grow ${t.done ? "done-text" : ""}">${esc(t.text)}</span>${attach(t)}</div>`;
const reminderAt = (r) => { const d = new Date(r.at); return `${d.toDateString() === today().toDateString() ? "Hoy" : d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })} ${hhmm(d)}`; };
const reminderIphoneUrl = (r) => { const d = new Date(r.at); return shortcutUrl(SHORTCUT_REMINDER, `${r.text} | ${dayKey(d)} ${hhmm(d)}`); };
const reminderRow = (r) => `<div class="row"><button class="check" data-act="rem-done" data-id="${esc(r.id)}" aria-pressed="${Boolean(r.done)}" aria-label="Hecho: ${esc(r.text)}">${I.check}</button><div class="grow"><div class="${r.done ? "done-text" : ""}">${esc(r.text)}</div><div class="muted small">${esc(reminderAt(r))}</div></div>${attach(r)}<a class="link small" href="${esc(reminderIphoneUrl(r))}">Al iPhone</a></div>`;
// WEB-49: long lists draw the first LIST_STEP items; «Ver todas» shows the rest.
const LIST_STEP = 25;
const showAll = { rems: false, tasks: false, ideas: false };
const moreButton = (key, n) => (n > LIST_STEP && !showAll[key] ? `<button class="link small" data-act="show-all" data-k="${key}">Ver todas (${n})</button>` : "");
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
      ${morningLaunch ? `<section class="card morning-hello"><h2>☀️ ${esc(greeting())}, Manu</h2><p class="muted small">Toca y te leo el día en voz alta.</p><div class="btns"><button class="btn" data-act="speak-day">🔊 Léemelo</button><button class="link small" data-act="morning-dismiss">Ahora no</button></div></section>` : ""}
      ${gentleCard()}
      <button class="cmdk-pill glass" data-act="cmdk" aria-label="Comando rápido">⚡ <span>Haz algo rápido…</span></button>
      ${nowCard()}
      ${clockCard()}
      ${toAsk(vault.spending, today()).length || splitDraft ? splitAskCard() : ""}
      ${closingCard()}
      ${briefingCard()}
      ${nightCard()}
      ${weatherCard()}
      ${backupNudge()}
      ${mailCards()}
      ${googleOn("gmail") && vault.mail?.important?.length ? `<section class="card"><h2>${I.mail} ${vault.mail.important.length} correo${vault.mail.important.length === 1 ? "" : "s"} importante${vault.mail.important.length === 1 ? "" : "s"}</h2>${vault.mail.important.slice(0, 3).map((x) => `<a class="row" href="${esc(messageUrl(x.id))}" target="_blank" rel="noopener"><div class="grow"><div>${esc(x.name)}</div><div class="muted small">${esc(x.subject || "(sin asunto)")}</div></div></a>`).join("")}<button class="link small" data-sub-go="correo">Ver todo el correo</button></section>` : ""}
      ${next || agendaToday() ? `<section class="card"><h2>Próximo</h2>${next ? `<div class="row"><span class="chip num">${esc(next.time)}</span><span class="grow">${esc(next.title)}</span></div>` : '<p class="muted">No te queda nada más hoy.</p>'}</section>` : ""}
      ${rems.length ? `<section class="card"><h2>${I.bell} Recordatorios de hoy</h2>${rems.map(reminderRow).join("")}</section>` : ""}
      ${inbox.length ? `<section class="card"><h2>Bandeja · ${inbox.length}</h2>${inbox.map((c) => `<div class="stack"><div>${esc(c.text)}</div><div class="btns">
          <button class="btn" data-act="task" data-id="${esc(c.id)}">Tarea</button><button class="btn ghost" data-act="idea" data-id="${esc(c.id)}">Idea</button><button class="btn ghost" data-act="forget" data-id="${esc(c.id)}">No recuerdo</button></div></div>`).join("")}</section>` : ""}
      ${hubCard(m.mode)}
      <section class="card"><div class="row"><h2>Tareas</h2>${addLink("TASK")}</div>${open.length ? open.slice(0, 5).map(taskRow).join("") + (open.length > 5 ? `<p class="muted small">Y ${open.length - 5} más en Agenda.</p>` : "") : '<p class="muted">Nada pendiente. Toca «Añadir» o díselo a MANU.</p>'}</section>
      ${bdays.length ? `<section class="card"><h2>${I.people} Cumpleaños</h2>${bdays.map((b) => { const wa = b.days === 0 ? whatsappUrl(b.person.phone, `¡Feliz cumpleaños, ${b.person.name.split(" ")[0]}! 🎉`) : null; return `<div class="row"><span class="grow">${esc(b.person.name)}</span>${wa ? `<a class="btn" href="${esc(safeHref(wa))}" target="_blank" rel="noopener">Felicitar por WhatsApp</a>` : `<span class="muted">${b.days === 0 ? "¡Hoy!" : b.days === 1 ? "Mañana" : (b.days === 1 ? "Mañana" : `En ${b.days} días`)}</span>`}</div>`; }).join("")}</section>` : ""}
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
      ${g ? `<div class="btns"><button class="btn ghost" data-act="gcal-sync">${gcal.busy ? "Actualizando…" : "Actualizar"}</button></div><p class="muted small">${synced ? `Última sincronización: ${synced}` : "Aún sin sincronizar."}${gcal.error ? ` · ${esc(gcal.error)}` : ""}${validToken(SCOPE.calendar) ? " · se actualiza sola mientras Google siga conectado" : " · toca «Actualizar» para traer cambios"}</p>` : `<p class="muted small"><button class="link small" data-act="goto-gcal">Conectar Google (Calendar, Tasks, Contactos y Drive)</button></p>`}
      ${upcomingCard()}
      ${calendarCard(gCal)}
      <details class="card"><summary class="muted small">Sin Google: pegar los eventos de hoy</summary><p class="muted small">Si tu calendario no es de Google, pega aquí tus eventos (o usa el atajo «MANU Agenda»).</p>${agendaToday() && vault.agenda.source !== "GOOGLE"
        ? (vault.agenda.events.length ? vault.agenda.events.map((ev) => `<div class="row"><span class="num chip">${esc(ev.time ? ev.time + (ev.end ? "–" + ev.end : "") : "Todo el día")}</span><span class="grow">${esc(ev.title)}</span></div>`).join("") : "") : ""}
      <form id="pasteEvents" class="stack"><label for="eventsText" class="muted small">Uno por línea: «09:30 Dentista», «10:00-11:00 Reunión», «todo el día Cumpleaños».</label><textarea id="eventsText" rows="3" placeholder="09:30 Dentista"></textarea><button class="btn ghost" type="submit">Guardar agenda de hoy</button></form></details>
      ${sectionTitle("Recordatorios", addLink("REMINDER"))}
      <section class="card">${rems.length ? (showAll.rems ? rems : rems.slice(0, LIST_STEP)).map(reminderRow).join("") + moreButton("rems", rems.length) : '<p class="muted">Sin recordatorios. Dile a MANU «recuérdame … a las 18».</p>'}</section>
      ${sectionTitle("Tareas", addLink("TASK"))}
      <section class="card">${open.length ? (showAll.tasks ? open : open.slice(0, LIST_STEP)).map(taskRow).join("") + moreButton("tasks", open.length) : '<p class="muted">Sin tareas pendientes.</p>'}${done.length ? `<details><summary>Hechas (${done.length})</summary>${done.map(taskRow).join("")}</details>` : ""}</section>
      ${sectionTitle("Ideas", addLink("IDEA"))}
      <section class="card">${idea.length ? (showAll.ideas ? idea : idea.slice(0, LIST_STEP)).map((i) => `<div class="row"><span class="grow">${esc(i.text)}</span>${attach(i)}<button class="link small" data-act="idea-to-task" data-id="${esc(i.id)}">Hacer tarea</button></div>`).join("") + moreButton("ideas", idea.length) : '<p class="muted">Tus ideas quedan aquí, sin convertirse en proyectos sin tu permiso.</p>'}</section>`;
  },
  manu() {
    const chips = refuge ? ["quiero entender por qué", "buscar una solución", "necesito desconectar"] : null;
    // Short cards: «fill» starts the sentence for Manu; «say» sends it directly.
    const cards = [["💸", "Apuntar gasto", "fill", "gasté "], ["⏰", "Crear alarma", "fill", "pon una alarma a las "], ["🔔", "Recordatorio", "fill", "recuérdame "], ["💡", "Guardar idea", "fill", "apunta idea: "], ["🗓️", "¿Qué tengo hoy?", "say", "qué tengo hoy"], ["🌿", "Refugio", "say", "refugio"]];
    const thinking = vault.chat.at(-1)?.text === "Pensando…";
    const empty = !vault.chat.length && !refuge;
    const history = vault.chat.length ? vault.chat : [{ from: "manu", text: "Hola, Manu. Puedo apuntar gastos, ideas y tareas, crear recordatorios y alarmas, y acompañarte en el Refugio. Aún funciono sin IA: habla claro y corto." }];
    return `<div class="manu-head${empty ? " big" : ""}"><div class="orb${thinking ? " thinking" : ""}" id="orb" aria-hidden="true"><span>M</span></div><div><h1>MANU</h1><p class="subtitle">${aiReady() && aiMode().on ? "Gemini integrado · conversación" : `Tu asistente · ${aiReady() ? "IA disponible, siempre con tu confirmación" : '<button class="link small" data-act="gemini-guide">activar IA</button>'}`}</p></div></div>
      ${refuge ? `<div class="refuge-bar"><span>Refugio · no se guarda</span><button class="link" data-act="leave-refuge">Salir</button></div>` : ""}
      ${aiReady() && !aiMode().on && !refuge ? `<section class="card ai-offer"><b>💬 ¿Hablamos como con Gemini?</b><p class="muted small">MANU conversa contigo, sabe lo que elijas de tu vida y gestiona tus cosas. Lo que escribas irá a Google.</p><div class="btns"><button class="btn" data-act="ai-mode" data-v="full">Activar con todo</button><button class="btn ghost" data-act="ai-mode" data-v="basic">Solo lo básico</button></div><button class="link small" data-sub-go="ia">Elegir qué sabe</button></section>` : ""}
      ${refuge ? "" : mailCards()}
      ${chips ? `<div class="suggest" aria-label="Sugerencias">${chips.map((s) => `<button data-say="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : `<div class="quick-cards" aria-label="Sugerencias">${cards.map(([e, label, how, text]) => `<button class="qcard" ${how === "say" ? `data-say="${esc(text)}"` : `data-fill="${esc(text)}"`}><span class="qe" aria-hidden="true">${e}</span><span>${esc(label)}</span></button>`).join("")}</div>`}
      ${vault.chat.length && !refuge ? `<div class="chat-tools"><button class="link small" data-act="chat-new">＋ Nueva conversación</button></div>` : ""}
      <div class="chat" id="chat" aria-live="polite">${(refuge ? refuge.messages : history).map((b) => `<div class="bubble ${b.from}${b.safety ? " safety" : ""}">${b.ai ? '<span class="ai-tag">IA</span>' : ""}${b.imageId ? `<img class="chat-img" data-img="${esc(b.imageId)}" alt="Captura">` : ""}${esc(b.text)}${b.url ? ` <a class="link small" href="${esc(safeHref(b.url))}" target="_blank" rel="noopener">Abrir</a>` : ""}${b.proposal ? `${b.proposal.state ? "" : `<p class="small proposal-what">Se enviará a Google solo tu frase: <b>«${esc(b.proposal.message)}»</b>, con las instrucciones fijas de MANU. Nada de tus datos.</p>`}<details><summary class="muted small">${b.proposal.state ? "Ver lo enviado" : "Ver detalles técnicos"}</summary><pre class="payload">${esc(shownPayload(b.proposal))}</pre></details>${b.proposal.state ? `<p class="muted small">${b.proposal.state === "sent" ? (b.proposal.auto ? "Enviado a Gemini sin preguntar (lo activaste en Tú → IA)." : "Enviado a Gemini.") : "No enviado."}</p>` : `<div class="btns"><button class="btn" data-act="ai-send" data-id="${esc(b.proposal.id)}">Enviar a Gemini</button><button class="btn ghost" data-act="ai-cancel" data-id="${esc(b.proposal.id)}">No</button></div><div class="btns"><button class="link small" data-act="ask-elsewhere" data-app="chatgpt" data-id="${esc(b.proposal.id)}">Preguntar en ChatGPT</button><button class="link small" data-act="ask-elsewhere" data-app="claude" data-id="${esc(b.proposal.id)}">Preguntar en Claude</button></div>`}` : ""}${b.action ? `<div class="btns"><a class="btn" href="${esc(safeHref(b.action.href))}">${esc(b.action.label)}</a></div>` : ""}${(b.calls ?? []).map((c, i) => callCard(b, c, i)).join("")}${b.mailUndo ? `<div class="btns"><button class="link small" data-act="mail-undo" data-at="${esc(b.at)}">Deshacer</button></div>` : ""}</div>`).join("")}</div>
      ${chatImage ? `<div class="chat-attach glass"><img src="${esc(chatImage)}" alt="Captura adjunta"><div class="grow small">${aiReady() ? "La captura se enviará a Google (Gemini) al pulsar «Enviar a Gemini». No uses capturas del banco o de salud si no quieres compartirlas." : '<button type="button" class="link small" data-act="gemini-guide">Activa la IA para que MANU lea la captura</button>'}</div><button type="button" class="qa-close" data-act="chat-image-remove" aria-label="Quitar captura">✕</button></div>` : ""}
      <form class="composer glass" id="composer">${refuge ? "" : '<label class="composer-attach" for="chatImage" role="button" tabindex="0" aria-label="Adjuntar captura">📎</label><input id="chatImage" type="file" accept="image/*" class="sr">'}<label for="msg" class="sr">Mensaje para MANU</label><input id="msg" autocomplete="off" enterkeyhint="send" placeholder="${refuge ? "Cuéntame" : chatImage ? "¿Qué quieres saber de la captura?" : "Escribe a MANU"}"><button class="btn" type="submit">${chatImage && aiReady() ? "Enviar a Gemini" : "Enviar"}</button></form>`;
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
        ${cats.map(([c, v]) => { const lim = moneyMonth === 0 ? vault.settings.budgets?.[c] : null; return `<div class="stack"><div class="row"><span>${esc(catLabel(c))}</span><span class="num">${euros(v)}${lim ? `<span class="muted small"> / ${euros(lim)}</span>` : ""}</span></div><div class="bar${lim && v > lim ? " over" : lim && v >= lim * 0.8 ? " warn" : ""}"><i data-w="${Math.max(3, Math.round((v / (lim ? Math.max(lim, v) : max)) * 100))}"></i></div></div>`; }).join("")}</section>
      ${moneyMonth === 0 ? `${splitAskCard()}${addMoneyCard()}${debtsCard()}` : ""}
      ${moneyMonth === 0 ? budgetCard() : ""}
      ${moneyStatsSection(ref, monthName)}
      <section class="card"><h2>${I.box} Importar del banco</h2>
        <p class="muted small">Excel o CSV de tu banco. Se lee en el móvil, sin enviarlo a nadie, y no duplica lo que ya tengas.</p>
        <label class="btn ghost" for="bankFile" role="button" tabindex="0">Elegir archivo (Excel o CSV)</label><input id="bankFile" type="file" accept=".xls,.xlsx,.csv,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="sr">
        <label class="btn ghost" for="rulesFile" role="button" tabindex="0">Importar reglas (Excel de ChatGPT)</label><input id="rulesFile" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="sr">
        ${rulesCount ? `<p class="muted small">${rulesCount} reglas de categorías guardadas en este móvil.</p>` : ""}
        ${ri ? `<p class="muted small">Excel de ChatGPT: ${ri.rules} reglas, ${ri.added} gastos nuevos${ri.duplicates ? `, ${ri.duplicates} ya estaban` : ""}${ri.review ? `, ${ri.review} por revisar` : ""}${ri.reclassified ? `, ${ri.reclassified} reclasificados` : ""}.</p>` : ""}
        ${rulesCount && !vault.spending.length ? '<p class="small"><b>Las reglas solas no son gastos.</b> Importa el extracto del banco o vuelve a elegir el Excel de ChatGPT, que trae la hoja «Gastos clasificados», y verás aquí tus números.</p>' : ""}
        ${imp ? `<p class="muted small">Última importación: ${imp.added} gastos nuevos, ${imp.duplicates} repetidos${imp.incomeAdded !== undefined ? `, ${imp.incomeAdded} ingresos nuevos${imp.incomeDuplicates ? ` (${imp.incomeDuplicates} ya estaban)` : ""}` : imp.income ? ` · ${imp.income} ingresos sin importar: vuelve a elegir el archivo para añadirlos` : ""}${imp.invalid ? `, ${imp.invalid} filas no reconocidas` : ""}.</p>` : ""}</section>
      ${moneyInsights()}
      ${sectionTitle("Movimientos", `${toReview ? `<button class="link small" data-act="money-filter">${moneyFilter === "review" ? "Ver todos" : `Por revisar (${toReview})`}</button>` : ""}${addLink("EXPENSE")}`)}
      <section class="card">${entries.length ? entries.map((x) => `<div class="row"><span class="cat-emoji" aria-hidden="true">${CATEGORY_EMOJI[x.category] ?? "📦"}</span><div class="grow"><div>${esc(x.merchant ?? "Sin concepto")}</div><div class="muted small">${new Date(x.at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}${x.sub ? ` · ${esc(x.sub)}` : ""}${x.source === "BANK" ? " · banco" : ""}${x.review ? ' · <b class="review">revisar</b>' : x.inferred ? " · categoría propuesta" : x.ruled ? " · según tus reglas" : ""}</div></div>
          <div class="stack"><span class="num">${euros(x.cents)}</span>${catEditing === x.id ? `<label class="sr" for="cat-${esc(x.id)}">Categoría</label><select id="cat-${esc(x.id)}" data-cat="${esc(x.id)}">${Object.keys(CATEGORIES).map((k) => `<option value="${k}"${k === x.category ? " selected" : ""}>${esc(catLabel(k))}</option>`).join("")}</select>` : `<button class="cat-chip" data-act="cat-edit" data-id="${esc(x.id)}" aria-label="Cambiar categoría: ${esc(CATEGORIES[x.category] ?? "Otros")}">${esc(catLabel(x.category))}</button>`}</div></div>`).join("")
        : '<p class="muted">Sin gastos. Escribe a MANU «gasté 12,50 en café» o importa el extracto del banco.</p>'}</section>
      </div>`;
  },
  proyectos() {
    const list = vault.projects ?? [];
    const p = openProject ? list.find((x) => x.id === openProject) : null;
    if (p) return projectPage(p);
    return `<h1>Proyectos</h1><p class="subtitle">Cuadernos con tus fuentes: MANU responde solo con lo que metas en cada uno.</p>
      <div class="stack">
      ${list.length ? `<div class="proj-grid">${list.map((x) => `<button class="proj-card" data-act="proj-open" data-id="${esc(x.id)}"><span class="proj-e" aria-hidden="true">${esc(x.emoji)}</span><b>${esc(x.name)}</b><span class="muted small">${x.sources.length} fuente${x.sources.length === 1 ? "" : "s"}</span></button>`).join("")}</div>` : '<section class="card"><p class="muted">Aún no tienes proyectos. Crea uno para un viaje, un estudio, una reforma, recetas… y mete notas, capturas y vídeos.</p></section>'}
      ${suggestCard()}
      <section class="card"><h2>Nuevo proyecto</h2><form id="projForm" class="proj-new"><label for="projEmoji" class="sr">Emoji</label><input id="projEmoji" maxlength="4" value="📁" aria-label="Emoji"><label for="projName" class="sr">Nombre</label><input id="projName" maxlength="60" placeholder="Viaje a Lisboa" required><button class="btn" type="submit">Crear</button></form></section>
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
      ${findCard()}
      ${setupCard()}
      ${sectionTitle("¿Cómo estás hoy?")}
      <section class="card"><div class="mood">${MOODS.map((m) => `<button data-act="mood" data-v="${m.value}" aria-pressed="${mood === m.value}" aria-label="${m.label}"><b class="mood-e" aria-hidden="true">${m.emoji}</b>${m.label}</button>`).join("")}</div>
        <div class="row"><span class="muted small">Últimos 7 días</span><span class="dots">${week.map((v) => `<i data-v="${v}" title="${v ? MOODS[v - 1].label : "Sin dato"}"></i>`).join("")}</span></div>
        ${mood === 1 ? '<button class="btn ghost" data-act="refuge">Abrir el Refugio</button>' : ""}</section>
      ${sectionTitle("Tu vida")}
      <div class="list">
        ${item("capturas", "shots", "blue", "Bandeja de capturas", toReview(vault.captures).length ? `${toReview(vault.captures).length} por revisar` : "Suelta aquí tus capturas y MANU las ordena")}
        ${item("fichaje", "clock", "blue", "Fichaje", (() => { const r = monthReport(vault.clock, localDay().slice(0, 7), { targetMin: clockTarget(), now: today() }); return r.days || r.openDays ? r.balance : "Entradas, pausas y lo que te debe RK"; })())}
        ${item("habitos", "repeat", "green", "Hábitos", vault.habits.length ? `${habitsDone} de ${vault.habits.length} hechos hoy` : "Crea tu primer hábito")}
        ${item("salud", "pulse", "red", "Salud", hs.sleep !== null || hs.steps !== null ? [hs.sleep !== null ? `${dec(hs.sleep)} h de sueño` : null, hs.steps !== null ? `${Math.round(hs.steps)} pasos` : null].filter(Boolean).join(" · ") + " (media semanal)" : "Sueño, pasos y peso")}
        ${item("comidas", "fork", "orange", "Comidas", `${vault.meals.filter((m) => m.day === t).length} apuntadas hoy`)}
        ${item("archivo", "box", "teal", "Tu archivo", archive.stats?.count ? `${archive.stats.count} conversaciones guardadas` : "Tus conversaciones y tu exportación de ChatGPT")}
        ${item("personas", "people", "purple", "Personas", vault.people.length ? `${vault.people.length} personas` : "Cumpleaños y detalles")}
        <button class="item" data-act="refuge"><span class="ico teal">${I.leaf}</span><span class="grow"><span>Refugio</span><br><span class="muted small">Para cuando no estás bien</span></span><span class="chev">${I.chev}</span></button>
      </div>
      ${sectionTitle("Ajustes")}
      <div class="list">
        ${item("tiempo", "pin", "blue", "Tiempo y ciudades", `Casa: ${(vault.settings.homeCity ?? CITIES.GIJON).name}`)}
        ${item("gcal", "google", "blue", "Google", isClientId(gClientId()) ? "Calendar, Tasks, Contactos, Drive y Gmail" : "Conectar tus servicios de Google")}
        ${item("correo", "mail", "red", "Correo", googleOn("gmail") ? (vault.mail ? `${vault.mail.senders.length} remitentes masivos · ${vault.mail.important.length} importantes` : "Conectado: toca «Actualizar»") : "Conectar Gmail")}
        ${item("spotify", "leaf", "green", "Spotify", spotifyStore.tokens ? `Conectado · altavoz «${vault.settings.spotifySpeaker || DEFAULT_SPEAKER}»` : "Sin conectar: un toque")}
        ${item("ia", "bolt", "purple", "IA (Gemini)", aiReady() ? `Activada · ${aiStore.model}` : "Chat con IA opcional")}
        ${item("atajos", "bolt", "orange", "Atajos del iPhone", shortcutsPending() ? `${shortcutsPending()} pendientes de crear` : "Todos creados")}
        ${item("avisos", "bell", "red", "Avisos", "Notificaciones de MANU")}
        ${item("nube", "box", "blue", "Tu nube", nubeOn() ? (nube.state.conflict ? "Elige con qué datos te quedas" : nube.state.error ? "Revisar" : `Sincronizada${nube.state.lastAt ? ` · ${new Date(nube.state.lastAt).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}`) : "iPhone y Mac con los mismos datos (sin fotos ni «Tu archivo»)")}
        ${item("datos", "box", "gray", "Tus datos", "Copia, restaurar y borrar")}
      </div>
      <p class="muted small">MANU OS web · versión ${APP_VERSION} · ${nubeOn() ? "sincronizado con tu nube" : "datos solo en este dispositivo"}</p>`;
  },
};

// «Puesta a punto»: what is still missing, each with one button.
function setupCard() {
  const steps = [];
  if (!["calendar", "tasks", "contacts", "drive", "gmail"].some(googleOn)) steps.push(["Google", "Calendar, Tasks, Contactos y Gmail con un toque", '<button class="btn small-btn" data-act="google-connect-all">Conectar</button>']);
  if (!aiReady()) steps.push(["IA (Gemini)", "Crear la clave y pegarla: 2 toques", '<button class="btn small-btn" data-act="gemini-guide">Activar</button>']);
  if (notificationStatus() === "default") steps.push(["Avisos", "Para que MANU te avise", '<button class="btn small-btn" data-act="notify-on">Activar</button>']);
  if (!spotifyStore.tokens) steps.push(["Spotify", `Música en tu altavoz «${vault.settings.spotifySpeaker || DEFAULT_SPEAKER}»: un toque`, '<button class="btn small-btn" data-act="spotify-connect">Conectar</button>']);
  if (shortcutsPending()) steps.push(["Atajos del iPhone", `${shortcutsPending()} por crear (alarmas y recordatorios que suenan siempre)`, '<button class="btn small-btn" data-sub-go="atajos">Ver</button>']);
  if (!steps.length) return "";
  return `${sectionTitle("Puesta a punto")}<section class="card">${steps.map(([t, d, b]) => `<div class="row"><div class="grow"><div>${t}</div><div class="muted small">${esc(d)}</div></div>${b}</div>`).join("")}</section>`;
}

// WEB-57: the profile form, also for pasting one written elsewhere.
const profileForm = (text) => `<form id="profileForm" class="stack"><label for="profileText" class="sr">Tu perfil</label><textarea id="profileText" rows="14" placeholder="Quién eres, cómo quieres que te hable MANU, tu día a día, lo que te importa…">${esc(text)}</textarea><div class="btns"><button class="btn" type="submit">Guardar</button><button class="btn ghost" type="button" data-act="profile-cancel">Cancelar</button></div></form>`;
const backBar = (title) => `<button class="link" data-act="back">${I.back} Tú</button><h1>${title}</h1>`;

const subpages = {
  // WEB-59: drop all the screenshots, MANU reads, groups and proposes; Manu keeps the text.
  capturas() {
    const list = vault.captures ?? [];
    const pend = pendingCaptures(list).length;
    const groups = groupCaptures(list);
    const kept = list.filter((c) => c.status === "kept").length;
    const itemRow = (c) => `<div class="cap-item">${c.imageId ? `<button class="thumb" data-act="img-view" data-img-id="${esc(c.imageId)}" aria-label="Ver captura"><img data-img="${esc(c.imageId)}" alt=""></button>` : ""}<div class="grow">${c.status === "pending" ? `<span class="muted small">${esc(new Date(c.at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))} · sin leer</span>` : `<p class="small">${esc(c.text || "No he visto nada útil.")}</p>`}
      <div class="btns">${c.call ? `<button class="btn" data-act="cap-do" data-id="${esc(c.id)}">${esc(callLabel(c.call))}</button>` : ""}${c.status === "read" ? `<button class="btn ghost" data-act="cap-keep" data-id="${esc(c.id)}">Guardar el texto</button>` : ""}<button class="link small danger-link" data-act="cap-drop" data-id="${esc(c.id)}">Descartar</button></div></div></div>`;
    return `${backBar("Capturas")}
      <p class="subtitle">Suéltalas todas aquí. MANU las lee, las agrupa por tema y te propone qué hacer. Te quedas con el texto y la imagen se borra.</p>
      <section class="card"><label class="btn block" for="capFiles" role="button" tabindex="0">${caps.busy ? esc(caps.busy) : "🖼️ Añadir capturas"}</label><input id="capFiles" type="file" accept="image/*" multiple class="sr">
        <p class="muted small">En Fotos puedes seleccionar muchas de golpe. Se guardan solo en este iPhone.</p>
        ${pend ? (aiReady() ? `<button class="btn ghost block" data-act="cap-read">${caps.reading ? esc(caps.reading) : `✨ Leer ${pend === 1 ? "1 captura" : `${pend} capturas`} con Gemini`}</button><p class="muted small">Las imágenes se envían a Google para leerlas (de ${BATCH} en ${BATCH}). Si alguna es privada, descártala antes.</p>` : '<p class="muted small">Para que MANU las lea, activa la IA en Tú → IA. Mientras, se quedan aquí guardadas.</p>') : ""}</section>
      ${groups.length ? groups.map((g) => `<section class="card cap-group"><h2>${esc(g.topic)} <span class="muted small">· ${g.items.length}</span></h2>${g.items.map(itemRow).join("")}${g.key !== "__pending" && g.items.length > 1 ? `<div class="btns"><button class="btn ghost" data-act="cap-keep-group" data-key="${esc(g.key)}">Guardar todo el texto</button><button class="link small danger-link" data-act="cap-drop-group" data-key="${esc(g.key)}">Descartar todas</button></div>` : ""}</section>`).join("") : '<section class="card"><p class="muted">Nada por revisar. 🙌</p></section>'}
      ${kept ? `<p class="muted small">${kept} ${kept === 1 ? "captura guardada" : "capturas guardadas"} como texto. Las encuentras con «busca …».</p>` : ""}`;
  },
  archivo() {
    const s = archive.stats;
    const d = (t) => (t ? new Date(t).toLocaleDateString("es-ES", { month: "short", year: "numeric" }) : "?");
    return `${backBar("Tu archivo")}
      <p class="subtitle">Tu memoria digital: lo que importes se queda solo en este iPhone. No va a GitHub, ni a las copias, ni a ninguna IA salvo que tú lo pidas.</p>
      <section class="card"><h2>📔 Tu diario</h2><p>${s?.diary ? `<b>${s.diary}</b> días con algo apuntado. MANU los rellena solo con tus gastos, tareas, ideas, recordatorios, agenda, ánimo, hábitos, comidas y salud.` : "MANU irá guardando aquí un resumen de cada día con lo que apuntes."}</p><p class="muted small">Pregúntale «¿qué hice ayer?», «¿cuánto gasté el martes?» o «¿qué pasó el 12?».</p></section>
      <section class="card"><h2>ChatGPT</h2>
        ${s?.count ? `<p><b>${(s.count).toLocaleString("es-ES")}</b> conversaciones${s.manu ? ` (${(s.count - s.manu).toLocaleString("es-ES")} de ChatGPT y ${(s.manu).toLocaleString("es-ES")} con MANU)` : ""} · ${(s.mine).toLocaleString("es-ES")} mensajes tuyos · de ${esc(d(s.from))} a ${esc(d(s.to))}</p>` : '<p class="muted">Cuando te llegue el correo de ChatGPT, descarga el .zip y elígelo aquí (sin descomprimir). También vale el archivo conversations.json.</p>'}
        ${archive.busy ? '<p class="muted small">Deja MANU abierta hasta que termine. Fotos y audios del .zip no se leen.</p>' : ""}
        <label class="btn ${s?.count ? "ghost" : ""} block" for="archiveFile" role="button" tabindex="0">${archive.busy ? esc(archive.busy) : s?.count ? "Volver a importar" : "Elegir la exportación de ChatGPT"}</label><input id="archiveFile" type="file" accept=".zip,.json,application/zip,application/json" class="sr">
        <p class="muted small">En ChatGPT: Ajustes → Controles de datos → Exportar datos. Llega un correo con el enlace.</p></section>
      ${s?.count || s?.diary ? `<section class="card"><h2>Pregúntale a tu archivo</h2>${aiReady() ? `<form id="archiveAsk" class="composer-inline"><label for="archiveAskQ" class="sr">Pregunta</label><input id="archiveAskQ" placeholder="¿Qué me recomendaron para Lisboa?" autocomplete="off"><button class="btn" type="submit">${archive.asking ? "Pensando…" : "Preguntar"}</button></form><p class="muted small">MANU busca aquí en tu iPhone y solo envía a Gemini los trozos que tienen que ver. Crisis, Refugio y contraseñas nunca salen${sensitiveAllowed() ? "" : "; salud, dinero y ánimo tampoco (Tú → IA)"}.</p>` : '<p class="muted">Activa la IA (Tú → IA) para preguntarle. Buscar funciona sin IA.</p>'}
        ${archive.answer ? `<div class="stack"><p class="muted small">«${esc(archive.answer.q)}»</p><div class="bubble manu"><span class="ai-tag">IA</span>${esc(archive.answer.text)}</div>${archive.answer.sources.length ? `<p class="muted small">Fuentes: ${archive.answer.sources.map((x) => `[${x.n}] ${esc(x.title)} (${esc(x.date)})`).join(" · ")}</p>` : ""}</div>` : ""}</section>
      <section class="card"><h2>Tu perfil</h2>${archive.editProfile && !vault.profile?.text ? profileForm("") : vault.profile?.text ? `${archive.editProfile ? profileForm(vault.profile.text) : `<div class="profile-text">${esc(vault.profile.text)}</div><p class="muted small">${vault.profile.basedOn ? `Hecho con ${vault.profile.basedOn} conversaciones` : "Escrito por ti"} · ${esc(new Date(vault.profile.at).toLocaleDateString("es-ES", { day: "numeric", month: "long" }))}. Corrige lo que no sea verdad: MANU usa este perfil al hablar contigo.</p><div class="btns"><button class="btn ghost" data-act="profile-edit">Corregir</button><button class="btn ghost" data-act="profile-make">${archive.profiling ? "Creando…" : "Rehacer"}</button><button class="link small danger-link" data-act="profile-delete">Borrar</button></div>`}` : `<p class="muted">Un retrato de quién eres a partir de tus conversaciones: gustos, rutinas, personas, lo que te preocupa y tus metas. Lo puedes corregir.</p>${aiReady() ? `<button class="btn block" data-act="profile-make">${archive.profiling ? "Creando tu perfil…" : "Crear mi perfil con Gemini"}</button><p class="muted small">Se envían a Gemini los títulos de tus conversaciones y la primera frase tuya de cada una (hasta unas 40.000 letras), sin crisis, Refugio ni contraseñas.</p>` : '<p class="muted small">Activa la IA en Tú → IA para crearlo.</p>'}<button class="btn ghost block" data-act="profile-edit">Escribirlo o pegarlo yo</button>`}</section>
      <section class="card"><h2>Buscar en tu archivo</h2><form id="archiveSearch" class="composer-inline"><label for="archiveQ" class="sr">Buscar</label><input id="archiveQ" value="${esc(archive.query)}" placeholder="Lisboa, lentejas, trabajo…" autocomplete="off"><button class="btn" type="submit">Buscar</button></form>
        ${archive.results ? (archive.results.length ? archive.results.map((r) => `<details class="arch-hit"><summary><b>${esc(r.doc.title)}</b><br><span class="muted small">${esc(d(r.doc.at))} · ${esc(r.snippet)}</span></summary><div class="stack small">${r.doc.messages.slice(0, 40).map((m) => `<div class="bubble ${m.role === "me" ? "me" : "manu"}">${esc(m.text.slice(0, 1500))}</div>`).join("")}</div></details>`).join("") : '<p class="muted">Nada con esas palabras.</p>') : ""}</section>
      <button class="link small danger-link" data-act="archive-clear">Borrar el archivo de este iPhone</button>` : ""}`;
  },
  correo() {
    if (!googleOn("gmail")) return `${backBar("Correo")}<section class="card"><p>MANU puede leer tu Gmail, avisarte de lo importante, darte de baja de lo que no quieres y archivar, etiquetar o mandar a la papelera.</p><button class="btn block" data-act="mail-connect">Conectar Gmail</button><p class="muted small">Antes activa la API de Gmail en tu proyecto de Google Cloud. Nunca borra nada para siempre: la papelera se recupera durante 30 días.</p></section>`;
    const m = vault.mail;
    const when = m?.syncedAt ? new Date(m.syncedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : null;
    return `${backBar("Correo")}
      <div class="btns"><button class="btn ghost" data-act="gcal-sync">${gcal.busy ? "Actualizando…" : "Actualizar"}</button></div><p class="muted small">${when ? `Leído a las ${when} · últimos 30 días` : "Aún sin leer: toca «Actualizar»."}</p>
      ${gmailErrorCard()}
      ${mailCards()}
      ${m ? `${sectionTitle("Importantes sin leer")}<section class="card">${m.important.length ? m.important.map((x) => `<a class="row" href="${esc(messageUrl(x.id))}" target="_blank" rel="noopener"><div class="grow"><div>${esc(x.name)}</div><div class="muted small">${esc(x.subject || "(sin asunto)")}</div></div><span class="chev">${I.chev}</span></a>`).join("") : '<p class="muted">Nada importante sin leer en los últimos 3 días. 🌿</p>'}</section>
      ${sectionTitle("Quién te escribe más")}<section class="card">${m.senders.length ? m.senders.slice(0, 15).map((x) => `<div class="stack mail-sender"><div class="row"><div class="grow"><div>${esc(x.name)}</div><div class="muted small">${esc(x.email)} · ${x.count} en 30 días${x.unread ? ` · ${x.unread} sin leer` : ""}</div></div></div><div class="btns">${x.unsub ? `<button class="btn small-btn" data-act="mail-do" data-kind="unsub" data-email="${esc(x.email)}">Baja</button>` : ""}<button class="btn ghost small-btn" data-act="mail-do" data-kind="archive" data-email="${esc(x.email)}">Archivar</button><button class="btn ghost small-btn" data-act="mail-do" data-kind="label" data-email="${esc(x.email)}">Etiquetar</button><button class="btn ghost small-btn" data-act="mail-do" data-kind="trash" data-email="${esc(x.email)}">Papelera</button></div></div>`).join("") : '<p class="muted">Sin newsletters ni avisos masivos.</p>'}</section>
      <p class="muted small">En el móvil solo se guarda este resumen (remitentes, asuntos y recuentos), nunca el texto de los correos. Archivar, etiquetar y papelera se pueden deshacer desde el chat.</p>` : ""}`;
  },
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
      ${soon.length ? `<section class="card"><h2>Cumpleaños próximos</h2>${soon.map((b) => `<div class="row"><span class="grow">${esc(b.person.name)}</span><span class="muted">${b.days === 0 ? "¡Hoy!" : (b.days === 1 ? "Mañana" : `En ${b.days} días`)}</span></div>`).join("")}</section>` : ""}
      ${quiet.length ? `<section class="card"><h2>Hace tiempo que no hablas con</h2>${quiet.map((p) => `<div class="row"><span class="grow">${esc(p.name)}</span><button class="link small" data-act="talked" data-id="${esc(p.id)}">Hablé hoy</button></div>`).join("")}</section>` : ""}
      ${sectionTitle("Todas")}
      <div class="list">${vault.people.length ? vault.people.map((p) => { const d = daysUntilBirthday(p.birthday); return `<details><summary class="item"><span class="ico purple">${esc(p.name.slice(0, 1).toUpperCase())}</span><span class="grow"><span>${esc(p.name)}</span><br><span class="muted small">${d !== null ? `${d === 1 ? "Cumple mañana" : `Cumple en ${d} días`}` : "Sin cumpleaños"}${p.lastContact ? ` · última vez ${new Date(p.lastContact).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}` : ""}${(() => { const d = debts(vault.spending).find((x) => x.key === p.id); return d ? ` · <b>te debe ${esc(eurosTxt(d.cents))}</b>` : ""; })()}</span></span></summary>
        <div class="inner">${p.notes ? `<p>${esc(p.notes)}</p>` : '<p class="muted small">Sin notas.</p>'}<div class="btns">${p.birthday && !p.calendarEventId && googleOn("calendar") ? `<button class="btn ghost" data-act="person-cal" data-id="${esc(p.id)}">🎂 Al calendario</button>` : ""}${p.birthday && p.googleId && vault.contacts?.some((c) => c.googleId === p.googleId && !c.birthday) ? `<button class="btn ghost" data-act="person-gcontact" data-id="${esc(p.id)}">📇 A Google Contactos</button>` : ""}${whatsappUrl(p.phone, "") ? `<a class="btn ghost" href="${esc(whatsappUrl(p.phone, `¡Hola, ${p.name.split(" ")[0]}!`))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}<button class="btn ghost" data-act="talked" data-id="${esc(p.id)}">Hablé hoy</button><button class="btn danger" data-act="del" data-list="people" data-id="${esc(p.id)}">Quitar</button></div></div></details>`; }).join("") : '<p class="muted item">Aún no hay nadie.</p>'}</div>
      <form class="card" id="addPerson"><h2>Añadir persona</h2>
        <label for="pName" class="muted small">Nombre${vault.contacts?.length ? ` (busca entre tus ${vault.contacts.length} contactos)` : ""}</label><input id="pName" maxlength="60" required autocomplete="off" placeholder="${vault.contacts?.length ? "Escribe «eva» y elige" : ""}">
        <div id="pMatches" class="contact-matches" aria-live="polite"></div>
        ${vault.contacts?.length ? '<button class="link small" type="button" data-act="contacts-sync">Actualizar mis contactos de Google</button>' : isClientId(gClientId()) ? '<button class="link small" type="button" data-act="contacts-sync">Traer los nombres de Google Contactos</button>' : ""}
        <label class="muted small" for="pBDay">Cumpleaños (el año no hace falta)</label>
        <div class="bday"><select id="pBDay" aria-label="Día"><option value="">Día</option>${Array.from({ length: 31 }, (_, i) => `<option value="${String(i + 1).padStart(2, "0")}">${i + 1}</option>`).join("")}</select><select id="pBMonth" aria-label="Mes"><option value="">Mes</option>${["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"].map((m, i) => `<option value="${String(i + 1).padStart(2, "0")}">${m}</option>`).join("")}</select></div>
        ${googleOn("calendar") ? '<label class="check-row"><input type="checkbox" id="pCal" checked> Ponerlo en Google Calendar (cada año)</label><p class="muted small" id="pCalNote"></p>' : ""}
        ${isClientId(gClientId()) ? '<label class="check-row" id="pGoogleRow" hidden><input type="checkbox" id="pGoogle" checked> Guardarlo también en Google Contactos</label>' : ""}
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
      ${ok ? `<section class="card"><h2>Servicios</h2><p class="muted small">Cada servicio pide solo su permiso, todos en una ventana.</p>
        <div class="row"><div class="grow"><div>Actualizar al abrir Agenda u Hoy</div><div class="muted small">Cada 10 minutos como mucho. A veces se abre un momento la ventana de Google.</div></div><button class="check" data-act="gauto" aria-pressed="${vault.settings.googleAutoOpen !== false}" aria-label="Actualizar al abrir">${I.check}</button></div>
        ${GOOGLE_FEATURES.map(([k, label, desc]) => `<div class="row"><div class="grow"><div>${label}</div><div class="muted small">${esc(desc)}${st[k] && st[k] !== "off" ? ` · ${esc(st[k].replace(/^ok: /, "").replace(/^error: /, "⚠︎ "))}` : ""}</div></div><button class="check" data-act="gfeature" data-k="${k}" aria-pressed="${googleOn(k)}" aria-label="${label}">${I.check}</button></div>`).join("")}
        ${["calendar", "tasks", "contacts", "gmail"].some(googleOn) ? `<button class="btn" data-act="gcal-sync">${gcal.busy ? "Sincronizando…" : "Sincronizar ahora"}</button>` : ""}</section>` : ""}
      ${ok && googleOn("drive") ? `<section class="card"><h2>Copia completa cifrada en Drive</h2>
        <p class="muted small">Se cifra con una frase tuya que no se guarda en ningún sitio. Si la olvidas, la copia no se puede abrir.</p>
        <form id="driveForm" class="stack"><label for="drivePass" class="muted small">Frase de la copia (mínimo 10 caracteres)</label><input id="drivePass" type="password" autocomplete="new-password" minlength="10">
          <div class="btns"><button class="btn ghost" type="submit" data-drive="save">Cifrar y subir</button><button class="btn ghost" type="submit" data-drive="restore">Descargar y restaurar</button></div></form>
        ${confirmDriveRestore ? `<p>La copia de Drive es del ${esc(new Date(confirmDriveRestore.file.modifiedTime).toLocaleString("es-ES"))} y se ha descifrado bien. Reemplazará lo que hay en este móvil.</p><div class="btns"><button class="btn danger" data-act="drive-restore-yes">Sí, restaurar</button><button class="btn ghost" data-act="drive-restore-no">Cancelar</button></div>` : ""}</section>` : ""}
      <section class="card"><h2>Cómo conseguir el ID (una vez, mejor desde el ordenador)</h2><ol class="muted small">
        <li>Entra en <b>console.cloud.google.com</b> y crea un proyecto «MANU OS». Es gratis.</li>
        <li>«APIs y servicios» → «Biblioteca»: habilita las APIs que vayas a usar (Google Calendar API, Google Tasks API, People API, Google Drive API y <b>Gmail API</b>). Si falta una, ese servicio falla con «API no activada».</li>
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
      <div class="btns">${x.test ? `<a class="btn ghost" href="${esc(safeHref(x.test))}">Probar</a>` : ""}${done[x.id] ? `<button class="btn ghost" data-act="shortcut-undo" data-id="${x.id}">Marcar como pendiente</button>` : `<button class="btn" data-act="shortcut-done" data-id="${x.id}">Ya lo tengo</button>`}</div></details>`;
    return `${backBar("Atajos")}
      <p class="muted small">Cada atajo se crea una vez en la app Atajos, con el nombre exacto. Cuando lo tengas, pulsa «Ya lo tengo».</p>
      ${buzonCard()}
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
  fichaje() {
    const month = clockMonth ?? localDay().slice(0, 7);
    const r = monthReport(vault.clock, month, { targetMin: clockTarget(), now: today() });
    const [y, m] = month.split("-").map(Number);
    const title = new Date(y, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    const isNow = month === localDay().slice(0, 7);
    const evLabel = { in: "🟢 Entro", pause: "⏸ Pausa", back: "🏢 Vuelvo", out: "🚪 Salida" };
    const dayRow = (x) => {
      const rec = clockDay(x.day);
      const open = clockEdit === x.day;
      return `<div class="clock-day${x.open ? " open-day" : ""}"><button class="row clock-row" data-act="clock-edit" data-day="${esc(x.day)}" aria-expanded="${open}">
        <span class="grow"><b>${esc(x.weekday.slice(0, 3))} ${Number(x.day.slice(8))}</b> <span class="muted small">${esc(x.in || "—")}–${esc(x.out || "¿salida?")}${x.pauses ? ` · ${x.pauses} pausa${x.pauses === 1 ? "" : "s"}` : ""}</span></span>
        <span class="num">${esc(dur(x.workedMin))}</span><span class="num diff ${x.diffMin === null ? "" : x.diffMin >= 0 ? "pos" : "neg"}">${x.diffMin === null ? "abierto" : `${x.diffMin >= 0 ? "+" : "−"}${esc(dur(x.diffMin))}`}</span></button>
        ${open ? `<div class="clock-events">${rec.events.map((e) => `<div class="row"><span class="grow">${evLabel[e.t]}${e.why ? ` <span class="muted small">${esc(e.why)}</span>` : ""}</span><label class="sr" for="ck-${esc(e.id)}">Hora</label><input type="time" id="ck-${esc(e.id)}" data-clock-day="${esc(x.day)}" data-clock-id="${esc(e.id)}" value="${esc(hhmm(new Date(e.at)))}"><button class="link small icon-btn" data-act="clock-del" data-day="${esc(x.day)}" data-id="${esc(e.id)}" aria-label="Borrar fichaje">✕</button></div>`).join("")}<p class="muted small">Cambia la hora si se te olvidó fichar a tiempo.</p></div>` : ""}</div>`;
    };
    return `${backBar("Fichaje")}
      <section class="card balance"><p class="muted small">Saldo de ${esc(title)}</p><h2 class="balance-line ${r.balanceMin > 0 ? "pos" : r.balanceMin < 0 ? "neg" : ""}">${esc(r.balance)}</h2>
        <p class="muted small">${r.days} ${r.days === 1 ? "día" : "días"} · trabajado ${esc(dur(r.workedMin))} de ${esc(dur(r.dueMin))}${r.openDays ? ` · <b>${r.openDays} sin salida</b> (no cuenta${r.openDays === 1 ? "" : "n"} hasta que lo corrijas)` : ""}. Jornada de ${esc(dur(clockTarget()))}; ${esc(dur(clockTarget()))} de más cuentan como 1 día.</p>
        <div class="btns"><button class="btn" data-act="clock-dl" data-kind="xlsx">⬇️ Informe en Excel</button><button class="btn ghost" data-act="clock-copy">📋 Copiar como nota</button><button class="btn ghost" data-act="clock-dl" data-kind="ics">📅 Calendario</button><button class="btn ghost" data-act="clock-dl" data-kind="csv">CSV</button></div></section>
      <div class="row month-nav"><button class="link" data-act="clock-month" data-d="-1" aria-label="Mes anterior">‹ Anterior</button><b class="grow center">${esc(title)}</b>${isNow ? "<span></span>" : '<button class="link" data-act="clock-month" data-d="1" aria-label="Mes siguiente">Siguiente ›</button>'}</div>
      <section class="card">${r.rows.length ? r.rows.slice().reverse().map(dayRow).join("") : '<p class="muted">Aún no hay fichajes este mes. Usa la tarjeta «⏱️ Fichaje» de Hoy.</p>'}</section>
      <section class="card"><h2>Tu jornada</h2><form class="row" id="clockTargetForm"><label for="clockTarget" class="grow">Horas por día</label><input id="clockTarget" type="time" value="${esc(`${String(Math.floor(clockTarget() / 60)).padStart(2, "0")}:${String(clockTarget() % 60).padStart(2, "0")}`)}"></form><p class="muted small">Para calcular tu hora de salida y el saldo con RK.</p></section>`;
  },
  nube() {
    const st = nube.state;
    const when = (iso) => new Date(iso).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const what = '<p class="muted small">Se sincroniza todo lo de MANU: tareas, ideas, agenda, dinero, personas, proyectos, perfil y ajustes. <b>Aún no</b> «Tu archivo» (ChatGPT) ni las fotos: cada dispositivo guarda los suyos.</p>';
    if (nubeOn()) {
      return `${backBar("Tu nube")}
        ${st.conflict ? `<section class="card"><h2>⚠️ Hay dos versiones</h2><p class="muted small">Este dispositivo tiene cambios sin subir y ${esc(st.conflict.device ?? "el otro dispositivo")} ha subido otros${st.conflict.at ? ` (${esc(when(st.conflict.at))})` : ""}. Elige con cuál te quedas: la otra se pierde.</p>
          <div class="btns"><button class="btn" data-act="nube-keep-local">Quedarme con este</button><button class="btn ghost" data-act="nube-keep-remote">Traer la de la nube</button></div></section>` : ""}
        <section class="card"><h2>Estado</h2>
          <p>${nube.running ? "Sincronizando…" : st.error ? esc(st.error) : st.dirty ? "Cambios pendientes de subir." : st.lastRev ? "Todo sincronizado." : "Conectado. Aún no hay nada en la nube ni nada que subir desde aquí: en cuanto apuntes algo, o conectes el dispositivo que tiene tus datos, se sincroniza."}</p>
          <p class="muted small">Cuenta: ${esc(st.email ?? "")}${st.lastAt ? ` · última vez ${esc(when(st.lastAt))}` : ""}${st.lastRev ? ` · versión ${esc(st.lastRev)}` : ""}</p>
          <div class="btns"><button class="btn" data-act="nube-sync">Sincronizar ahora</button><button class="btn ghost" data-act="nube-leave">Desconectar este dispositivo</button></div></section>
        <section class="card"><h2>Cómo funciona</h2>${what}<ul class="muted small"><li>Solo tu cuenta puede leer tus datos en la nube. No van cifrados con una frase (lo elegiste así para no tener nada que recordar): Supabase, como empresa, técnicamente podría verlos.</li><li>Al cambiar algo, se sube en unos segundos. Al abrir MANU, se trae lo último del otro dispositivo.</li><li>Para entrar en otro dispositivo, te llega un código al correo.</li></ul></section>`;
    }
    const sent = Boolean(st.codeSentAt && st.email);
    return `${backBar("Tu nube")}
      <section class="card"><h2>iPhone y Mac con los mismos datos</h2><p class="muted small">Tu propio Supabase (gratis). Entras con un enlace que te llega al correo: nada que recordar.</p>${what}</section>
      ${nube.handoff ? `<section class="card"><h2>📋 Tu código para MANU</h2><p class="muted small">Estás en Safari, no en la app. Copia este código, abre MANU desde tu pantalla de inicio y pégalo en Tú → Tu nube.</p><pre class="code">${esc(nube.handoff)}</pre><button class="btn block" data-act="nube-copy-handoff">Copiar código</button></section>` : ""}
      <section class="card"><h2>${sent ? "2. Abre el correo" : "1. Tu correo"}</h2>
        ${sent ? `<p class="muted small">Te he mandado un correo a <b>${esc(st.email)}</b> («Your sign-in link»; mira también en «Spam»).</p><ul class="muted small"><li><b>En el Mac:</b> ábrelo y pulsa «Sign in». Ya está.</li><li><b>En el iPhone:</b> ábrelo y pulsa «Sign in». Se abrirá Safari con un código: cópialo, vuelve aquí y pégalo abajo.</li></ul>
        <form id="nubeForm" class="stack">
          <label class="muted small" for="nubeCode">Código que te da el enlace</label><input id="nubeCode" autocomplete="one-time-code" autocapitalize="off" spellcheck="false" placeholder="Pega aquí el código">
          <div class="btns"><button class="btn" type="submit">Entrar</button><button class="btn ghost" type="button" data-act="nube-other">Otro correo</button><button class="link small" type="button" data-act="nube-code">Mandármelo otra vez</button></div>
        </form>` : `<form id="nubeMail" class="stack">
          <label class="muted small" for="nubeEmail">Correo</label><input id="nubeEmail" type="email" value="${esc(st.email ?? "")}" autocomplete="email">
          <button class="btn" type="submit">Mandarme el enlace</button>
        </form>`}</section>
      <details class="card"><summary class="muted small">Solo si falta la tabla en Supabase</summary><p class="muted small">SQL Editor → New query → pega esto → Run. Ya está hecha en tu proyecto.</p><pre class="code small">${esc(SUPABASE_SQL)}</pre><button class="btn ghost" type="button" data-act="nube-copy-sql">Copiar el SQL</button></details>`;
  },
  ia() {
    const key = aiStore.key;
    return `${backBar("IA (Gemini)")}
      ${aiReady() ? "" : `<section class="card"><h2>Actívala paso a paso</h2><p class="muted small">Te guío: crear la clave gratis, copiarla y pegarla aquí.</p><button class="btn block" data-act="gemini-guide">Empezar</button></section>`}
      <section class="card"><h2>Estado</h2><p>${aiReady() ? `Activada con <b>${esc(aiStore.model)}</b>.` : key ? "Clave guardada. Pulsa «Probar clave»." : "Sin clave: MANU funciona sin IA."}</p>
        <form id="aiForm" class="stack"><label for="aiKey" class="muted small">Clave de API de Gemini. Nunca va en las copias. Por defecto solo dura mientras MANU está abierta.</label><input id="aiKey" type="password" value="${esc(key)}" autocomplete="off" spellcheck="false" placeholder="AQ.… o AIza…"><div class="btns"><button class="btn" type="submit">Guardar y probar clave</button>${key ? '<button class="btn danger" type="button" data-act="ai-forget">Borrar clave</button>' : ""}</div></form>
        <div class="row"><div class="grow"><div>Recordar la clave en este móvil</div><div class="muted small">Más cómodo, pero cualquier código que corra en esta web podría leerla (ADR-0013).</div></div><button class="check" data-act="ai-remember" aria-pressed="${aiStore.remember}" aria-label="Recordar clave">${I.check}</button></div>
        ${key ? `<div class="row"><span>Ofrecer la IA en el chat</span><button class="check" data-act="ai-toggle" aria-pressed="${vault.settings.aiEnabled !== false}" aria-label="Usar IA">${I.check}</button></div>
        <div class="row"><div class="grow"><div>Enviar a Gemini sin preguntar</div><div class="muted small">Desactivado por defecto. Si lo activas, lo que MANU no entienda irá directo a Gemini. ${vault.settings.aiSensitive === true ? "Contraseñas, tarjetas, IBAN, teléfonos, crisis y Refugio seguirán sin enviarse nunca." : "Lo que parezca privado (salud, dinero, ánimo, teléfonos…) seguirá sin enviarse nunca."}</div></div><button class="check" data-act="ai-auto" aria-pressed="${vault.settings.aiAutoSend === true}" aria-label="Enviar sin preguntar">${I.check}</button></div>
        <div class="row"><div class="grow"><div>Permitir datos sensibles</div><div class="muted small">Salud, dinero, ánimo y personas podrán ir a Gemini en el chat, las capturas y los proyectos. Contraseñas, tarjetas, IBAN, teléfonos, correos, crisis y Refugio nunca.</div></div><button class="check" data-act="ai-sensitive" aria-pressed="${vault.settings.aiSensitive === true}" aria-label="Permitir datos sensibles">${I.check}</button></div>` : ""}</section>
      ${aiReady() ? aiModeCard() : ""}
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
        <p class="muted small">Con MANU abierta. Para que suenen siempre, usa los atajos.</p></section>
      <section class="card"><h2>Qué te aviso</h2>
        ${(() => { const prefs = nudgePrefs(vault.settings.nudges); return NUDGES.map((n) => `<div class="row nudge-row"><button class="check" data-act="nudge-toggle" data-id="${n.id}" aria-pressed="${prefs[n.id].on}" aria-label="${esc(n.label)}">${I.check}</button><div class="grow"><div>${esc(n.label)}</div><div class="muted small">${esc(n.hint)}</div></div>${n.time === null ? `<span class="muted small">${n.id === "ficharEntrada" ? esc(addMinutes(vault.settings.workStart ?? "09:00", 1)) : esc(addMinutes(vault.settings.workStart ?? "09:00", clockTarget()))}</span>` : `<label class="sr" for="nt-${n.id}">Hora de «${esc(n.label)}»</label><input id="nt-${n.id}" type="time" data-nudge-time="${n.id}" value="${esc(prefs[n.id].time)}"${prefs[n.id].on ? "" : " disabled"}>`}</div>`).join(""); })()}
        <p class="muted small">Solo avisa si hace falta. Con MANU cerrada, usa las automatizaciones de <button class="link small" data-sub-go="atajos">Atajos</button> («MANU Fichaje» y «MANU Noche»).</p></section>
      <section class="card"><h2>${I.bolt} Atajos</h2><p class="muted small">Los atajos del iPhone tienen ahora su propia sección.</p><button class="btn ghost" data-sub-go="atajos">Ir a Atajos</button></section>
      <section class="card" hidden><h2>${I.bolt} Atajos (se crean una vez)</h2>
        <p class="muted small">Crea estos atajos en la app Atajos con el nombre exacto. Los nombres de las acciones pueden variar según tu iOS. NO_VERIFICADO en tu iPhone.</p>
        <details><summary>«${SHORTCUT_ALARM}»: alarmas</summary><ol class="muted small"><li>Nuevo atajo llamado <b>${SHORTCUT_ALARM}</b>.</li><li>Acción «Obtener fechas de» → Entrada del atajo.</li><li>Acción «Crear alarma» (Reloj) con esa hora.</li><li>En MANU, «Poner alarma» abre este atajo con la hora.</li></ol></details>
        <details><summary>«${SHORTCUT_REMINDER}»: recordatorios que suenan</summary><ol class="muted small"><li>Nuevo atajo llamado <b>${SHORTCUT_REMINDER}</b>.</li><li>«Dividir texto» la Entrada del atajo por el separador personalizado <code>|</code>.</li><li>«Obtener elemento de la lista» → primer elemento (el texto).</li><li>«Obtener elemento de la lista» → último elemento → «Obtener fechas de».</li><li>«Añadir nuevo recordatorio» con el texto y alerta en esa fecha.</li></ol></details>
        <details><summary>Apuntar a MANU desde Siri</summary><ol class="muted small"><li>«Solicitar entrada» (texto).</li><li>«URL»: <code>${esc(SITE)}#di=</code> + Entrada proporcionada.</li><li>«Abrir URL». Se abre en Safari, que guarda sus datos aparte del icono (NO_VERIFICADO).</li></ol></details>
        <details><summary>Traer la agenda de hoy</summary><ol class="muted small"><li>«Buscar eventos del calendario» de hoy.</li><li>«Repetir con cada» → «Texto»: hora de inicio (HH:mm), espacio y título.</li><li>«Combinar texto» con saltos de línea → «Copiar al portapapeles».</li><li>Abre MANU → Agenda → Pegar eventos de hoy.</li></ol></details></section>`;
  },
  datos() {
    const use = storageUse(globalThis.localStorage);
    return `${backBar("Tus datos")}
      ${use ? `<section class="card"><h2>Espacio en este dispositivo</h2><div class="bar meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(use.ratio * 100)}" aria-label="Espacio usado"><i data-level="${use.level}" data-w="${Math.max(1, Math.min(100, Math.round(use.ratio * 100)))}"></i></div><p class="muted small">${(use.bytes / 1048576).toFixed(1).replace(".", ",")} MB de unos 5 MB.${use.level === "ok" ? " Vas sobrado." : " Haz una copia y borra lo que ya no necesites (capturas, conversaciones viejas)."} Las fotos y «Tu archivo» van aparte y no cuentan aquí.</p></section>` : ""}
      ${fullBackupCard()}
      <section class="card"><p class="muted small">Solo lo básico (sin imágenes, archivo ni diario), sin cifrar:</p>
        <div class="btns"><button class="btn ghost" data-act="export">Descargar copia básica</button></div>
        ${confirmWipe ? '<p>¿Seguro? Se borra todo lo guardado en este dispositivo.</p><div class="btns"><button class="btn danger" data-act="wipe-yes">Sí, borrar todo</button><button class="btn ghost" data-act="wipe-no">Cancelar</button></div>' : '<button class="link" data-act="wipe">Borrar todos los datos…</button>'}</section>`;
  },
};

// ---------- Quick add sheet (WEB-22: one field, MANU guesses the kind) ----------
const KINDS = [["TASK", "✅", "Tarea"], ["IDEA", "💡", "Idea"], ["EXPENSE", "💸", "Gasto"], ["REMINDER", "🔔", "Aviso"]];
const SAVE_LABEL = { TASK: "Añadir tarea", IDEA: "Guardar idea", EXPENSE: "Apuntar gasto", REMINDER: "Crear aviso", EVENT: "Crear evento" };
const localInput = (d) => `${dayKey(d)}T${hhmm(d)}`;
function detectHint(d) {
  if (!d || !sheet?.text) return "Escribe lo que sea: «llamar al taller», «12,50 gasolina», «recuérdame … a las 18», «idea: …».";
  if (d.kind === "EXPENSE") return `💸 Parece un gasto de ${euros(d.cents)}${d.merchant ? ` en ${d.merchant}` : ""}.`;
  if (d.kind === "REMINDER") return `🔔 Te aviso ${dayKey(d.at) === localDay() ? "hoy" : dayKey(d.at) === tomorrowKey() ? "mañana" : d.at.toLocaleDateString("es-ES")} a las ${hhmm(d.at)}.`;
  if (d.kind === "IDEA") return "💡 Lo guardo como idea.";
  return "✅ Lo apunto como tarea.";
}
// Screenshot / link part of the sheet.
function sharedBlock() {
  const img = sheet.image, link = sheet.link;
  const preview = img ? `<div class="qa-thumb"><img src="${esc(img)}" alt="Captura adjunta"><button type="button" data-act="qa-image-remove" aria-label="Quitar captura">✕</button></div>` : "";
  const attachBtn = `<label class="qa-attach" for="qImage" role="button" tabindex="0">📎 ${img ? "Cambiar captura" : "Añadir captura"}</label><input id="qImage" type="file" accept="image/*" class="sr">`;
  let ai = "";
  if (link && !img && link.provider === "instagram") ai = '<p class="qa-note small">📸 Instagram no deja leer sus reels desde fuera. Haz una captura del reel con el texto visible y añádela con 📎.</p>';
  else if (img || (link && (link.provider === "tiktok" || link.provider === "youtube"))) {
    const what = img ? "la captura" : `el texto del vídeo de ${PROVIDER_NAME[link.provider]}`;
    ai = aiReady()
      ? `<div class="qa-ai"><button type="button" class="btn ghost block" data-act="qa-ai">✨ Que MANU lo lea y lo apunte</button><p class="muted small">Se envía ${what} a Google (Gemini) para sacar planes, fechas, precios o tareas; tú confirmas cada cosa. No lo uses con datos del banco, de salud o de otras personas.</p></div>`
      : '<div class="qa-ai"><button type="button" class="btn ghost block" data-act="gemini-guide">✨ Activa la IA para que MANU lo lea</button></div>';
  } else if (link) ai = `<p class="qa-note small">🔗 Enlace guardado con ${sheet.kind === "IDEA" ? "la idea" : "lo que añadas"}. MANU solo puede leer vídeos de TikTok y YouTube.</p>`;
  return `<div class="qa-shared">${preview}<div class="qa-attach-row">${attachBtn}</div>${ai}</div>`;
}

function sheetHtml() {
  if (!sheet) return "";
  const k = sheet.kind;
  const d = sheet.detected ?? null;
  const soon = new Date(Date.now() + 3600e3); soon.setMinutes(0, 0, 0);
  const when = d?.kind === "REMINDER" && d.at ? d.at : soon;
  const extra = {
    EXPENSE: `<div class="qa-row"><label for="qAmount" class="muted small">Importe</label><div class="qa-amount"><input id="qAmount" inputmode="decimal" placeholder="0,00" value="${d?.kind === "EXPENSE" && d.cents ? esc(euros(d.cents).replace(/\s?€/, "")) : ""}" required><span>€</span></div></div>`,
    REMINDER: `<div class="qa-row"><label for="qWhen" class="muted small">Cuándo</label><input id="qWhen" type="datetime-local" value="${localInput(when)}" required></div>`,
    EVENT: `<div class="qa-row"><label for="qWhen" class="muted small">Empieza</label><input id="qWhen" type="datetime-local" value="${localInput(soon)}" required></div><div class="qa-row"><label for="qMinutes" class="muted small">Duración (min)</label><input id="qMinutes" inputmode="numeric" value="60"></div>`,
  }[k] ?? "";
  const tiles = k === "EVENT" ? "" : `<div class="qa-kinds" role="group" aria-label="Tipo">${KINDS.map(([id, e, label]) => `<button type="button" class="qa-kind${id === k ? " on" : ""}" data-kind="${id}" data-act="sheet-kind" aria-pressed="${id === k}"><span class="qa-e" aria-hidden="true">${e}</span><span>${label}</span></button>`).join("")}</div>`;
  return `<div class="sheet-bg" id="sheetBg"><form class="sheet glass qa" id="quickAdd" role="dialog" aria-modal="true" aria-label="Añadir">
    <div class="grabber"></div>
    <div class="qa-head"><h2>${k === "EVENT" ? "Nuevo evento" : "Añadir"}</h2><button type="button" class="qa-close" data-act="sheet-close" aria-label="Cerrar">✕</button></div>
    <label for="qText" class="sr">Qué quieres añadir</label><textarea id="qText" rows="2" maxlength="400" placeholder="${k === "EVENT" ? "Título del evento" : "Escribe lo que sea…"}" enterkeyhint="done">${esc(sheet.text ?? "")}</textarea>
    ${k === "EVENT" ? "" : `<p class="qa-hint muted small" id="qaHint" aria-live="polite">${esc(detectHint(d))}</p>`}
    ${k === "EVENT" ? "" : sharedBlock()}
    ${tiles}${extra}
    <button class="btn block qa-save" type="submit">${SAVE_LABEL[k]}</button></form></div>`;
}

// ---------- Render ----------
// ---------- Motion (QAL/animate rules: ease-out entrances, <300ms UI, reduced motion) ----------
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
// WEB-40: whether the chat should keep following its end.
let chatPinned = true, autoScrollUntil = 0;
const pageScroller = () => document.scrollingElement ?? document.documentElement;
function chatAtEnd() {
  const s = pageScroller();
  const vh = window.visualViewport?.height ?? window.innerHeight;
  return s.scrollHeight - (s.scrollTop + vh) < 160;
}
function scrollChatToEnd(smooth = false) {
  autoScrollUntil = Date.now() + (smooth ? 700 : 150);
  window.scrollTo({ top: pageScroller().scrollHeight, behavior: smooth && !reduceMotion() ? "smooth" : "auto" });
  chatUnseen = false; updateChatDown();
}
// WEB-45: while Manu reads older messages, a small «↓» takes him back to the
// end; it gets a dot when something new arrived meanwhile.
let chatUnseen = false;
function updateChatDown() {
  const b = document.getElementById("chatDown");
  if (!b) return;
  // WEB-49: measuring the page forces a layout; outside MANU there is nothing to measure.
  if (tab !== "manu") { if (!b.hidden) b.hidden = true; return; }
  const show = tab === "manu" && !sheet && !chatPinned && !chatAtEnd();
  if (!show && chatAtEnd()) chatUnseen = false;
  b.hidden = !show;
  b.classList.toggle("unseen", show && chatUnseen);
  b.setAttribute("aria-label", chatUnseen ? "Hay mensajes nuevos: bajar al último" : "Bajar al último mensaje");
}
document.getElementById("chatDown")?.addEventListener("click", () => { chatPinned = true; scrollChatToEnd(true); });
window.addEventListener("scroll", () => {
  if (tab !== "manu" || document.body.classList.contains("kb") || Date.now() < autoScrollUntil) return;
  chatPinned = chatAtEnd();
  updateChatDown();
}, { passive: true });
// The chat keeps growing after a redraw (entry animation, «Pensando…» turning
// into the answer). While Manu follows the conversation, stay at the end.
let lastScreenHeight = 0;
if (typeof ResizeObserver === "function") {
  new ResizeObserver(() => {
    const h = document.getElementById("screen")?.scrollHeight ?? 0;
    const grew = h > lastScreenHeight;
    lastScreenHeight = h;
    if (grew && tab === "manu" && chatPinned && !document.body.classList.contains("kb")) scrollChatToEnd(false);
    else if (grew && tab === "manu" && !chatPinned) { chatUnseen = true; updateChatDown(); }
  }).observe(document.getElementById("screen") ?? document.body);
}
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

// manual: the kind was chosen by Manu (a section's «Añadir»), so typing does not change it.
function openSheet(kind, manual = false) {
  sheet = { kind, manual, text: "", detected: null, image: null, link: null };
  render();
}

// Typing in the sheet: guess the kind and prefill fields, without rebuilding
// the sheet (and losing the keyboard) unless the kind changes.
// With the iPhone keyboard open the visible area shrinks: keep the whole sheet
// (title and ✕ included) inside it.
function fitSheet() {
  const bg = $("sheetBg"), vv = window.visualViewport;
  if (!bg || !vv) return;
  bg.style.top = `${Math.round(vv.offsetTop)}px`;
  bg.style.height = `${Math.round(vv.height)}px`;
  bg.style.bottom = "auto";
}
window.visualViewport?.addEventListener("resize", fitSheet);
// Keyboard open (visible area much smaller than the window): hide the tab bar
// and «+» so the chat composer sits right above the keyboard.
let fullHeight = window.visualViewport?.height ?? window.innerHeight; // baseline without keyboard
window.addEventListener("orientationchange", () => { fullHeight = 0; setTimeout(() => { fullHeight = window.visualViewport?.height ?? window.innerHeight; }, 400); });
function keyboardMode() {
  const vv = window.visualViewport;
  if (vv) fullHeight = Math.max(fullHeight, vv.height, document.activeElement?.matches("input, textarea") ? 0 : window.innerHeight);
  const open = Boolean(vv) && vv.height < fullHeight * 0.78 && document.activeElement?.matches("input, textarea");
  const was = document.body.classList.contains("kb");
  document.body.classList.toggle("kb", open);
  placeComposer();
  if (open && !was && tab === "manu") $("chat")?.lastElementChild?.scrollIntoView({ block: "end" });
  // WEB-40: when the keyboard goes away, iOS leaves the page shifted; if Manu
  // was following the conversation, bring back the end (twice: iOS animates).
  if (!open && was && tab === "manu" && chatPinned) { setTimeout(() => scrollChatToEnd(false), 60); setTimeout(() => scrollChatToEnd(false), 360); }
}
// iOS keeps the layout viewport full height under the keyboard, so a sticky
// composer ends up hidden behind it (or floating mid-screen). With the
// keyboard open it is fixed to the bottom of the visible area instead (WEB-29).
function placeComposer() {
  const vv = window.visualViewport;
  if (!vv || !document.body.classList.contains("kb")) { document.body.style.removeProperty("--kb-bottom"); return; }
  document.body.style.setProperty("--kb-bottom", `${Math.round(vv.offsetTop + vv.height)}px`);
}
window.visualViewport?.addEventListener("resize", keyboardMode);
document.addEventListener("focusout", () => setTimeout(keyboardMode, 50));
window.visualViewport?.addEventListener("scroll", fitSheet);
window.visualViewport?.addEventListener("scroll", placeComposer);

function rerenderSheet() {
  const t = $("qText"); const pos = t?.selectionStart ?? null;
  renderedSheetKind = undefined; render();
  const n = $("qText"); if (n) { n.focus(); const p = pos ?? n.value.length; n.setSelectionRange(p, p); }
}

function onQuickInput(value) {
  if (!sheet) return;
  sheet.text = value;
  if (sheet.kind === "EVENT") return;
  const link = detectLink(value);
  if (Boolean(link) !== Boolean(sheet.link) || (link && sheet.link && link.url !== sheet.link.url)) {
    sheet.link = link;
    if (link && !sheet.manual && !sheet.image) sheet.kind = "IDEA"; // a shared video is usually «para luego»
    rerenderSheet();
    return;
  }
  const d = quickDetect(value, today());
  sheet.detected = d;
  // Switch only to a kind MANU actually recognised (gasto, aviso, idea); fall back
  // to «tarea» only if the current kind was itself a guess. Opening the sheet
  // from Dinero and typing «gasolina» first keeps it a gasto.
  if (!sheet.manual && value.trim() && d.kind !== sheet.kind && (d.kind !== "TASK" || sheet.guessed)) {
    const pos = $("qText")?.selectionStart ?? value.length;
    sheet.kind = d.kind;
    sheet.guessed = d.kind !== "TASK";
    render();
    const t = $("qText"); if (t) { t.focus(); t.setSelectionRange(pos, pos); }
    $("quickAdd")?.querySelector(".qa-kind.on")?.classList.add("pop");
    return;
  }
  const hint = $("qaHint"); if (hint) hint.textContent = detectHint(d);
  if (sheet.kind === "EXPENSE" && d.kind === "EXPENSE" && $("qAmount") && !$("qAmount").dataset.touched) $("qAmount").value = euros(d.cents).replace(/\s?€/, "");
  if (sheet.kind === "REMINDER" && d.kind === "REMINDER" && $("qWhen") && !$("qWhen").dataset.touched) $("qWhen").value = localInput(d.at);
}

function closeSheet() {
  const bg = $("sheetBg");
  if (!bg || reduceMotion()) { sheet = null; render(); return; }
  bg.dataset.state = "closing";
  setTimeout(() => { sheet = null; render(); }, 280);
}

function render({ focus = false, enter = null } = {}) {
  setSensitiveOk(vault?.settings?.aiSensitive === true);
  celebrateMoney = Boolean(enter) && tab === "dinero" && !overlay && !reduceMotion();
  const w = currentWeather();
  if (w?.data?.now) document.body.dataset.wx = sceneFor(w.data.now.icon, w.data.today); else delete document.body.dataset.wx;
  const phase = w?.data ? phaseOf(w.data) : null;
  if (phase) document.body.dataset.sky = phase; else delete document.body.dataset.sky;
  document.body.dataset.screen = overlay === "weather" ? "weather" : tab; // not data-tab: that attribute marks the tab buttons
  // Full-screen living background: the weather scene behind Hoy and the weather
  // page. Rebuilt only when it changes, so the animation never restarts on render.
  const skyScene = (tab === "hoy" || overlay === "weather") && w?.data?.now ? sceneFor(w.data.now.icon, w.data.today) : "";
  const sky = $("sky");
  if (sky && sky.dataset.scene !== skyScene) { sky.dataset.scene = skyScene; sky.innerHTML = skyScene ? sceneLayer(skyScene) : ""; syncAnimations(sky); }
  const todayMood = vault.moods.find((m) => m.day === localDay())?.value;
  if (todayMood) document.body.dataset.mood = String(todayMood); else delete document.body.dataset.mood;
  if (tab === "tu" && (!sub || sub === "gcal") && isClientId(gClientId())) loadGis().catch(() => {});
  document.body.dataset.mode = modeState(today(), undefined, vault.settings.override).mode;
  renderTabs();
  // WEB-35: a background refresh (weather, Google, archive) must not wipe what
  // Manu is typing nor close the keyboard: keep the focused field as it was.
  const active = document.activeElement;
  const typing = active?.id && active.closest?.("#screen") && active.matches("input:not([type=file]):not([type=checkbox]), textarea")
    ? { id: active.id, value: active.value, start: active.selectionStart, end: active.selectionEnd } : null;
  $("screen").innerHTML = overlay === "weather" ? weatherPage() : overlay === "gemini" ? geminiGuide() : overlay === "image" ? `<button class="link" data-act="overlay-close">${I.back} Volver</button><img class="viewer" data-img="${esc(viewImageId ?? "")}" alt="Captura">` : (screens[tab] ?? screens.hoy)();
  animateEnter(enter);
  syncAnimations($("screen"));
  if (typing && !focus && !enter) {
    const el = document.getElementById(typing.id);
    if (el && el.matches("input, textarea")) {
      if (el.value !== typing.value) el.value = typing.value;
      el.focus({ preventScroll: true });
      try { el.setSelectionRange(typing.start, typing.end); } catch { /* inputs without a caret */ }
    }
  }
  const bars =$("screen").querySelectorAll(".bar > i[data-w]");
  if (enter && !reduceMotion()) { bars.forEach((el) => { el.style.width = "0%"; }); requestAnimationFrame(() => requestAnimationFrame(() => bars.forEach((el) => { el.style.width = `${el.dataset.w}%`; }))); }
  else bars.forEach((el) => { el.style.width = `${el.dataset.w}%`; });
  $("screen").querySelectorAll(".range > i").forEach((el) => { el.style.left = `${el.dataset.l}%`; el.style.width = `${el.dataset.w}%`; });
  $("screen").querySelectorAll(".week-bars i[data-h], .ie-bars i[data-h]").forEach((el) => { el.style.height = `${Math.max(Number(el.dataset.h) ? 2 : 0, Number(el.dataset.h))}%`; });
  $("screen").querySelectorAll("[data-c]").forEach((el) => { if (/^#[0-9a-f]{6}$/i.test(el.dataset.c)) el.style.setProperty("--ev", el.dataset.c); });
  hydrateImages($("screen"));
  $("topTitle").textContent = sub ? { habitos: "Hábitos", salud: "Salud", comidas: "Comidas", personas: "Personas", tiempo: "Tiempo", avisos: "Avisos", datos: "Tus datos", gcal: "Google", correo: "Correo", archivo: "Tu archivo", capturas: "Capturas", ia: "IA", spotify: "Spotify", atajos: "Atajos" }[sub] : TABS.find(([id]) => id === tab)[1];
  const sheetKey = sheet ? sheet.kind : null;
  if (sheetKey !== renderedSheetKind || !sheet) {
    const wasOpen = Boolean($("sheetBg"));
    $("sheetRoot").innerHTML = sheetHtml();
    renderedSheetKind = sheetKey;
    const bg = $("sheetBg");
    if (bg && !wasOpen && !reduceMotion()) { bg.dataset.state = "opening"; requestAnimationFrame(() => requestAnimationFrame(() => { bg.dataset.state = "open"; })); }
    else if (bg) bg.dataset.state = "open";
    fitSheet();
    if (sheet) { const t = $("qText"); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
  }
  if (tab === "manu") {
    const chat = $("chat");
    const count = chat?.children.length ?? 0;
    const grew = count > lastChatLength && lastChatLength > 0;
    if (grew && !reduceMotion()) [...chat.children].slice(lastChatLength - count).forEach((b) => b.classList.add("pop"));
    const entering = lastChatLength === 0 || enter === "tab";
    const mine = chat?.lastElementChild?.classList.contains("me");
    lastChatLength = count;
    // WEB-40: follow the end only when opening the chat, after Manu writes, or
    // while he is already at the end; never while he reads older messages.
    if (entering) { chatPinned = true; scrollChatToEnd(false); }
    else if (grew && mine) { chatPinned = true; scrollChatToEnd(true); }
    else if (chatPinned) scrollChatToEnd(grew);
    else if (grew) chatUnseen = true;
    updateChatDown();
  } else { lastChatLength = 0; updateChatDown(); }
  // WEB-44: redraws must not wipe the backup phrase Manu is typing (never saved).
  if (sub !== "datos") { full.pass = ""; full.plain = false; }
  else { if ($("fullPass")) $("fullPass").value = full.pass; if ($("fullPlain")) $("fullPlain").checked = full.plain; }
  if (focus) $("screen").focus();
}

function go(newTab) {
  tab = newTab;
  sub = null;
  overlay = null;
  sessionStorage.setItem("manuos.tab", tab);
  render({ focus: true, enter: "tab" });
  if (tab !== "manu") scrollTo(0, 0); // the chat opens at its end (WEB-40)
  if (tab === "hoy") refreshWeather();
  syncOnOpen();
}

// Opening Agenda or Hoy shows what is saved at once (WEB-32: Manu did not want
// to wait for Google's check every time). While the Google permission (about
// an hour, no server) is valid it syncs silently in the background; once it
// has expired, «Actualizar» renews it with one tap.
const OPEN_SYNC_MS = 10 * 60000;
function syncOnOpen() {
  if (!["agenda", "hoy"].includes(tab) || !navigator.onLine || gcal.busy) return;
  if (!["calendar", "tasks", "contacts", "gmail"].some((k) => googleOn(k)) || vault.settings.googleAutoOpen === false) return;
  const last = Math.max(Date.parse(vault.settings.gcalSyncedAt ?? "") || 0, gcal.lastRun ?? 0);
  if (Date.now() - last < OPEN_SYNC_MS) return;
  if (validToken(SCOPE.calendar)) syncGoogle({ silent: true }).catch(() => { gcal.busy = false; });
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
  // WEB-47: «pon un presupuesto de 150 para comer», «¿cómo voy de presupuesto?».
  const bc = budgetCommand(clean);
  if (bc) {
    let text;
    if (bc.kind === "set") { vault.settings.budgets = { ...(vault.settings.budgets ?? {}), [bc.cat]: bc.cents }; text = `Hecho: ${CATEGORIES[bc.cat]}, ${euros(bc.cents)} al mes. Te aviso en «Tu día» si vas demasiado rápido.`; }
    else if (bc.kind === "remove") { const b = { ...(vault.settings.budgets ?? {}) }; delete b[bc.cat]; vault.settings.budgets = b; text = `Quitado el presupuesto de ${CATEGORIES[bc.cat]}.`; }
    else { const l = budgetsNow(); text = l.length ? l.map((b) => `${{ ok: "🟢", warn: "🟠", over: "🔴" }[b.status]} ${budgetLine(b)}`).join("\n") : "Aún no tienes presupuestos. Di «pon un presupuesto de 150 para comer» o ponlos en Dinero."; }
    vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text, at });
    persist(); render(); return;
  }
  // WEB-58: «¿qué hago ahora?» — one answer, not a list.
  if (isWhatNowQuestion(clean)) {
    vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text: whatNowText(nowPlan()), at });
    persist(); render(); return;
  }
  // WEB-70: «modo bajón», «vamos suave».
  if (isGentleQuestion(clean)) {
    const { plan } = gentleData();
    const text = plan ? [plan.title, plan.why, ...plan.lines.map((l) => `${l.e} ${l.t}`), "", "Si quieres hablarlo, dime «estoy de bajón» y abro el Refugio."].join("\n")
      : "Ahora no te veo de bajón. Si lo estás, márcalo en Tú → «¿Cómo estás hoy?» (😣 o 😕) y MANU irá suave contigo.";
    vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text, at });
    persist(); render(); return;
  }
  // WEB-63: «cierra la jornada», «he terminado de currar».
  if (isClosingQuestion(clean)) {
    vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text: closingText(dayClosing()), at });
    if (closingDue(today(), { closedDay: vault.settings.closedDay ?? null })) vault.settings.closedDay = localDay();
    persist(); render(); return;
  }
  // WEB-46: «¿cómo va mi día?», «resumen del día».
  if (isBriefingQuestion(normalise(clean))) {
    vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text: briefingText(dayBriefing()), at });
    persist(); render(); return;
  }
  // WEB-41: «¿qué hice ayer?», «¿cuánto gasté el martes?» from the diary.
  if (isDiaryQuestion(clean)) {
    vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text: diaryAnswer(clean), at });
    persist(); render(); return;
  }
  // Profile and questions to the archive (WEB-35).
  if (whoAmI(clean)) {
    vault.chat.push({ from: "me", text: clean, at }, { from: "manu", at, text: vault.profile?.text ? `Esto es lo que sé de ti (lo puedes corregir en Tú → Tu archivo):\n\n${vault.profile.text}` : "Aún no tengo tu perfil. Importa tu exportación de ChatGPT y pulsa «Crear mi perfil» en Tú → Tu archivo." });
    persist(); render(); return;
  }
  const ask = archiveAskCommand(clean);
  if (ask && aiReady() && navigator.onLine) {
    const answer = { from: "manu", text: "Pensando…", at: new Date(Date.now() + 1).toISOString(), ai: true };
    vault.chat.push({ from: "me", text: clean, at }, answer);
    persist(); render();
    askArchive(ask).then((r) => { answer.text = r.sources.length ? `${r.text}\n\nFuentes: ${r.sources.map((x) => `[${x.n}] ${x.title} (${x.date})`).join(" · ")}` : r.text; persist(); render(); });
    return;
  }
  // Archive (WEB-34): «busca en mi archivo …», «qué hablé con ChatGPT de …».
  const aq = archiveCommand(clean);
  if (aq) {
    vault.chat.push({ from: "me", text: clean, at });
    archiveDocs().then((docs) => {
      const r = archiveSearch(docs, aq, { limit: 5 });
      vault.chat.push({ from: "manu", at: new Date().toISOString(), text: !docs.length ? "Tu archivo está vacío. Importa tu exportación de ChatGPT en Tú → Tu archivo." : r.length ? `En tu archivo sobre «${aq}»:\n${r.map((x) => `• ${x.doc.title} (${new Date(x.doc.at).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}): ${x.snippet}`).join("\n")}` : `No encuentro nada sobre «${aq}» en tu archivo.` });
      persist(); render();
    });
    persist(); render(); return;
  }
  // WEB-48: «busca lisboa», «¿dónde apunté lo del alquiler?». Nothing found →
  // the message goes on (to the AI if it is on), never a dead end.
  const fq = findCommand(clean);
  if (fq) {
    const found = findEverywhere(fq, 8);
    if (found.length) {
      vault.chat.push({ from: "me", text: clean, at }, { from: "manu", at, text: `Sobre «${fq}» tengo:
${found.map((x) => `${x.icon} ${x.title} — ${x.detail}`).join("\n")}

También puedes buscar en Tú → 🔎.` });
      persist(); render(); return;
    }
  }
  // Mail (WEB-33): «¿de quién me llegan más correos?», «dame de baja de X».
  const mail = mailCommand(clean);
  if (mail) {
    vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text: mail.text, at, ...(mail.calls ? { calls: mail.calls } : {}) });
    persist(); render(); return;
  }
  // Conversation mode: what MANU does not do by itself (greetings, questions,
  // the day, the weather, anything else) goes to Gemini with the chosen context.
  // Short commands («gasté 3 en café») stay instant and local; longer or
  // compound sentences go to Gemini, which can do several things at once.
  const longCommand = ["expense", "expenses", "reminder", "idea", "alarm", "task"].includes(intent.kind) && clean.split(/\s+/).length > 8;
  if (aiMode().on && aiReady() && navigator.onLine && (["unknown", "greeting", "thanks", "agenda", "weather"].includes(intent.kind) || longCommand)) {
    const check = allowedToSend(clean, sensitiveAllowed() ? FULL_CONTEXT : aiMode().context);
    vault.chat.push({ from: "me", text: clean, at });
    if (!check.ok) {
      const why = check.blocked.includes("secret") ? "lleva datos que nunca envío (claves, tarjetas, teléfonos…)" : check.blocked.includes("crisis") ? "eso se queda en el móvil" : `habla de ${check.blocked.map((k) => ({ money: "dinero", health: "salud", mood: "ánimo" }[k] ?? k)).join(" y ")}, y no me dejaste compartirlo`;
      vault.chat.push({ from: "manu", text: `${localAnswer(intent) ?? reply(intent, variant++)} (No lo envío a Gemini: ${why}. Lo cambias en Tú → IA.)`, at });
      persist(); render(); return;
    }
    converse(clean); return;
  }
  let action = null;
  // WEB-51: «ayer gasté…» goes on that day (at midday, the hour is unknown).
  const onDay = (d) => (d ? new Date(`${d}T12:00:00`).toISOString() : at);
  if (intent.kind === "expense") vault.spending.push(newEntry({ id: uid("s"), cents: intent.cents, merchant: intent.merchant, at: onDay(intent.day) }, vault.settings.categoryRules ?? {}));
  if (intent.kind === "expenses") for (const x of intent.items) vault.spending.push(newEntry({ id: uid("s"), cents: x.cents, merchant: x.merchant, at: onDay(intent.day) }, vault.settings.categoryRules ?? {})); // WEB-52
  if (intent.kind === "income") vault.income = [...(vault.income ?? []), { id: uid("n"), cents: intent.cents, concept: intent.concept ?? "Ingreso", at: onDay(intent.day), source: "MANU" }];
  if (intent.kind === "health") { const t = localDay(); vault.health = [...vault.health.filter((x) => !(x.day === t && x.kind === intent.metric)), { day: t, kind: intent.metric, value: intent.value }]; }
  if (intent.kind === "mood") vault.moods = setMood(vault.moods, localDay(), intent.value);
  if (intent.kind === "idea") vault.inbox.push(capture({ id: uid("c"), text: intent.text, at }));
  if (intent.kind === "task") vault.inbox.push({ ...capture({ id: uid("c"), text: intent.text.slice(0, 140), at }), status: "TASK" });
  if (intent.kind === "alarm") action = { label: `Poner en el iPhone · ${intent.time}`, href: shortcutUrl(SHORTCUT_ALARM, intent.time) };
  if (intent.kind === "reminder") {
    let when = new Date(now);
    if (intent.inMinutes) when = new Date(now.getTime() + intent.inMinutes * 60000); // WEB-50: «en 20 minutos»
    else if (intent.day) { const [y, mo, d] = intent.day.split("-").map(Number); const [h, m] = intent.time.split(":").map(Number); when = new Date(y, mo - 1, d, h, m); } // WEB-51: «el viernes a las 10»
    else {
      if (intent.tomorrow) when.setDate(when.getDate() + 1);
      const [h, m] = intent.time.split(":").map(Number);
      when.setHours(h, m, 0, 0);
      if (!intent.tomorrow && when < now) when.setDate(when.getDate() + 1);
    }
    const r = { id: uid("r"), text: intent.text, at: when.toISOString(), done: false, notified: false };
    vault.reminders.push(r);
    action = { label: "Añadir al iPhone", href: reminderIphoneUrl(r) };
  }
  // WEB-51: the agenda is answered in the chat itself (localAnswer); no more jumping to Agenda while Manu reads.
  if (intent.kind === "unknown" && aiReady() && navigator.onLine) {
    if (!mayGo(clean)) {
      vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text: `${reply(intent, variant++)} (Parece privado: no te ofrezco enviarlo a la IA.)`, at });
      persist(); render(); return;
    }
    const proposal = { id: uid("q"), message: clean, at };
    if (vault.settings.aiAutoSend === true) {
      vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text: "Se lo pregunto a Gemini.", at, proposal: { ...proposal, auto: true } });
      askAi(proposal.id, { auto: true }); return;
    }
    vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text: "Eso no lo sé hacer yo solo. ¿Se lo pregunto a Gemini?", at, proposal });
    persist(); render(); return;
  }
  vault.chat.push({ from: "me", text: clean, at }, { from: "manu", text: localAnswer(intent) ?? reply(intent, variant++), at, ...(action ? { action } : {}) });
  persist();
  render();
}

// The payload is built from the proposal's own timestamp, so what Manu saw is what is sent.
const proposalPayload = (p) => buildActionPayload(p.message, new Date(p.at ?? Date.now()));
function shownPayload(p) {
  const { tools, ...rest } = proposalPayload(p);
  return `${JSON.stringify(rest, null, 1)}\n+ lista fija de ${tools[0].functionDeclarations.length} acciones que puede proponer`;
}

// WEB-63: if Google retired the model chosen when the key was pasted, pick
// the current one and try once more instead of failing.
async function freshModel(call) {
  try { return await call(); } catch (err) {
    if (err.code !== "model") throw err;
    const model = pickModel(await listModels(aiStore.key));
    if (!model || model === aiStore.model) throw err;
    aiStore.model = model;
    return call();
  }
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


// Answers MANU gives from the app's own data (no AI): the day and the weather.
function localAnswer(intent) {
  if (intent.kind === "spendQuery") { // WEB-50
    const [s, e] = monthRange();
    const m = summary(vault.spending, s, e);
    const pace = monthPace(vault.spending, today());
    const vs = pace.diff === null ? "" : pace.diff === 0 ? " Igual que el mes pasado a estas alturas." : ` Un ${Math.abs(pace.diff)} % ${pace.diff < 0 ? "menos" : "más"} que el mes pasado a estas alturas.`;
    if (intent.category) {
      const v = m.byCategory[intent.category] ?? 0;
      const b = budgetsNow().find((x) => x.cat === intent.category);
      return `${catLabel(intent.category)}: ${euros(v)} este mes.${b ? ` ${budgetLine(b)}` : ""}`;
    }
    if (!m.total) return "Este mes aún no has apuntado gastos.";
    const top = Object.entries(m.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${CATEGORIES[c] ?? c} ${euros(v)}`).join(", ");
    return `Llevas ${euros(m.total)} este mes.${vs} Lo que más: ${top}.`;
  }
  if (intent.kind === "agenda" && intent.day === "week") { // WEB-51: «¿qué tengo esta semana?»
    const lines = [];
    for (let i = 0; i < 7; i++) {
      const d = today(); d.setDate(d.getDate() + i); const k = dayKey(d);
      const evs = eventsFor(k), rems = vault.reminders.filter((r) => !r.done && dayKey(new Date(r.at)) === k);
      if (evs.length || rems.length) lines.push(`${i === 0 ? "Hoy" : i === 1 ? "Mañana" : cap(d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" }))}: ${[...evs.map((e) => `${e.time ?? "todo el día"} ${e.title}`), ...rems.map((r) => `🔔 ${hhmm(new Date(r.at))} ${r.text}`)].slice(0, 4).join(" · ")}`);
    }
    return lines.length ? lines.join("\n") : "Esta semana no tienes nada en la agenda ni recordatorios. 🌿";
  }
  if (intent.kind === "agenda") {
    const day = intent.day === "tomorrow" ? tomorrowKey() : intent.day === "today" ? localDay() : intent.day;
    const word = intent.day === "tomorrow" ? "Mañana" : intent.day === "today" ? "Hoy" : cap(new Date(`${intent.day}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }));
    const evs = eventsFor(day);
    const rems = vault.reminders.filter((r) => !r.done && dayKey(new Date(r.at)) === day);
    if (!evs.length && !rems.length) return vault.calendar || googleOn("calendar") ? `${word} no tienes nada en el calendario ni recordatorios. 🌿` : `${word} no tienes recordatorios. Conecta Google en Tú para ver también tu calendario.`;
    const list = [...evs.map((e) => `${e.time ?? "todo el día"} ${e.title}`), ...rems.map((r) => `🔔 ${hhmm(new Date(r.at))} ${r.text}`)];
    return `${word}: ${list.slice(0, 6).join(" · ")}${list.length > 6 ? ` y ${list.length - 6} más` : ""}.`;
  }
  if (intent.kind === "weather") {
    const w = currentWeather();
    if (!w?.data?.now) return "Ahora no tengo el tiempo cargado. Abre Hoy con conexión y te lo digo.";
    const f = w.data;
    return `${w.city.name}: ${f.now.text.toLowerCase()}, ${f.now.temp}° (${f.today.min}°–${f.today.max}°). ${advice(f)}`;
  }
  return null;
}

// ---------- Conversation mode (WEB-27) ----------
function aiModeCard() {
  const m = aiMode();
  return `<section class="card"><h2>💬 Modo conversación</h2>
    <p class="muted small">MANU conversa con Gemini y recuerda lo que hablas. Lo que escribes y lo que marques aquí va a Google.</p>
    ${m.on ? `<div class="row"><span class="grow">Activado</span><button class="btn ghost small-btn" data-act="ai-mode" data-v="off">Desactivar</button></div>` : `<div class="btns"><button class="btn" data-act="ai-mode" data-v="full">Activar con todo</button><button class="btn ghost" data-act="ai-mode" data-v="basic">Solo lo básico</button></div><p class="muted small">«Con todo» incluye también dinero, salud, ánimo y personas. «Solo lo básico»: agenda, tareas, tiempo y hábitos.</p>`}
    ${m.on ? `<p class="small"><b>Qué sabe MANU</b></p>${CONTEXT_CATEGORIES.map((c) => `<div class="row"><div class="grow"><div>${c.sensitive ? "🔒 " : ""}${esc(c.label)}</div>${c.sensitive ? '<div class="muted small">Dato sensible: solo si tú lo marcas.</div>' : c.note ? `<div class="muted small">${esc(c.note)}</div>` : ""}</div><button class="check" data-act="ai-ctx" data-k="${c.key}" aria-pressed="${Boolean(m.context[c.key])}" aria-label="${esc(c.label)}">${I.check}</button></div>`).join("")}
      <div class="row"><div class="grow"><div>Que haga las cosas sin preguntar</div><div class="muted small">Crear tareas, ideas y recordatorios, completar tareas. Siempre con «Deshacer». Gastos y cambios de la app siguen pidiendo tu toque.</div></div><button class="check" data-act="ai-auto-actions" aria-pressed="${m.autoActions}" aria-label="Hacer sin preguntar">${I.check}</button></div>
      <p class="muted small">Nunca se envían contraseñas, tarjetas, IBAN, teléfonos ni el Refugio.</p>` : ""}
  </section>`;
}

const aiMode = () => {
  const m = { on: false, context: BASIC_CONTEXT, autoActions: false, ...(vault.settings.aiMode ?? {}) };
  // «Con todo» chosen before Gmail existed (WEB-33) also includes the mail summary.
  if (m.context.mail === undefined && m.context.money && m.context.people) m.context = { ...m.context, mail: true };
  if (m.context.profile === undefined && m.context.money && m.context.people) m.context = { ...m.context, profile: true, archive: true };
  return m;
};
function lifeSnapshot() {
  const now = today();
  const events = {};
  for (let d = 0; d < 2; d++) { const x = new Date(now); x.setDate(x.getDate() + d); const k = dayKey(x); events[k] = eventsFor(k).filter((e) => !e.multi || e.first || d === 0); }
  const w = currentWeather()?.data;
  const [s, e] = monthRange();
  const month = summary(vault.spending, s, e);
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const st = monthStats(vault.spending, vault.income ?? [], key, now);
  const hs = healthSummary(vault.health);
  const mood = vault.moods.find((m) => m.day === localDay())?.value;
  return {
    events, reminders: vault.reminders, tasks: tasks(vault.inbox).filter((t) => !t.done), ideas: ideas(vault.inbox),
    weather: w ? { city: activeCity().name, text: w.now.text, temp: w.now.temp, min: w.today.min, max: w.today.max, rain: w.today.rain ?? null } : null,
    habits: vault.habits.map((h) => ({ name: h.name, doneToday: (h.done ?? []).includes(localDay()) })),
    money: { spent: st.spent, earned: st.earned, payroll: st.payroll.cents, balance: vault.settings.balance?.cents ?? null, byCategory: Object.entries(month.byCategory).sort((a, b) => b[1] - a[1]) },
    health: hs.sleep !== null || hs.steps !== null ? { sleep: hs.sleep !== null ? dec(hs.sleep) : null, steps: hs.steps !== null ? Math.round(hs.steps) : null } : null,
    mood: mood ? MOODS[mood - 1].label : null,
    birthdays: upcomingBirthdays(vault.people, now, 14).map((b) => ({ name: b.person.name, days: b.days })),
    mail: googleOn("gmail") ? vault.mail ?? null : null,
    profile: vault.profile?.text ?? null,
  };
}

async function converse(message) {
  const mode = aiMode();
  const history = vault.chat.slice(0, -1).filter((b) => !b.proposal);
  let contextText = buildContext(lifeSnapshot(), mode.context, today());
  // WEB-35: what MANU remembers from Manu's archive, only if he shares it.
  if (mode.context.archive) {
    const mem = memoryContext(await archiveDocs(), message, { permit: mayGo }); if (mem) contextText += `\n${mem}`;
    const d = dayFromText(message, today()); // WEB-41: «el martes…» → that day's diary
    if (d) { const lines = dayLines(vault, d, { calendar: vault.calendar?.days ?? null }).filter(mayGo); if (lines.length) contextText += `\nDIARIO del ${dayTitle(d)}: ${lines.join(" ")}`; }
  }
  const payload = buildConversationPayload({ message, history, contextText, context: sensitiveAllowed() ? FULL_CONTEXT : mode.context, now: today(), autoActions: mode.autoActions });
  const answer = { from: "manu", text: "Pensando…", at: new Date(Date.now() + 1).toISOString(), ai: true, sentContext: Object.keys(mode.context).filter((k) => mode.context[k]) };
  vault.chat.push(answer);
  persist(); render();
  try {
    const { text, calls } = await freshModel(() => askWithActions({ key: aiStore.key, model: aiStore.model, payload, confirmed: true, permit: (t) => allowedToSend(t, sensitiveAllowed() ? FULL_CONTEXT : mode.context).ok }));
    answer.text = text || (calls.length ? "Hecho:" : "…");
    if (calls.length) {
      answer.calls = calls.map((c) => ({ ...c, state: null }));
      if (mode.autoActions) for (const c of answer.calls) if (AUTO_SAFE.has(c.name) && c.name !== "ir_a") { runCall(c, { quiet: true }); c.auto = true; }
    }
  } catch (err) {
    answer.ai = false;
    answer.text = aiErrorText(err);
  }
  persist(); if (tab === "manu") render();
}

// Undo an action MANU did by itself.
function undoCall(c) {
  if (!c?.undo) return;
  const u = c.undo;
  if (u.list === "inbox" && u.completed) vault.inbox = vault.inbox.map((i) => (i.id === u.id ? { ...i, done: false } : i));
  else if (u.list) vault[u.list] = (vault[u.list] ?? []).filter((x) => x.id !== u.id);
  c.state = "undone"; delete c.undo;
  persist(); render(); toast("Deshecho");
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
    const { text, calls } = await freshModel(() => askWithActions({ key: aiStore.key, model: aiStore.model, payload: proposalPayload(bubble.proposal), confirmed: consent }));
    answer.text = text || (calls.length === 1 ? "Te propongo esto:" : "Te propongo esto (confirma lo que quieras):");
    if (calls.length) answer.calls = calls.map((c) => ({ ...c, state: null }));
  } catch (err) {
    answer.ai = false;
    answer.text = err.code === "sensitive" ? "Eso parece privado: no lo envío." : aiErrorText(err);
  }
  persist();
  if (tab === "manu") render();
}

const SCREENS = { hoy: ["hoy"], agenda: ["agenda"], dinero: ["dinero"], tu: ["tu"], tiempo: ["hoy", null, "weather"], google: ["tu", "gcal"], correo: ["tu", "correo"], ia: ["tu", "ia"], atajos: ["tu", "atajos"], habitos: ["tu", "habitos"], salud: ["tu", "salud"], comidas: ["tu", "comidas"], personas: ["tu", "personas"] };
const SCREEN_NAMES = { hoy: "Hoy", agenda: "Agenda", dinero: "Dinero", tu: "Tú", tiempo: "El tiempo", google: "Google", correo: "Correo", ia: "IA", atajos: "Atajos", habitos: "Hábitos", salud: "Salud", comidas: "Comidas", personas: "Personas" };

function callLabel(c) {
  switch (c.name) {
    case "anadir_tarea": return `Añadir tarea «${c.texto}»`;
    case "completar_tarea": return `Completar «${c.texto}»`;
    case "anadir_idea": return `Guardar idea «${c.texto}»`;
    case "apuntar_gasto": return `Apuntar gasto de ${euros(c.cents)}${c.concepto ? ` · ${c.concepto}` : ""}`;
    case "crear_recordatorio": { const d = new Date(c.at); return `Recordatorio «${c.texto}» · ${d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })} ${hhmm(d)}`; }
    case "ir_a": return `Ir a ${SCREEN_NAMES[c.pantalla]}`;
    case "importar_extracto": return "Elegir el extracto del banco";
    case "sugerir_mejora": return `Mejora: ${c.titulo}`;
    case "correo_baja": return `Darte de baja de ${senderName(findSender(vault.mail, c.remitente)?.email ?? c.remitente)}`;
    case "correo_archivar": return `Archivar los correos de ${senderName(findSender(vault.mail, c.remitente)?.email ?? c.remitente)}`;
    case "correo_papelera": return `Papelera: correos de ${senderName(findSender(vault.mail, c.remitente)?.email ?? c.remitente)}`;
    case "correo_etiquetar": return `Etiquetar «${c.etiqueta}» los de ${senderName(findSender(vault.mail, c.remitente)?.email ?? c.remitente)}`;
    default: return c.name;
  }
}

function callCard(b, c, i) {
  const at = esc(b.at), n = i;
  if (c.name === "sugerir_mejora") {
    if (c.sensitive) return `<div class="ai-call"><b>${esc(callLabel(c))}</b><p class="muted small">Parece que incluye datos privados: no la preparo para GitHub. Díselo sin datos personales.</p></div>`;
    return `<div class="ai-call"><b>${esc(callLabel(c))}</b><p class="small">${esc(c.descripcion)}</p>${c.state ? `<p class="muted small">${c.state === "done" ? "Abierta en GitHub." : "Descartada."}</p>` : `<p class="muted small">Se abre GitHub con la petición escrita; la envías tú. El repositorio es público.</p><div class="btns"><a class="btn" href="${esc(issueUrl(c, APP_VERSION))}" target="_blank" rel="noopener" data-act="ai-issue" data-at="${at}" data-n="${n}">Abrir en GitHub</a><button class="btn ghost" data-act="ai-skip" data-at="${at}" data-n="${n}">No</button></div>`}</div>`;
  }
  if (c.auto) return `<div class="ai-call${c.state === "done" ? " done" : ""}"><b>${c.state === "done" ? "✓ " : ""}${esc(callLabel(c))}</b>${c.state === "done" && c.undo ? `<div class="btns"><button class="link small" data-act="ai-undo" data-at="${at}" data-n="${n}">Deshacer</button></div>` : c.state === "undone" ? '<p class="muted small">Deshecho.</p>' : c.state === "missing" ? '<p class="muted small">No encontré esa tarea.</p>' : ""}</div>`;
  return `<div class="ai-call"><b>${esc(callLabel(c))}</b>${c.state ? `<p class="muted small">${c.state === "done" ? "Hecho." : c.state === "missing" ? (c.name.startsWith("correo_") ? "No encontré ese remitente." : "No encontré esa tarea.") : c.state === "working" ? "Haciéndolo…" : "Descartado."}</p>${c.result ? `<p class="small">${esc(c.result)}</p>` : ""}${c.mailUndo ? `<div class="btns"><button class="link small" data-act="mail-undo-call" data-at="${at}" data-n="${n}">Deshacer</button></div>` : ""}` : `<div class="btns"><button class="btn" data-act="ai-do" data-at="${at}" data-n="${n}">${c.name === "ir_a" || c.name === "importar_extracto" ? "Ir" : "Hacer"}</button><button class="btn ghost" data-act="ai-skip" data-at="${at}" data-n="${n}">No</button></div>`}</div>`;
}

const findCall = (el) => { const b = vault.chat.find((x) => x.at === el.dataset.at && x.calls); return b ? b.calls[Number(el.dataset.n)] : null; };

// Runs one action Gemini proposed, only after Manu's tap. Everything stays local.
const shared = (c) => ({ ...(c.imageId ? { imageId: c.imageId } : {}), ...(c.url ? { url: c.url } : {}) });

// Images are loaded from IndexedDB after each render (kept in a small cache).
const imageCache = new Map();
function hydrateImages(root) {
  root?.querySelectorAll("img[data-img]").forEach(async (img) => {
    const id = img.dataset.img;
    if (!id) return;
    try {
      if (!imageCache.has(id)) imageCache.set(id, await getImage(id));
      const src = imageCache.get(id);
      if (src && /^data:image\//.test(src)) img.src = src; else img.closest(".thumb")?.remove();
    } catch {}
  });
}

// Screenshot → small JPEG data URL (max 1280 px), read without blob: URLs (CSP).
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No he podido leer la imagen"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Ese formato de imagen no se puede abrir aquí"));
      img.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.78));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// «✨ Que MANU lo lea»: screenshot or TikTok/YouTube link → Gemini proposes
// actions. Only on Manu's tap (the button says it goes to Google); never
// with «Enviar sin preguntar».
async function shareToAi(from = null) {
  if (!aiReady()) return;
  const src = from ?? (sheet ? { note: ($("qText")?.value ?? "").trim(), link: sheet.link && !sheet.image ? sheet.link : null, image: sheet.image ?? null } : null);
  if (!src) return;
  const { note, link, image } = src;
  const at = new Date().toISOString();
  let imageId = null;
  if (image) { imageId = uid("img"); try { await putImage(imageId, image); imageCache.set(imageId, image); } catch { imageId = null; } }
  sheet = null; tab = "manu"; sub = null; overlay = null;
  vault.chat.push({ from: "me", text: image ? (note && !link ? note : "📷 Captura") : `🔗 ${PROVIDER_NAME[link.provider]}`, at, ...(imageId ? { imageId } : {}), ...(link ? { url: link.url } : {}) });
  const answer = { from: "manu", text: "Pensando…", at: new Date(Date.now() + 1).toISOString(), ai: true };
  vault.chat.push(answer);
  persist(); render({ focus: true, enter: "tab" });
  try {
    let payload;
    if (image) payload = buildImagePayload({ base64: image.split(",")[1], mime: "image/jpeg", note }, today());
    else {
      const info = await linkInfo(link);
      if (!info) throw Object.assign(new Error("sin texto"), { code: "noinfo" });
      payload = buildLinkPayload({ provider: PROVIDER_NAME[link.provider], url: link.url, title: info.title, author: info.author }, today());
    }
    const { text, calls } = await askWithActions({ key: aiStore.key, model: aiStore.model, payload, confirmed: true });
    answer.text = text || (calls.length ? "Te propongo esto:" : "No veo nada que apuntar.");
    if (calls.length) answer.calls = calls.map((c) => ({ ...c, state: null, ...(imageId ? { imageId } : {}), ...(link ? { url: link.url } : {}) }));
  } catch (err) {
    answer.ai = false;
    answer.text = err.code === "noinfo" ? "Ese vídeo no trae texto que pueda leer. Haz una captura con el texto visible y añádela con 📎."
      : err.code === "quota" ? "Hoy ya no queda IA gratuita. Sigo sin IA." : err.code === "key" ? "La clave de Gemini no funciona. Revísala en Tú → IA."
      : err.code === "sensitive" ? "Eso parece privado: no lo envío." : `No he podido leerlo: ${err.message}`;
  }
  persist(); if (tab === "manu") render();
}

// WEB-59: keep the text (image deleted) or drop the capture.
function finishCapture(id, how, batch = false) {
  const c = vault.captures.find((x) => x.id === id);
  if (!c) return;
  if (c.imageId) { deleteImage(c.imageId).catch(() => {}); imageCache.delete(c.imageId); }
  vault.captures = how === "keep" ? keepCapture(vault.captures, id) : dropCapture(vault.captures, id);
  if (!batch) { persist(); render(); }
}

// WEB-59: read the pending captures with Gemini, a few at a time. Only on
// Manu's tap; the button says the images go to Google.
async function readCaptures() {
  if (caps.reading || !aiReady()) return;
  const pend = pendingCaptures(vault.captures);
  let done = 0, failed = null;
  for (let i = 0; i < pend.length; i += BATCH) {
    const chunk = pend.slice(i, i + BATCH);
    caps.reading = `Leyendo ${Math.min(i + BATCH, pend.length)} de ${pend.length}…`; render();
    try {
      const items = [];
      for (const c of chunk) { const d = await getImage(c.imageId); if (d && /^data:image\/jpeg;base64,/.test(d)) items.push({ id: c.id, base64: d.split(",")[1], at: c.at }); }
      if (!items.length) continue;
      const { text } = await askWithActions({ key: aiStore.key, model: aiStore.model, payload: buildCapturesPayload(items, today()), confirmed: true });
      const readings = parseCapturesReply(text, items.map((x) => x.id));
      vault.captures = applyReading(vault.captures, readings);
      done += Object.keys(readings).length;
      persist();
    } catch (err) {
      failed = err.code === "quota" ? "Hoy ya no queda IA gratuita; sigue mañana." : err.code === "key" ? "La clave de Gemini no funciona. Revísala en Tú → IA." : `No he podido leerlas: ${err.message}`;
      break;
    }
  }
  caps.reading = null; persist(); render();
  toast(failed ?? (done ? `Leídas ${done}. Revísalas por tema.` : "No he sacado nada de esas capturas."));
}

function runCall(c, { quiet = false } = {}) {
  if (!c || c.state) return;
  c.state = "done";
  const at = new Date().toISOString();
  const say = (t) => { if (!quiet) toast(t); };
  switch (c.name) {
    case "anadir_tarea": { const id = uid("c"); vault.inbox.push({ ...capture({ id, text: c.texto, at }), status: "TASK", ...shared(c) }); c.undo = { list: "inbox", id }; say("Tarea añadida"); break; }
    case "anadir_idea": { const id = uid("c"); vault.inbox.push({ ...capture({ id, text: c.texto, at }), status: "IDEA", ...shared(c) }); c.undo = { list: "inbox", id }; say("Idea guardada"); break; }
    case "completar_tarea": {
      const q = normalise(c.texto);
      const t = tasks(vault.inbox).find((x) => !x.done && normalise(x.text).includes(q)) ?? tasks(vault.inbox).find((x) => !x.done && q.includes(normalise(x.text)));
      if (!t) { c.state = "missing"; say("No encuentro esa tarea"); break; }
      vault.inbox = vault.inbox.map((i) => (i.id === t.id ? { ...i, done: true, doneAt: new Date().toISOString() } : i)); c.undo = { list: "inbox", id: t.id, completed: true }; c.texto = t.text; say("Tarea completada"); break;
    }
    case "apuntar_gasto": vault.spending.push({ ...newEntry({ id: uid("s"), cents: c.cents, merchant: c.concepto, at }, vault.settings.categoryRules ?? {}), ...shared(c) }); toast("Gasto apuntado"); break;
    case "crear_recordatorio": { const id = uid("r"); vault.reminders.push({ id, text: c.texto, at: c.at, done: false, notified: false, ...shared(c) }); c.undo = { list: "reminders", id }; say("Recordatorio creado"); break; }
    case "ir_a": case "importar_extracto": {
      persist();
      const [t, s2, ov] = c.name === "ir_a" ? SCREENS[c.pantalla] : ["dinero"];
      go(t);
      if (s2 || ov) { sub = s2 ?? null; overlay = ov ?? null; render({ focus: true, enter: "page" }); if (ov) refreshWeather(); }
      // Opening the picker must happen inside this tap; Manu still chooses the file.
      if (c.name === "importar_extracto") $("bankFile")?.click();
      return;
    }
    case "correo_baja": case "correo_archivar": case "correo_papelera": case "correo_etiquetar": {
      const s = findSender(vault.mail, c.remitente);
      if (!s) { c.state = "missing"; break; }
      const kind = { correo_baja: "unsub", correo_archivar: "archive", correo_papelera: "trash", correo_etiquetar: "label" }[c.name];
      markMailSeen(`sender:${s.email}`);
      c.state = "working";
      mailDo(kind, s.email, c.etiqueta ?? "").then((r) => { c.state = "done"; c.result = r?.text ?? null; if (r?.undo) c.mailUndo = r.undo; persist(); render(); });
      break;
    }
    default: c.state = null; return;
  }
  persist(); render();
}

// ---------- Tu archivo (WEB-34) ----------
const caps = { busy: false, reading: null };
const archive = { docs: null, stats: null, results: null, query: "", busy: false, answer: null, asking: false, profiling: false, editProfile: false };

// «Pregúntale a tu archivo» (WEB-35): search here, send only the fragments.
async function askArchive(q) {
  const docs = await archiveDocs();
  const ex = findExcerpts(docs, q, { permit: mayGo });
  if (!ex.length) return { q, text: "No encuentro nada sobre eso en tu archivo.", sources: [] };
  try {
    const r = await askWithActions({ key: aiStore.key, model: aiStore.model, payload: askPayload(q, ex, today()), confirmed: true });
    return { q, text: r.text ?? "Gemini no ha respondido.", sources: ex.map(({ n, title, date }) => ({ n, title, date })) };
  } catch (err) {
    return { q, text: err.code === "quota" ? "Hoy ya no queda IA gratuita." : err.code === "key" ? "La clave de Gemini no funciona. Revísala en Tú → IA." : err.code === "sensitive" ? "Algo parece privado: no lo envío." : `No he podido preguntar: ${err.message}`, sources: [] };
  }
}

async function makeProfile() {
  if (archive.profiling || !aiReady()) return;
  archive.profiling = true; render();
  try {
    const docs = await archiveDocs();
    const digest = profileDigest(docs, { permit: mayGo });
    if (!digest.used) throw new Error("tu archivo está vacío");
    const r = await askWithActions({ key: aiStore.key, model: aiStore.model, payload: profilePayload(digest, today()), confirmed: true });
    if (!r.text) throw new Error("Gemini no ha respondido");
    vault.profile = { text: r.text.slice(0, 12000), at: new Date().toISOString(), basedOn: digest.used };
    persist(); toast("Tu perfil está listo");
  } catch (err) { toast(err.code === "quota" ? "Hoy ya no queda IA gratuita" : `No he podido crear tu perfil: ${err.message}`); }
  archive.profiling = false; render();
}
async function archiveDocs() {
  if (!archive.docs) { try { archive.docs = await allDocs(); } catch { archive.docs = []; } archive.stats = { ...archiveStats(archive.docs.filter((x) => x.source !== "diario")), manu: archive.docs.filter((x) => x.source === "manu").length, diary: archive.docs.filter((x) => x.source === "diario").length }; }
  return archive.docs;
}
archiveDocs().then(() => { if (archive.stats?.count && tab === "tu") render(); });

// WEB-37: each conversation starts empty; the previous one goes to «Tu
// archivo» (only on this device), where MANU can recall it later.
function startNewChat() {
  const doc = chatToDoc(vault.chat);
  vault.chat = [];
  lastChatLength = 0;
  persist(); render();
  if (doc) putDocs([doc]).then(() => { archive.docs = null; return archiveDocs(); }).catch(() => {});
}
function newChatIfStale() { if (vault && staleChat(vault.chat) && !refuge) startNewChat(); }
// WEB-41: «Tu diario», one archive document per day, rebuilt from the vault
// when MANU opens (same ids, so it only updates). Only on this device.
async function refreshDiary() {
  if (!vault) return;
  try { await putDocs(diaryDocs(vault, { calendar: vault.calendar?.days ?? null })); archive.docs = null; await archiveDocs(); } catch { /* IndexedDB unavailable: the diary simply waits */ }
}
function diaryAnswer(text) {
  const day = dayFromText(text, today());
  const lines = day ? dayLines(vault, day, { calendar: vault.calendar?.days ?? null }) : [];
  return lines.length ? `El ${dayTitle(day)}:\n${lines.map((l) => `• ${l}`).join("\n")}` : `El ${dayTitle(day)} no tengo nada apuntado.`;
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { newChatIfStale(); refreshDiary(); } });
setTimeout(() => { newChatIfStale(); refreshDiary(); }, 0);

// «Pregúntale a mi archivo …», «según mi archivo …».
function archiveAskCommand(text) {
  const m = normalise(text).match(/^(?:preguntale a mi archivo|pregunta a mi archivo|segun mi archivo|en mis conversaciones con chatgpt)[,:]?\s+(.+)$/);
  return m ? text.slice(text.length - m[1].length).trim() : null;
}
const whoAmI = (text) => /^(?:que sabes de mi|quien soy|cual es mi perfil|como soy)\??$/.test(normalise(text).replace(/[¿?!.]/g, "").trim());

// «¿Qué hablé con ChatGPT de Lisboa?», «busca en mi archivo lentejas».
function archiveCommand(text) {
  const t = normalise(text);
  const m = t.match(/(?:busca(?:me)? en (?:mi|el) archivo|que (?:hable|he hablado|le dije|le conte) (?:con|a) chatgpt (?:de|sobre)|que (?:hablamos|te dije|te conte|hable contigo) (?:de|sobre)|busca en chatgpt|en mi archivo)\s+(.+)$/);
  return m ? m[1].trim() : null;
}

// ---------- Buzón de Atajos (WEB-43) ----------
function buzonCard() {
  const last = vault.settings.lastBuzon;
  return `<section class="card"><h2>📬 Buzón de Atajos</h2>
    <p class="muted small">Apple Pay, Salud y ubicación no se pueden leer desde una web. Los atajos «MANU Apple Pay», «MANU Salud» y «MANU Lugar» los apuntan en <b>iCloud Drive → Atajos → MANU-buzon.txt</b> y aquí lo importas con un toque. Lo repetido se salta, así que no hace falta borrar el archivo. Todo se queda en tu iPhone.</p>
    ${last ? `<p class="small">Última importación: ${esc(new Date(last.at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))} · ${esc(last.text)}</p>` : ""}
    <label class="btn block" for="buzonFile" role="button" tabindex="0">Importar del buzón</label><input id="buzonFile" type="file" accept=".txt,text/plain" class="sr"></section>`;
}
function importBuzon(text) {
  const r = applyBuzon(text, vault, { now: new Date(), newEntry: (e) => newEntry(e, vault.settings.categoryRules ?? {}) });
  vault.spending.push(...r.spending);
  // WEB-78: notes dictated to Siri («MANU Dictado»). A gasto, tarea or idea is
  // filed like in the chat (with the time it was dictated); anything else,
  // reminders included, waits in «Por clasificar» so nothing is guessed wrong.
  for (const n of r.notes) {
    const p = parse(n.text, new Date(n.at));
    if (p.kind === "expense") vault.spending.push({ ...newEntry({ id: n.id, cents: p.cents, merchant: p.merchant, at: n.at }, vault.settings.categoryRules ?? {}), source: "SIRI" });
    else if (p.kind === "task") vault.inbox.push({ ...capture({ id: n.id, text: p.text.slice(0, 140), at: n.at }), status: "TASK" });
    else vault.inbox.push(capture({ id: n.id, text: (p.kind === "idea" ? p.text : n.text).slice(0, 280), at: n.at }));
  }
  vault.health = r.health;
  vault.places = r.places;
  vault.settings.buzonSeen = r.seenAll;
  const summary = buzonSummary(r);
  vault.settings.lastBuzon = { at: new Date().toISOString(), text: summary };
  const done = { ...(vault.settings.shortcutsDone ?? {}) };
  if (r.counts.expense) done.applepay = true;
  if (r.counts.steps || r.counts.sleep || r.counts.weight) done.salud = true;
  if (r.counts.place) done.lugar = true;
  if (r.counts.note) done.dictado = true;
  vault.settings.shortcutsDone = done;
  persist(); render(); refreshDiary();
  toast(`Buzón: ${summary}`);
}

// ---------- Personas (WEB-38) ----------
// WEB-62: the birthday also goes into that Google contact (asks for the
// contacts write permission the first time).
async function saveBirthdayToGoogle(id) {
  const p = vault.people.find((x) => x.id === id);
  if (!p?.birthday || !p.googleId) return;
  try {
    const token = await googleToken(SCOPE.contactsWrite);
    await setContactBirthday(token, p.googleId, p.birthday);
    vault.contacts = (vault.contacts ?? []).map((c) => (c.googleId === p.googleId ? { ...c, birthday: p.birthday } : c));
    persist(); render(); toast(`Cumpleaños de ${p.name} guardado en Google Contactos`);
  } catch (err) { toast(`No he podido guardarlo en Google Contactos: ${err.message}`); }
}
async function addBirthdayToCalendar(id) {
  const p = vault.people.find((x) => x.id === id);
  if (!p?.birthday || p.calendarEventId) return;
  try {
    const token = await googleToken(SCOPE.calendar);
    const ev = await createEvent(token, birthdayEventBody(p, today()));
    vault.people = vault.people.map((x) => (x.id === id ? { ...x, calendarEventId: ev.id } : x));
    persist(); render(); toast(`Cumpleaños de ${p.name} en tu calendario, cada año`);
  } catch (err) { toast(`No he podido ponerlo en Google Calendar: ${err.message}`); }
}
// Choosing a contact fills in what Google knows (birthday, phone) if still empty.
// WEB-61: typing a name lists every matching contact to pick from.
let pickedContact = null;
function renderContactMatches(q) {
  const box = $("pMatches"); if (!box) return;
  const list = searchContacts(vault.contacts ?? [], q, vault.people);
  box.innerHTML = list.length ? list.map((c) => `<button type="button" class="contact-row" data-act="pick-contact" data-gid="${esc(c.googleId)}"><span class="ico purple" aria-hidden="true">${esc(c.name.slice(0, 1).toUpperCase())}</span><span class="grow"><span>${esc(c.name)}</span><br><span class="muted small">${c.added ? "Ya está en Personas" : c.birthday ? `Cumple el ${Number(c.birthday.slice(3))}/${Number(c.birthday.slice(0, 2))}` : "Sin cumpleaños en Google"}</span></span></button>`).join("") : (q.trim().length >= 2 && vault.contacts?.length ? '<p class="muted small">Ningún contacto con ese nombre. Se guardará tal cual lo escribas.</p>' : "");
}
function fillFromContact(c) {
  const gRow = $("pGoogleRow"); if (gRow) gRow.hidden = Boolean(c.birthday); // WEB-62: only when Google lacks it
  if (c.birthday && !$("pBDay").value && !$("pBMonth").value) { const [m, d] = c.birthday.split("-"); $("pBMonth").value = m; $("pBDay").value = d; }
  if (c.phone && !$("pPhone").value) $("pPhone").value = c.phone;
  const cal = $("pCal"), note = $("pCalNote");
  if (cal && c.birthday) { cal.checked = false; if (note) note.textContent = "Ya tiene el cumpleaños en Google Contactos; Google Calendar suele mostrarlo en su calendario «Cumpleaños». Márcalo si quieres además un evento propio."; }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest('[data-act="pick-contact"]'); if (!b) return;
  const c = vault.contacts?.find((x) => x.googleId === b.dataset.gid); if (!c) return;
  pickedContact = c;
  $("pName").value = c.name; $("pMatches").innerHTML = "";
  fillFromContact(c);
  (c.birthday ? $("pNotes") : $("pBDay"))?.focus();
});
document.addEventListener("input", (e) => {
  if (e.target.id === "fullPass") { full.pass = e.target.value; return; }
  // WEB-80: the split card. Searching redraws only the matches (the keyboard stays).
  if (e.target.id === "splitQ") {
    const entryId = splitDraft?.entryId ?? toAsk(vault.spending, today())[0]?.id;
    if (!entryId) return;
    splitDraft = splitDraft?.entryId ? splitDraft : { entryId, people: [], mode: null, q: "" };
    splitDraft.q = e.target.value;
    const pos = e.target.selectionStart; render(); const n = $("splitQ"); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
    return;
  }
  if (e.target.dataset?.splitWhat && splitDraft) { const p = splitDraft.people.find((x) => x.key === e.target.dataset.splitWhat); if (p) p.what = e.target.value.slice(0, 60); return; }
  if (e.target.dataset?.splitCents && splitDraft) { const p = splitDraft.people.find((x) => x.key === e.target.dataset.splitCents); if (p) p.cents = toCents(e.target.value) ?? 0; return; }
  if (e.target.id !== "pName") return;
  if (pickedContact && pickedContact.name !== e.target.value) pickedContact = null;
  renderContactMatches(e.target.value);
  const c = vault.contacts?.find((x) => x.name.toLowerCase() === e.target.value.trim().toLowerCase());
  if (!c) return;
  if (c.birthday && !$("pBDay").value && !$("pBMonth").value) { const [m, d] = c.birthday.split("-"); $("pBMonth").value = m; $("pBDay").value = d; }
  if (c.phone && !$("pPhone").value) $("pPhone").value = c.phone;
  const cal = $("pCal"), note = $("pCalNote");
  if (cal && c.birthday) { cal.checked = false; if (note) note.textContent = "Ya tiene el cumpleaños en Google Contactos; Google Calendar suele mostrarlo en su calendario «Cumpleaños». Márcalo si quieres además un evento propio."; }
});

// ---------- Gmail (WEB-33) ----------
// WEB-40: when Gmail fails, the exact reason and what Manu has to do.
const GMAIL_FIX = {
  "api-disabled": ["Abre console.cloud.google.com/apis/library/gmail.googleapis.com", "Arriba, elige el proyecto de MANU (el mismo del Calendar)", "Pulsa «Habilitar» y espera un minuto", "Vuelve aquí y pulsa «Ya está, reintentar»"],
  scope: ["Pulsa «Volver a autorizar»", "En la ventana de Google, marca la casilla de Gmail («leer, redactar y enviar…»)", "Si no aparece, en Google Cloud → Google Auth Platform → Acceso a datos, añade el permiso …/auth/gmail.modify y vuelve a autorizar"],
  "no-scope": ["Pulsa «Volver a autorizar»", "En la ventana de Google, marca la casilla de Gmail", "Si no aparece, en Google Cloud → Google Auth Platform → Acceso a datos, añade el permiso …/auth/gmail.modify"],
  denied: ["En Google Cloud → Google Auth Platform → Público: el estado debe ser «Prueba» y tu cuenta debe estar en «Usuarios de prueba»", "En «Acceso a datos», añade el permiso …/auth/gmail.modify", "Vuelve aquí y pulsa «Volver a autorizar». Si Google avisa de «app no verificada», entra en «Configuración avanzada» → «Ir a MANU»"],
  auth: ["Pulsa «Volver a autorizar»", "En la ventana de Google, elige tu cuenta y acepta"],
  rate: ["Espera un minuto y pulsa «Reintentar»"],
  network: ["Comprueba que tienes internet (wifi o datos)", "Pulsa «Reintentar»"],
};
// WEB-45: the concrete action for each error.
const GMAIL_ACTION = {
  "api-disabled": '<a class="btn" href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noopener">Activar la API de Gmail</a><button class="btn ghost" data-act="mail-connect">Ya está, reintentar</button>',
  network: '<button class="btn" data-act="mail-connect">Reintentar</button>',
  rate: '<button class="btn" data-act="mail-connect">Reintentar</button>',
};
function gmailErrorCard() {
  const e = vault.settings.googleErrors?.gmail;
  if (!e) return "";
  const steps = GMAIL_FIX[e.code] ?? ["Pulsa «Volver a autorizar»", "Si sigue fallando, mándale a Claude una captura de este mensaje"];
  const action = GMAIL_ACTION[e.code] ?? '<button class="btn" data-act="mail-reconnect">Volver a autorizar</button>';
  const d = e.detail;
  const tech = [`código ${e.code}`, e.status !== null && e.status !== undefined ? `HTTP ${e.status}` : null, d?.reasons?.length ? d.reasons.join(", ") : null, d?.google ?? d?.cause ?? null, e.at ? new Date(e.at).toLocaleString("es-ES") : null].filter(Boolean).join(" · ");
  return `<section class="card mail-error"><h2>⚠️ Gmail no ha funcionado</h2><p class="small">${esc(e.message)}</p><ol class="small">${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><div class="btns">${action}</div><details class="small muted"><summary>Detalle técnico</summary><p>${esc(tech)}</p></details></section>`;
}
const mailSeen = () => vault.settings.mailSeen ?? [];
function markMailSeen(key) { if (key) vault.settings.mailSeen = [...new Set([...mailSeen(), key])].slice(-300); }
const senderName = (email) => vault.mail?.senders?.find((s) => s.email === email)?.name ?? email;

// What MANU raises by itself: ChatGPT's export arrived, a sender that writes too much.
function mailCards() {
  if (!googleOn("gmail") || !vault.mail) return "";
  return mailSuggestions(vault.mail, mailSeen()).map((s) => s.kind === "export"
    ? `<section class="card ai-offer"><b>📦 Te ha llegado la exportación de ChatGPT</b><p class="muted small">Descárgala desde el correo cuanto antes (el enlace caduca) e impórtala en Tú → Tu archivo.</p><div class="btns"><a class="btn" href="${esc(messageUrl(s.id))}" target="_blank" rel="noopener">Abrir el correo</a><button class="btn ghost" data-act="mail-seen" data-k="${esc(s.key)}">Hecho</button></div></section>`
    : `<section class="card ai-offer"><b>📬 Este mes te han llegado ${s.count} correos de ${esc(s.name)}</b><p class="muted small">¿Qué hago con ellos? También puedes decírmelo en el chat: «¿de quién más me llegan muchos correos?»</p><div class="btns">${s.canUnsub ? `<button class="btn" data-act="mail-do" data-kind="unsub" data-email="${esc(s.email)}">Darme de baja</button>` : ""}<button class="btn ghost" data-act="mail-do" data-kind="archive" data-email="${esc(s.email)}">Archivarlos</button><button class="btn ghost" data-act="mail-do" data-kind="trash" data-email="${esc(s.email)}">Papelera</button></div><button class="link small" data-act="mail-seen" data-k="${esc(s.key)}">No, déjalo</button></section>`).join("");
}

// Unsubscribing must start inside Manu's tap (it opens a page or the mail app).
function unsubscribe(email) {
  const u = vault.mail?.senders?.find((s) => s.email === email)?.unsub;
  if (!u) return false;
  // The sender's own page (the CSP keeps form-action 'none', so no silent POST).
  if (u.http && /^https:\/\//i.test(u.http)) window.open(u.http, "_blank", "noopener");
  else if (u.mailto && /^mailto:/i.test(u.mailto)) location.href = u.mailto;
  else return false;
  return true;
}

async function mailDo(kind, email, label = "") {
  if (!googleOn("gmail")) { toast("Conecta Gmail en Tú → Correo"); return null; }
  const name = senderName(email);
  if (kind === "unsub") return { text: unsubscribe(email) ? `Abro la baja de ${name}. Si su página pide confirmar, confírmalo allí.` : `${name} no trae enlace de baja. Puedo archivarlos o mandarlos a la papelera.` };
  try {
    const token = await googleToken(SCOPE.gmail);
    const ids = await idsFrom(token, email);
    if (!ids.length) return { text: `No encuentro correos de ${name}.` };
    let labelId = null;
    if (kind === "archive") await mailArchive(token, ids);
    else if (kind === "trash") await mailTrash(token, ids);
    else if (kind === "label") { labelId = await ensureLabel(token, label); await addLabel(token, ids, labelId); }
    else return null;
    const verb = { archive: "Archivados", trash: "A la papelera", label: `Etiquetados como «${label}»` }[kind];
    return { text: `${verb} ${ids.length} correos de ${name}.`, undo: { kind, ids, labelId } };
  } catch (err) { return { text: `Gmail: ${err.message}` }; }
}

async function mailUndo(u) {
  try {
    const token = await googleToken(SCOPE.gmail);
    if (u.kind === "archive") await mailUnarchive(token, u.ids);
    else if (u.kind === "trash") await mailUntrash(token, u.ids);
    else if (u.kind === "label") await removeLabel(token, u.ids, u.labelId);
    toast("Deshecho en Gmail"); return true;
  } catch (err) { toast(`Gmail: ${err.message}`); return false; }
}

// «¿De quién me llegan más correos?», «dame de baja de X», «archiva los de X».
function mailCommand(text) {
  const t = normalise(text);
  // Only questions about Manu's mail; «apunta idea: mandar un correo a…» is not one.
  const aboutMail = /(correo|correos|mail|mails|email|emails|gmail)/.test(t)
    && !/^(apunta|anota|recuerdame|recordatorio|gaste|he gastado|idea|pon una alarma)/.test(t)
    && /(\?|^(que|cuales|quien|quienes|cuantos|tengo|hay|dame|desuscrib|archiva|a la papelera|borra|elimina|quitame)|me (han )?(llegado|llegaron|escribe|escriben)|nuevos|importantes|sin leer)/.test(t);
  // WEB-40: never let a mail question fall through to an AI that knows nothing.
  if (aboutMail && !googleOn("gmail")) return { text: "Gmail no está conectado. Conéctalo en Tú → Correo y te cuento qué te llega." };
  if (aboutMail && !vault.mail) return { text: vault.settings.googleErrors?.gmail ? `Aún no he podido leer tu correo: ${vault.settings.googleErrors.gmail.message} Tienes los pasos en Tú → Correo.` : "Aún no he leído tu correo. Pulsa «Actualizar» en Tú → Correo." };
  if (!googleOn("gmail") || !vault.mail) return null;
  if (aboutMail && /(que|cuales|nuevos|ultimos|recientes|hoy|llegado|llegaron|tengo|hay|importantes|sin leer)/.test(t) && !/(quien|quienes|remitentes|mas|muchos|baja|archiv|papelera|borra|etiquet)/.test(t)) {
    const m = vault.mail;
    const imp = m.important.slice(0, 6);
    const top = m.senders.slice(0, 3);
    const when = m.syncedAt ? new Date(m.syncedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "?";
    return { text: `${imp.length ? `Importantes sin leer: ${imp.map((x) => `${x.name} — «${x.subject || "sin asunto"}»`).join("; ")}.` : "No tienes correos importantes sin leer de los últimos 3 días."}${top.length ? ` Lo que más te llega: ${top.map((s) => `${s.name} (${s.count})`).join(", ")}.` : ""} (Leído a las ${when}; en Tú → Correo puedes actualizar.)` };
  }
  if (/(correo|mail|email)/.test(t) && /(quien|quienes|cuales|remitentes|mas|muchos)/.test(t) && !/(baja|archiv|papelera|borra|etiquet)/.test(t)) {
    const top = vault.mail.senders.slice(0, 6);
    return { text: top.length ? `En los últimos 30 días, quien más te escribe: ${top.map((s) => `${s.name} (${s.count})`).join(", ")}. Dime «dame de baja de …», «archiva los de …» o «a la papelera los de …».` : "No veo newsletters ni avisos masivos en los últimos 30 días." };
  }
  const order = mailOrder(t);
  if (!order) return null;
  const s = findSender(vault.mail, order.who);
  // A sender that is not in the mail and no word about mail: not a mail order.
  if (!s) return order.aboutMail ? { text: `No encuentro a «${order.who}» entre quienes más te escriben. Toca «Actualizar» en Tú → Correo si es reciente.` } : null;
  const name = { unsub: "correo_baja", archive: "correo_archivar", trash: "correo_papelera" }[order.kind];
  return { text: "¿Lo hago?", calls: [{ name, remitente: s.email, state: null }] };
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
    case "sheet": openSheet(a.dataset.kind, true); break;
    case "close-day": closeDay(); break;
    case "punch": doPunch(a.dataset.t, a.dataset.why || null); break;
    case "clock-month": { const [y, m] = (clockMonth ?? localDay().slice(0, 7)).split("-").map(Number); const d = new Date(y, m - 1 + Number(a.dataset.d), 1); clockMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; clockEdit = null; render(); break; }
    case "clock-edit": clockEdit = clockEdit === a.dataset.day ? null : a.dataset.day; render(); break;
    case "clock-del": if (window.confirm("¿Borrar este fichaje?")) { try { vault.clock = editPunch(vault.clock, a.dataset.day, a.dataset.id, { remove: true }); persist(); } catch (err) { toast(err.message); } render(); } break;
    case "clock-copy": {
      const month = clockMonth ?? localDay().slice(0, 7);
      const [y, m] = month.split("-").map(Number);
      const text = monthNote(monthReport(vault.clock, month, { targetMin: clockTarget(), now: today() }), new Date(y, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" }));
      try { await navigator.clipboard.writeText(text); toast("Copiado: pégalo en Notas o donde quieras"); }
      catch { try { await navigator.share({ text }); } catch { toast("No he podido copiarlo"); } }
      break;
    }
    case "clock-dl": downloadClock(clockMonth ?? localDay().slice(0, 7), a.dataset.kind); break;
    case "speak-day": speakDay(); break;
    case "morning-dismiss": morningLaunch = false; render(); break;
    case "gentle-pause": vault.settings.gentlePaused = localDay(); persist(); render(); toast("Vale. Me alegro 💙"); break;
    case "nube-code": nubeCodeAgain(); break;
    case "nube-copy-handoff": navigator.clipboard?.writeText(nube.handoff ?? "").then(() => toast("Copiado: ahora abre MANU desde tu pantalla de inicio y pégalo en Tu nube"), () => toast("Mantén pulsado el código para copiarlo")); break;
    case "nube-other": nube.patch({ codeSentAt: null }); render(); break;
    case "nube-copy-sql": navigator.clipboard?.writeText(SUPABASE_SQL).then(() => toast("SQL copiado: pégalo en Supabase → SQL Editor"), () => toast("No he podido copiarlo: ábrelo y cópialo a mano")); break;
    case "nube-sync": nubeSync({ manual: true }); break;
    case "nube-leave": if (window.confirm("¿Desconectar este dispositivo de tu nube? Tus datos se quedan aquí y en la nube.")) nubeLeave().then(() => { render(); toast("Desconectado"); }); break;
    case "nube-keep-local": nubeResolve("local"); break;
    case "nube-keep-remote": if (window.confirm("Se sustituyen los datos de este dispositivo por los de la nube. ¿Seguro?")) nubeResolve("remote"); break;
    case "chat-image-remove": chatImage = null; render(); break;
    case "proj-open": openProject = a.dataset.id; projSourceKind = "note"; render({ focus: true, enter: "page" }); scrollTo(0, 0); break;
    case "proj-back": openProject = null; render({ focus: true, enter: "tab" }); scrollTo(0, 0); break;
    case "proj-kind": projSourceKind = a.dataset.kind; render(); break;
    case "proj-del-source": updateProject(openProject, (p) => ({ ...p, sources: p.sources.filter((x) => x.id !== a.dataset.id) })); break;
    case "proj-delete": if (a.dataset.confirm === "1") { vault.projects = (vault.projects ?? []).filter((p) => p.id !== openProject); openProject = null; persist(); render(); toast("Proyecto borrado"); } else { a.dataset.confirm = "1"; a.textContent = "Pulsa otra vez para borrarlo"; } break;
    case "proj-preset": askProject(PRESETS[a.dataset.p], a.dataset.label); break;
    case "proj-src-view": { const src = currentProject()?.sources.find((x) => x.id === a.dataset.id); if (src) toast(`[${a.dataset.n}] ${src.title}`); break; }
    case "qa-image-remove": if (sheet) { sheet.image = null; rerenderSheet(); } break;
    case "qa-ai": shareToAi(); break;
    case "img-view": viewImageId = a.dataset.imgId; overlay = "image"; render({ focus: true, enter: "page" }); scrollTo(0, 0); break;
    case "sheet-kind": { if (!sheet) break; sheet.kind = a.dataset.kind; sheet.manual = true; sheet.text = $("qText")?.value ?? sheet.text; render(); const t = $("qText"); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } break; }
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
    case "google-connect-all": vault.settings.google = { ...(vault.settings.google ?? {}), calendar: true, tasks: true, contacts: true, gmail: true }; persist(); syncGoogle(); break;
    case "drive-restore-no": confirmDriveRestore = null; render(); break;
    case "drive-restore-yes": { const r = validateVault(confirmDriveRestore?.data); confirmDriveRestore = null; if (!r.ok) { toast(r.reason); render(); break; } vault = r.vault; persist(); render(); toast("Copia de Drive restaurada"); break; }
    case "gauto": vault.settings.googleAutoOpen = vault.settings.googleAutoOpen === false; persist(); render(); break;
    case "gfeature": { const k = a.dataset.k; vault.settings.google = { ...(vault.settings.google ?? {}), [k]: !googleOn(k) }; if (!googleOn(k)) delete gcal.tokens[SCOPE[k]]; persist(); render(); break; }
    case "ai-send": askAi(id); break;
    case "ai-do": runCall(findCall(a)); break;
    case "ai-undo": undoCall(findCall(a)); break;
    case "contacts-sync": vault.settings.google = { ...(vault.settings.google ?? {}), contacts: true }; persist(); syncGoogle(); break;
    case "person-cal": addBirthdayToCalendar(a.dataset.id); break;
    case "chat-new": startNewChat(); toast("Conversación nueva. La anterior queda en Tu archivo."); break;
    case "profile-make": makeProfile(); break;
    case "cap-read": readCaptures(); break;
    case "person-gcontact": saveBirthdayToGoogle(a.dataset.id); break;
    case "proj-suggest": suggestProjects(); break;
    case "proj-sug-close": projAuto.suggestions = null; render(); break;
    case "proj-sug-add": case "proj-sug-all": {
      const list = projAuto.suggestions ?? [];
      const pick = a.dataset.act === "proj-sug-all" ? list : [list[Number(a.dataset.i)]].filter(Boolean);
      (async () => { let n = 0; for (const s of pick) n += (await createProject(s)).n; projAuto.suggestions = list.filter((x) => !pick.includes(x)); if (!projAuto.suggestions.length) projAuto.suggestions = null; persist(); render(); toast(`${pick.length === 1 ? "Proyecto creado" : `${pick.length} proyectos creados`}${n ? `, con ${n} cosas tuyas dentro` : ""}`); })();
      break;
    }
    case "proj-seed": { const p = currentProject(); if (!p) break; projAuto.busy = p.id; render(); seedFromArchive(p).then((n) => { projAuto.busy = false; persist(); render(); toast(n ? `Añadidas ${n} conversaciones` : "No encuentro conversaciones sobre esto. Añade palabras clave."); }); break; }
    case "proj-export": { const p = currentProject(); if (p) exportProject(p, a.dataset.kind); break; }
    case "cap-do": { const c = vault.captures.find((x) => x.id === a.dataset.id); if (c?.call) { runCall({ ...c.call, state: null }); finishCapture(c.id, "keep"); } break; }
    case "cap-keep": finishCapture(a.dataset.id, "keep"); break;
    case "cap-drop": finishCapture(a.dataset.id, "drop"); break;
    case "cap-keep-group": case "cap-drop-group": { const g = groupCaptures(vault.captures).find((x) => x.key === a.dataset.key); if (g && (a.dataset.act === "cap-keep-group" || window.confirm(`¿Descartar ${g.items.length} capturas?`))) for (const c of g.items) finishCapture(c.id, a.dataset.act === "cap-keep-group" ? "keep" : "drop", true); persist(); render(); break; }
    case "profile-edit": archive.editProfile = true; render(); break;
    case "profile-cancel": archive.editProfile = false; render(); break;
    case "profile-delete": if (window.confirm("¿Borrar tu perfil?")) { delete vault.profile; persist(); render(); toast("Perfil borrado"); } break;
    case "archive-clear": if (window.confirm("¿Borrar todo tu archivo de este iPhone? No se puede deshacer.")) { clearArchive().then(() => { archive.docs = null; archive.stats = null; archive.results = null; render(); toast("Archivo borrado"); }); } break;
    case "mail-reconnect": delete gcal.tokens[SCOPE.gmail]; gcal.consentError = null; vault.settings.google = { ...(vault.settings.google ?? {}), gmail: true }; persist(); syncGoogle(); break;
    case "mail-connect": vault.settings.google = { ...(vault.settings.google ?? {}), gmail: true }; persist(); syncGoogle(); break;
    case "mail-seen": markMailSeen(a.dataset.k); persist(); render(); break;
    case "mail-do": {
      const email = a.dataset.email, kind = a.dataset.kind;
      // WEB-69: a card can move under the finger (another one disappears
      // above it); trash and archive never go with a single tap.
      const n = vault.mail?.senders?.find((x) => x.email === email)?.count;
      if ((kind === "trash" || kind === "archive") && !window.confirm(`¿${kind === "trash" ? "Mandar a la papelera" : "Archivar"} ${n ? `los ${n} correos` : "los correos"} de ${senderName(email)}? Se puede deshacer desde el chat.`)) break;
      const label = kind === "label" ? (window.prompt("Nombre de la etiqueta", senderName(email)) ?? "").trim() : "";
      if (kind === "label" && !label) break;
      markMailSeen(`sender:${email}`);
      mailDo(kind, email, label).then((r) => { if (!r) return; vault.chat.push({ from: "manu", text: r.text, at: new Date().toISOString(), ...(r.undo ? { mailUndo: r.undo } : {}) }); persist(); render(); toast(r.undo ? `${r.text} Deshacer en el chat.` : r.text); });
      break;
    }
    case "mail-undo": { const b = vault.chat.find((x) => x.at === a.dataset.at && x.mailUndo); if (b) mailUndo(b.mailUndo).then((ok) => { if (ok) { delete b.mailUndo; b.text += " (deshecho)"; persist(); render(); } }); break; }
    case "mail-undo-call": { const c = findCall(a); if (c?.mailUndo) mailUndo(c.mailUndo).then((ok) => { if (ok) { delete c.mailUndo; c.state = "undone"; persist(); render(); } }); break; }
    case "ai-mode": { const m = aiMode(); const v = a.dataset.v; vault.settings.aiMode = v === "off" ? { ...m, on: false } : v === "full" ? (vault.settings.aiSensitive = true, { ...m, on: true, context: { ...FULL_CONTEXT } }) : v === "basic" ? { ...m, on: true, context: { ...BASIC_CONTEXT } } : m; persist(); render(); toast(v === "off" ? "Modo conversación desactivado" : "Modo conversación activado"); break; }
    case "ai-ctx": { const m = aiMode(); vault.settings.aiMode = { ...m, context: { ...m.context, [a.dataset.k]: !m.context[a.dataset.k] } }; persist(); render(); break; }
    case "ai-auto-actions": { const m = aiMode(); vault.settings.aiMode = { ...m, autoActions: !m.autoActions }; persist(); render(); break; }
    case "ai-skip": { const c = findCall(a); if (c && !c.state) { c.state = "no"; persist(); render(); } break; }
    case "ai-issue": { const c = findCall(a); if (c && !c.state) { c.state = "done"; persist(); setTimeout(render, 300); } break; }
    case "ai-sensitive": vault.settings.aiSensitive = vault.settings.aiSensitive !== true; persist(); render(); toast(vault.settings.aiSensitive ? "Lo sensible podrá ir a Gemini (nunca claves ni crisis)" : "Lo sensible vuelve a quedarse en el móvil"); break;
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
    case "series-pick": seriesPick = seriesPick === a.dataset.k ? null : a.dataset.k; render(); break;
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
      if (c && c.name !== activeCity().name) { const list = weatherCityList(); showCity(c, list.findIndex((x) => x.name === c.name) > list.findIndex((x) => x.name === activeCity().name) ? "next" : "prev"); }
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
    case "cmdk": openCmdk(); break;
    case "income-add": incomeForm = !incomeForm; render(); if (incomeForm) $("inAmount")?.focus(); break;
    case "bank-tick": { const m = bankRead?.items?.[Number(a.dataset.i)]; if (m) { m.on = !m.on; render(); } break; }
    case "bank-save": saveBankShots(); break;
    case "bank-cancel": bankRead = null; render(); break;
    case "split-person": {
      const key = a.dataset.key;
      const e = splitDraft?.entryId ? splitDraft : { entryId: (vault.spending.find((x) => x.id === splitDraft?.entryId) ?? toAsk(vault.spending, today())[0])?.id, people: [], mode: null, q: "" };
      if (!e.entryId) break;
      const p = vault.people.find((x) => x.id === key);
      e.people = e.people.some((x) => x.key === key) ? e.people.filter((x) => x.key !== key) : p ? [...e.people, { key, name: p.name, ...(p.googleId ? { googleId: p.googleId } : {}) }] : e.people;
      e.q = ""; splitDraft = e; render(); break;
    }
    case "split-contact": {
      const p = personFromContact(a.dataset.gid);
      const e = splitDraft?.entryId ? splitDraft : { entryId: toAsk(vault.spending, today())[0]?.id, people: [], mode: null, q: "" };
      if (!p || !e.entryId) break;
      if (!e.people.some((x) => x.key === p.id)) e.people.push({ key: p.id, name: p.name, googleId: p.googleId });
      e.q = ""; splitDraft = e; persist(); render(); break;
    }
    case "split-mode": if (splitDraft) { splitDraft.mode = a.dataset.mode || null; render(); } break;
    case "split-save": saveSplit(a.dataset.mode); break;
    case "split-none": { const ids = new Set(toAsk(vault.spending, today()).map((x) => x.id)); vault.spending = vault.spending.map((x) => (ids.has(x.id) ? { ...x, splitAsked: true } : x)); splitDraft = null; persist(); render(); break; }
    case "split-alone": vault.spending = vault.spending.map((x) => (x.id === a.dataset.id ? { ...x, splitAsked: true } : x)); splitDraft = null; persist(); render(); break;
    case "debt-paid": {
      const d = debts(vault.spending).find((x) => x.key === a.dataset.key);
      if (d && window.confirm(`¿${d.name.split(" ")[0]} te ha pagado los ${eurosTxt(d.cents)}?`)) { vault.spending = settleAll(vault.spending, d.key, new Date()); persist(); render(); toast("Saldado"); }
      break;
    }
    case "nudge-toggle": {
      const cur = nudgePrefs(vault.settings.nudges)[a.dataset.id];
      if (!cur) break;
      vault.settings.nudges = { ...(vault.settings.nudges ?? {}), [a.dataset.id]: { ...(vault.settings.nudges?.[a.dataset.id] ?? {}), on: !cur.on } };
      persist(); render(); toast(cur.on ? "Aviso desactivado" : "Aviso activado");
      break;
    }
    case "notify-test": if (!(await testNotification())) toast("No se ha podido mostrar el aviso."); break;
    case "export": exportBackup(); break;
    case "show-all": showAll[a.dataset.k] = true; render(); break;
    case "cat-edit": catEditing = a.dataset.id; render(); $(`cat-${catEditing}`)?.focus(); break;
    case "find-clear": findQ = ""; render(); break;
    case "find-go": if (a.dataset.project) { openProject = a.dataset.project; go("proyectos"); } else go(a.dataset.tab); break;
    case "budget-del": { const b = { ...(vault.settings.budgets ?? {}) }; delete b[a.dataset.cat]; vault.settings.budgets = b; persist(); render(); break; }
    case "full-restore-yes": doFullRestore(); break;
    case "full-restore-no": full.pending = null; render(); break;
    case "backup-later": vault.settings.backupSnooze = new Date(Date.now() + 3 * 86400000).toISOString(); persist(); render(); break;
    case "wipe": confirmWipe = true; render(); break;
    case "wipe-no": confirmWipe = false; render(); break;
    case "wipe-yes": { let ss = null, ls = null; try { ss = sessionStorage; ls = localStorage; } catch {} wipeDeviceKeys([ls, ss]); clearTimeout(nube.timer); dropNubeKey(); clearImages(); clearArchive(); archive.docs = null; archive.stats = null; imageCache.clear(); gcal.tokens = {}; vault = emptyVault(); confirmWipe = false; persist(); render(); toast("Datos borrados de este dispositivo"); break; }
  }
});

document.addEventListener("keydown", (e) => {
  if (e.target.id === "qText" && e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("quickAdd")?.requestSubmit(); return; }
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
  if (f === "nubeMail") { nubeMail($("nubeEmail").value.trim()); return; }
  if (f === "nubeForm") { nubeCodeSubmit($("nubeCode").value); return; }
  if (f === "projKeys") {
    const p = currentProject(); if (!p) return;
    updateProject(p.id, (x) => ({ ...x, keywords: parseKeywords($("projKeysIn").value) }));
    const n = fileNewItems(p.id).length; persist(); render();
    toast(n ? `Guardadas. He metido ${n} ${n === 1 ? "cosa" : "cosas"} que encajan.` : "Guardadas");
    return;
  }
  if (f === "projForm") {
    try {
      const { p, n } = await createProject({ name: $("projName").value, emoji: $("projEmoji").value || "📁" });
      openProject = p.id; render({ focus: true, enter: "page" }); scrollTo(0, 0);
      if (n) toast(`He metido ${n} ${n === 1 ? "cosa" : "cosas"} que ya tenías sobre esto`);
    } catch (err) { toast(err.message); }
    return;
  }
  if (f === "projSource") { await addProjectSource(); return; }
  if (f === "archiveAsk") { const q = $("archiveAskQ").value.trim(); if (!q || archive.asking) return; archive.asking = true; render(); archive.answer = await askArchive(q); archive.asking = false; render(); return; }
  if (f === "profileForm") { const t = $("profileText").value.trim(); vault.profile = t ? { at: new Date().toISOString(), ...vault.profile, text: t.slice(0, 12000), edited: true } : undefined; if (!t) delete vault.profile; archive.editProfile = false; persist(); render(); toast("Perfil guardado"); return; }
  if (f === "archiveSearch") { archive.query = $("archiveQ").value.trim(); archive.results = archiveSearch(await archiveDocs(), archive.query); render(); return; }
  if (f === "projAsk") { const q = $("projQ").value.trim(); if (q) { $("projQ").value = ""; askProject(q); } return; }
  if (f === "composer") {
    const input = $("msg"); const v = input.value; input.value = "";
    // A screenshot goes to Gemini only with this explicit «Enviar a Gemini».
    if (chatImage && aiReady()) { const image = chatImage; chatImage = null; shareToAi({ note: v.trim(), link: null, image }); return; }
    if (chatImage) { toast("Activa la IA para que MANU lea la captura"); return; }
    say(v); $("msg")?.focus(); return;
  }
  if (f === "pasteEvents") { const events = parseEvents($("eventsText").value); vault.agenda = { day: localDay(), events, importedAt: new Date().toISOString() }; persist(); render(); toast(events.length ? `Agenda de hoy: ${events.length} evento${events.length === 1 ? "" : "s"}` : "No he reconocido ningún evento"); return; }
  if (f === "gcalForm") {
    const id = $("gcalId").value.trim();
    if (id && !isClientId(id)) { toast("Ese no parece un ID de cliente de Google"); return; }
    vault.settings.gcalClientId = id && id !== DEFAULT_GOOGLE_CLIENT_ID ? id : null; gcal.client = null; gcal.token = null;
    persist(); render(); toast(id ? "ID guardado" : "Google Calendar desconectado"); return;
  }
  if (f === "workStartForm" || f === "clockTargetForm") return;
  if (f === "incomeForm") {
    const cents = toCents($("inAmount").value);
    if (!cents) { toast("Pon un importe"); return; }
    const concept = ($("inConcept").value || "Ingreso").trim().slice(0, 80);
    const day = /^\d{4}-\d{2}-\d{2}$/.test($("inDate").value) ? $("inDate").value : localDay();
    const [y, mo, d] = day.split("-").map(Number);
    vault.income.push({ id: uid("in"), cents, concept, at: new Date(y, mo - 1, d, 12).toISOString(), source: "MANUAL", kind: incomeKind(concept) });
    incomeForm = false; persist(); render(); toast(`Ingreso de ${euros(cents)} guardado`);
    return;
  }
  if (f === "spotifyForm") {
    const id = $("spId").value.trim();
    if (id && !isSpotifyClientId(id)) { toast("Ese no parece un Client ID de Spotify"); return; }
    const next = id && id !== DEFAULT_SPOTIFY_CLIENT_ID ? id : null;
    if (next !== (vault.settings.spotifyClientId ?? null)) spotifyStore.tokens = null; // tokens belong to the app that issued them
    vault.settings.spotifyClientId = next;
    vault.settings.spotifySpeaker = $("spSpeaker").value.trim().slice(0, 40) || DEFAULT_SPEAKER;
    persist(); render(); toast("Spotify guardado"); return;
  }
  if (f === "fullForm") {
    if (full.busy) return;
    const pass = $("fullPass").value, plain = $("fullPlain").checked;
    const where = e.submitter?.dataset.full ?? "download";
    if (where === "drive" && plain) { toast("A Drive solo se suben copias cifradas."); return; }
    if (!plain) { const problem = passphraseProblem(pass); if (problem) { toast(problem); return; } }
    full.busy = where === "drive" ? "drive" : "export"; render();
    try {
      const b = await makeFullBackup(pass, plain);
      const mb = (b.bytes / 1048576).toFixed(1);
      if (where === "drive") {
        if (b.bytes > DRIVE_MAX) { toast(`La copia pesa ${mb} MB y Drive por ahora solo admite hasta 5 MB desde MANU. Descárgala y guárdala en Archivos o iCloud.`); return; }
        await withRetry(SCOPE.drive, (tk) => saveBackup(tk, b.envelope));
      } else downloadBlob(b.blob, b.filename);
      vault.settings.lastFullBackup = { at: new Date().toISOString(), where: where === "drive" ? "drive" : "download", mb, encrypted: !plain };
      delete vault.settings.backupSnooze;
      persist();
      toast(where === "drive" ? `Copia completa cifrada en tu Drive (${mb} MB)` : `Copia completa lista (${mb} MB). Guárdala en Archivos o iCloud.`);
    } catch (err) { toast(`No he podido hacer la copia: ${err.message}`); }
    finally { full.busy = null; render(); }
    return;
  }
  if (f === "driveForm") {
    const pass = $("drivePass").value;
    const problem = passphraseProblem(pass);
    if (problem) { toast(problem); return; }
    const action = e.submitter?.dataset.drive ?? "save";
    try {
      if (action === "save") {
        // WEB-44: the same full copy as in Tus datos, so Drive never keeps a partial one.
        const b = await makeFullBackup(pass, false);
        if (b.bytes > DRIVE_MAX) { toast(`La copia pesa ${(b.bytes / 1048576).toFixed(1)} MB y Drive por ahora solo admite hasta 5 MB desde MANU. Descárgala en Tú → Tus datos.`); return; }
        await withRetry(SCOPE.drive, (tk) => saveBackup(tk, b.envelope));
        vault.settings.lastFullBackup = { at: new Date().toISOString(), where: "drive", mb: (b.bytes / 1048576).toFixed(1), encrypted: true };
        vault.settings.googleStatus = { ...(vault.settings.googleStatus ?? {}), drive: `ok: copia cifrada ${new Date().toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` };
        persist(); render(); toast("Copia cifrada guardada en tu Drive");
      } else {
        const b = await withRetry(SCOPE.drive, (tk) => loadBackup(tk));
        if (!b) { toast("No hay copia en Drive todavía"); return; }
        const data = await decryptBackup(b.data, pass);
        if (typeof data === "string") { // WEB-44: a full copy
          const checked = await readBackupFile(new Blob([data]), { validateVault });
          if (!checked.ok) { toast(checked.reason); return; }
          full.pending = checked; tab = "tu"; sub = "datos"; render(); scrollTo(0, 0); return;
        }
        confirmDriveRestore = { file: b.file, data };
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
    const bd = $("pBDay").value, bm = $("pBMonth").value;
    if (Boolean(bd) !== Boolean(bm)) { toast("Elige el día y el mes del cumpleaños"); return; }
    const birthday = bd && bm ? `${bm}-${bd}` : null;
    const contact = (pickedContact && pickedContact.name === name ? pickedContact : null) ?? vault.contacts?.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (contact && vault.people.some((p) => p.googleId === contact.googleId)) { toast(`${contact.name} ya está en Personas`); return; }
    pickedContact = null;
    const person = { id: uid("p"), name: name.slice(0, 60), birthday, phone: $("pPhone").value.trim().slice(0, 20) || null, notes: $("pNotes").value.trim().slice(0, 300) || null, lastContact: null, ...(contact ? { googleId: contact.googleId } : {}) };
    const toCalendar = birthday && $("pCal")?.checked;
    const toGoogle = birthday && contact && !contact.birthday && $("pGoogleRow") && !$("pGoogleRow").hidden && $("pGoogle")?.checked;
    vault.people.push(person);
    persist(); render(); toast("Persona guardada");
    if (toCalendar) addBirthdayToCalendar(person.id);
    if (toGoogle) saveBirthdayToGoogle(person.id);
    return;
  }
  if (f === "findForm") {
    findQ = $("findQ").value.trim().slice(0, 100);
    await archiveDocs(); render(); $("findQ")?.blur(); return;
  }
  if (f === "budgetForm") {
    const cat = $("budgetCat").value, cents = toCents($("budgetAmount").value.replace(/[€\s]/g, ""));
    if (!CATEGORIES[cat] || !cents) { toast("Escribe el límite en euros, por ejemplo 150"); return; }
    vault.settings.budgets = { ...(vault.settings.budgets ?? {}), [cat]: cents };
    persist(); render(); toast(`Presupuesto de ${CATEGORIES[cat]}: ${euros(cents)} al mes`); return;
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
    let raw = $("qText")?.value.trim() ?? "";
    const link = sheet.link;
    let imageId = null;
    if (sheet.image) { imageId = uid("img"); try { await putImage(imageId, sheet.image); imageCache.set(imageId, sheet.image); } catch { imageId = null; toast("No he podido guardar la captura en este móvil"); } }
    const extra = { ...(imageId ? { imageId } : {}), ...(link ? { url: link.url } : {}) };
    if (link) raw = link.rest || raw.replace(link.url, "").trim() || `Vídeo de ${PROVIDER_NAME[link.provider]}`;
    if (!raw && imageId) raw = "Captura";
    const at = new Date().toISOString();
    const k = sheet.kind;
    const d = quickDetect(raw, today());
    // Use the cleaned text MANU understood («sacar la basura», not the whole sentence).
    const text = (d.kind === k && d.text) || (k === "EXPENSE" && d.kind === "EXPENSE" ? d.merchant ?? "" : raw);
    if (k === "TASK" && text) vault.inbox.push({ ...capture({ id: uid("c"), text: text.slice(0, 140), at }), status: "TASK", ...extra });
    else if (k === "IDEA" && text) vault.inbox.push({ ...capture({ id: uid("c"), text: text.slice(0, 400), at }), status: "IDEA", ...extra });
    else if (k === "EXPENSE") {
      // WEB-52: «12.50» is 12,50 € (before, every dot was removed: 1.250 €); «1.200» is 1.200 €.
      const cents = amountCents(($("qAmount")?.value ?? "").replace(/\s|€/g, ""));
      if (!cents) { toast("Pon el importe, por ejemplo 12,50"); $("qAmount")?.focus(); return; }
      const when = d.kind === "EXPENSE" && d.day ? new Date(`${d.day}T12:00:00`).toISOString() : at; // «ayer gasté…»
      vault.spending.push({ ...newEntry({ id: uid("s"), cents, merchant: text || null, at: when }, vault.settings.categoryRules ?? {}), ...extra });
    } else if (k === "EVENT" && raw) {
      const minutes = Math.min(1440, Math.max(5, Number($("qMinutes").value) || 60));
      try {
        const token = await googleToken(SCOPE.calendar);
        await createEvent(token, newEventBody({ title: raw, start: $("qWhen").value, minutes }));
        sheet = null; render(); toast("Evento creado en Google Calendar"); syncGoogle();
      } catch (err) { toast(err.message || "No se pudo crear el evento"); }
      return;
    } else if (k === "REMINDER" && text) {
      const when = new Date($("qWhen").value);
      if (Number.isNaN(when.getTime())) { toast("Elige cuándo"); return; }
      vault.reminders.push({ id: uid("r"), text: text.slice(0, 140), at: when.toISOString(), done: false, notified: false, ...extra });
    } else { toast("Escribe algo primero"); $("qText")?.focus(); return; }
    sheet = null; persist(); render();
    toast({ TASK: "Tarea añadida", IDEA: "Idea guardada", EXPENSE: "Gasto apuntado", REMINDER: "Recordatorio creado" }[k]);
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "qText") onQuickInput(e.target.value);
  if (e.target.id === "qAmount" || e.target.id === "qWhen") e.target.dataset.touched = "1";
  if (e.target.id === "msg") $("orb")?.classList.toggle("listening", e.target.value.trim().length > 0);
});

document.addEventListener("change", async (e) => {
  if (e.target.id === "chatImage" && e.target.files?.[0]) {
    try { chatImage = await compressImage(e.target.files[0]); render(); $("msg")?.focus(); } catch (err) { toast(err.message); }
    return;
  }
  if (e.target.id === "projImage" && e.target.files?.[0]) { await addProjectImage(e.target.files[0]); return; }
  if (e.target.id === "qImage" && e.target.files?.[0] && sheet) {
    try { sheet.image = await compressImage(e.target.files[0]); if (!sheet.manual && !(sheet.text ?? "").trim()) sheet.kind = "IDEA"; rerenderSheet(); }
    catch (err) { toast(err.message); }
    return;
  }
  if (e.target.dataset?.clockId && /^\d{2}:\d{2}$/.test(e.target.value)) { try { vault.clock = editPunch(vault.clock, e.target.dataset.clockDay, e.target.dataset.clockId, { time: e.target.value }); persist(); toast("Hora corregida"); } catch (err) { toast(err.message); } render(); return; }
  if (e.target.id === "clockTarget" && /^\d{2}:\d{2}$/.test(e.target.value)) { const [h, mi] = e.target.value.split(":").map(Number); if (h * 60 + mi >= 30) { vault.settings.clockTarget = h * 60 + mi; persist(); render(); toast(`Jornada: ${dur(h * 60 + mi)}`); } return; }
  if (e.target.dataset?.nudgeTime && /^\d{2}:\d{2}$/.test(e.target.value) && NUDGES.some((n) => n.id === e.target.dataset.nudgeTime && n.time !== null)) {
    const id = e.target.dataset.nudgeTime;
    vault.settings.nudges = { ...(vault.settings.nudges ?? {}), [id]: { ...(vault.settings.nudges?.[id] ?? {}), time: e.target.value } };
    persist(); toast(`Aviso a las ${e.target.value}`); return;
  }
  if (e.target.id === "workStart" && /^\d{2}:\d{2}$/.test(e.target.value)) { vault.settings.workStart = e.target.value; persist(); toast(`Entrada: ${e.target.value}`); return; }
  if (e.target.dataset.cat) {
    catEditing = null;
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
  if (e.target.id === "bankShots" && e.target.files?.length) { const files = [...e.target.files]; e.target.value = ""; readBankShots(files); return; }
  if (e.target.id === "buzonFile" && e.target.files?.[0]) {
    const file = e.target.files[0]; e.target.value = "";
    if (file.size > 5_000_000) { toast("Ese archivo es demasiado grande para ser el buzón."); return; }
    try { importBuzon(await file.text()); } catch { toast("No he podido leer el buzón."); }
    return;
  }
  if (e.target.id === "capFiles" && e.target.files?.length) {
    const files = [...e.target.files]; e.target.value = "";
    let added = 0;
    for (const [i, file] of files.entries()) {
      caps.busy = `Guardando ${i + 1} de ${files.length}…`; render();
      try {
        const data = await compressImage(file);
        const imageId = uid("img");
        await putImage(imageId, data); imageCache.set(imageId, data);
        const at = file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString();
        vault.captures.push(newCapture({ id: uid("cap"), imageId, at }));
        added++;
      } catch { /* one unreadable image does not stop the rest */ }
    }
    vault.captures = trimCaptures(vault.captures);
    caps.busy = false; persist(); render();
    toast(added === files.length ? `${added} ${added === 1 ? "captura guardada" : "capturas guardadas"}` : `Guardadas ${added} de ${files.length}; alguna no se pudo abrir`);
    return;
  }
  if (e.target.id === "archiveFile" && e.target.files?.[0]) {
    const file = e.target.files[0]; e.target.value = "";
    if (archive.busy) { toast("Ya estoy importando; espera a que termine."); return; }
    // WEB-56: real exports weigh GBs; they are streamed and saved in batches,
    // so a failure halfway keeps what was already saved.
    archive.busy = "Importando…"; render();
    let saved = 0;
    const label = () => document.querySelector('label[for="archiveFile"]');
    try {
      const n = await readChatgptExport(file, {
        batch: 100,
        onBatch: async (docs) => { await putDocs(docs); saved += docs.length; },
        onProgress: ({ count, fraction }) => { archive.busy = `Importando… ${Math.floor(fraction * 100)} % · ${count.toLocaleString("es-ES")} conversaciones`; const l = label(); if (l) l.textContent = archive.busy; },
      });
      toast(`Importadas ${n.toLocaleString("es-ES")} conversaciones de ChatGPT`);
    } catch (err) {
      const full = err?.name === "QuotaExceededError" || /quota/i.test(String(err?.message));
      toast(full ? `El iPhone no tiene más sitio para MANU. Se guardaron ${saved.toLocaleString("es-ES")} conversaciones.` : `No he podido importarlo${saved ? ` entero (se guardaron ${saved.toLocaleString("es-ES")})` : ""}: ${err.message}`);
    }
    archive.docs = null; await archiveDocs();
    archive.busy = false; render(); return;
  }
  if (e.target.id === "bankFile" && e.target.files?.[0]) {
    const file = e.target.files[0];
    const ids = new Set([...vault.spending, ...(vault.income ?? [])].map((x) => x.id));
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
    const pay = dropCrossSource(r.entries, vault.spending, "APPLEPAY"); // WEB-43: already came from the buzón
    r.entries = pay.entries; r.duplicates += pay.duplicates;
    vault.spending.push(...r.entries);
    moneyMonth = latestMonthOffset();
    vault.income = [...(vault.income ?? []), ...(r.income ?? [])];
    if (r.balance && (!vault.settings.balance || r.balance.at >= vault.settings.balance.at)) vault.settings.balance = r.balance;
    vault.settings.lastImport = { at: new Date().toISOString(), added: r.entries.length, duplicates: r.duplicates, incomeAdded: (r.income ?? []).length, incomeDuplicates: r.incomeDuplicates ?? 0, invalid: r.skippedInvalid };
    persist(); render(); toast(`${r.entries.length} gastos y ${(r.income ?? []).length} ingresos importados`); return;
  }
  if (e.target.id === "fullPlain") { full.plain = e.target.checked; return; }
  if (e.target.id === "import" && e.target.files?.[0]) {
    const file = e.target.files[0]; e.target.value = "";
    try {
      // WEB-44: validate everything first; nothing is written until Manu confirms.
      const checked = await checkAnyBackup(await file.text(), $("fullPass")?.value ?? "");
      if (!checked.ok) { toast(checked.reason); return; }
      full.pending = checked; render(); scrollTo(0, 0);
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
        if (resp.error || !resp.access_token) { gcal.consentError = { code: resp.error ?? "sin_token", description: resp.error_description ?? null }; reject(Object.assign(new Error(`Google no dio el permiso (${resp.error ?? "sin token"})`), { code: "consent" })); return; }
        gcal.consentError = null;
        const granted = missing.filter((sc) => google.accounts.oauth2.hasGrantedAllScopes(resp, sc));
        for (const sc of granted) gcal.tokens[sc] = { token: resp.access_token, expires: Date.now() + (Number(resp.expires_in) || 3600) * 1000 };
        resolve(granted);
      },
      error_callback: (err) => { gcal.consentError = { code: err?.type ?? "popup_closed", description: null }; reject(Object.assign(new Error("Se cerró la ventana de Google"), { code: "consent" })); },
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

// Never opens a window: used inside a sync, after googleConsent. When the
// permission is missing it says why (WEB-40), instead of a generic «no».
function cachedToken(scope) {
  const t = gcal.tokens[scope];
  if (t && Date.now() < t.expires - 60000) return Promise.resolve(t.token);
  const name = GOOGLE_FEATURES.find(([k]) => SCOPE[k] === scope)?.[1] ?? "este servicio";
  const why = gcal.consentError
    ? `Google no dio el permiso de ${name} (${gcal.consentError.code}${gcal.consentError.description ? `: ${gcal.consentError.description}` : ""})`
    : `En la ventana de Google no se concedió el permiso de ${name}`;
  return Promise.reject(Object.assign(new Error(why), { code: gcal.consentError?.code === "access_denied" ? "denied" : "no-scope" }));
}

async function withRetry(scope, fn) {
  try { return await fn(await googleToken(scope)); }
  catch (err) { if (err.code !== "auth") throw err; delete gcal.tokens[scope]; return fn(await googleToken(scope)); }
}

// silent: automatic refresh. Never opens a Google window (iOS would block it
// and it would interrupt Manu); it only uses tokens still valid in memory.
async function syncGoogle({ silent = false, quiet = false } = {}) {
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
      vault.contacts = fromGoogle.contacts; // WEB-38: names for autocomplete, only on this device
      const merged = mergePeople(vault.people, fromGoogle.people, () => uid("p"));
      vault.people = merged.people;
      return `${fromGoogle.total} leídos · ${fromGoogle.people.length} con cumpleaños · ${merged.added} nuevos${fromGoogle.complete ? "" : " (lista incompleta)"}`;
    } },
    { key: "gmail", scope: SCOPE.gmail, run: async (token) => {
      const s = mailSummary(await fetchSnapshot(token), Date.now());
      vault.mail = { ...s, syncedAt: new Date().toISOString() };
      return `${s.total} correos (30 días) · ${s.senders.length} remitentes masivos · ${s.important.length} importantes`;
    } },
  ];
  const enabled = Object.fromEntries(["calendar", "tasks", "contacts", "gmail"].map((k) => [k, googleOn(k)]));
  const wanted = Object.keys(enabled).filter((k) => enabled[k]).map((k) => SCOPE[k]);
  if (enabled.calendar) wanted.push(SCOPE.calendarList); // to show all of Manu's calendars
  if (silent) {
    // Only the services whose permission is still valid; the rest wait for a tap.
    for (const k of Object.keys(enabled)) if (enabled[k] && !validToken(SCOPE[k])) enabled[k] = false;
    if (!Object.values(enabled).some(Boolean)) { gcal.busy = false; return; }
  } else {
    try { await googleConsent(wanted); } catch { /* each service reports its own missing permission */ }
  }
  const errors = {};
  const status = await runServices(services, enabled, cachedToken, errors);
  // WEB-45: a 401 means the saved token no longer works: forget it, so the next
  // tap asks Google again instead of repeating the same failure for an hour.
  for (const e of Object.values(errors)) if (e.code === "auth" && e.scope) delete gcal.tokens[e.scope];
  vault.settings.googleStatus = { ...(vault.settings.googleStatus ?? {}), ...status };
  vault.settings.googleErrors = { ...(vault.settings.googleErrors ?? {}), ...errors };
  for (const k of Object.keys(status)) if (!status[k].startsWith("error")) delete vault.settings.googleErrors[k];
  if (status.calendar?.startsWith("ok")) vault.settings.gcalSyncedAt = new Date().toISOString();
  const failed = Object.values(status).filter((v) => v.startsWith("error"));
  gcal.error = failed.length ? failed.map((v) => v.replace(/^error: /, "")).join(" · ") : null;
  gcal.busy = false;
  persist();
  if (silent) { if (!sheet && !document.activeElement?.matches("input, textarea")) render(); return; }
  render();
  // WEB-40: say which service failed and Google's reason, never a generic message.
  const failedNames = Object.keys(errors).map((k) => GOOGLE_FEATURES.find(([f]) => f === k)?.[1] ?? k);
  if (!quiet || failed.length) toast(failed.length ? `No se ha sincronizado ${failedNames.join(" y ")}: ${Object.values(errors)[0].message}` : "Google sincronizado");
}

const validToken = (scope) => { const t = gcal.tokens[scope]; return Boolean(t && Date.now() < t.expires - 60000); };
const AUTO_SYNC_MS = 10 * 60000;
function autoSyncGoogle() {
  if (document.visibilityState !== "visible" || !navigator.onLine || gcal.busy) return;
  if (!["calendar", "tasks", "contacts", "gmail"].some((k) => googleOn(k) && validToken(SCOPE[k]))) return;
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

// ---------- Copia completa (WEB-44) ----------
// Vault + images + «Tu archivo» + diary in one file, encrypted by default.
// Secrets (Gemini key, Spotify tokens) never go in it (core/backup-manager.js).
const full = { busy: null, pending: null, pass: "", plain: false }; // pass: memory only, while on Tus datos
const DRIVE_MAX = 5 * 1024 * 1024; // Drive simple/multipart uploads are for files up to 5 MB
const daysSince = (iso) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null);
function fullBackupCard() {
  const last = vault.settings.lastFullBackup;
  const p = full.pending;
  if (p) {
    const c = p.counts?.databases ?? {};
    const n = (db, st) => c[db]?.[st] ?? 0;
    return `<section class="card"><h2>💾 ¿Restaurar esta copia?</h2>
      <p class="small">${p.kind === "vault" ? "Copia básica (solo el vault)." : `Copia completa${p.createdAt ? ` del ${esc(new Date(p.createdAt).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }))}` : ""}: ${n("manuos-images", "images")} imágenes, ${n("manuos-archive", "docs")} documentos de tu archivo y diario.`}</p>
      <p class="muted small">Reemplaza lo que hay ahora en este iPhone. Tu clave de Gemini y Spotify no se tocan. Si algo falla, todo se queda como estaba.</p>
      <div class="btns"><button class="btn danger" data-act="full-restore-yes">${full.busy === "restore" ? "Restaurando…" : "Sí, restaurar"}</button><button class="btn ghost" data-act="full-restore-no">Cancelar</button></div></section>`;
  }
  return `<section class="card"><h2>💾 Copia completa</h2>
    <p class="muted small">Si cambias de iPhone o borras Safari, solo se salva lo que esté en una copia. Las claves no van dentro.</p>
    <p class="small">${last ? `Última copia: hace ${daysSince(last.at) === 0 ? "menos de un día" : `${daysSince(last.at)} ${daysSince(last.at) === 1 ? "día" : "días"}`} (${esc(last.where === "drive" ? "en tu Drive" : "descargada")}, ${esc(last.mb)} MB).` : "Aún no has hecho ninguna copia completa."}</p>
    <form id="fullForm" class="stack" autocomplete="off">
      <label for="fullPass" class="muted small">Frase para cifrarla (mín. 10 caracteres; sin ella no se puede abrir, apúntala en un sitio seguro)</label>
      <input id="fullPass" type="password" maxlength="200" autocomplete="new-password">
      <label class="check-row"><input type="checkbox" id="fullPlain"> Sin cifrar (no recomendado: quien tenga el archivo lo lee todo)</label>
      <div class="btns"><button class="btn" type="submit" data-full="download">${full.busy === "export" ? "Preparando…" : "Descargar copia completa"}</button>${googleOn("drive") ? `<button class="btn ghost" type="submit" data-full="drive">${full.busy === "drive" ? "Subiendo…" : "Guardar en Drive"}</button>` : ""}</div>
    </form>
    <div class="btns"><label class="btn ghost" for="import" role="button" tabindex="0">Restaurar una copia</label><input id="import" type="file" accept="application/json,.json" class="sr"></div>
    <p class="muted small">Para restaurar una copia cifrada, escribe primero su frase arriba.</p></section>`;
}
// Encrypted file: the same AES-GCM envelope as the Drive copy (crypto.js),
// whose plaintext is the full-backup text.
async function makeFullBackup(pass, plain) {
  const exp = await exportFullBackup({ appVersion: APP_VERSION });
  if (plain) return { blob: exp.blob, filename: exp.filename, bytes: exp.bytes };
  const envelope = await encryptBackup(await exp.blob.text(), pass);
  const blob = new Blob([JSON.stringify(envelope)], { type: "application/json" });
  return { blob, envelope, filename: exp.filename.replace(".json", "-cifrada.json"), bytes: blob.size };
}
// Any copy MANU ever made: basic vault, full, or either one encrypted.
async function checkAnyBackup(text, pass) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, reason: "Ese archivo no es una copia de MANU OS." }; }
  if (isEnvelope(data)) {
    if (passphraseProblem(pass)) return { ok: false, reason: "Es una copia cifrada: escribe su frase en «Frase para cifrarla» y vuelve a elegir el archivo." };
    try { data = await decryptBackup(data, pass); } catch (err) { return { ok: false, reason: err.message }; }
    if (typeof data === "string") return readBackupFile(new Blob([data]), { validateVault });
  }
  if (data?.format === FULL_FORMAT) return readBackupFile(new Blob([text]), { validateVault });
  const v = validateVault(data);
  return v.ok ? { ok: true, kind: "vault", vault: v.vault } : { ok: false, reason: v.reason };
}
async function doFullRestore() {
  const p = full.pending;
  if (!p || full.busy) return;
  if (p.kind === "vault") { vault = p.vault; full.pending = null; persist(); render(); toast("Copia restaurada"); return; }
  full.busy = "restore"; render();
  try {
    restoring = true;
    await restoreFullBackup(p);
    toast("Copia restaurada. Reiniciando MANU…");
    setTimeout(() => location.reload(), 600);
  } catch (err) {
    restoring = false; full.busy = null; full.pending = null; render();
    toast(err.message);
  }
}
// Hoy: a quiet nudge after 7 days without a full copy (only once there is something to lose).
function backupNudge() {
  const s = vault.settings;
  if (s.backupSnooze && Date.parse(s.backupSnooze) > Date.now()) return "";
  const lastAt = s.lastFullBackup?.at;
  const items = vault.inbox.length + vault.spending.length + (vault.people?.length ?? 0) + (vault.projects?.length ?? 0);
  if (lastAt ? daysSince(lastAt) < 7 : items < 5) return "";
  return `<section class="card ai-offer"><b>💾 ${lastAt ? `Hace ${daysSince(lastAt)} días que no haces copia` : "Aún no tienes ninguna copia"}</b><p class="muted small">Si se borran los datos de Safari, se pierde todo. Tarda un momento.</p><div class="btns"><button class="btn" data-sub-go="datos">Hacer copia</button><button class="btn ghost" data-act="backup-later">Luego</button></div></section>`;
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
async function notifyOrToast(body, tag, go = "hoy") {
  // Visible app: a toast is enough. In the background (Mac tab, iPhone just
  // left): a system notification if he allowed them; a tap takes him to `go`.
  if (document.visibilityState !== "visible" && notificationStatus() === "granted") {
    try { const reg = await navigator.serviceWorker.ready; await reg.showNotification("MANU", { body, tag, icon: "icons/icon-192.png", data: { go } }); return; } catch {}
  }
  toast(`⏰ ${body}`);
}
// WEB-77: what was already shown today, on this device only (not in the vault:
// each device nudges on its own and it must not count as an edit for Tu nube).
const nudgedStore = {
  get() { try { return JSON.parse(localStorage.getItem("manuos.nudged") || "null"); } catch { return null; } },
  set(v) { try { localStorage.setItem("manuos.nudged", JSON.stringify(v)); } catch {} },
};
function nudgeContext() {
  const t = localDay();
  const evs = eventsFor(t).filter((e) => !String(e.title ?? "").startsWith("🎂"));
  const timed = evs.filter((e) => e.time).sort((a, b) => a.time.localeCompare(b.time));
  return {
    eventsToday: evs.length, firstAt: timed[0]?.time ?? null,
    remindersToday: vault.reminders.filter((r) => !r.done && dayKey(new Date(r.at)) === t).length,
    birthdaysToday: upcomingBirthdays(vault.people, today(), 0).length,
    moodToday: vault.moods.some((m) => m.day === t),
    habitsLeft: vault.habits.filter((h) => !(h.done ?? []).includes(t)).length,
    tomorrowAnswered: vault.settings.tomorrow?.day === tomorrowKey(),
    backupDays: vault.settings.lastFullBackup?.at ? daysSince(vault.settings.lastFullBackup.at) : null,
  };
}
// WEB-75 + WEB-77: the nudges Manu turned on, only when they apply. They work
// while MANU is open (or just left); with it closed, the iPhone automations in
// Atajos do the ones at a fixed time.
async function checkNudges() {
  const s = vault.settings;
  const prefs = nudgePrefs(s.nudges);
  const day = localDay();
  let sent = nudgedStore.get();
  const list = dueNudges(nudgeContext(), { now: today(), prefs, sent });
  const done = sent?.day === day ? sent.ids ?? [] : [];
  const n = clockNudge(clockDay().events, { now: today(), workStart: s.workStart ?? "09:00", targetMin: clockTarget(), off: Boolean(s.tomorrow?.day === day && s.tomorrow.work === false), sent: { day, in: done.includes("ficharEntrada"), out: done.includes("ficharSalida") } });
  const clockId = n && (n.kind === "in" ? "ficharEntrada" : "ficharSalida");
  if (n && prefs[clockId].on) list.unshift({ id: clockId, text: n.text, go: "hoy" });
  for (const x of list) {
    sent = markSent(sent, day, x.id);
    nudgedStore.set(sent);
    await notifyOrToast(x.text, `manu-${x.id}`, x.go);
  }
}
async function checkReminders() {
  await checkNudges();
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
// Audit 2026-10: if this device's data was damaged and set aside, never let the
// empty vault overwrite the cloud: forget the last revision so the next sync
// brings the cloud's copy down («pull») instead of pushing an empty one.
if (loaded.warning && isEmptyVault(vault) && nube.session) nube.patch({ lastRev: null, dirty: false });

// Audit 2026-10: MANU open in two tabs (easy on the Mac). Each tab keeps its
// vault in memory, so a save in one would undo the other. When another tab
// saves, this one takes its copy (unless a full restore is running).
window.addEventListener("storage", (e) => {
  if (e.key !== "manuos.vault" || !e.newValue || restoring) return;
  try {
    const r = validateVault(JSON.parse(e.newValue));
    if (!r.ok) return;
    vault = r.vault;
    if (!sheet && !document.activeElement?.matches("input, textarea, select")) render();
  } catch { /* a half-written value: the next event brings the full one */ }
});
if ("serviceWorker" in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  // WEB-66: a new version reloads by itself, unless Manu is typing or has
  // something open; then it waits until he comes back to MANU.
  let pendingReload = false;
  const reloadIfIdle = () => {
    if (!pendingReload || restoring) return;
    if (sheet || document.activeElement?.matches("input, textarea, select")) { toast("MANU se ha actualizado: se aplicará al volver"); return; }
    location.reload();
  };
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController) { pendingReload = true; reloadIfIdle(); } });
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
    // The installed app on the iPhone can stay open for days: look for a new
    // version every time Manu comes back to it.
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { reg.update().catch(() => {}); reloadIfIdle(); } });
  }).catch(() => {});
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

// WEB-77: where a tapped notification points: "hoy", "tu", "tu/habitos"…
function goTo(where) {
  const [t, sp] = String(where ?? "").split("/");
  if (!TABS.some(([id]) => id === t)) return false;
  tab = t; sub = sp && subpages[sp] ? sp : null;
  return true;
}
navigator.serviceWorker?.addEventListener("message", (e) => { if (e.data?.go && goTo(e.data.go)) render(); });
function applyIr() {
  const ir = /^#ir=([a-z]+(?:\/[a-z]+)?)$/.exec(location.hash);
  if (!ir) return false;
  history.replaceState(null, "", location.pathname);
  return goTo(ir[1]);
}
applyIr();
// ---------- Dinero: añadir, capturas del banco y gastos compartidos (WEB-80) ----------
let incomeForm = false;      // the «+ Ingreso» form is open
let bankRead = null;         // { busy } while Gemini reads; { items: [{...mov, on}] } to review
let splitDraft = null;       // { entryId, people: [{ key, name, googleId? }], mode: null|"detail", q: "" }
const eurosTxt = (c) => euros(c);
// People to offer first: whoever he talks to most recently.
const splitCandidates = () => [...(vault.people ?? [])].sort((a, b) => String(b.lastContact ?? "").localeCompare(String(a.lastContact ?? ""))).slice(0, 8);
function personFromContact(gid) {
  const c = vault.contacts?.find((x) => x.googleId === gid);
  if (!c) return null;
  let p = vault.people.find((x) => x.googleId === gid);
  if (!p) { p = { id: uid("p"), name: c.name, googleId: gid, ...(c.birthday ? { birthday: c.birthday } : {}) }; vault.people.push(p); }
  return p;
}
function splitAskCard() {
  const e = splitDraft ? vault.spending.find((x) => x.id === splitDraft.entryId) : toAsk(vault.spending, today())[0];
  if (!e) return "";
  const d = splitDraft?.entryId === e.id ? splitDraft : null;
  const when = new Date(e.at).toLocaleDateString("es-ES", { weekday: "long", day: "numeric" });
  const chosen = new Set((d?.people ?? []).map((p) => p.key));
  const chips = [...(d?.people ?? []), ...splitCandidates().filter((p) => !chosen.has(p.id)).map((p) => ({ key: p.id, name: p.name }))]
    .map((p) => `<button class="chip${chosen.has(p.key) ? " on" : ""}" data-act="split-person" data-key="${esc(p.key)}" aria-pressed="${chosen.has(p.key)}">${esc(p.name.split(" ")[0])}</button>`).join("");
  const q = d?.q ?? "";
  const matches = q.trim().length >= 2 ? [
    ...vault.people.filter((p) => !chosen.has(p.id) && normalise(p.name).includes(normalise(q))).slice(0, 5).map((p) => `<button class="contact-row" data-act="split-person" data-key="${esc(p.id)}"><span class="grow">${esc(p.name)}</span></button>`),
    ...searchContacts(vault.contacts ?? [], q, vault.people).filter((c) => !c.added).slice(0, 5).map((c) => `<button class="contact-row" data-act="split-contact" data-gid="${esc(c.googleId)}"><span class="grow">${esc(c.name)} <span class="muted small">· Google</span></span></button>`),
  ].join("") : "";
  const detail = d?.mode === "detail" ? `<div class="stack split-detail">${d.people.map((p) => `<div class="row"><span class="grow">${esc(p.name.split(" ")[0])}</span><label class="sr" for="sw-${esc(p.key)}">Qué tomó ${esc(p.name)}</label><input id="sw-${esc(p.key)}" data-split-what="${esc(p.key)}" placeholder="qué tomó" maxlength="60" value="${esc(p.what ?? "")}"><label class="sr" for="sc-${esc(p.key)}">Cuánto ${esc(p.name)}</label><input id="sc-${esc(p.key)}" class="num split-amount" data-split-cents="${esc(p.key)}" inputmode="decimal" placeholder="€" value="${p.cents ? esc((p.cents / 100).toFixed(2).replace(".", ",")) : ""}"></div>`).join("")}
      <p class="muted small">Lo que no pongas es tuyo.</p><div class="btns"><button class="btn" data-act="split-save" data-mode="detail">Guardar</button><button class="btn ghost" data-act="split-mode" data-mode="">Atrás</button></div></div>` : "";
  return `<section class="card split-ask" aria-labelledby="splitTitle"><h2 id="splitTitle">🍻 ${esc(eurosTxt(e.cents))}${e.merchant ? ` en ${esc(e.merchant)}` : ""}</h2>
    <p>${d?.people?.length ? "¿Cómo lo repartís?" : `¿Con quién estabas el ${esc(when)}?`}</p>
    ${d?.mode === "detail" ? detail : `<div class="chips" role="group" aria-label="Personas">${chips}</div>
    <label class="sr" for="splitQ">Buscar persona o contacto</label><input id="splitQ" placeholder="Busca en Personas o Google Contactos" autocomplete="off" value="${esc(q)}"><div class="contact-matches">${matches}</div>
    <div class="btns">${d?.people?.length ? `<button class="btn" data-act="split-save" data-mode="equal">A partes iguales (${esc(eurosTxt(Math.floor(e.cents / (d.people.length + 1))))} cada uno)</button><button class="btn ghost" data-act="split-mode" data-mode="detail">Cada uno lo suyo</button>` : ""}<button class="btn ghost" data-act="split-alone" data-id="${esc(e.id)}">Pagué solo yo</button></div>${toAsk(vault.spending, today()).length > 1 && !d?.people?.length ? `<button class="link small" data-act="split-none">No preguntar por estos ${toAsk(vault.spending, today()).length}</button>` : ""}`}</section>`;
}
function debtsCard() {
  const list = debts(vault.spending);
  if (!list.length) return "";
  const total = list.reduce((s, d) => s + d.cents, 0);
  return `<section class="card debts"><h2>🤝 Te deben ${esc(eurosTxt(total))}</h2>${list.map((d) => {
    const p = vault.people.find((x) => x.id === d.key);
    const wa = p?.phone ? whatsappUrl(p.phone, reminderText(d)) : null;
    return `<div class="stack debt"><div class="row"><span class="grow">${esc(debtLine(d))}</span></div><div class="btns">${wa ? `<a class="btn ghost small-btn" href="${esc(safeHref(wa))}" target="_blank" rel="noopener">Recordárselo</a>` : ""}<button class="btn small-btn" data-act="debt-paid" data-key="${esc(d.key)}">Me ha pagado</button></div></div>`;
  }).join("")}</section>`;
}
function addMoneyCard() {
  const form = incomeForm ? `<form id="incomeForm" class="stack"><label for="inAmount" class="muted small">Ingreso</label><input id="inAmount" inputmode="decimal" placeholder="Importe (€)" required>
      <label for="inConcept" class="sr">Concepto</label><input id="inConcept" placeholder="Concepto (nómina, Bizum de Ana…)" maxlength="80">
      <label for="inDate" class="sr">Fecha</label><input id="inDate" type="date" value="${esc(localDay())}"><div class="btns"><button class="btn" type="submit">Guardar ingreso</button><button class="btn ghost" type="button" data-act="income-add">Cancelar</button></div></form>` : "";
  const review = bankRead?.busy ? `<p class="muted">📸 ${esc(bankRead.busy)}</p>` : bankRead?.items ? `<div class="stack bank-review"><p><b>${bankRead.items.length ? `He leído ${bankRead.items.length} movimiento${bankRead.items.length === 1 ? "" : "s"}` : "No he visto movimientos claros en esas capturas."}</b>${bankRead.items.some((x) => !x.on) ? ' <span class="muted small">Los que ya tenías van sin marcar.</span>' : ""}</p>
      ${bankRead.items.map((m, i) => `<div class="row"><button class="check" data-act="bank-tick" data-i="${i}" aria-pressed="${m.on}" aria-label="Añadir ${esc(m.concept)}">${I.check}</button><div class="grow"><div>${esc(m.concept)}</div><div class="muted small">${esc(new Date(m.at).toLocaleDateString("es-ES", { day: "numeric", month: "short" }))}${m.income ? ` · ${esc(INCOME_KIND[m.kind] ?? "Ingreso")}` : ""}</div></div><b class="num ${m.income ? "pos" : ""}">${m.income ? "+" : "−"}${esc(eurosTxt(m.cents))}</b></div>`).join("")}
      <div class="btns">${bankRead.items.some((x) => x.on) ? `<button class="btn" data-act="bank-save">Añadir ${bankRead.items.filter((x) => x.on).length}</button>` : ""}<button class="btn ghost" data-act="bank-cancel">${bankRead.items.length ? "Descartar" : "Vale"}</button></div></div>` : "";
  return `<section class="card add-money"><h2>Añadir</h2>
    <div class="btns"><button class="btn" data-act="sheet" data-kind="EXPENSE">➖ Gasto</button><button class="btn ghost" data-act="income-add" aria-expanded="${incomeForm}">➕ Ingreso</button><label class="btn ghost" for="bankShots" role="button" tabindex="0">📸 Capturas del banco</label><input id="bankShots" type="file" accept="image/*" multiple class="sr"></div>
    ${form}${review}
    ${bankRead ? "" : `<p class="muted small">Hasta ${MAX_SHOTS} capturas. Las lee Gemini (van a Google) y tú revisas antes de guardar.</p>`}</section>`;
}
async function readBankShots(files) {
  const list = [...files].filter((f) => /^image\//.test(f.type)).slice(0, MAX_SHOTS);
  if (!list.length) return;
  if (!aiReady()) { toast("Para leer capturas necesito tu clave de Gemini (Tú → IA)"); return; }
  if (!sensitiveAllowed() && !window.confirm("Las capturas del banco se enviarán a Google (Gemini) para leer los movimientos. No se guardan en Google Drive ni en el chat. ¿Seguimos?")) return;
  bankRead = { busy: `Leyendo ${list.length} captura${list.length === 1 ? "" : "s"}…` }; render();
  try {
    const shots = [];
    for (const f of list) shots.push((await compressImage(f)).split(",")[1]);
    const { text } = await askWithActions({ key: aiStore.key, model: aiStore.model, payload: buildBankShotsPayload(shots, today()), confirmed: true, permit: () => true });
    const items = parseBankShots(text, today()).map((m) => ({ ...m, on: !alreadyThere(m, vault.spending, vault.income) }));
    bankRead = { items };
  } catch (err) {
    bankRead = null;
    toast(err.code === "quota" ? "Hoy ya no queda IA gratuita." : err.code === "key" ? "La clave de Gemini no funciona. Revísala en Tú → IA." : `No he podido leer las capturas: ${aiErrorText(err)}`);
  }
  render();
}
function saveBankShots() {
  const on = (bankRead?.items ?? []).filter((m) => m.on);
  let out = 0, inn = 0;
  for (const m of on) {
    if (m.income) { vault.income.push({ id: uid("in"), cents: m.cents, concept: m.concept, at: m.at, source: "SHOT", kind: m.kind ?? incomeKind(m.concept) }); inn++; }
    else { vault.spending.push({ ...newEntry({ id: uid("s"), cents: m.cents, merchant: m.concept, at: m.at }, vault.settings.categoryRules ?? {}), source: "SHOT" }); out++; }
  }
  bankRead = null;
  persist(); render();
  toast(`Añadidos ${out} gasto${out === 1 ? "" : "s"} y ${inn} ingreso${inn === 1 ? "" : "s"}${toAsk(vault.spending, today()).length ? ". ¿Con quién fuiste al bar? Te lo pregunto arriba" : ""}`);
}
function saveSplit(mode) {
  const e = vault.spending.find((x) => x.id === splitDraft?.entryId);
  if (!e || !splitDraft.people.length) return;
  try {
    const people = splitDraft.people.map((p) => ({ key: p.key, name: p.name, ...(p.googleId ? { googleId: p.googleId } : {}), ...(mode === "detail" ? { cents: p.cents ?? 0, what: p.what } : {}) }));
    const split = mode === "equal" ? equalSplit(e.cents, people) : detailSplit(e.cents, people);
    vault.spending = vault.spending.map((x) => (x.id === e.id ? { ...x, split, splitAsked: true } : x));
    splitDraft = null;
    persist(); render();
    const owed = split.people.reduce((s, p) => s + p.cents, 0);
    toast(owed ? `Apuntado: te deben ${eurosTxt(owed)}` : "Apuntado: todo tuyo");
  } catch (err) { toast(err.message); }
}

// ---------- Barra de comandos (WEB-78) ----------
// Outside #screen, so a render never touches it while Manu types.
const cmdk = { el: null, items: [], sel: 0 };
function openCmdk(prefill = "") {
  if (!cmdk.el) {
    const bg = document.createElement("div");
    bg.id = "cmdkBg"; bg.className = "cmdk-bg"; bg.hidden = true;
    bg.innerHTML = `<div class="cmdk" role="dialog" aria-modal="true" aria-label="Comando rápido">
      <label for="cmdkInput" class="sr">Qué quieres hacer</label>
      <input id="cmdkInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" placeholder="Entro, gasto 12 café, hábitos…" role="combobox" aria-expanded="true" aria-controls="cmdkList">
      <ul id="cmdkList" class="cmdk-list" role="listbox"></ul>
      <p class="muted small cmdk-help">Enter para hacerlo · Esc para cerrar</p></div>`;
    document.body.appendChild(bg);
    bg.addEventListener("click", (e) => {
      const li = e.target.closest("[data-i]");
      if (li) { pickCmdk(Number(li.dataset.i)); return; }
      if (e.target === bg) closeCmdk();
    });
    bg.querySelector("#cmdkInput").addEventListener("input", () => { cmdk.sel = 0; drawCmdk(); });
    bg.querySelector("#cmdkInput").addEventListener("keydown", (e) => {
      if (e.isComposing) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); cmdk.sel = (cmdk.sel + (e.key === "ArrowDown" ? 1 : -1) + cmdk.items.length) % Math.max(1, cmdk.items.length); drawCmdk(false); }
      else if (e.key === "Enter") { e.preventDefault(); pickCmdk(cmdk.sel); }
      else if (e.key === "Escape") { e.preventDefault(); closeCmdk(); }
    });
    cmdk.el = bg;
  }
  const input = cmdk.el.querySelector("#cmdkInput");
  input.value = prefill; cmdk.sel = 0;
  cmdk.el.hidden = false;
  drawCmdk();
  input.focus();
}
function closeCmdk() { if (cmdk.el) cmdk.el.hidden = true; }
function drawCmdk(rebuild = true) {
  const input = cmdk.el.querySelector("#cmdkInput");
  if (rebuild) cmdk.items = suggest(input.value, { clock: shiftNow().state });
  cmdk.el.querySelector("#cmdkList").innerHTML = cmdk.items.map((x, i) => `<li role="option" id="cmdk-${i}" data-i="${i}" class="cmdk-item${i === cmdk.sel ? " on" : ""}" aria-selected="${i === cmdk.sel}">${esc(x.label)}</li>`).join("");
  input.setAttribute("aria-activedescendant", `cmdk-${cmdk.sel}`);
}
function pickCmdk(i) {
  const it = cmdk.items[i];
  if (!it) return;
  const input = cmdk.el.querySelector("#cmdkInput");
  if (it.fill) { input.value = it.fill; cmdk.sel = 0; drawCmdk(); input.focus(); return; }
  closeCmdk();
  runCommand(it.run);
}
function runCommand(text) {
  const cmd = parseCommand(text);
  if (!cmd) return;
  if (cmd.type === "punch") { doPunch(cmd.t, cmd.why ?? null); return; }
  if (cmd.type === "mood") {
    vault.moods = setMood(vault.moods, localDay(), cmd.value); persist(); render();
    toast(`Ánimo de hoy: ${MOODS.find((m) => m.value === cmd.value)?.label.toLowerCase() ?? ""}`); return;
  }
  if (cmd.type === "habit") {
    const want = normalise(cmd.name);
    const h = vault.habits.find((x) => normalise(x.name) === want) ?? vault.habits.find((x) => normalise(x.name).includes(want));
    if (!h) { goTo("tu/habitos"); render(); toast(`No tienes un hábito «${cmd.name}»: créalo aquí`); return; }
    if ((h.done ?? []).includes(localDay())) { toast(`«${h.name}» ya estaba hecho hoy`); return; }
    vault.habits = vault.habits.map((x) => (x.id === h.id ? toggleHabit(x, localDay()) : x)); persist(); render();
    toast(`✅ ${h.name}: hecho hoy`); return;
  }
  if (cmd.type === "go") { goTo(cmd.target); render({ enter: "page" }); return; }
  // Anything else, as if typed in the chat. Things MANU just does (gasto, tarea,
  // idea, aviso) stay here with a toast; questions open the chat for the answer.
  const kind = parse(cmd.text).kind;
  const before = vault.chat.length;
  say(cmd.text);
  const last = vault.chat.at(-1);
  if (["expense", "task", "idea", "reminder"].includes(kind) && !refuge && vault.chat.length > before && last?.from === "manu") toast(String(last.text ?? "Hecho").split("\n")[0].slice(0, 160));
  else { tab = "manu"; sub = null; render(); }
}
document.addEventListener("keydown", (e) => {
  const typing = e.target.matches?.("input, textarea, select, [contenteditable]");
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (cmdk.el && !cmdk.el.hidden) closeCmdk(); else openCmdk(); }
  else if (e.key === "/" && !typing && !sheet && !(cmdk.el && !cmdk.el.hidden)) { e.preventDefault(); openCmdk(); }
});

// From a Shortcut: «#di=…» (or the old «?di=…»), «#eventos=…», «#manana=1».
function applyLaunch() {
  const q = launchParams(location.search), h = launchParams(location.hash);
  const launch = { say: h.say ?? q.say, events: h.events ?? q.events, morning: h.morning || q.morning };
  if (!launch.morning && !launch.say && !launch.events) return false;
  history.replaceState(null, "", location.pathname);
  if (launch.morning) { tab = "hoy"; morningLaunch = true; }
  if (launch.events) { vault.agenda = { day: localDay(), events: launch.events, importedAt: new Date().toISOString() }; persist(); tab = "agenda"; }
  if (launch.say) { tab = "manu"; say(launch.say); }
  return true;
}
applyLaunch();
// «…/manu-os/#nube=<url>|<key>»: fills «Tu nube» (also if MANU was already open).
function applyNubeLink() {
  if (!location.hash.startsWith("#nube=")) return false;
  const link = parseSyncLink(location.hash);
  history.replaceState(null, "", location.pathname + location.search);
  // WEB-67: the project is built in; the old link just opens «Tu nube».
  if (link) { tab = "tu"; sub = "nube"; }
  return true;
}
applyNubeLink();
// WEB-67: the email's link (if the template sends a link, not a code).
{
  const linked = parseAuthHash(location.hash);
  if (linked || /error_description=/.test(location.hash)) {
    history.replaceState(null, "", location.pathname + location.search);
    tab = "tu"; sub = "nube";
    if (linked && inIosBrowser()) {
      // WEB-68: on the iPhone the email opens Safari, not the installed app
      // (their storage is separate). Don't use the session here: show its
      // refresh code so Manu pastes it into MANU. Kept only in memory.
      nube.handoff = linked.refresh;
    } else if (linked) {
      nube.session = linked;
      nubeAfterSignIn().then(() => { render(); nubeSync({ manual: true }); }).catch((err) => toast(syncErrorText(err)));
    } else setTimeout(() => toast("El enlace del correo ha caducado: pide un código nuevo"), 300);
  }
}
window.addEventListener("hashchange", () => { if (applyNubeLink() || applyLaunch() || applyIr()) render(); });
render({ enter: "page" });
nubeSync();
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") nubeSync(); });
refreshWeather();
if (isClientId(gClientId()) && GOOGLE_FEATURES.some(([k]) => googleOn(k))) loadGis().catch(() => {});
checkReminders();
setInterval(checkReminders, 30000);
setInterval(autoSyncGoogle, 60000);
document.addEventListener("visibilitychange", autoSyncGoogle);
setInterval(() => { if (tab === "hoy" && !sheet && !document.activeElement?.matches("input, textarea")) render(); }, 60000);
