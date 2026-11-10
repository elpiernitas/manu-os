// HORIZONTE (WEB-108): el núcleo del tema. Todo puro: entra el vault real (o partes) y sale lo
// que pintan las pantallas. Nada aquí inventa datos: si falta algo, sale vacío y la pantalla
// muestra un estado vacío. Regla del tema: lo que sale de contar es HECHO; lo que se interpreta es
// HIPÓTESIS (con su base); lo que aún no está claro es PENDIENTE.
import { related, staleness } from "./brain.js";
import { normalise } from "./text.js";
import { cleanConcept } from "./quickmoney.js";

const DIA = 864e5;
const RAD = Math.PI / 180;

// ---------- Temas ----------
export const SKINS = { design: "Claude Design", clasico: "Clásico", horizonte: "Horizonte" };
/** El diseño original de Claude Design es el predeterminado.
 *  Respeta las elecciones explícitas de otros temas y nunca toca el vault. */
export const skinOf = (settings) => (settings?.skin === "horizonte" || settings?.skin === "clasico" || settings?.skin === "design" ? settings.skin : "design");

// ---------- Cielo ----------
export const GIJON = { latitude: 43.53573, longitude: -5.66152 };
export const TIEMPOS = ["despejado", "nubes", "lluvia", "niebla"];
/** De los iconos de `core/weather.js` a los cuatro cielos del tema. Sin dato: despejado. */
export function tiempoDe(icon) {
  if (["rain", "storm", "snow", "drizzle"].includes(icon)) return "lluvia";
  if (icon === "fog") return "niebla";
  if (["cloud", "cloud-sun", "cloud-moon"].includes(icon)) return "nubes";
  return "despejado";
}

/** Elevación del sol (fórmula aproximada de la NOAA, ±1°) y ángulo horario (negativo = mañana). */
export function sol(fecha, { latitude: lat, longitude: lon } = GIJON) {
  const inicio = Date.UTC(fecha.getUTCFullYear(), 0, 0);
  const dia = Math.floor((fecha.getTime() - inicio) / DIA);
  const horas = fecha.getUTCHours() + fecha.getUTCMinutes() / 60;
  const g = (2 * Math.PI / 365) * (dia - 1 + (horas - 12) / 24);
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  let ha = (horas * 60 + eqt + 4 * lon) / 4 - 180;
  ha = ((ha + 540) % 360) - 180;
  const el = Math.asin(Math.sin(lat * RAD) * Math.sin(decl) + Math.cos(lat * RAD) * Math.cos(decl) * Math.cos(ha * RAD));
  return { elevacion: el / RAD, angulo: ha };
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
export const mezcla = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
function lum(h) { const [r, g, b] = hex(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
export const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const PARADAS = (tarde) => [
  [-12, "#060a18", "#131c3a", "#0a1226"],
  [-4, "#1b2358", tarde ? "#a8456b" : "#8b5d9c", "#2a2a5c"],
  [0, tarde ? "#2e3384" : "#4a5aa6", tarde ? "#ff8a4c" : "#ffb199", tarde ? "#6b4480" : "#5f5a96"],
  [8, "#6fa8e8", tarde ? "#ffd9a6" : "#ffe6cf", "#3f7fa6"],
  [25, "#3d8bef", "#cde7ff", "#1f6fa8"],
];
const VELO = { despejado: 0, nubes: 0.32, lluvia: 0.58, niebla: 0.66 };

/** El cielo de un instante: fase, colores, astro y si la interfaz va en tinta clara u oscura. */
export function cielo(fecha = new Date(), tiempo = "despejado", lugar = GIJON) {
  const coords = Number.isFinite(lugar?.latitude) && Number.isFinite(lugar?.longitude) ? lugar : GIJON;
  const { elevacion, angulo } = sol(fecha, coords);
  const tarde = angulo > 0;
  const p = PARADAS(tarde);
  const e = Math.max(p[0][0], Math.min(p[p.length - 1][0], elevacion));
  let i = 0;
  while (i < p.length - 2 && e > p[i + 1][0]) i++;
  const t = (e - p[i][0]) / (p[i + 1][0] - p[i][0]);
  let colores = [1, 2, 3].map((k) => mezcla(p[i][k], p[i + 1][k], t));
  const noche = elevacion < -1;
  const tt = TIEMPOS.includes(tiempo) ? tiempo : "despejado";
  const velo = VELO[tt];
  if (velo) { const gris = noche ? "#1a1f2b" : tt === "niebla" ? "#c9ced3" : "#7d8792"; colores = colores.map((c) => mezcla(c, gris, velo)); }
  const fase = elevacion < -6 ? "noche" : elevacion < 6 ? (tarde ? "ocaso" : "alba") : "dia";
  const astro = noche
    ? { tipo: "luna", x: ((angulo + 360) % 360 - 90) / 180, y: Math.min(1, Math.max(0.15, -elevacion / 50)) }
    : { tipo: "sol", x: Math.max(0, Math.min(1, (angulo + 100) / 200)), y: Math.max(0, Math.min(1, elevacion / 70)) };
  astro.x = Math.max(0.06, Math.min(0.94, astro.x));
  const oscuro = lum(mezcla(colores[0], colores[1], 0.35)) < 0.18;
  return { fase, noche, oscuro, tiempo: tt, elevacion, astro, colores: { arriba: colores[0], horizonte: colores[1], mar: colores[2] } };
}
export const variables = (c) => ({ "--cielo-1": c.colores.arriba, "--cielo-2": c.colores.horizonte, "--mar": c.colores.mar, "--astro-x": c.astro.x.toFixed(3), "--astro-y": c.astro.y.toFixed(3) });
const FRASE = { noche: "de noche", alba: "amanece", dia: "de día", ocaso: "atardece" };
export const describeCielo = (c) => `${FRASE[c.fase]} · ${c.tiempo}`;
/** Pares de color del tema (se prueban en tests/horizonte.test.js). */
export const TOKENS = {
  dia: { papel: "#f3eee3", papel2: "#e9e2d3", tinta: "#15120e", tinta2: "#5a5348", boya: "#ff4b1f", boyaTinta: "#b02a07", sobreBoya: "#15120e" },
  noche: { papel: "#0a0f1e", papel2: "#141b30", tinta: "#eef0f6", tinta2: "#a3abc2", boya: "#ff6a3d", boyaTinta: "#ff8a66", sobreBoya: "#15120e" },
};

// ---------- Hoy: la portada ----------
const minutosDe = (hhmm) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? "")); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const hm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const diaDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/**
 * La portada de un instante del día de hoy (el dial lo mueve). Solo lo que hay de verdad:
 * eventos de la agenda de hoy (Google o pegados) y recordatorios pendientes de hoy.
 * `agenda`: { day, events: [{ time, end, title }] } como `vault.agenda`.
 */
export function portada({ agenda = null, reminders = [], ahora = new Date(), real = new Date() } = {}) {
  const hoy = diaDe(real);
  const eventos = agenda?.day === hoy ? (agenda.events ?? []) : [];
  const conHora = eventos.filter((e) => minutosDe(e.time) != null).map((e) => ({ tipo: "cita", hora: e.time.slice(0, 5), min: minutosDe(e.time), title: String(e.title ?? "") }));
  const todoElDia = eventos.filter((e) => minutosDe(e.time) == null).map((e) => String(e.title ?? ""));
  const avisos = (reminders ?? []).filter((r) => !r.done && r.at && diaDe(new Date(r.at)) === hoy).map((r) => { const d = new Date(r.at); return { tipo: "aviso", hora: hm(d), min: d.getHours() * 60 + d.getMinutes(), title: String(r.text ?? "") }; });
  const lista = [...conHora, ...avisos].sort((a, b) => a.min - b.min);
  const m = ahora.getHours() * 60 + ahora.getMinutes();
  const antes = lista.filter((x) => x.min <= m), luego = lista.filter((x) => x.min > m);
  const sig = luego[0];
  const titular = sig ? `${sig.hora} · ${sig.title}` : lista.length ? "Lo de hoy ya ha pasado." : todoElDia.length ? todoElDia[0] : "Nada en la agenda de hoy.";
  const h = ahora.getHours();
  const antetitulo = h < 6 ? "Madrugada" : h < 13 ? "Edición de mañana" : h < 20 ? "Edición de tarde" : "Edición de noche";
  return { antetitulo, titular, antes, luego, todoElDia, numero: Math.floor((real.getTime() - new Date(real.getFullYear(), 0, 0).getTime()) / DIA), vacio: !lista.length && !todoElDia.length };
}

// ---------- Dinero: mareas ----------
export const FRANJAS = ["Madrugada", "Mañana", "Tarde", "Noche"];
const franja = (h) => (h < 6 ? 0 : h < 13 ? 1 : h < 20 ? 2 : 3);
const enRango = (lista, desde, hasta) => (lista ?? []).filter((s) => { const t = Date.parse(s?.at); return s?.cents > 0 && t >= desde && t <= hasta; });
const nombre = (m) => cleanConcept(m) || "Sin concepto";
// Bizum y transferencias son dinero entre personas, no consumo: fuera de noches y momentos.
const consumo = (s) => s.category !== "TRANSFERS";

/** Noches: 3 o más pagos seguidos entre las 21:00 y las 06:00 con menos de 3 h entre ellos. */
export function noches(spending, { ahora = new Date(), dias = 90 } = {}) {
  const lista = enRango(spending, ahora.getTime() - dias * DIA, ahora.getTime()).filter(consumo).filter((s) => { const h = new Date(s.at).getHours(); return h >= 21 || h < 6; }).sort((x, y) => String(x.at).localeCompare(String(y.at)));
  const grupos = [];
  for (const s of lista) {
    const g = grupos[grupos.length - 1];
    if (g && Date.parse(s.at) - Date.parse(g[g.length - 1].at) < 3 * 3600e3) g.push(s); else grupos.push([s]);
  }
  return grupos.filter((g) => g.length >= 3).map((g) => ({
    id: `noche-${g[0].id}`, inicio: g[0].at, fin: g[g.length - 1].at, total: g.reduce((n, s) => n + s.cents, 0),
    paradas: g.map((s) => ({ at: s.at, sitio: nombre(s.merchant), cents: s.cents })),
    sitios: new Set(g.map((s) => normalise(nombre(s.merchant)))).size,
  })).reverse();
}

export function mareas({ spending = [], income = [] } = {}, { ahora = new Date(), dias = 90 } = {}) {
  const hasta = ahora.getTime(), desde = hasta - dias * DIA;
  const gastos = enRango(spending, desde, hasta), ingresos = enRango(income, desde, hasta);
  const porDia = new Map();
  const suma = (s, signo) => { const k = diaDe(new Date(s.at)); porDia.set(k, (porDia.get(k) ?? 0) + signo * s.cents); };
  gastos.forEach((s) => suma(s, -1)); ingresos.forEach((s) => suma(s, 1));
  const marea = []; let nivel = 0;
  for (let i = dias - 1; i >= 0; i--) { const k = diaDe(new Date(hasta - i * DIA)); const neto = porDia.get(k) ?? 0; nivel += neto; marea.push({ dia: k, neto, nivel }); }
  const momentos = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
  const sitios = new Map();
  let total = 0;
  for (const s of gastos.filter(consumo)) {
    total += s.cents;
    const d = new Date(s.at); momentos[(d.getDay() + 6) % 7][franja(d.getHours())] += s.cents;
    const k = normalise(nombre(s.merchant)); const g = sitios.get(k) ?? { sitio: nombre(s.merchant), cents: 0, veces: 0 }; g.cents += s.cents; g.veces++; sitios.set(k, g);
  }
  const ns = noches(spending, { ahora, dias });
  const hallazgos = [];
  const top = [...sitios.values()].sort((a, b) => b.cents - a.cents)[0];
  if (top && top.veces > 1) hallazgos.push({ tipo: "HECHO", texto: `Donde más gastas: ${top.sitio}, ${top.veces} pagos.`, cents: top.cents, base: `Suma de tus movimientos de los últimos ${dias} días (sin Bizum ni transferencias).` });
  const veces = [...sitios.values()].sort((a, b) => b.veces - a.veces)[0];
  if (veces && veces !== top && veces.veces > 2) hallazgos.push({ tipo: "HECHO", texto: `Donde más veces pagas: ${veces.sitio} (${veces.veces}).`, base: "Recuento de movimientos." });
  const pico = momentos.flatMap((f, d) => f.map((c, h) => ({ d, h, c }))).sort((a, b) => b.c - a.c)[0];
  if (pico?.c && gastos.length >= 10) hallazgos.push({ tipo: "HECHO", texto: `Tu momento más caro: ${["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"][pico.d]} por la ${FRANJAS[pico.h].toLowerCase()}.`, cents: pico.c, base: `Suma por día de la semana y franja horaria en ${dias} días.` });
  if (ns.length) {
    hallazgos.push({ tipo: "HECHO", texto: `${ns.length} ${ns.length === 1 ? "noche" : "noches"} con 3 o más pagos seguidos.`, cents: Math.round(ns.reduce((n, x) => n + x.total, 0) / ns.length), centsLabel: "de media", base: "Pagos entre las 21:00 y las 06:00 con menos de 3 horas entre uno y otro." });
    hallazgos.push({ tipo: "HIPOTESIS", texto: "Pueden ser noches de fiesta. Yo solo veo pagos: no sé con quién ni qué celebrabas.", base: "Interpretación de la secuencia de pagos. Confírmalo o descártalo en cada noche." });
  }
  const dudosos = gastos.filter((s) => s.review || !s.category || s.category === "OTHER").length;
  if (dudosos) hallazgos.push({ tipo: "PENDIENTE", texto: `${dudosos} ${dudosos === 1 ? "movimiento" : "movimientos"} sin categoría segura.`, base: "Movimientos en «Otros» o marcados para revisar: corrígelos en la lista de Movimientos.", ir: "review" });
  return { marea, momentos, noches: ns, hallazgos, total, gastos: gastos.length, ingresos: ingresos.length, vacio: !gastos.length && !ingresos.length };
}

// ---------- Memoria: la constelación ----------
export const ESTADOS = { confirmada: "Confirmada", inferida: "Inferida", pendiente: "Pendiente de confirmar", caducada: "Contradicha o caducada" };
/** El estado de una afirmación real en la constelación. */
export function estadoDe(c, ahora = new Date()) {
  if (c.status === "CONTESTED" || staleness(c, ahora).stale) return "caducada";
  if (c.kind === "INFERENCE" || c.kind === "HYPOTHESIS") return c.status === "ACTIVE" ? "confirmada" : "inferida";
  if (c.status === "PROPOSED") return "pendiente";
  return "confirmada";
}
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 2 ** 32; };
export const HUECO = 0.12;
function separa(es) {
  for (let v = 0; v < 80; v++) {
    let movio = false;
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
      let dx = es[j].x - es[i].x, dy = es[j].y - es[i].y, d = Math.hypot(dx, dy);
      if (d >= HUECO) continue;
      if (d < 1e-6) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
      const m = (HUECO - d) / 2 + 0.002;
      es[i].x -= (dx / d) * m; es[i].y -= (dy / d) * m; es[j].x += (dx / d) * m; es[j].y += (dy / d) * m; movio = true;
    }
    for (const e of es) { e.x = Math.max(0.06, Math.min(0.94, e.x)); e.y = Math.max(0.06, Math.min(0.94, e.y)); }
    if (!movio) break;
  }
}
export const MAX_ESTRELLAS = 48;
/**
 * Estrellas = afirmaciones vivas (vigentes, propuestas o en duda), las más recientes primero.
 * Hilos = solo los que `related()` de brain.js encuentra (misma etiqueta, clave, lugar…), con su
 * motivo. Nada se une «porque queda bonito».
 */
export function constelacion(brain, { ahora = new Date() } = {}) {
  const vivas = (brain?.claims ?? []).filter((c) => ["ACTIVE", "PROPOSED", "CONTESTED"].includes(c.status))
    .sort((a, b) => String(b.recordedAt ?? b.validFrom ?? "").localeCompare(String(a.recordedAt ?? a.validFrom ?? ""))).slice(0, MAX_ESTRELLAS);
  const temas = [...new Set(vivas.map((c) => c.tags?.[0] ?? c.key ?? "otros"))];
  const estrellas = vivas.map((c) => {
    const tema = c.tags?.[0] ?? c.key ?? "otros";
    const ang = (temas.indexOf(tema) / Math.max(1, temas.length)) * Math.PI * 2 + (hash(c.id) - 0.5) * 0.9;
    const rad = 0.16 + hash(`${c.id}r`) * 0.26;
    return { id: c.id, texto: c.text, estado: estadoDe(c, ahora), x: 0.5 + Math.cos(ang) * rad, y: 0.5 + Math.sin(ang) * rad * 0.9 };
  });
  separa(estrellas);
  const ids = new Set(vivas.map((c) => c.id));
  const hilos = [], visto = new Set();
  for (const c of vivas) {
    let rel = [];
    try { rel = related(brain, c.id, { now: ahora, limit: 6 }); } catch { rel = []; }
    for (const r of rel) {
      if (!ids.has(r.claim.id)) continue;
      const k = [c.id, r.claim.id].sort().join("|");
      if (visto.has(k)) continue;
      visto.add(k);
      hilos.push({ a: c.id, b: r.claim.id, por: r.why ?? [] });
    }
  }
  const cuenta = Object.fromEntries(Object.keys(ESTADOS).map((k) => [k, estrellas.filter((e) => e.estado === k).length]));
  return { estrellas, hilos, cuenta, total: (brain?.claims ?? []).filter((c) => ["ACTIVE", "PROPOSED", "CONTESTED"].includes(c.status)).length };
}

/** La Bitácora: lo que MANU cree de ti, por tipo, con fecha y procedencia. Sin terceros. */
export function retrato(brain, { ahora = new Date(), max = 40 } = {}) {
  const vivas = (brain?.claims ?? []).filter((c) => ["ACTIVE", "PROPOSED", "CONTESTED"].includes(c.status) && !c.thirdParty)
    .sort((a, b) => String(b.recordedAt ?? "").localeCompare(String(a.recordedAt ?? ""))).slice(0, max);
  const grupos = [["Quién eres", ["FACT", "MEMORY"]], ["Qué prefieres", ["PREFERENCE"]], ["Qué decidiste", ["DECISION"]], ["Qué sospecho", ["INFERENCE", "HYPOTHESIS"]]];
  return grupos.map(([titulo, kinds]) => ({ titulo, frases: vivas.filter((c) => kinds.includes(c.kind)).map((c) => ({ id: c.id, texto: c.text, estado: estadoDe(c, ahora), desde: c.recordedAt ?? c.validFrom ?? null })) })).filter((g) => g.frases.length);
}

// ---------- Proyectos: el astillero ----------
// Regla documentada (docs/HORIZONTE.md): el casco avanza solo con las piezas que Manu crea y marca.
// Sin piezas, el proyecto es «solo el plano»: no hay porcentaje que inventar.
export const MAX_PIEZAS = 40;
export function barco(p) {
  const piezas = Array.isArray(p?.pieces) ? p.pieces.filter((x) => x && typeof x.id === "string") : [];
  const hechas = piezas.filter((x) => x.done).length;
  return { id: p.id, nombre: p.name, emoji: p.emoji, piezas, hechas, avance: piezas.length ? hechas / piezas.length : null, listo: piezas.length > 0 && hechas === piezas.length, botado: p.launchedAt ?? null, fuentes: (p.sources ?? []).length };
}
export function addPieza(p, texto, id) {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!t) throw new Error("Escribe la pieza.");
  const piezas = Array.isArray(p.pieces) ? p.pieces : [];
  if (piezas.length >= MAX_PIEZAS) throw new Error(`Como mucho ${MAX_PIEZAS} piezas por proyecto.`);
  return { ...p, pieces: [...piezas, { id, t, done: false }] };
}
export const marcarPieza = (p, id) => ({ ...p, pieces: (p.pieces ?? []).map((x) => (x.id === id ? { ...x, done: !x.done } : x)) });
export const quitarPieza = (p, id) => ({ ...p, pieces: (p.pieces ?? []).filter((x) => x.id !== id) });
/** Botar = terminar. Solo con todas las piezas hechas; si no, el proyecto no cambia. */
export function botar(p, ahora = new Date()) {
  const b = barco(p);
  return b.listo && !b.botado ? { ...p, launchedAt: ahora.toISOString() } : p;
}
export const varar = (p) => { const { launchedAt, ...rest } = p; return rest; };
