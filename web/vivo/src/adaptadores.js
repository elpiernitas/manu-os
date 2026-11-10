// Adaptadores: del vault real de MANU OS a lo que pinta cada pantalla. Todo puro y sin efectos.
// Entra la forma de `manuos.vault` (spending, income, brain.claims, projects, inbox, reminders);
// sale un modelo de vista. Ninguna función escribe: los cambios vuelven por `acciones.js`.
// Regla del sistema: lo que sale de contar es HECHO; lo que se interpreta es HIPÓTESIS, y lleva su base.
const DIA = 864e5;
// Copia de CATEGORIES de core/money.js (una prueba vigila que no se separen).
export const CATEGORIAS = {"FOOD_AND_DRINK": "Comer y beber", "GROCERIES": "Supermercado", "TRANSPORT": "Transporte", "SUBSCRIPTIONS": "Suscripciones", "LEISURE": "Ocio", "HOME": "Casa", "HEALTH": "Salud", "SHOPPING": "Compras", "TRANSFERS": "Bizum y transferencias", "CASH": "Efectivo", "NIGHTLIFE": "Ocio nocturno", "TOBACCO": "Tabaco", "TRAVEL": "Viajes", "SERVICES": "Servicios", "FINANCE": "Finanzas", "ADMIN": "Administración", "DONATIONS": "Donaciones", "OTHER": "Otros"};
export const euros = (cents, dec = 2) => (cents / 100).toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + " €";
const clave = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const limpio = (m) => String(m ?? "").replace(/\s*\(DEMO\)\s*/i, "").replace(/\s+/g, " ").trim();
const titulo = (m) => limpio(m).toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const validos = (lista, desde, hasta) => (lista ?? []).filter((s) => { const t = Date.parse(s?.at); return s?.cents > 0 && t >= desde && t <= hasta; });

// ---------- Dinero ----------
export const FRANJAS = ["Madrugada", "Mañana", "Tarde", "Noche"];
const franja = (h) => (h < 6 ? 0 : h < 13 ? 1 : h < 20 ? 2 : 3);

/** Noches: 3 o más gastos seguidos entre las 21:00 y las 06:00 con menos de 3 h entre ellos. */
export function noches(spending, { ahora = new Date(), dias = 90 } = {}) {
  const lista = validos(spending, ahora.getTime() - dias * DIA, ahora.getTime()).filter((s) => { const h = new Date(s.at).getHours(); return h >= 21 || h < 6; }).sort((x, y) => x.at.localeCompare(y.at));
  const grupos = [];
  for (const s of lista) {
    const g = grupos[grupos.length - 1];
    if (g && Date.parse(s.at) - Date.parse(g[g.length - 1].at) < 3 * 3600e3) g.push(s); else grupos.push([s]);
  }
  return grupos.filter((g) => g.length >= 3).map((g) => ({
    id: g[0].id, inicio: g[0].at, fin: g[g.length - 1].at, total: g.reduce((n, s) => n + s.cents, 0),
    paradas: g.map((s) => ({ at: s.at, sitio: titulo(s.merchant), cents: s.cents, categoria: s.category })),
    sitios: new Set(g.map((s) => limpio(s.merchant))).size,
  })).reverse();
}

export function dinero(vault, { ahora = new Date(), dias = 90 } = {}) {
  const hasta = ahora.getTime(), desde = hasta - dias * DIA;
  const gastos = validos(vault?.spending, desde, hasta), ingresos = validos(vault?.income, desde, hasta);
  const delMes = (l) => l.filter((s) => { const d = new Date(s.at); return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear(); }).reduce((n, s) => n + s.cents, 0);
  const mes = { gastado: delMes(gastos), ingresado: delMes(ingresos) };
  mes.ahorro = mes.ingresado - mes.gastado;
  // La marea: saldo relativo acumulado día a día (sube con ingresos, baja con gastos).
  const porDia = new Map();
  for (const s of gastos) porDia.set(clave(new Date(s.at)), (porDia.get(clave(new Date(s.at))) ?? 0) - s.cents);
  for (const s of ingresos) porDia.set(clave(new Date(s.at)), (porDia.get(clave(new Date(s.at))) ?? 0) + s.cents);
  const marea = []; let nivel = 0;
  for (let i = dias - 1; i >= 0; i--) { const d = new Date(hasta - i * DIA); const neto = porDia.get(clave(d)) ?? 0; nivel += neto; marea.push({ dia: clave(d), neto, nivel }); }
  const cat = new Map(), sitios = new Map();
  const momentos = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
  let total = 0;
  for (const s of gastos) {
    total += s.cents;
    cat.set(s.category ?? "OTHER", (cat.get(s.category ?? "OTHER") ?? 0) + s.cents);
    const k = limpio(s.merchant); const g = sitios.get(k) ?? { sitio: titulo(k), cents: 0, veces: 0 }; g.cents += s.cents; g.veces++; sitios.set(k, g);
    const d = new Date(s.at); momentos[(d.getDay() + 6) % 7][franja(d.getHours())] += s.cents;
  }
  const categorias = [...cat].map(([id, cents]) => ({ id, nombre: CATEGORIAS[id] ?? id, cents, pct: total ? cents / total : 0 })).sort((x, y) => y.cents - x.cents);
  const top = [...sitios.values()].sort((x, y) => y.cents - x.cents).slice(0, 6);
  const ns = noches(vault?.spending, { ahora, dias });
  const hallazgos = [];
  if (top[0]) hallazgos.push({ tipo: "HECHO", texto: `Tu sitio nº 1 es ${top[0].sitio}: ${top[0].veces} visitas, ${euros(top[0].cents)}.`, base: `Suma de ${top[0].veces} movimientos en ${dias} días.` });
  const repetido = [...sitios.values()].sort((x, y) => y.veces - x.veces)[0];
  if (repetido && repetido !== top[0]) hallazgos.push({ tipo: "HECHO", texto: `Donde más veces pagas: ${repetido.sitio} (${repetido.veces}).`, base: "Recuento de movimientos." });
  if (ns.length) {
    const media = ns.reduce((n, x) => n + x.total, 0) / ns.length;
    hallazgos.push({ tipo: "HECHO", texto: `${ns.length} noches con 3 o más pagos seguidos. Media: ${euros(Math.round(media))}.`, base: "Pagos entre las 21:00 y las 06:00 con menos de 3 h entre ellos." });
    hallazgos.push({ tipo: "HIPOTESIS", texto: "Parecen noches de fiesta. Yo solo veo pagos: no sé con quién ni qué celebrabas.", base: "Interpretación de la secuencia de pagos. Confírmalo o descártalo." });
  }
  const pico = momentos.flatMap((f, d) => f.map((c, h) => ({ d, h, c }))).sort((x, y) => y.c - x.c)[0];
  if (pico?.c) hallazgos.push({ tipo: "HECHO", texto: `Tu momento más caro: ${["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"][pico.d]} por la ${FRANJAS[pico.h].toLowerCase()} (${euros(pico.c)}).`, base: `Suma por día y franja en ${dias} días.` });
  return { mes, marea, categorias, sitios: top, momentos, noches: ns, hallazgos, total, movimientos: [...gastos].sort((x, y) => y.at.localeCompare(x.at)).slice(0, 12).map((s) => ({ ...s, sitio: titulo(s.merchant) })), vacio: !gastos.length && !ingresos.length };
}

// ---------- Memoria: la constelación ----------
const CADUCA = { FACT: 365, PREFERENCE: 180, DECISION: 120, INFERENCE: 90, HYPOTHESIS: 60, MEMORY: null }; // = FRESH_DAYS de brain.js
const TEMAS = [["trabajo", /trabaj|client|encarg|marketing|briefing/], ["dinero", /ahorr|gast|dinero|€/], ["noche", /noche|fiesta|madrug/], ["descanso", /duerm|descans|domingo/], ["diseno", /diseñ|editorial|tipograf/], ["juegos", /juego|videojueg/], ["humor", /humor|palabras|chiste/]];
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 2 ** 32; };

/** Qué grado de certeza tiene un recuerdo: lo sé / lo sospecho / confírmamelo. */
export function nivelDe(c, ahora = new Date()) {
  const dias = CADUCA[c.kind];
  const edad = (ahora.getTime() - Date.parse(c.confirmedAt ?? c.validFrom ?? ahora)) / DIA;
  if (c.status === "CONTESTED" || (dias != null && edad > dias)) return "confirmar";
  if (c.status === "PROPOSED" || c.kind === "INFERENCE" || c.kind === "HYPOTHESIS") return "sospecha";
  return "sabe";
}
export const NIVEL = { sabe: "Lo sé", sospecha: "Lo sospecho", confirmar: "Confírmamelo" };

export function constelacion(brain, { ahora = new Date() } = {}) {
  const vivos = (brain?.claims ?? []).filter((c) => !["RETRACTED", "REJECTED", "SUPERSEDED"].includes(c.status));
  const temas = [...new Set(vivos.flatMap((c) => etiquetas(c)))];
  const estrellas = vivos.map((c) => {
    const tags = etiquetas(c);
    // Cada tema ocupa un sector del cielo; el recuerdo cae cerca del centro de su primer tema.
    const ang = (temas.indexOf(tags[0]) / Math.max(1, temas.length)) * Math.PI * 2 + (hash(c.id) - 0.5) * 0.9;
    const rad = 0.2 + hash(c.id + "r") * 0.25;
    return { id: c.id, texto: c.text, tipo: c.kind, nivel: nivelDe(c, ahora), tags, razon: c.reason ?? null, confianza: c.confidence ?? null, desde: c.validFrom, x: 0.5 + Math.cos(ang) * rad, y: 0.5 + Math.sin(ang) * rad * 0.85 };
  });
  separa(estrellas);
  const hilos = [];
  for (let i = 0; i < estrellas.length; i++) for (let j = i + 1; j < estrellas.length; j++) {
    const comun = estrellas[i].tags.filter((t) => estrellas[j].tags.includes(t));
    if (comun.length) hilos.push({ a: estrellas[i].id, b: estrellas[j].id, comun, tension: estrellas[i].nivel === "confirmar" || estrellas[j].nivel === "confirmar" });
  }
  return { estrellas, hilos, temas, cuenta: { sabe: estrellas.filter((e) => e.nivel === "sabe").length, sospecha: estrellas.filter((e) => e.nivel === "sospecha").length, confirmar: estrellas.filter((e) => e.nivel === "confirmar").length } };
}
/** Ninguna estrella encima de otra: se empujan hasta dejar sitio para el dedo (determinista). */
export const HUECO = 0.13;
function separa(es) {
  for (let v = 0; v < 60; v++) {
    let movio = false;
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
      let dx = es[j].x - es[i].x, dy = es[j].y - es[i].y, d = Math.hypot(dx, dy);
      if (d >= HUECO) continue;
      if (d < 1e-6) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
      const m = (HUECO - d) / 2 + 0.002;
      es[i].x -= (dx / d) * m; es[i].y -= (dy / d) * m; es[j].x += (dx / d) * m; es[j].y += (dy / d) * m; movio = true;
    }
    for (const e of es) { e.x = Math.max(0.07, Math.min(0.93, e.x)); e.y = Math.max(0.07, Math.min(0.93, e.y)); }
    if (!movio) break;
  }
}
export function etiquetas(c) {
  if (Array.isArray(c.tags) && c.tags.length) return c.tags;
  const t = String(c.text ?? "").toLowerCase();
  const out = TEMAS.filter(([, re]) => re.test(t)).map(([n]) => n);
  return out.length ? out : ["otros"];
}

// ---------- Proyectos: el astillero ----------
export const AREAS = { marketing: "Marketing", branding: "Branding", trabajo: "Trabajo", personal: "Personal", sin: "Sin muelle" };
export function astillero(projects) {
  const barcos = (projects ?? []).map((p) => {
    const tareas = p.tareas ?? [];
    const hechas = tareas.filter((t) => t.done).length;
    return { id: p.id, nombre: p.name, emoji: p.emoji, area: AREAS[p.area] ? p.area : "sin", fuentes: p.sources ?? [], ideas: p.ideas ?? [], tareas, hechas, avance: tareas.length ? hechas / tareas.length : null, listo: tareas.length > 0 && hechas === tareas.length, botado: p.botado ?? null };
  });
  const muelles = Object.keys(AREAS).map((id) => ({ id, nombre: AREAS[id], barcos: barcos.filter((b) => b.area === id && !b.botado) })).filter((m) => m.barcos.length);
  return { muelles, flota: barcos.filter((b) => b.botado), barcos };
}

// ---------- Agenda y Hoy ----------
export function semana(eventos, reminders, { ahora = new Date(), dias = 7 } = {}) {
  const base = new Date(ahora); base.setHours(0, 0, 0, 0);
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date(base.getTime() + i * DIA), k = clave(d);
    const citas = [...(eventos ?? []).map((e) => ({ ...e, tipo: "cita" })), ...(reminders ?? []).filter((r) => !r.done).map((r) => ({ id: r.id, title: r.text, at: r.at, tipo: "aviso" }))].filter((e) => clave(new Date(e.at)) === k).sort((x, y) => x.at.localeCompare(y.at));
    return { clave: k, fecha: d, hoy: i === 0, citas };
  });
}
export const hora = (iso) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
export const numero = (d) => Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / DIA); // el «número» de la portada: día del año

/** La portada de Hoy para un instante dado (el sol se puede arrastrar: `ahora` cambia). */
export function portada(vault, { ahora = new Date(), tiempo = "despejado", real = new Date() } = {}) {
  const hoy = semana(vault?.eventos, vault?.reminders, { ahora: real, dias: 1 })[0];
  const antes = hoy.citas.filter((c) => Date.parse(c.at) <= ahora.getTime()), luego = hoy.citas.filter((c) => Date.parse(c.at) > ahora.getTime());
  const sig = luego[0];
  const tareas = (vault?.inbox ?? []).filter((i) => i.status === "TASK" && !i.done);
  const h = ahora.getHours();
  const lluvia = tiempo === "lluvia" ? " Y llueve, claro." : tiempo === "niebla" ? " Con niebla de regalo." : "";
  const titular = sig ? `${hora(sig.at)}: ${sig.title.toLowerCase()}.${lluvia}` : antes.length ? `Lo de hoy ya está hecho.${lluvia}` : `Día en blanco.${lluvia || " No es un fallo, es un lujo."}`;
  const antetitulo = h < 6 ? "Madrugada" : h < 13 ? "Edición de mañana" : h < 20 ? "Edición de tarde" : "Edición de noche";
  const ayer = validos(vault?.spending, real.getTime() - DIA, real.getTime()).reduce((n, s) => n + s.cents, 0);
  return { antetitulo, titular, antes, luego, tareas, gastadoAyer: ayer, numero: numero(real) };
}

// ---------- Bahía ----------
export function bahia(vault) {
  const { flota, barcos } = astillero(vault?.projects);
  const hechas = (vault?.inbox ?? []).filter((i) => i.status === "TASK" && i.done).length + barcos.reduce((n, b) => n + b.hechas, 0);
  const ideas = (vault?.inbox ?? []).filter((i) => i.status === "IDEA").length + barcos.reduce((n, b) => n + b.ideas.length, 0);
  const puntos = hechas * 10 + ideas * 4 + flota.length * 50; // solo suma: descansar no resta
  return { nivel: 1 + Math.floor(puntos / 60), puntos, siguiente: 60 - (puntos % 60), flota, hechas, ideas, faro: flota.length > 0 };
}

// ---------- La sonda: buscar en todo, por profundidad ----------
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function sonda(q, vault) {
  const t = norm(q).trim();
  if (t.length < 2) return [];
  const da = (s) => norm(s).includes(t);
  const capas = [
    ["Superficie · hoy", [...(vault?.eventos ?? []).filter((e) => da(e.title)).map((e) => ({ id: e.id, texto: e.title, pista: hora(e.at), ir: "agenda" })), ...(vault?.inbox ?? []).filter((i) => da(i.text)).map((i) => ({ id: i.id, texto: i.text, pista: i.status === "IDEA" ? "Idea" : "Tarea", ir: "hoy" }))]],
    ["A media agua · proyectos", (vault?.projects ?? []).flatMap((p) => [da(p.name) ? { id: p.id, texto: p.name, pista: "Proyecto", ir: "proyectos" } : null, ...(p.sources ?? []).filter((s) => da(s.title)).map((s) => ({ id: s.id, texto: s.title, pista: `Fuente de ${p.name}`, ir: "proyectos" })), ...(p.tareas ?? []).filter((x) => da(x.t)).map((x) => ({ id: x.id, texto: x.t, pista: `Pieza de ${p.name}`, ir: "proyectos" })), ...(p.ideas ?? []).filter(da).map((x, i) => ({ id: `${p.id}-i${i}`, texto: x, pista: `Idea de ${p.name}`, ir: "proyectos" }))]).filter(Boolean)],
    ["Corriente · dinero", [...new Map((vault?.spending ?? []).filter((s) => da(s.merchant)).map((s) => [limpio(s.merchant), s])).values()].slice(0, 5).map((s) => ({ id: s.id, texto: titulo(s.merchant), pista: CATEGORIAS[s.category] ?? "", ir: "dinero" }))],
    ["Fondo · memoria", (vault?.brain?.claims ?? []).filter((c) => da(c.text) && !["RETRACTED", "REJECTED"].includes(c.status)).map((c) => ({ id: c.id, texto: c.text, pista: NIVEL[nivelDe(c)], ir: "tu" }))],
  ];
  return capas.map(([capa, hallazgos]) => ({ capa, hallazgos })).filter((c) => c.hallazgos.length);
}
