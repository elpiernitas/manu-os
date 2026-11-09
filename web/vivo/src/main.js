// HORIZONTE · el motor. Un estado, un cielo, siete vistas y un solo sitio donde se atienden los toques.
// Este prototipo NO lee `manuos.vault`, no llama a ninguna red y no guarda nada tuyo: trabaja
// sobre el vault de demostración de `demo.js`. Solo recuerda (localStorage) el tiempo de demo elegido.
import { cielo, variables, TIEMPOS } from "./cielo.js";
import { vaultDemo } from "./demo.js";
import * as A from "./adaptadores.js";
import * as X from "./acciones.js";
import { hoja, cerrarHoja, aviso, icono, cara, esc, quieto } from "./ui.js";
import * as hoy from "./vistas/hoy.js";
import * as agenda from "./vistas/agenda.js";
import * as manu from "./vistas/manu.js";
import * as dinero from "./vistas/dinero.js";
import * as bahia from "./vistas/bahia.js";
import * as proyectos from "./vistas/proyectos.js";
import * as tu from "./vistas/tu.js";

const VISTAS = { bahia, hoy, manu, dinero, proyectos, tu, agenda };
const NAV = [["bahia", "Bahía"], ["hoy", "Hoy"], ["manu", "MANU"], ["dinero", "Dinero"], ["proyectos", "Astillero"], ["tu", "Tú"]];
const TITULO = { bahia: "Bahía", hoy: "Hoy", manu: "MANU", dinero: "Dinero", proyectos: "Proyectos", tu: "Tú", agenda: "Agenda" };
const recuerda = (k, v) => { try { if (v === undefined) return localStorage.getItem(`manuos.vivo.${k}`); localStorage.setItem(`manuos.vivo.${k}`, v); } catch { /* sin almacenamiento: la demo funciona igual */ } return null; };
const SALUDO = { id: "m0", de: "manu", cara: "calma", texto: "No te voy a escribir cada cinco minutos. Aparezco cuando tenga algo que merezca la pena. Y si no sé algo, te lo digo." };

const S = { vault: vaultDemo(), vista: "hoy", tiempo: TIEMPOS.includes(recuerda("tiempo")) ? recuerda("tiempo") : "lluvia", minutos: null, ui: { botella: "playa" }, chat: [SALUDO] };
const main = document.getElementById("contenido"), dique = document.getElementById("dique"), capas = document.getElementById("capas");

function calcula() {
  const real = new Date();
  S.instante = real;
  if (S.minutos != null) { S.instante = new Date(real); S.instante.setHours(Math.floor(S.minutos / 60), S.minutos % 60, 0, 0); }
  S.cielo = cielo(S.instante, S.tiempo);
  S.vm = {
    euros: A.euros,
    portada: A.portada(S.vault, { ahora: S.instante, tiempo: S.tiempo, real }),
    dinero: A.dinero(S.vault, { ahora: real }),
    memoria: A.constelacion(S.vault.brain, { ahora: real }),
    astillero: A.astillero(S.vault.projects),
    semana: A.semana(S.vault.eventos, S.vault.reminders, { ahora: real }),
    bahia: A.bahia(S.vault),
  };
}
function pintaCielo() {
  const r = document.documentElement;
  for (const [k, v] of Object.entries(variables(S.cielo))) r.style.setProperty(k, v);
  r.dataset.tema = S.cielo.oscuro ? "noche" : "dia"; r.dataset.tiempo = S.cielo.tiempo; r.dataset.fase = S.cielo.fase; r.dataset.astro = S.cielo.astro.tipo;
  document.querySelector('meta[name="theme-color"]').content = S.cielo.colores.arriba;
}
function pintaDique() {
  dique.innerHTML = NAV.map(([id, n]) => `<a href="#${id}" data-ir="${id}" class="${id === "manu" ? "nav-manu" : ""}"${S.vista === id ? ' aria-current="page"' : ""}>${id === "manu" ? cara(S.ui.pensando ? "piensa" : "calma") : icono(id)}<span>${n}</span></a>`).join("")
    + `<a href="#agenda" data-ir="agenda" class="solo-mac"${S.vista === "agenda" ? ' aria-current="page"' : ""}>${icono("agenda")}<span>Agenda</span></a><button class="solo-mac" data-act="sonda">${icono("sonda")}<span>Sonda</span><kbd>⌘K</kbd></button>`;
}
function pinta() {
  calcula(); pintaCielo(); pintaDique();
  main.innerHTML = VISTAS[S.vista].pinta(S);
  document.title = `${TITULO[S.vista]} · MANU OS`;
}
function ir(vista, { foco = true } = {}) {
  if (!VISTAS[vista]) vista = "hoy";
  const cambia = () => { S.vista = vista; pinta(); scrollTo(0, 0); if (foco) main.focus({ preventScroll: true }); };
  try { if (location.hash !== `#${vista}`) history.replaceState(null, "", `#${vista}`); } catch { /* marcos que no dejan tocar el historial */ }
  if (document.startViewTransition && !quieto()) document.startViewTransition(cambia); else cambia();
}
const cambia = (vault) => { S.vault = vault; pinta(); };
const estrella = (id) => S.vm.memoria.estrellas.find((e) => e.id === id);

// ---------- MANU habla (guion de demo) ----------
function decir(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return;
  S.chat.push({ id: `y${S.chat.length}`, de: "yo", texto: t });
  S.ui.pensando = true; pinta(); alFinal();
  setTimeout(() => {
    const r = X.responder(t, S.vm);
    S.ui.pensando = false;
    S.chat.push({ id: `m${S.chat.length}`, de: "manu", ...r, textos: Object.fromEntries((r.elegir ?? []).map((id) => [id, estrella(id)?.texto ?? ""])) });
    pinta(); alFinal();
  }, quieto() ? 0 : 900);
}
const alFinal = () => document.querySelector(".charla li:last-child")?.scrollIntoView({ block: "center", behavior: quieto() ? "auto" : "smooth" });
const cierra = (msg) => { const m = S.chat.find((x) => x.id === msg); if (m) m.cerrado = true; };
const manuDice = (carita, texto) => { S.chat.push({ id: `m${S.chat.length}`, de: "manu", cara: carita, texto }); };

// ---------- La sonda ----------
function abrirSonda() {
  const d = hoja(`<p class="ante">Echar la sonda</p><label class="oculto" for="sonda">Buscar en todo</label><input id="sonda" class="sonda-campo" placeholder="¿Qué buscas en el fondo?" autocomplete="off" data-input="sonda"><div id="sonda-res" aria-live="polite"><p class="nota">Busca en agenda, proyectos, dinero y memoria a la vez. Prueba «logo», «bar» o «noche».</p></div>`, { etiqueta: "Buscar", clase: "hoja-sonda" });
  d.querySelector("input").focus();
}
function sondear(q) {
  const res = A.sonda(q, S.vault), el = document.getElementById("sonda-res");
  if (!el) return;
  el.innerHTML = q.trim().length < 2 ? '<p class="nota">Escribe al menos dos letras.</p>' : res.length ? res.map((c) => `<section class="sonda-capa"><h3 class="ante">${esc(c.capa)}</h3>${c.hallazgos.map((h) => `<a href="#${h.ir}" data-ir="${h.ir}"><span>${esc(h.texto)}</span><span class="mini">${esc(h.pista)}</span></a>`).join("")}</section>`).join("") : `<p class="nota">La sonda no toca nada con «${esc(q)}». No hay fondo ahí.</p>`;
}
function abrirProyecto(id) { const b = S.vm.astillero.barcos.find((x) => x.id === id); if (b) hoja(proyectos.expediente(b), { etiqueta: b.nombre }); }

// ---------- Acciones (un toque de Manu = una acción) ----------
const ACCION = {
  "cerrar-hoja": () => cerrarHoja(),
  sonda: abrirSonda,
  constelacion: () => { S.ui.manu = "cielo"; ir("manu"); },
  "dial-ahora": () => { S.minutos = null; pinta(); },
  "tiempo-ciclo": () => { S.tiempo = TIEMPOS[(TIEMPOS.indexOf(S.tiempo) + 1) % TIEMPOS.length]; recuerda("tiempo", S.tiempo); pinta(); aviso(`Tiempo de demo: ${S.tiempo}`); },
  "botella-abrir": () => { const n = S.vm.dinero.noches[0]; hoja(`<p class="ante">La propuesta</p><h2 class="titulo-2">Un tope de ${esc(A.euros(Math.round(n.total * 0.8 / 500) * 500, 0))} por noche</h2><p>Si lo activas, lo apunto como decisión tuya y solo te aviso si una noche lo pasas. Sin sermones.</p><div class="fila"><button class="boton" data-act="botella-si">Activarlo</button><button class="boton boton-linea" data-act="botella-tirar">Mejor no</button></div>`, { etiqueta: "Propuesta de MANU" }); },
  "botella-si": () => { const n = S.vm.dinero.noches[0]; S.ui.botella = "aceptada"; cerrarHoja(); cambia(X.recordar(S.vault, `Tope de ${A.euros(Math.round(n.total * 0.8 / 500) * 500, 0)} por noche de fiesta`, { kind: "DECISION", tags: ["dinero", "noche", "decisiones"] })); aviso("Apuntado como decisión tuya. Está en tu Bitácora."); },
  "botella-tirar": () => { S.ui.botella = "mar"; cerrarHoja(); pinta(); aviso("Devuelta al mar. No insisto."); },
  "botella-nunca": () => { S.ui.botella = "nunca"; pinta(); aviso("Entendido: no más propuestas de este tipo."); },
  dia: (id) => { S.ui.dia = id; pinta(); },
  "cita-nueva": (id) => hoja(agenda.formulario(id), { etiqueta: "Nueva cita" }),
  "manu-modo": (id) => { S.ui.manu = id; pinta(); },
  estrella: (id) => { const s = (S.ui.estrellas ?? []).filter((x) => x !== id); S.ui.estrellas = (S.ui.estrellas ?? []).includes(id) ? s : [...s, id].slice(-2); pinta(); document.querySelector(`.estrella[data-id="${id}"]`)?.focus(); },
  "mem-confirmar": (id, el) => { cierra(el.dataset.msg); cerrarHoja(); cambia(X.confirmar(S.vault, id)); aviso("Confirmado. Ahora lo sé."); },
  "mem-dudar": (id) => { cerrarHoja(); cambia(X.dudar(S.vault, id)); aviso("En duda. Te lo volveré a preguntar."); },
  "mem-corregir": (id) => { const e = estrella(id); if (e) hoja(tu.fichaRecuerdo(e), { etiqueta: "Recuerdo" }); },
  "mem-olvidar": (id, el) => {
    if (S.ui.borrar !== id) { S.ui.borrar = id; el.textContent = "¿Seguro? Toca otra vez"; return; }
    S.ui.borrar = null; S.ui.estrellas = (S.ui.estrellas ?? []).filter((x) => x !== id); cierra(el.dataset.msg); cerrarHoja(); cambia(X.olvidar(S.vault, id)); aviso("Olvidado. No vuelve.");
  },
  frase: (id) => ACCION["mem-corregir"](id),
  decir: (id) => decir(id),
  cara: () => { manuDice("feliz", "¡Eh! Que hace cosquillas."); pinta(); },
  "zasca-touche": (id) => { cierra(id); manuDice("feliz", "Apuntado. Sin rencor."); pinta(); alFinal(); },
  "zasca-recurso": (id) => { cierra(id); manuDice("duda", "Recurso admitido. Si un dato está mal, corrígelo en Dinero o en tu Bitácora y cambio de opinión. Yo no tengo orgullo: tengo recibos."); pinta(); alFinal(); },
  contra: (id, el) => { cierra(el.dataset.msg); S.vault = X.olvidar(S.vault, id); manuDice("calma", "Hecho: esa la retiro. La otra se queda como cierta hasta que digas lo contrario."); pinta(); alFinal(); },
  "noche-si": (id) => { const n = S.vm.dinero.noches.find((x) => x.id === id); S.ui.noches = { ...S.ui.noches, [id]: "si" }; cambia(X.recordar(S.vault, `Salí de fiesta el ${new Date(n.inicio).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`, { kind: "MEMORY", tags: ["noche", "amigos"] })); aviso("Apuntado en tu memoria porque tú lo has dicho."); },
  "noche-no": (id) => { S.ui.noches = { ...S.ui.noches, [id]: "no" }; pinta(); },
  "banco-estado": (id) => { S.ui.banco = id; S.ui.importe = null; pinta(); },
  importar: () => hoja(dinero.confirmarImporte(), { etiqueta: "Confirmar importación" }),
  "importar-si": () => {
    cerrarHoja(); S.ui.banco = "cargando"; S.ui.importe = null; pinta();
    setTimeout(() => { const r = X.importarDemo(S.vault); S.ui.banco = "conectado"; S.ui.importe = { nuevos: r.nuevos, duplicados: r.duplicados }; cambia(r.vault); aviso(`${r.nuevos} movimientos nuevos; ${r.duplicados} repetidos sin duplicar.`); }, quieto() ? 0 : 1100);
  },
  lugar: (id) => { if (id === "astillero") return ir("proyectos"); S.ui.lugar = id; pinta(); document.querySelector(`.lugar[data-id="${id}"]`)?.focus({ preventScroll: true }); },
  proyecto: abrirProyecto,
  botar: (id) => {
    const antes = S.vm.astillero.barcos.find((x) => x.id === id);
    if (!antes?.listo) return;
    cerrarHoja(); cambia(X.botar(S.vault, id));
    capas.insertAdjacentHTML("beforeend", proyectos.botadura(antes));
    capas.querySelector(".botadura .boton")?.focus();
  },
  "botadura-fin": () => capas.querySelector(".botadura")?.remove(),
  reiniciar: () => { S.vault = vaultDemo(); S.ui = { botella: "playa" }; S.chat = [SALUDO]; S.minutos = null; pinta(); aviso("Demo como nueva."); },
};
const ENTRADA = {
  dial: (v) => {
    S.minutos = Number(v); calcula(); pintaCielo();
    const h = S.instante, p = S.vm.portada;
    document.querySelector(".dial output").textContent = `${String(h.getHours()).padStart(2, "0")}:${String(h.getMinutes()).padStart(2, "0")}`;
    document.querySelector(".titular").textContent = p.titular;
  },
  banco: (v) => ACCION["banco-estado"](v),
  tiempo: (v) => { S.tiempo = v; recuerda("tiempo", v); pinta(); },
  sonda: sondear,
  tarea: (v, el) => { S.vault = X.marcarTarea(S.vault, el.dataset.id, el.dataset.tid); pinta(); abrirProyecto(el.dataset.id); document.querySelector(`[data-tid="${el.dataset.tid}"]`)?.focus(); },
  muelle: (v, el) => { S.vault = X.cambiarMuelle(S.vault, el.dataset.id, v); pinta(); abrirProyecto(el.dataset.id); aviso(`Movido al muelle ${A.AREAS[v]}.`); },
};
const FORM = {
  decir: (f) => { decir(f.get("texto")); },
  cita: (f) => { const [h, m] = String(f.get("hora")).split(":").map(Number); const d = new Date(`${f.get("dia")}T00:00:00`); d.setHours(h, m); cerrarHoja(); S.ui.dia = f.get("dia"); cambia(X.citar(S.vault, { title: f.get("title"), at: d })); aviso("Cita añadida (solo en la demo)."); },
  corregir: (f) => { cerrarHoja(); cambia(X.corregir(S.vault, f.get("id"), f.get("texto"))); aviso("Corregido. Gracias: así me equivoco menos."); },
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act], [data-ir]");
  if (!el) return;
  if (el.dataset.act) { if (el.tagName !== "INPUT") ACCION[el.dataset.act]?.(el.dataset.id, el); }
  if (el.dataset.ir) { e.preventDefault(); cerrarHoja(); ir(el.dataset.ir); }
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); abrirSonda(); return; }
  const el = e.target.closest?.('[role="button"][data-act]');
  if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); ACCION[el.dataset.act]?.(el.dataset.id, el); }
});
document.addEventListener("input", (e) => { const k = e.target.dataset?.input; if (k === "dial" || k === "sonda") ENTRADA[k](e.target.value, e.target); });
document.addEventListener("change", (e) => {
  const k = e.target.dataset?.input;
  if (k === "dial") { pinta(); document.getElementById("dial")?.focus(); } else if (k && k !== "sonda") ENTRADA[k]?.(e.target.value, e.target);
});
document.addEventListener("submit", (e) => { const k = e.target.dataset?.form; if (!FORM[k]) return; e.preventDefault(); FORM[k](new FormData(e.target)); });
addEventListener("hashchange", () => { const v = location.hash.slice(1); if (v !== S.vista) ir(v); });
setInterval(() => { if (S.minutos == null && !document.hidden && !document.querySelector("dialog[open], .botadura")) { calcula(); pintaCielo(); } }, 60000);

// Para pruebas y capturas: ?hora=13:30&tiempo=despejado fija el instante y el tiempo de la demo.
const q = new URLSearchParams(location.search);
if (/^\d{1,2}:\d{2}$/.test(q.get("hora") ?? "")) { const [h, m] = q.get("hora").split(":").map(Number); S.minutos = Math.min(1439, h * 60 + m); }
if (TIEMPOS.includes(q.get("tiempo"))) S.tiempo = q.get("tiempo");
ir(location.hash.slice(1) || "hoy", { foco: false });
