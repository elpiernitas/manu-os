import { parse, reply } from "./core/assistant.js";
import { CATEGORIES, euros, newEntry, correctCategory, summary } from "./core/money.js";
import { MODE_TITLES, modeState } from "./core/modes.js";
import { capture, confirm, markUnclassified, pending, tasks, ideas, toggleDone } from "./core/inbox.js";
import { initialRefuge, refugeReply } from "./core/refuge.js";
import { LocalStore, emptyVault, validateVault } from "./core/storage.js";
import { notificationStatus, isInstalled, enableNotifications, testNotification } from "./core/notify.js";

const store = new LocalStore(globalThis.localStorage ?? { getItem: () => null, setItem: () => { throw new Error("no storage"); } });
const loaded = store.load();
let vault = loaded.vault;
let tab = sessionStorage.getItem("manuos.tab") || "hoy";
let refuge = null; // Refugio conversation lives only in memory, never saved.
let confirmWipe = false;
let variant = vault.chat.length;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function persist() {
  if (vault.chat.length > 200) vault.chat = vault.chat.slice(-200);
  if (!store.save(vault)) toast("No he podido guardar en este dispositivo.");
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

const ICONS = {
  hoy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  agenda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  dinero: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="2" y="6" width="20" height="13" rx="3"/><circle cx="12" cy="12.5" r="2.5"/></svg>',
  tu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
};
const TABS = [["hoy", "Hoy"], ["agenda", "Agenda"], ["manu", "MANU"], ["dinero", "Dinero"], ["tu", "Tú"]];

function monthRange(d = new Date()) {
  return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 1)];
}

const screens = {
  hoy() {
    const m = modeState(new Date(), undefined, vault.settings.override);
    const inbox = pending(vault.inbox);
    const open = tasks(vault.inbox);
    const [s, e] = monthRange();
    const month = summary(vault.spending, s, e);
    return `<h1>Hoy</h1><div class="stack">
      <section class="card"><h2>Ahora</h2><div class="row"><span class="chip">Modo ${esc(MODE_TITLES[m.mode])}</span><span class="muted small">${esc(m.reason)}</span></div></section>
      <section class="card"><h2>Bandeja</h2>
        ${inbox.length ? inbox.map((c) => `<div class="stack"><div>${esc(c.text)}</div><div class="btns">
          <button class="btn" data-act="task" data-id="${esc(c.id)}">Es una tarea</button>
          <button class="btn ghost" data-act="idea" data-id="${esc(c.id)}">Es una idea</button>
          <button class="btn ghost" data-act="forget" data-id="${esc(c.id)}">No recuerdo</button></div></div>`).join("")
          : '<p class="muted">Nada pendiente. Lo que le pidas a MANU que apunte aparecerá aquí para que lo confirmes.</p>'}
      </section>
      <section class="card"><h2>Resumen</h2>
        <div class="row"><span>Tareas abiertas</span><span class="num">${open.length}</span></div>
        <div class="row"><span>Gastado este mes</span><span class="num">${euros(month.total)}</span></div>
      </section>
      <section class="card"><h2>Tiempo</h2><p class="muted">Pendiente de elegir el servicio meteorológico (D-06).</p></section>
    </div>`;
  },
  agenda() {
    const open = tasks(vault.inbox);
    const done = vault.inbox.filter((i) => i.status === "TASK" && i.done);
    const idea = ideas(vault.inbox);
    const row = (t) => `<div class="row"><button class="check" data-act="toggle" data-id="${esc(t.id)}" aria-pressed="${Boolean(t.done)}" aria-label="${t.done ? "Reabrir" : "Completar"}: ${esc(t.text)}"></button><span class="grow">${esc(t.text)}</span></div>`;
    return `<h1>Agenda</h1><div class="stack">
      <section class="card"><h2>Calendario</h2><p class="muted">Todavía no leo tu calendario. En la versión web no hay acceso al Calendario de Apple (ADR-0012).</p></section>
      <section class="card"><h2>Tareas</h2>${open.length ? open.map(row).join("") : '<p class="muted">Sin tareas. Dile a MANU «apunta …» y confírmala como tarea en Hoy.</p>'}</section>
      ${done.length ? `<section class="card"><h2>Hechas</h2>${done.map(row).join("")}</section>` : ""}
      <section class="card"><h2>Ideas</h2>${idea.length ? idea.map((i) => `<div class="row"><span class="grow">${esc(i.text)}</span></div>`).join("") : '<p class="muted">Tus ideas quedan aquí, sin convertirse en proyectos sin tu permiso.</p>'}</section>
    </div>`;
  },
  manu() {
    const chips = refuge ? ["quiero entender por qué", "buscar una solución", "necesito desconectar"] : ["gasté 3,20 en café", "apunta llamar al taller", "qué tengo hoy", "refugio"];
    const history = vault.chat.length ? vault.chat : [{ from: "manu", text: "Hola, Manu. Funciono sin IA: puedo apuntar ideas y tareas, registrar gastos y acompañarte en el Refugio." }];
    return `<h1>MANU</h1>
      ${refuge ? `<div class="refuge-bar"><span>Refugio · lo que hables aquí no se guarda</span><button class="link" data-act="leave-refuge">Salir</button></div>` : ""}
      <div class="suggest" aria-label="Sugerencias">${chips.map((s) => `<button data-say="${esc(s)}">${esc(s)}</button>`).join("")}</div>
      <div class="chat" id="chat" aria-live="polite">${[...history, ...(refuge?.messages ?? [])].map((b) => `<div class="bubble ${b.from}${b.safety ? " safety" : ""}">${esc(b.text)}</div>`).join("")}</div>
      <form class="composer" id="composer"><label for="msg" class="sr">Mensaje para MANU</label><input id="msg" autocomplete="off" enterkeyhint="send" placeholder="${refuge ? "Cuéntame" : "Escribe a MANU"}"><button class="btn" type="submit">Enviar</button></form>`;
  },
  dinero() {
    const [s, e] = monthRange();
    const month = summary(vault.spending, s, e);
    const entries = [...vault.spending].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 50);
    const cats = Object.entries(month.byCategory).sort((a, b) => b[1] - a[1]);
    return `<h1>Dinero</h1><div class="stack">
      <section class="card"><h2>Este mes</h2>
        <div class="row"><strong>Total</strong><strong class="num">${euros(month.total)}</strong></div>
        ${cats.map(([c, v]) => `<div class="row"><span>${esc(CATEGORIES[c])}</span><span class="num">${euros(v)}</span></div>`).join("")}
      </section>
      <section class="card"><h2>Movimientos</h2>
        ${entries.length ? entries.map((x) => `<div class="row"><div class="grow"><div>${esc(x.merchant ?? "Sin comercio")}</div><div class="muted small">${new Date(x.at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}${x.inferred ? " · categoría propuesta" : ""}</div></div>
          <div class="stack"><span class="num">${euros(x.cents)}</span><label class="sr" for="cat-${esc(x.id)}">Categoría</label><select id="cat-${esc(x.id)}" data-cat="${esc(x.id)}">${Object.entries(CATEGORIES).map(([k, t]) => `<option value="${k}"${k === x.category ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div></div>`).join("")
          : '<p class="muted">Sin gastos. Escribe a MANU, por ejemplo: «gasté 12,50 en café».</p>'}
      </section>
    </div>`;
  },
  tu() {
    const n = notificationStatus();
    const notif = { unsupported: isInstalled() ? "Este dispositivo no permite avisos web." : "En iPhone, primero añade MANU a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde ahí.", default: "Desactivados.", granted: "Activados.", denied: "Bloqueados. Actívalos en Ajustes → Notificaciones → MANU." }[n];
    return `<h1>Tú</h1><div class="stack">
      <section class="card"><h2>Refugio</h2><p class="muted">Para cuando no estás bien. Sin diagnósticos y sin guardar la conversación.</p><div class="btns"><button class="btn" data-act="refuge">Abrir Refugio</button></div></section>
      <section class="card"><h2>Avisos</h2><p class="muted">${esc(notif)}</p>
        <div class="btns">${n === "default" ? '<button class="btn" data-act="notify-on">Activar avisos</button>' : ""}${n === "granted" ? '<button class="btn ghost" data-act="notify-test">Probar un aviso</button>' : ""}</div>
        <p class="muted small">Los recordatorios a una hora concreta necesitan un servidor de avisos que aún no existe.</p></section>
      <section class="card"><h2>Tus datos</h2><p class="muted">Todo se guarda solo en este dispositivo. Haz copias de vez en cuando: si borras los datos de Safari, se pierden.</p>
        <div class="btns"><button class="btn ghost" data-act="export">Descargar copia</button><label class="btn ghost" for="import" role="button" tabindex="0">Restaurar copia</label><input id="import" type="file" accept="application/json,.json" class="sr"></div>
        ${confirmWipe ? '<p>¿Seguro? Se borra todo lo guardado en este dispositivo.</p><div class="btns"><button class="btn danger" data-act="wipe-yes">Sí, borrar todo</button><button class="btn ghost" data-act="wipe-no">Cancelar</button></div>' : '<button class="link" data-act="wipe">Borrar todos los datos…</button>'}
      </section>
      <section class="card"><h2>Próximamente</h2><p class="muted">Salud, comidas, personas y hábitos. En la web no hay acceso a Salud ni a Contactos de Apple.</p></section>
      <p class="muted small">MANU OS web · datos locales · sin IA</p>
    </div>`;
  },
};

function render({ focus = false } = {}) {
  $("tabs").innerHTML = TABS.map(([id, label]) => `<button class="tab" role="tab" data-tab="${id}" aria-selected="${tab === id}">${id === "manu" ? '<span class="dot" aria-hidden="true">M</span>' : ICONS[id]}<span>${label}</span></button>`).join("");
  $("screen").innerHTML = (screens[tab] ?? screens.hoy)();
  if (tab === "manu") $("chat")?.lastElementChild?.scrollIntoView({ block: "end" });
  if (focus) $("screen").focus();
}

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
  const now = new Date().toISOString();
  if (intent.kind === "refuge" || intent.kind === "lowMood") {
    // Mood messages are sensitive: they are not written to the saved chat.
    refuge = { state: initialRefuge(), messages: [{ from: "me", text: clean }, { from: "manu", text: reply(intent, variant++) }] };
    render();
    return;
  }
  if (intent.kind === "crisis") {
    refuge = { state: { phase: "HUMAN_HELP", turn: 0 }, messages: [{ from: "me", text: clean }, { from: "manu", text: reply(intent), safety: true }] };
    render();
    return;
  }
  if (intent.kind === "expense") vault.spending.push(newEntry({ id: uid("s"), cents: intent.cents, merchant: intent.merchant, at: now }));
  if (intent.kind === "idea") vault.inbox.push(capture({ id: uid("c"), text: intent.text, at: now }));
  vault.chat.push({ from: "me", text: clean, at: now }, { from: "manu", text: reply(intent, variant++), at: now });
  persist();
  render();
}

function updateItem(id, fn) {
  vault.inbox = vault.inbox.map((i) => (i.id === id ? fn(i) : i));
  persist();
  render();
}

document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-tab]");
  if (t) { tab = t.dataset.tab; sessionStorage.setItem("manuos.tab", tab); render({ focus: true }); scrollTo(0, 0); return; }
  const s = e.target.closest("[data-say]");
  if (s) { say(s.dataset.say); return; }
  const a = e.target.closest("[data-act]");
  if (!a) return;
  const id = a.dataset.id;
  switch (a.dataset.act) {
    case "task": updateItem(id, (i) => confirm(i, "TASK")); toast("Guardada como tarea"); break;
    case "idea": updateItem(id, (i) => confirm(i, "IDEA")); toast("Guardada como idea"); break;
    case "forget": updateItem(id, markUnclassified); break;
    case "toggle": updateItem(id, toggleDone); break;
    case "refuge": refuge = { state: initialRefuge(), messages: [{ from: "manu", text: "Estoy aquí. ¿Qué te vendría mejor ahora: entender por qué estás así, buscar una solución o cambiar de aire?" }] }; tab = "manu"; render({ focus: true }); break;
    case "leave-refuge": refuge = null; render(); break;
    case "notify-on": await enableNotifications(); render(); break;
    case "notify-test": if (!(await testNotification())) toast("No se ha podido mostrar el aviso."); break;
    case "export": exportBackup(); break;
    case "wipe": confirmWipe = true; render(); break;
    case "wipe-no": confirmWipe = false; render(); break;
    case "wipe-yes": vault = emptyVault(); confirmWipe = false; persist(); render(); toast("Datos borrados de este dispositivo"); break;
  }
});

document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("label[for=import]")) { e.preventDefault(); $("import").click(); }
});

document.addEventListener("submit", (e) => {
  if (e.target.id !== "composer") return;
  e.preventDefault();
  const input = $("msg");
  const value = input.value;
  input.value = "";
  say(value);
  $("msg")?.focus();
});

document.addEventListener("change", async (e) => {
  if (e.target.dataset.cat) {
    vault.spending = vault.spending.map((x) => (x.id === e.target.dataset.cat ? correctCategory(x, e.target.value) : x));
    persist();
    render();
    return;
  }
  if (e.target.id === "import" && e.target.files?.[0]) {
    try {
      const result = validateVault(JSON.parse(await e.target.files[0].text()));
      if (!result.ok) { toast(result.reason); return; }
      vault = result.vault;
      persist();
      render();
      toast("Copia restaurada");
    } catch {
      toast("Ese archivo no es una copia de MANU OS.");
    }
  }
});

function exportBackup() {
  const blob = new Blob([JSON.stringify(vault, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `manu-os-copia-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

if (loaded.warning) {
  $("banner").textContent = loaded.warning;
  $("banner").hidden = false;
}
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
render();
