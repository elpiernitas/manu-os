// WEB-108: Horizonte. Datos inventados; ninguna prueba toca red ni datos reales.
import test from "node:test";
import assert from "node:assert/strict";
import * as H from "../core/horizonte.js";
import * as V from "../design/horizonte.js";
import { validateVault } from "../core/storage.js";
import { cloudPayload, applyRemote } from "../core/cloudprivacy.js";
import { remember, emptyBrain } from "../core/brain.js";

const AHORA = new Date("2026-11-09T10:00:00+01:00");
const iso = (s) => new Date(s).toISOString();

test("tema: Claude Design predeterminado y los otros dos disponibles", () => {
  assert.equal(H.skinOf(undefined), "design");
  assert.equal(H.skinOf({}), "design", "un vault antiguo sin elección abre Claude Design");
  assert.equal(H.skinOf({ skin: "design" }), "design");
  assert.equal(H.skinOf({ skin: "clasico" }), "clasico");
  assert.equal(H.skinOf({ skin: "horizonte" }), "horizonte");
  assert.equal(H.skinOf({ skin: "<script>" }), "design");
});

test("la elección y los campos nuevos sobreviven a la validación y viajan con Tu nube", () => {
  const raw = { schema: 1, inbox: [], spending: [], chat: [], settings: { skin: "clasico", hzNoches: { "noche-a": "no" } },
    projects: [{ id: "p", name: "P", emoji: "📁", sources: [], chat: [{ from: "me", text: "hola" }], pieces: [{ id: "x", t: "Pieza", done: true }], launchedAt: iso("2026-11-01T10:00:00Z") }] };
  const v = validateVault(raw).vault ?? validateVault(raw);
  const p = (v.projects ?? raw.projects)[0];
  assert.deepEqual(p.pieces, raw.projects[0].pieces);
  assert.equal(p.launchedAt, raw.projects[0].launchedAt);
  const up = cloudPayload(raw);
  assert.equal(up.settings.skin, "clasico");
  assert.deepEqual(up.projects[0].pieces, raw.projects[0].pieces);
  assert.equal(up.projects[0].chat, undefined, "el chat del proyecto sigue sin subir");
  const down = applyRemote(up, raw);
  assert.equal(down.settings.skin, "clasico");
});

test("cielo: el sol de Gijón decide día, ocaso y noche; el tiempo real lo vela", () => {
  assert.equal(H.cielo(new Date("2026-11-09T12:30:00+01:00")).fase, "dia");
  assert.equal(H.cielo(new Date("2026-11-09T23:00:00+01:00")).astro.tipo, "luna");
  assert.equal(H.cielo(new Date("2026-11-09T23:00:00+01:00")).oscuro, true);
  assert.equal(H.cielo(new Date("2026-11-09T12:30:00+01:00"), "lluvia").tiempo, "lluvia");
  assert.equal(H.cielo(new Date(), "granizo").tiempo, "despejado");
  assert.equal(H.cielo(new Date(), "despejado", { name: "Sin coords" }).fase.length > 0, true, "una ciudad sin coordenadas usa Gijón");
  assert.equal(H.tiempoDe("rain"), "lluvia"); assert.equal(H.tiempoDe("fog"), "niebla"); assert.equal(H.tiempoDe("cloud-sun"), "nubes"); assert.equal(H.tiempoDe(undefined), "despejado");
});

test("contraste: los pares del tema cumplen AA y el título se lee sobre el cielo a cualquier hora", () => {
  for (const [tema, t] of Object.entries(H.TOKENS)) for (const fondo of [t.papel, t.papel2]) {
    for (const k of ["tinta", "tinta2", "boyaTinta"]) assert.ok(H.contraste(t[k], fondo) >= 4.5, `${tema} ${k} sobre ${fondo}`);
  }
  for (const tiempo of H.TIEMPOS) for (let m = 0; m < 1440; m += 20) {
    const c = H.cielo(new Date(Date.UTC(2026, 10, 9, Math.floor(m / 60), m % 60)), tiempo);
    const tinta = H.TOKENS[c.oscuro ? "noche" : "dia"].tinta;
    assert.ok(H.contraste(tinta, c.colores.arriba) >= 3, `${tiempo} ${m} min: ${H.contraste(tinta, c.colores.arriba).toFixed(2)}`);
  }
});

test("portada: solo citas y avisos reales de hoy; sin nada, lo dice (en hora local del dispositivo)", () => {
  const local = (h, m = 0, d = 9) => new Date(2026, 10, d, h, m);
  const ahora = local(10);
  const agenda = { day: "2026-11-09", events: [{ time: "09:30", title: "Reunión" }, { time: "12:00", title: "Comida" }, { title: "Cumpleaños" }] };
  const reminders = [{ text: "Factura", at: local(17).toISOString(), done: false }, { text: "Ayer", at: local(17, 0, 8).toISOString(), done: false }];
  const p = H.portada({ agenda, reminders, ahora, real: ahora });
  assert.equal(p.titular, "12:00 · Comida");
  assert.equal(p.antes.length, 1); assert.equal(p.luego.length, 2);
  assert.deepEqual(p.todoElDia, ["Cumpleaños"]);
  assert.equal(H.portada({ agenda, reminders, ahora: local(21), real: ahora }).titular, "Lo de hoy ya ha pasado.");
  assert.equal(H.portada({ agenda: { day: "2026-11-08", events: [{ time: "10:00", title: "Viejo" }] }, ahora, real: ahora }).titular, "Nada en la agenda de hoy.", "la agenda de otro día no cuenta");
});

// Fechas en hora local: las «noches» son horas del dispositivo (Manu en Madrid), no UTC.
const L = (s) => { const [d, t] = s.split("T"); const [y, mo, da] = d.split("-").map(Number); const [h, mi] = t.slice(0, 5).split(":").map(Number); return new Date(y, mo - 1, da, h, mi); };
const gasto = (id, at, cents, merchant = "BAR UNO", category = "NIGHTLIFE") => ({ id, at: L(at).toISOString(), cents, merchant, category });
test("mareas: hechos contados, hipótesis marcada, pendientes visibles; Bizum fuera de las noches", () => {
  assert.equal(H.mareas({}, { ahora: L("2026-11-09T10:00") }).vacio, true);
  const spending = [
    gasto("a", "2026-11-01T22:00:00+01:00", 900), gasto("b", "2026-11-01T23:30:00+01:00", 1200, "PUB DOS"), gasto("c", "2026-11-02T01:00:00+01:00", 1500, "SALA TRES"),
    gasto("d", "2026-11-03T22:00:00+01:00", 900, "BIZUM A ALGUIEN", "TRANSFERS"), gasto("e", "2026-11-03T23:00:00+01:00", 900, "BIZUM B", "TRANSFERS"), gasto("f", "2026-11-04T00:30:00+01:00", 900, "BIZUM C", "TRANSFERS"),
    gasto("g", "2026-11-05T12:00:00+01:00", 500, "RARO", "OTHER"),
    gasto("viejo", "2026-06-01T12:00:00+01:00", 99999, "MUY VIEJO", "SHOPPING"),
  ];
  const m = H.mareas({ spending, income: [{ id: "i", at: L("2026-10-28T08:00").toISOString(), cents: 100000 }] }, { ahora: L("2026-11-09T10:00") });
  assert.equal(m.noches.length, 1, "los Bizum de madrugada no son una noche");
  assert.equal(m.noches[0].total, 3600);
  assert.equal(m.marea.length, 90);
  assert.equal(m.marea.at(-1).nivel, 100000 - 3600 - 2700 - 500, "la marea solo suma lo de los 90 días");
  assert.ok(m.hallazgos.some((h) => h.tipo === "HIPOTESIS" && /fiesta/.test(h.texto)));
  assert.ok(m.hallazgos.some((h) => h.tipo === "PENDIENTE" && /1 movimiento sin categoría/.test(h.texto)));
  assert.ok(m.hallazgos.every((h) => ["HECHO", "HIPOTESIS", "PENDIENTE"].includes(h.tipo) && h.base));
  assert.equal(m.momentos.flat().reduce((a, b) => a + b, 0), m.total, "cada céntimo de consumo cae en una celda");
});

test("constelación: estados reales, hilos solo con motivo, estrellas que no se pisan", () => {
  let b = emptyBrain();
  const add = (input) => { b = remember(b, input, { now: AHORA }).brain; };
  add({ text: "Trabajo en marketing", kind: "FACT", tags: ["trabajo"] });
  add({ text: "Prefiero trabajar de noche", kind: "PREFERENCE", tags: ["trabajo", "noche"] });
  add({ text: "Los domingos rindo poco", kind: "INFERENCE", confidence: 0.6, reason: "x", source: { kind: "deduccion" } });
  add({ text: "Me gusta el mar", kind: "PREFERENCE" });
  for (let i = 0; i < 30; i++) add({ text: `Recuerdo ${i}`, kind: "MEMORY", tags: [`t${i % 5}`] });
  const c = H.constelacion(b, { ahora: AHORA });
  assert.equal(c.estrellas.length, 34);
  assert.equal(c.cuenta.inferida, 1);
  const id = (t) => b.claims.find((x) => x.text === t).id;
  assert.ok(c.hilos.some((h) => [h.a, h.b].sort().join() === [id("Trabajo en marketing"), id("Prefiero trabajar de noche")].sort().join() && h.por.some((p) => /trabajo/.test(p))));
  assert.ok(!c.hilos.some((h) => h.a === id("Me gusta el mar") || h.b === id("Me gusta el mar")), "sin nada en común, sin hilo");
  for (let i = 0; i < c.estrellas.length; i++) for (let j = i + 1; j < c.estrellas.length; j++) {
    const [p, q] = [c.estrellas[i], c.estrellas[j]];
    assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= H.HUECO * 0.9, "dos estrellas no pueden pisarse (no se podrían tocar)");
  }
  const viejo = { id: "v", text: "Viejo", kind: "DECISION", status: "ACTIVE", recordedAt: iso("2025-01-01"), validFrom: iso("2025-01-01"), confirmedAt: iso("2025-01-01") };
  assert.equal(H.estadoDe(viejo, AHORA), "caducada", "una decisión de hace casi dos años está por revisar");
});

test("bitácora: sin recuerdos de terceros, agrupada por tipo", () => {
  let b = emptyBrain();
  b = remember(b, { text: "Vivo en Gijón", kind: "FACT" }, { now: AHORA }).brain;
  b = remember(b, { text: "Ana trabaja en un banco", kind: "FACT", subject: "Ana", thirdParty: true }, { now: AHORA }).brain;
  const r = H.retrato(b, { ahora: AHORA });
  assert.deepEqual(r.map((g) => g.titulo), ["Quién eres"]);
  assert.equal(r[0].frases.length, 1);
});

test("astillero: el casco solo avanza con piezas; botar exige terminarlas; se puede deshacer", () => {
  const p0 = { id: "p", name: "P", emoji: "📁", sources: [{}], chat: [] };
  assert.equal(H.barco(p0).avance, null, "sin piezas no hay porcentaje");
  assert.equal(H.botar(p0, AHORA), p0, "un plano sin piezas no se bota");
  assert.throws(() => H.addPieza(p0, "   ", "a"));
  let p = H.addPieza(H.addPieza(p0, "Uno", "a"), "Dos", "b");
  assert.equal(H.barco(p).avance, 0);
  p = H.marcarPieza(p, "a");
  assert.equal(H.barco(p).avance, 0.5);
  assert.equal(H.botar(p, AHORA), p, "con piezas pendientes no se bota");
  p = H.botar(H.marcarPieza(p, "b"), AHORA);
  assert.equal(p.launchedAt, AHORA.toISOString());
  assert.equal(p.sources.length, 1, "botar no toca las fuentes");
  assert.equal(H.varar(p).launchedAt, undefined);
  let lleno = p0; for (let i = 0; i < H.MAX_PIEZAS; i++) lleno = H.addPieza(lleno, `P${i}`, `id${i}`);
  assert.throws(() => H.addPieza(lleno, "Una más", "x"));
});

test("las piezas visuales escapan todo lo que viene de los datos", () => {
  const malo = '<img src=x onerror="alert(1)">';
  const html = [
    V.hzPortada({ p: H.portada({ agenda: { day: "2026-11-09", events: [{ time: "12:00", title: malo }] }, ahora: AHORA, real: AHORA }), c: H.cielo(AHORA), w: { now: { temp: malo } }, ciudad: malo, fecha: AHORA }),
    V.hzBotella({ key: malo, title: malo, body: malo, why: malo, actions: [{ id: malo, label: malo, primary: true }] }),
    V.hzMareas(H.mareas({ spending: [gasto("a", "2026-11-01T22:00:00+01:00", 900, malo), gasto("b", "2026-11-01T23:00:00+01:00", 900, malo), gasto("c", "2026-11-02T00:30:00+01:00", 900, malo)] }, { ahora: L("2026-11-09T10:00") })),
    V.hzConstelacion({ estrellas: [{ id: malo, texto: malo, estado: "confirmada", x: 0.5, y: 0.5 }], hilos: [], cuenta: { confirmada: 1, inferida: 0, pendiente: 0, caducada: 0 }, total: 1 }, { sel: malo }),
    V.hzBarcoCarta(H.barco({ id: malo, name: malo, emoji: malo, sources: [], pieces: [{ id: malo, t: malo, done: false }] })),
    V.hzAstillero(H.barco({ id: malo, name: malo, emoji: malo, sources: [], pieces: [{ id: malo, t: malo, done: false }] })),
    V.hzBitacora([{ titulo: malo, frases: [{ id: malo, texto: malo, estado: "pendiente" }] }]),
  ].join("");
  assert.ok(!html.includes("<img"), "ninguna etiqueta inyectada");
  assert.ok(!/style="/.test(html), "sin estilos en línea (la CSP de la app los bloquea)");
});

test("estados vacíos: nada inventado", () => {
  assert.match(V.hzMareas(H.mareas({}, { ahora: AHORA })), /Mar en calma/);
  assert.match(V.hzConstelacion(H.constelacion(emptyBrain(), { ahora: AHORA })), /Cielo despejado/);
  assert.match(V.hzBitacora([]), /Mejor eso que inventármelo/);
  assert.equal(V.hzBotella(null), "");
});
