// ⚠️ DATOS DE DEMOSTRACIÓN. Todo lo de este archivo es INVENTADO: comercios, importes, recuerdos,
// proyectos y citas. No sale del banco, ni de la memoria real, ni de ninguna cuenta.
// Tiene la MISMA forma que el vault real (`manuos.vault`) para que los adaptadores se prueben
// con algo verosímil; los campos nuevos que propone el rediseño van marcados con «NUEVO».
export const ES_DEMO = true;
export const ORIGEN = "DEMO";

const azar = (semilla) => { let s = semilla >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; };
const DIA = 864e5;
const a = (base, dias, h, m = 0) => { const d = new Date(base.getTime() + dias * DIA); d.setHours(h, m, 0, 0); return d.toISOString(); };

const HABITUALES = [
  ["CAFE SALITRE (DEMO)", "FOOD_AND_DRINK", 180, 420, [8, 10]],
  ["SUPER CANTABRICO (DEMO)", "GROCERIES", 900, 4800, [18, 20]],
  ["BAR EL PEDRERU (DEMO)", "FOOD_AND_DRINK", 600, 2200, [14, 15]],
  ["BUS URBANO (DEMO)", "TRANSPORT", 150, 150, [8, 9]],
  ["LIBRERIA NORDESTE (DEMO)", "SHOPPING", 1200, 3500, [17, 19]],
  ["SIDRERIA LA GALERNA (DEMO)", "FOOD_AND_DRINK", 1400, 3800, [21, 22]],
];
const NOCHE = [["SIDRERIA LA GALERNA (DEMO)", "FOOD_AND_DRINK", 2350, 21, 40], ["BAR MAREA BAJA (DEMO)", "NIGHTLIFE", 900, 23, 15], ["BAR MAREA BAJA (DEMO)", "NIGHTLIFE", 1200, 24, 5], ["SALA FARO ROJO (DEMO)", "NIGHTLIFE", 1500, 25, 30], ["SALA FARO ROJO (DEMO)", "NIGHTLIFE", 1000, 27, 10], ["KEBAB PONIENTE (DEMO)", "FOOD_AND_DRINK", 750, 29, 20], ["TAXI (DEMO)", "TRANSPORT", 890, 29, 45]];

/** Un vault de mentira, estable para una misma fecha. */
export function vaultDemo(ahora = new Date()) {
  const r = azar(20261109);
  const hoy = new Date(ahora); hoy.setHours(12, 0, 0, 0);
  const spending = [], income = [];
  let n = 0;
  const gasto = (at, merchant, category, cents) => spending.push({ id: `demo-g${++n}`, at, merchant, category, cents, source: ORIGEN });
  for (let d = -89; d <= 0; d++) {
    const veces = Math.floor(r() * 3);
    for (let k = 0; k < veces; k++) { const [m, c, min, max, [h0, h1]] = HABITUALES[Math.floor(r() * HABITUALES.length)]; gasto(a(hoy, d, h0 + Math.floor(r() * (h1 - h0 + 1)), Math.floor(r() * 60)), m, c, Math.round((min + r() * (max - min)) / 10) * 10); }
    const fecha = new Date(hoy.getTime() + d * DIA);
    if (fecha.getDate() === 3) gasto(a(hoy, d, 9), "MUSICA EN LINEA (DEMO)", "SUBSCRIPTIONS", 1099);
    if (fecha.getDate() === 12) gasto(a(hoy, d, 9), "GIMNASIO MAREA (DEMO)", "HEALTH", 3490);
    if (fecha.getDate() === 28) income.push({ id: `demo-i${++n}`, at: a(hoy, d, 8), merchant: "NOMINA (DEMO)", cents: 142000, source: ORIGEN });
    // Las noches de los sábados alternos: la secuencia que Dinero cuenta como una historia.
    if (fecha.getDay() === 6 && Math.floor(d / 7) % 2 === 0 && d < 0) for (const [m, c, cents, h, min] of NOCHE) gasto(a(hoy, d + (h >= 24 ? 1 : 0), h % 24, min), m, c, cents);
  }
  spending.sort((x, y) => y.at.localeCompare(x.at));

  const mem = (id, text, kind, status, extra = {}) => ({ id, text, kind, status, source: { kind: "manu" }, validFrom: a(hoy, -(extra.hace ?? 30), 10), ...extra });
  const claims = [
    mem("m1", "Trabajo en marketing", "FACT", "ACTIVE", { hace: 200, tags: ["trabajo"] }),
    mem("m2", "Vivo en Gijón", "FACT", "ACTIVE", { hace: 300, tags: ["casa"] }),
    mem("m3", "Prefiero trabajar de noche con música", "PREFERENCE", "ACTIVE", { hace: 40, tags: ["trabajo", "musica", "noche"] }),
    mem("m4", "Decidí no aceptar encargos sin briefing escrito", "DECISION", "ACTIVE", { hace: 25, tags: ["trabajo", "decisiones"] }),
    mem("m5", "Los domingos rindo poco: mejor no planificar nada serio", "INFERENCE", "PROPOSED", { hace: 12, confidence: 0.6, reason: "3 de 4 domingos sin tareas hechas", source: { kind: "deduccion" }, tags: ["descanso", "habitos"] }),
    mem("m6", "Gasto más las semanas en que duermo poco", "HYPOTHESIS", "PROPOSED", { hace: 6, confidence: 0.4, reason: "Coinciden 2 veces; pueden ser casualidad", source: { kind: "deduccion" }, tags: ["dinero", "descanso"] }),
    mem("m7", "Quiero ahorrar 200 € al mes", "DECISION", "ACTIVE", { hace: 150, tags: ["dinero", "decisiones"] }),
    mem("m8", "Salgo de fiesta dos sábados al mes", "INFERENCE", "PROPOSED", { hace: 9, confidence: 0.8, reason: "Patrón en los gastos de noche", source: { kind: "deduccion" }, tags: ["dinero", "noche", "amigos"] }),
    mem("m9", "Me gusta el diseño editorial", "PREFERENCE", "ACTIVE", { hace: 90, tags: ["diseno", "trabajo"] }),
    mem("m10", "Madrugo sin problema", "FACT", "CONTESTED", { hace: 210, tags: ["habitos", "noche"] }),
    mem("m11", "Estoy aprendiendo a programar videojuegos", "FACT", "ACTIVE", { hace: 190, tags: ["juegos", "proyectos"] }),
    mem("m12", "Los juegos de palabras me salen solos", "MEMORY", "ACTIVE", { hace: 70, tags: ["humor"] }),
  ];

  const tarea = (id, t, done = false) => ({ id, t, done });
  const projects = [
    { id: "p1", name: "Rebranding Sidrería (demo)", emoji: "🍏", createdAt: a(hoy, -40, 10), sources: [{ id: "s1", kind: "text", title: "Briefing del cliente" }, { id: "s2", kind: "link", title: "Referencias de etiquetas" }, { id: "s3", kind: "text", title: "Notas de la reunión" }], chat: [],
      /* NUEVO */ area: "branding", ideas: ["Etiqueta que cambia con la marea", "Tipografía de cartel de puerto"], tareas: [tarea("t1", "Moodboard", true), tarea("t2", "Tres rutas de logo", true), tarea("t3", "Presentación", true), tarea("t4", "Entrega final", false)] },
    { id: "p2", name: "Campaña de otoño (demo)", emoji: "🍂", createdAt: a(hoy, -18, 10), sources: [{ id: "s4", kind: "text", title: "Calendario de contenidos" }], chat: [],
      area: "marketing", ideas: ["Serie «Llueve, ¿y qué?»"], tareas: [tarea("t5", "Concepto", true), tarea("t6", "Guiones", false), tarea("t7", "Rodaje", false), tarea("t8", "Montaje", false)] },
    { id: "p3", name: "Mi juego de la bahía (demo)", emoji: "🎮", createdAt: a(hoy, -70, 10), sources: [{ id: "s5", kind: "text", title: "Documento de diseño" }, { id: "s6", kind: "link", title: "Paletas que me gustan" }], chat: [],
      area: "personal", ideas: ["Una gaviota que roba tareas", "Faro que se enciende al terminar"], tareas: [tarea("t9", "Prototipo de movimiento", true), tarea("t10", "Primer nivel", false)] },
    { id: "p4", name: "Informe mensual (demo)", emoji: "📊", createdAt: a(hoy, -95, 10), sources: [], chat: [],
      area: "trabajo", ideas: [], tareas: [tarea("t11", "Datos", true), tarea("t12", "Redacción", true)], botado: a(hoy, -20, 18) },
    { id: "p5", name: "Portfolio (demo)", emoji: "🗂️", createdAt: a(hoy, -5, 10), sources: [], chat: [], area: "personal", ideas: [], tareas: [] },
  ];

  /* NUEVO (solo demo): la agenda real llega de Google Calendar con `groupByDay`, no del vault. */
  const eventos = [
    { id: "e1", title: "Daily del equipo", at: a(hoy, 0, 9, 30), minutes: 20 },
    { id: "e2", title: "Presentar rutas de logo", at: a(hoy, 0, 12, 0), minutes: 60, proyecto: "p1" },
    { id: "e3", title: "Gimnasio", at: a(hoy, 0, 19, 0), minutes: 60 },
    { id: "e4", title: "Rodaje campaña", at: a(hoy, 1, 10, 0), minutes: 180, proyecto: "p2" },
    { id: "e5", title: "Cena con amigos", at: a(hoy, 2, 21, 30), minutes: 120 },
    { id: "e6", title: "Dentista", at: a(hoy, 4, 16, 0), minutes: 45 },
  ];
  const reminders = [{ id: "r1", text: "Enviar la factura", at: a(hoy, 0, 17, 0), done: false }, { id: "r2", text: "Regar las plantas", at: a(hoy, 1, 9, 0), done: false }];
  const inbox = [{ id: "i1", status: "TASK", text: "Responder al cliente", done: false, at: a(hoy, -1, 11) }, { id: "i2", status: "TASK", text: "Renovar el abono", done: true, at: a(hoy, -3, 11) }, { id: "i3", status: "IDEA", text: "Un podcast sobre carteles de bar", at: a(hoy, -2, 23) }];
  const decisiones = [
    { id: "d1", at: a(hoy, -150, 12), texto: "Ahorrar 200 € al mes", antes: null },
    { id: "d2", at: a(hoy, -60, 12), texto: "Dejar de aceptar trabajos «para ayer»", antes: "Decía que sí a todo" },
    { id: "d3", at: a(hoy, -25, 12), texto: "Sin briefing escrito no empiezo", antes: "Me fiaba de una llamada" },
  ];
  return { schema: 1, demo: true, spending, income, reminders, inbox, projects, eventos, decisiones, brain: { schema: 1, claims, events: [], forgotten: [] }, settings: {} };
}
