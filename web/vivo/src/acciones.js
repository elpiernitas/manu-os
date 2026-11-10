// Acciones: lo único que cambia datos. Puras: reciben un vault y devuelven otro.
// En el prototipo trabajan sobre el vault de DEMO. Al integrar, cada una se sustituye por el
// módulo real que ya existe (ver docs/ADAPTADORES.md): brain.confirm/correct/forget, planImport…
// Nada aquí decide por Manu: todas se llaman desde un toque suyo.
const iso = (d) => d.toISOString();
const conClaims = (v, f) => ({ ...v, brain: { ...v.brain, claims: f(v.brain?.claims ?? []) } });

export const confirmar = (v, id, ahora = new Date()) => conClaims(v, (cs) => cs.map((c) => (c.id !== id ? c : { ...c, status: "ACTIVE", kind: c.kind === "INFERENCE" || c.kind === "HYPOTHESIS" ? "FACT" : c.kind, confirmedAt: iso(ahora), confidence: undefined, reason: undefined })));
export const corregir = (v, id, texto, ahora = new Date()) => { const t = String(texto ?? "").replace(/\s+/g, " ").trim().slice(0, 200); return t ? conClaims(v, (cs) => cs.map((c) => (c.id !== id ? c : { ...c, text: t, status: "ACTIVE", source: { kind: "correccion" }, confirmedAt: iso(ahora) }))) : v; };
export const dudar = (v, id) => conClaims(v, (cs) => cs.map((c) => (c.id !== id ? c : { ...c, status: "CONTESTED" })));
/** Olvidar deja una lápida sin texto (id y fecha), como `brain.forgotten` en la app real. */
export const olvidar = (v, id, ahora = new Date()) => ({ ...v, brain: { ...v.brain, claims: (v.brain?.claims ?? []).filter((c) => c.id !== id), forgotten: [...(v.brain?.forgotten ?? []), { id, at: iso(ahora) }] } });
export const recordar = (v, texto, extra = {}, ahora = new Date()) => conClaims(v, (cs) => [...cs, { id: `m${Date.now().toString(36)}`, text: String(texto).slice(0, 200), kind: "FACT", status: "ACTIVE", source: { kind: "manu" }, validFrom: iso(ahora), ...extra }]);

const conProyecto = (v, pid, f) => ({ ...v, projects: (v.projects ?? []).map((p) => (p.id === pid ? f(p) : p)) });
export const marcarTarea = (v, pid, tid) => conProyecto(v, pid, (p) => ({ ...p, tareas: (p.tareas ?? []).map((t) => (t.id === tid ? { ...t, done: !t.done } : t)) }));
export const cambiarMuelle = (v, pid, area) => conProyecto(v, pid, (p) => ({ ...p, area }));
/** Botar = terminar. Solo si todas las tareas están hechas; si no, no pasa nada. */
export const botar = (v, pid, ahora = new Date()) => conProyecto(v, pid, (p) => ((p.tareas ?? []).length && p.tareas.every((t) => t.done) && !p.botado ? { ...p, botado: iso(ahora) } : p));

export const citar = (v, { title, at }) => { const t = String(title ?? "").trim().slice(0, 120); return t && Number.isFinite(Date.parse(at)) ? { ...v, eventos: [...(v.eventos ?? []), { id: `e${Date.now().toString(36)}`, title: t, at: new Date(at).toISOString(), minutes: 60 }] } : v; };

/**
 * «Importar todo (90 días)» de mentira: un extracto inventado con movimientos repetidos y nuevos.
 * Misma regla que `planImport` en la app real: lo que ya está no se duplica.
 */
export function importarDemo(v, ahora = new Date()) {
  const huella = (s) => `${s.at.slice(0, 10)}|${s.cents}|${s.merchant}`;
  const tengo = new Set((v.spending ?? []).map(huella));
  const t = (h) => { const d = new Date(ahora); d.setDate(d.getDate() - 1); d.setHours(h, 5, 0, 0); return iso(d); };
  const extracto = [...(v.spending ?? []).slice(0, 14), { at: t(13), merchant: "BAR EL PEDRERU (DEMO)", category: "FOOD_AND_DRINK", cents: 1350 }, { at: t(18), merchant: "FERRETERIA LA RULA (DEMO)", category: "HOME", cents: 2490 }, { at: t(20), merchant: "SUPER CANTABRICO (DEMO)", category: "GROCERIES", cents: 3120 }];
  const nuevos = extracto.filter((s) => !tengo.has(huella(s))).map((s, i) => ({ ...s, id: `demo-imp-${ahora.getTime()}-${i}`, source: "DEMO" }));
  return { vault: { ...v, spending: [...nuevos, ...(v.spending ?? [])].sort((x, y) => y.at.localeCompare(x.at)) }, nuevos: nuevos.length, duplicados: extracto.length - nuevos.length };
}

/** El guion del asistente de DEMO (sin IA): enseña cómo sabe, sospecha, duda y da un zasca. */
export function responder(texto, vm) {
  const t = String(texto ?? "").toLowerCase();
  const m = (id) => vm.memoria.estrellas.find((e) => e.id === id);
  if (/ahorr|gast|dinero|pasta/.test(t)) {
    const ns = vm.dinero.noches, total = ns.reduce((n, x) => n + x.total, 0);
    return { cara: "zasca", nivel: "sabe", texto: `Dijiste que querías ahorrar 200 € al mes. En 90 días llevas ${vm.euros(total)} en ${ns.length} noches largas. No lo digo yo: lo dicen tus pagos.`, pruebas: [m("m7") && `Recuerdo: «${m("m7").texto}»`, `${ns.length} secuencias de 3 o más pagos nocturnos`, `Suma: ${vm.euros(total)}`].filter(Boolean), sospecha: "Que fueran fiestas es una hipótesis mía. Los importes, no." };
  }
  if (/madrug|mañana|tempran|despert/.test(t) && m("m10") && m("m3")) return { cara: "duda", nivel: "confirmar", texto: `Aquí tengo dos cosas que no casan: «${m("m10").texto}» y «${m("m3").texto}». Una de las dos ha caducado. ¿Cuál?`, elegir: ["m10", "m3"] };
  if (/domingo|finde|descans/.test(t) && m("m5")) return { cara: "piensa", nivel: "sospecha", texto: `Sospecho esto: «${m("m5").texto}».`, pruebas: [m("m5").razon].filter(Boolean), confirmarId: "m5" };
  if (/qui[eé]n soy|qu[eé] sabes|conoces/.test(t)) { const c = vm.memoria.cuenta; return { cara: "calma", nivel: "sabe", texto: `De ti sé ${c.sabe} cosas, sospecho ${c.sospecha} y tengo ${c.confirmar} pendiente de que me la confirmes. Están todas en la constelación: puedes corregirlas o borrarlas.` }; }
  if (/hola|buenas|qu[eé] tal/.test(t)) return { cara: "feliz", nivel: null, texto: "Aquí, en la línea del horizonte, viéndote venir." };
  return { cara: "duda", nivel: null, texto: "Eso no lo sé. Y no me lo voy a inventar. Si me lo cuentas, lo apunto; si no, seguimos igual de amigos.", nose: true };
}
