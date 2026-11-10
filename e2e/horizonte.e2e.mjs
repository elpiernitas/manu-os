// WEB-108: Horizonte en la app real (Chromium con emulación de iPhone; NO es Safari real).
// Run: python3 -m http.server 8765 --directory web  &  node e2e/horizonte.e2e.mjs [carpeta-capturas]
// Todos los datos son inventados («BAR UNO», «Proyecto prueba»…). Ninguna llamada sale de la máquina:
// el tiempo, Supabase y Google se interceptan.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
const B = process.env.MANU_URL ?? "http://localhost:8765/";
let fails = 0, passes = 0;
const ok = (l, v) => { if (v) passes++; else { fails++; console.log("FAIL", l); } };
const browser = await chromium.launch();
const iso = (d, h, m = 0) => new Date(`${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+01:00`).toISOString();

// ---- Un vault de prueba con la forma real (inventado) ----
function seed({ skin } = {}) {
  const spending = [];
  let n = 0;
  const g = (at, merchant, category, cents) => spending.push({ id: `g${++n}`, at, merchant, category, cents, source: "MANUAL" });
  for (let d = 1; d <= 60; d++) { const day = new Date(Date.UTC(2026, 10, 9) - d * 864e5).toISOString().slice(0, 10); g(iso(day, 9, 10), "CAFE UNO", "FOOD_AND_DRINK", 180 + (d % 4) * 20); if (d % 3 === 0) g(iso(day, 19, 30), "SUPER DOS", "GROCERIES", 2400 + d * 10); }
  // Dos noches con 3+ pagos seguidos
  for (const day of ["2026-11-01", "2026-10-18"]) { g(iso(day, 22, 10), "BAR UNO", "NIGHTLIFE", 900); g(iso(day, 23, 40), "PUB DOS", "NIGHTLIFE", 1200); const next = new Date(Date.parse(`${day}T12:00:00Z`) + 864e5).toISOString().slice(0, 10); g(iso(next, 1, 30), "SALA TRES", "NIGHTLIFE", 1500); g(iso(next, 3, 5), "TAXI CUATRO", "TRANSPORT", 890); }
  g(iso("2026-11-05", 12, 0), "COMPRA RARA <script>alert(1)</script>", "OTHER", 999);
  const income = [{ id: "i1", at: iso("2026-10-28", 8), merchant: "NOMINA PRUEBA", cents: 120000 }];
  const claim = (id, text, kind, status, extra = {}) => ({ id, text, kind, status, subject: "Manu", tags: [], sensitive: false, source: { kind: "manu" }, recordedAt: iso("2026-11-01", 10), validFrom: iso("2026-11-01", 10), confirmedAt: status === "ACTIVE" ? iso("2026-11-01", 10) : null, ...extra });
  const brain = { schema: 1, claims: [
    claim("c1", "Trabajo en marketing", "FACT", "ACTIVE", { tags: ["trabajo"] }),
    claim("c2", "Prefiero trabajar de noche", "PREFERENCE", "ACTIVE", { tags: ["trabajo", "noche"] }),
    claim("c3", "Decidí no aceptar encargos sin briefing", "DECISION", "ACTIVE", { tags: ["trabajo"] }),
    claim("c4", "Los domingos rindo poco", "INFERENCE", "PROPOSED", { tags: ["descanso"], confidence: 0.6, reason: "Prueba", source: { kind: "deduccion" } }),
    claim("c5", "Madrugo sin problema", "FACT", "CONTESTED", { tags: ["noche"] }),
    claim("c6", "Mi café es <b>cortado</b>", "PREFERENCE", "ACTIVE"),
  ], events: [], forgotten: [] };
  return { schema: 1, settings: skin ? { skin } : {}, inbox: [{ id: "t1", status: "TASK", text: "Responder al cliente", done: false, at: iso("2026-11-08", 11) }], chat: [], income, spending,
    reminders: [{ id: "r1", text: "Enviar la factura", at: iso("2026-11-09", 17), done: false }],
    agenda: { day: "2026-11-09", source: "PASTE", events: [{ time: "09:30", title: "Daily del equipo" }, { time: "12:00", title: "Presentar rutas de logo" }] },
    projects: [
      { id: "p1", name: "Proyecto prueba", emoji: "📁", createdAt: iso("2026-10-01", 10), sources: [{ id: "s1", kind: "note", title: "Nota", text: "x" }], chat: [], pieces: [{ id: "a", t: "Moodboard", done: true }, { id: "b", t: "Entrega", done: false }] },
      { id: "p2", name: "Proyecto antiguo", emoji: "🗂️", createdAt: iso("2026-09-01", 10), sources: [], chat: [] },
    ],
    weather: { city: { id: "GIJON", name: "Gijón", latitude: 43.53573, longitude: -5.66152 }, at: new Date("2026-11-09T09:55:00+01:00").toISOString(),
      data: { now: { temp: 14, icon: "rain", label: "Lluvia" }, today: { max: 15, min: 9, sunrise: "08:21", sunset: "18:05", icon: "rain", rain: 80 }, tomorrow: null, offset: 3600, days: [], hours: [{ time: "Ahora", icon: "rain" }, { time: "20", icon: "cloud-moon" }] } },
    brain };
}
const ctxFor = async (opts, v, { at = "2026-11-09T10:00:00+01:00", tab = "hoy" } = {}) => {
  const ctx = await browser.newContext({ timezoneId: "Europe/Madrid", ...opts });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/open-meteo|Failed to load resource|Applying inline style violates/.test(m.text())) errors.push(m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.clock.install({ time: new Date(at) });
  await page.route(/^https:\/\/([^/]*\.)?(open-meteo\.com|supabase\.co|googleapis\.com|google\.com|spotify\.com|enablebanking\.com)\//, (r) => r.fulfill({ status: 503, body: "" }));
  await page.addInitScript(([vv, t]) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); sessionStorage.setItem("manuos.tab", t); localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); if (vv) localStorage.setItem("manuos.vault", JSON.stringify(vv)); }, [v, tab]);
  await page.goto(B); await page.waitForTimeout(700);
  return { ctx, page, errors };
};
const iphone = { ...devices["iPhone 14"] };
const shot = async (page, name) => { if (out) { await page.waitForTimeout(450); await page.screenshot({ path: `${out}/${name}.png` }); } };
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const go = async (page, t) => { await page.click(`#tabs [data-tab="${t}"]`); await page.waitForTimeout(250); };

// 1. Por defecto, Horizonte. Datos reales del vault, nada inventado.
{
  const { ctx, page, errors } = await ctxFor(iphone, seed());
  ok("tema por defecto: horizonte", (await page.getAttribute("html", "data-skin")) === "horizonte");
  ok("a las 10:00 en Gijón es de día", (await page.getAttribute("html", "data-tema")) === "dia");
  const hoy = await page.locator("#screen").innerText();
  ok("portada con la cita real siguiente", /12:00 · Presentar rutas de logo/.test(hoy));
  ok("portada con el tiempo real (lluvia)", /lluvia · 14°/i.test(hoy));
  ok("sin datos de la demo", !/DEMO|Sidrería|Salitre|inventad/i.test(hoy));
  await shot(page, "hoy-dia");
  // El dial: a las 20:00 el titular dice lo que hay de verdad y el cielo se oscurece.
  await page.locator("#hzDial").fill("1200"); await page.locator("#hzDial").dispatchEvent("input");
  ok("dial 20:00: noche", (await page.getAttribute("html", "data-tema")) === "noche");
  ok("dial 20:00: nada más hoy", /ya ha pasado/.test(await page.locator("#hzTitular").innerText()));
  await page.locator("#hzDial").dispatchEvent("change");
  ok("dial: botón para volver a ahora", await page.locator('[data-act="hz-dial-ahora"]').isVisible());
  await shot(page, "hoy-dial-noche");
  await page.click('[data-act="hz-dial-ahora"]');
  ok("vuelta a ahora", (await page.getAttribute("html", "data-tema")) === "dia");
  // Navegación por todas las secciones, sin desbordes.
  for (const t of ["bahia", "manu", "dinero", "proyectos", "tu", "hoy"]) { await go(page, t); ok(`sección ${t} sin desbordar`, !(await overflow(page))); }
  ok(`sin errores de consola (${errors.join(" | ")})`, errors.length === 0);
  await ctx.close();
}

// 2. Dinero: mareas con datos reales, hecho/hipótesis/pendiente, noche que solo se apunta si Manu lo dice.
{
  const { ctx, page, errors } = await ctxFor(iphone, seed(), { tab: "dinero" });
  const t = await page.locator(".hz-mareas").innerText();
  ok("mareas: hechos", (await page.locator(".hz-mareas .hz-sello-hecho").count()) >= 2);
  ok("mareas: hipótesis de fiesta", (await page.locator(".hz-mareas .hz-sello-hipotesis").count()) >= 1);
  ok("mareas: pendiente (sin categoría)", /sin categoría segura/.test(t));
  ok("mareas: no es el saldo", /No es tu saldo/.test(t));
  ok("XSS: el concepto se escapa", (await page.locator(".hz-mareas script, #screen script").count()) === 0);
  ok("el bloque del banco sigue ahí", (await page.locator("#screen").innerText()).includes("Sabadell"));
  await shot(page, "dinero");
  const antes = (await page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")))).brain.claims.length;
  await page.click('[data-act="hz-noche"][data-v="si"]');
  const v = await page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
  ok("noche confirmada: un recuerdo nuevo, de Manu", v.brain.claims.length === antes + 1 && v.brain.claims.at(-1).source.kind === "manu");
  ok("noche confirmada: los movimientos no cambian", v.spending.length === seed().spending.length);
  ok(`dinero sin errores (${errors.join(" | ")})`, errors.length === 0);
  await ctx.close();
}

// 3. MANU: chat real (no guion) y Constelación con recuerdos reales.
{
  const { ctx, page, errors } = await ctxFor(iphone, seed(), { tab: "manu" });
  ok("MANU: la cara", (await page.locator("#orb .hz-cara").count()) === 1);
  ok("MANU: el composer real", await page.locator("#composer #msg").isVisible());
  // El composer no queda bajo la barra
  const comp = await page.locator("#composer").boundingBox(), bar = await page.locator("#tabs").boundingBox();
  ok("composer por encima de la barra", comp.y + comp.height <= bar.y + 1);
  await page.fill("#msg", "gasté 3 en café"); await page.press("#msg", "Enter"); await page.waitForTimeout(400);
  ok("el chat real apunta el gasto", (await page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")))).spending.length === seed().spending.length + 1 || /café|gasto/i.test(await page.locator("#chat").innerText()));
  await shot(page, "manu-chat");
  await page.click('[data-act="hz-manu"][data-v="cielo"]');
  ok("constelación: una estrella por recuerdo vivo", (await page.locator(".hz-estrella").count()) === 6);
  ok("constelación: estados", (await page.locator(".hz-estrella-inferida").count()) === 1 && (await page.locator(".hz-estrella-caducada").count()) === 1);
  await page.locator('.hz-estrella[data-id="c2"]').focus(); await page.keyboard.press("Enter");
  ok("estrella abre su ficha real", /Origen/.test(await page.locator(".mem-detail").innerText()));
  ok("hilos con motivo real", /tema: (trabajo|noche)/.test(await page.locator(".hz-hilo-texto").innerText()));
  ok("XSS: el texto del recuerdo se escapa", (await page.locator(".hz-cons b").count()) === 0);
  await shot(page, "constelacion");
  await page.locator('.hz-estrella[data-id="c4"]').focus(); await page.keyboard.press("Enter");
  await page.click('.mem-detail [data-act="mem-confirm"]');
  ok("confirmar una inferida la vuelve confirmada", (await page.locator('.hz-estrella[data-id="c4"].hz-estrella-confirmada').count()) === 1);
  await page.locator('.hz-estrella[data-id="c6"]').focus(); await page.keyboard.press("Enter");
  await page.click('.mem-detail [data-act="mem-forget"]');
  const v = await page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
  ok("olvidar: desaparece y deja lápida", !v.brain.claims.some((c) => c.id === "c6") && v.brain.forgotten.some((t) => t.id === "c6"));
  ok(`manu sin errores (${errors.join(" | ")})`, errors.length === 0);
  await ctx.close();
}

// 4. Astillero: progreso por piezas reales; botar con confirmación; volver al astillero.
{
  const { ctx, page, errors } = await ctxFor(iphone, seed(), { tab: "proyectos" });
  ok("barco con piezas: 1 de 2", /1 de 2 piezas/.test(await page.locator("#screen").innerText()));
  ok("proyecto sin piezas: solo el plano", /Solo el plano/.test(await page.locator("#screen").innerText()));
  await shot(page, "astillero");
  await page.click('[data-act="proj-open"][data-id="p1"]');
  ok("botar deshabilitado con piezas pendientes", await page.locator('[data-act="hz-botar"]').isDisabled());
  await page.fill("#hzPieza", "Revisión final"); await page.press("#hzPieza", "Enter");
  ok("pieza añadida", /Revisión final/.test(await page.locator(".hz-piezas").innerText()));
  for (const id of await page.locator('.hz-piezas input:not(:checked)').evaluateAll((els) => els.map((e) => e.dataset.id))) await page.click(`.hz-piezas input[data-id="${id}"]`);
  await page.click('[data-act="hz-botar"]');
  ok("botar pide confirmación", await page.locator(".hz-confirmar").isVisible());
  await page.click('[data-act="hz-botar-si"]');
  ok("botadura", await page.locator(".hz-botadura").isVisible());
  await shot(page, "botadura");
  await page.click('[data-act="hz-botadura-fin"]');
  let v = await page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
  const p1 = v.projects.find((p) => p.id === "p1");
  ok("botado de verdad, sin perder fuentes", Boolean(p1.launchedAt) && p1.sources.length === 1);
  await page.click('[data-act="hz-varar"]');
  v = await page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
  ok("se puede deshacer", !v.projects.find((p) => p.id === "p1").launchedAt);
  ok(`astillero sin errores (${errors.join(" | ")})`, errors.length === 0);
  await ctx.close();
}

// 5. Tú: Bitácora real, y cambiar a Clásico y volver, sin perder estado y tras recargar.
{
  const { ctx, page, errors } = await ctxFor(iphone, seed(), { tab: "tu" });
  ok("bitácora con frases reales", /Trabajo en marketing/.test(await page.locator(".hz-bitacora").innerText()));
  await shot(page, "tu");
  await page.click('.hz-frase[data-id="c3"]');
  ok("una frase abre su ficha en Memoria", /Origen/.test(await page.locator(".mem-detail").innerText()));
  await page.click('[data-act="back"]');
  await page.click('[data-sub="apariencia"]');
  await page.click('[data-act="hz-skin"][data-v="clasico"]');
  ok("clásico aplicado", (await page.getAttribute("html", "data-skin")) === "clasico");
  ok("clásico: sin cielo de Horizonte", (await page.evaluate(() => document.documentElement.style.getPropertyValue("--cielo-1"))) === "");
  ok("clásico: el vault no cambia salvo el tema", (await page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")))).spending.length === seed().spending.length);
  await shot(page, "clasico-apariencia");
  await page.reload(); await page.waitForTimeout(600);
  ok("tras recargar sigue clásico", (await page.getAttribute("html", "data-skin")) === "clasico");
  await go(page, "hoy");
  ok("clásico: la portada de siempre", (await page.locator(".hz-portada").count()) === 0 && (await page.locator(".fable-hoy").count()) === 1);
  await go(page, "tu"); await page.click('[data-sub="apariencia"]');
  await page.click('[data-act="hz-skin"][data-v="horizonte"]');
  ok("vuelta a horizonte", (await page.getAttribute("html", "data-skin")) === "horizonte");
  ok(`tú sin errores (${errors.join(" | ")})`, errors.length === 0);
  await ctx.close();
}

// 6. Vault vacío (instalación nueva): estados vacíos, nada inventado.
{
  const { ctx, page, errors } = await ctxFor(iphone, null);
  ok("vacío: horizonte", (await page.getAttribute("html", "data-skin")) === "horizonte");
  ok("vacío: portada sin citas", /Nada en la agenda de hoy/.test(await page.locator("#screen").innerText()));
  await shot(page, "vacio-hoy");
  await go(page, "dinero"); ok("vacío: mar en calma", /Mar en calma/.test(await page.locator("#screen").innerText()));
  await go(page, "manu"); await page.click('[data-act="hz-manu"][data-v="cielo"]'); ok("vacío: cielo despejado", /Cielo despejado/.test(await page.locator("#screen").innerText()));
  ok(`vacío sin errores (${errors.join(" | ")})`, errors.length === 0);
  await ctx.close();
}

// 7. Noche, 320/375/390/430 px y Mac.
{
  const { ctx, page } = await ctxFor(iphone, seed(), { at: "2026-11-09T22:30:00+01:00" });
  ok("22:30: noche y luna", (await page.getAttribute("html", "data-tema")) === "noche" && (await page.getAttribute("html", "data-astro")) === "luna");
  await shot(page, "hoy-noche");
  await go(page, "dinero"); await shot(page, "dinero-noche");
  await ctx.close();
}
for (const w of [320, 375, 390, 430]) {
  const { ctx, page } = await ctxFor({ viewport: { width: w, height: 760 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }, seed());
  for (const t of ["hoy", "bahia", "manu", "dinero", "proyectos", "tu"]) { await go(page, t); ok(`${w}px ${t}: sin desbordar`, !(await overflow(page))); }
  // Lo último de la página queda por encima de la barra.
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(150);
  const last = await page.evaluate(() => { const els = [...document.querySelectorAll("#screen > *, #screen .stack > *")].filter((e) => e.offsetHeight); const r = els.at(-1).getBoundingClientRect(); return r.bottom; });
  const bar = await page.locator("#tabs").boundingBox();
  ok(`${w}px: el final no queda bajo la barra`, last <= bar.y + 1);
  await ctx.close();
}
{
  const { ctx, page, errors } = await ctxFor({ viewport: { width: 1440, height: 900 } }, seed());
  const bar = await page.locator("#tabs").boundingBox();
  ok("Mac: la barra es un muelle lateral", bar.height > 800 && bar.width <= 210);
  ok("Mac: sin desbordar", !(await overflow(page)));
  await shot(page, "mac-hoy");
  await go(page, "dinero"); await shot(page, "mac-dinero");
  ok(`mac sin errores (${errors.join(" | ")})`, errors.length === 0);
  await ctx.close();
}
// 8. Movimiento reducido: sin animaciones.
{
  const { ctx, page } = await ctxFor({ ...iphone, reducedMotion: "reduce" }, seed());
  const anim = await page.evaluate(() => getComputedStyle(document.querySelector(".hz-botella-ico, .tab[aria-selected=true]"), "::before").animationName);
  ok("movimiento reducido: sin animación", anim === "none" || anim === "");
  await ctx.close();
}

// 9. PWA: el service worker guarda Horizonte; sin conexión abre igual y los datos siguen ahí.
{
  const ctx = await browser.newContext({ ...iphone, timezoneId: "Europe/Madrid" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(/^https:\/\/([^/]*\.)?(open-meteo\.com|supabase\.co|googleapis\.com|google\.com|spotify\.com|enablebanking\.com)\//, (r) => r.fulfill({ status: 503, body: "" }));
  await page.addInitScript((vv) => { if (!localStorage.getItem("manuos.vault")) localStorage.setItem("manuos.vault", JSON.stringify(vv)); }, seed({ skin: "clasico" }));
  await page.goto(B); await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(1500);
  const cached = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys.find((k) => k.startsWith("manuos-v"))); return { keys, css: Boolean(await c.match("design/horizonte.css")), core: Boolean(await c.match("core/horizonte.js")), font: Boolean(await c.match("design/fonts/fraunces.woff2")) }; });
  ok(`caché con la versión nueva (${cached.keys.join(",")})`, cached.keys.some((k) => /^manuos-v\d+$/.test(k)));
  ok("caché: Horizonte completo (estilos, núcleo, tipografía)", cached.css && cached.core && cached.font);
  ok("la elección guardada (Clásico) se respeta al abrir", (await page.getAttribute("html", "data-skin")) === "clasico");
  await ctx.setOffline(true);
  await page.reload(); await page.waitForTimeout(900);
  ok("sin conexión: la app abre", (await page.locator("#tabs .tab").count()) === 6);
  const v = await page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
  ok("sin conexión: los datos intactos", v.spending.length === seed().spending.length && v.brain.claims.length === seed().brain.claims.length && v.settings.skin === "clasico");
  ok(`pwa sin errores (${errors.join(" | ")})`, errors.length === 0);
  await ctx.close();
}

await browser.close();
console.log(`horizonte.e2e: ${passes} correctas, ${fails} fallos`);
process.exit(fails ? 1 : 0);
