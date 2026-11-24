// WEB-124: centro de operaciones en escritorio (Chromium; NO es Safari).
// Run: python3 -m http.server 8765 --directory web  &  node e2e/escritorio.e2e.mjs [carpeta-capturas]
// Datos inventados. Ninguna llamada sale de la máquina: los servicios externos se interceptan.
// Comprueba: barra lateral fija ≥ 1024 px y barra inferior en móvil; panel de MANU con «Lo sé / Lo deduzco /
// Te propongo / Me falta»; ⌘J/Esc y foco; contraer la barra; ⌘K; sin desbordes de 320 a 1920; claro y oscuro.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
const B = process.env.MANU_URL ?? "http://localhost:8765/";
let fails = 0, passes = 0;
const ok = (l, v, extra = "") => { if (v) passes++; else { fails++; console.log("FAIL", l, extra); } };
const browser = await chromium.launch();
const iso = (d, h, m = 0) => new Date(`${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+01:00`).toISOString();

function seed(settings = { skin: "mp" }) {
  const spending = [];
  for (let d = 1; d <= 40; d++) { const day = new Date(Date.UTC(2026, 10, 20) - d * 864e5).toISOString().slice(0, 10); spending.push({ id: `g${d}`, at: iso(day, 9, 10), merchant: d % 5 ? "CAFE UNO" : "SUPER PRUEBA", category: d % 5 ? "FOOD_AND_DRINK" : "GROCERIES", cents: 180 + (d % 4) * 20, source: "MANUAL" }); }
  for (const m of ["2026-09-03", "2026-10-03", "2026-11-03"]) spending.push({ id: `s${m}`, at: iso(m, 8), merchant: "STREAMING PRUEBA", category: "SUBSCRIPTIONS", cents: 1299, source: "MANUAL" });
  return { schema: 1, settings, chat: [{ from: "manu", text: "Hola, Manu. ¿Qué apuntamos?" }],
    inbox: [{ id: "t1", status: "TASK", text: "Revisar presupuesto de prueba", done: false, at: iso("2026-11-19", 11) }, { id: "i1", status: "IDEA", text: "Idea de prueba para el blog", at: iso("2026-11-18", 11) }],
    income: [{ id: "n1", at: iso("2026-10-28", 8), merchant: "NOMINA PRUEBA", cents: 120000 }], spending,
    reminders: [{ id: "r1", text: "Llamar al taller (prueba)", at: iso("2026-11-20", 17), done: false }],
    agenda: { day: "2026-11-20", source: "PASTE", events: [{ time: "09:30", title: "Reunión de prueba" }, { time: "18:00", title: "Pádel (prueba)" }] },
    projects: [{ id: "p1", name: "Proyecto Alfa", emoji: "📁", why: "Probar el escritorio", createdAt: iso("2026-10-01", 10), sources: [{ id: "s1", kind: "note", title: "Nota", text: "Texto de prueba", at: iso("2026-11-10", 10) }], chat: [] },
      { id: "p2", name: "Proyecto Beta", emoji: "🧪", createdAt: iso("2026-09-01", 10), sources: [], chat: [] }],
    library: [{ id: "l1", kind: "libro", title: "Libro de prueba", status: "pendiente", at: iso("2026-11-01", 10) }],
    people: [{ id: "pe1", name: "Persona Prueba", birthday: "03-14" }],
  };
}
async function open({ v = seed(), viewport = { width: 1440, height: 900 }, device = null, tab = "hoy", scheme = "light", reduced = false, shell = null } = {}) {
  const ctx = await browser.newContext({ ...(device ?? { viewport }), timezoneId: "Europe/Madrid", colorScheme: scheme, reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.clock.install({ time: new Date("2026-11-20T10:00:00+01:00") });
  await page.route(/^https:\/\/([^/]*\.)?(open-meteo\.com|supabase\.co|googleapis\.com|google\.com|spotify\.com|enablebanking\.com|tiktok\.com|youtube\.com)\//, (r) => r.fulfill({ status: 503, body: "" }));
  await page.addInitScript(([vv, t, sh]) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); sessionStorage.setItem("manuos.tab", t); localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); if (vv) localStorage.setItem("manuos.vault", JSON.stringify(vv)); if (sh) localStorage.setItem("manuos.shell", JSON.stringify(sh)); }, [v, tab, shell]);
  await page.goto(B); await page.waitForTimeout(600);
  await settle(page);
  return { ctx, page, errors };
}
const noFiled = (k, v) => (k === "filed" ? undefined : v);
const settle = (page) => page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch {} }));
const goTab = async (page, t) => { await page.click(`.tab[data-tab="${t}"]`); await page.waitForTimeout(250); await settle(page); };
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const box = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right } : null; }, sel);
const ctxText = (page) => page.evaluate(() => { const p = document.getElementById("ctxPanel"); return p.hidden ? null : p.innerText; });
// Contraste del texto visible: color del texto frente al primer fondo opaco de sus antepasados.
const contrast = (page) => page.evaluate(() => {
  const parse = (c) => { const s = c.match(/color\(srgb ([^)]+)\)/); if (s) { const p = s[1].split(/[ /]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p[3] ?? 1 }; } const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const lum = ({ r, g, b }) => [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const mix = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const bgOf = (el) => { const layers = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== "none" && !/url\(/.test(cs.backgroundImage)) return null; const c = parse(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 0.99) break; } } let acc = { r: 255, g: 255, b: 255, a: 1 }; for (const l of layers.reverse()) acc = mix(l, acc); return acc; };
  const bad = [];
  for (const el of document.querySelectorAll("body *")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight * 6) continue;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || +cs.opacity === 0 || el.closest("[hidden],.sr,details:not([open]) > :not(summary)")) continue;
    const fg = parse(cs.color), bg = bgOf(el); if (!fg || !bg) continue;
    const f = fg.a < 1 ? mix(fg, bg) : fg;
    const [hi, lo] = [lum(f), lum(bg)].sort((a, b) => b - a); const ratio = (hi + 0.05) / (lo + 0.05);
    const size = parseFloat(cs.fontSize), large = size >= 24 || (size >= 18.6 && +cs.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5)) bad.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} «${el.textContent.trim().slice(0, 30)}» ${ratio.toFixed(2)}`);
  }
  return bad;
});
const shot = async (page, name) => { if (out) { await page.waitForTimeout(300); await page.screenshot({ path: `${out}/${name}.png` }); } };

// 1. Escritorio 1440: barra lateral a la izquierda, zona central ancha, sin desbordes.
{
  const { ctx, page, errors } = await open();
  const side = await box(page, "#sidebar"), screen = await box(page, "#screen");
  ok("barra lateral visible a la izquierda", side && side.x === 0 && side.w >= 200 && side.h >= 800, JSON.stringify(side));
  ok("zona central a la derecha de la barra", screen && screen.x >= side.right, JSON.stringify(screen));
  ok("zona central ancha (≥ 900 px)", screen && screen.w >= 900, JSON.stringify(screen));
  ok("las seis áreas en la barra", (await page.locator("#tabs .tab").count()) === 6);
  ok("pestañas en vertical", await page.evaluate(() => { const t = [...document.querySelectorAll("#tabs .tab")].map((e) => e.getBoundingClientRect().y); return t.every((y, i) => !i || y > t[i - 1]); }));
  ok("logo en la cabecera lateral", (await page.locator("#sideHead .side-brand").count()) === 1);
  ok("buscar y MANU en el pie lateral", (await page.locator("#sideFoot [data-act=cmdk]").count()) === 1 && (await page.locator("#sideFoot [data-act=ctx-toggle]").count()) === 1);
  ok("sin desbordes 1440", !(await overflow(page)));
  await shot(page, "escritorio-hoy-1440");
  // Panel de MANU: ⌘J abre, con las cajas y con fuente; Esc cierra y devuelve el foco.
  await page.keyboard.press("Control+j"); await page.waitForTimeout(200);
  const t = await ctxText(page);
  ok("⌘J abre el panel de MANU", t !== null);
  ok("el panel dice lo que sabe con su fuente", /Lo sé/i.test(t ?? "") && /Reunión de prueba/.test(t ?? "") && /Agenda pegada/i.test(t ?? ""), t);
  ok("el panel separa lo que deduce", /Lo deduzco/i.test(t ?? ""), t);
  ok("el panel dice lo que le falta", /Me falta/i.test(t ?? "") && /no está conectado/i.test(t ?? ""), t);
  ok("el foco entra en el panel", await page.evaluate(() => Boolean(document.activeElement?.closest("#ctxPanel"))));
  const p = await box(page, "#ctxPanel"), s2 = await box(page, "#screen");
  ok("el panel se acopla a la derecha sin tapar la zona central", p && p.right <= 1441 && s2.right <= p.x + 1, JSON.stringify({ p, s2 }));
  await shot(page, "escritorio-hoy-panel-1440");
  await page.keyboard.press("Escape"); await page.waitForTimeout(150);
  ok("Esc cierra el panel", (await ctxText(page)) === null);
  ok("el foco vuelve al botón de MANU", await page.evaluate(() => document.activeElement?.id === "ctxToggle"));
  // El estado se recuerda.
  await page.keyboard.press("Control+j"); await page.reload(); await page.waitForTimeout(600);
  ok("el panel abierto se recuerda al recargar", (await ctxText(page)) !== null);
  // Contraer la barra.
  await page.click("[data-act=side-collapse]"); await page.waitForTimeout(250);
  const sc = await box(page, "#sidebar");
  ok("contraer deja la barra estrecha", sc && sc.w <= 90, JSON.stringify(sc));
  ok("contraída: aria-expanded=false", (await page.getAttribute("[data-act=side-collapse]", "aria-expanded")) === "false");
  ok("contraída: los nombres siguen accesibles", (await page.locator("#tabs .tab").first().getAttribute("aria-label")) !== null || /Hoy/i.test(await page.locator("#tabs .tab").first().innerText()));
  await page.click("[data-act=side-collapse]");
  // Subsecciones en la barra.
  await goTab(page, "tu");
  ok("Tú enseña sus subsecciones en la barra", (await page.locator("#sideSub [data-act=side-go]").count()) >= 6);
  await page.click('#sideSub [data-to="biblioteca"]'); await page.waitForTimeout(250);
  ok("la barra abre Biblioteca", /Biblioteca/i.test(await page.locator("#screen").innerText()));
  ok("el panel cambia con la vista", /Libro de prueba|libros para leer/i.test((await ctxText(page)) ?? ""), await ctxText(page));
  await goTab(page, "proyectos");
  ok("Proyectos lista los proyectos en la barra", (await page.locator("#sideSub [data-act=side-proj]").count()) === 2);
  await page.click('#sideSub [data-id="p1"]'); await page.waitForTimeout(250);
  const tp = (await ctxText(page)) ?? "";
  ok("panel del proyecto: para qué y fuentes", /Probar el escritorio/.test(tp) && /1 fuentes/.test(tp), tp);
  ok("panel del proyecto: dice que no tiene decisiones", /No tengo decisiones/i.test(tp), tp);
  await shot(page, "escritorio-proyecto-1440");
  await goTab(page, "dinero");
  const td = (await ctxText(page)) ?? "";
  ok("panel de Dinero: fijo detectado como deducción", /STREAMING PRUEBA/.test(td) && /Lo deduzco/i.test(td), td);
  ok("panel de Dinero: no opera con el banco", /No hago operaciones con el banco/i.test(td), td);
  await shot(page, "escritorio-dinero-1440");
  await goTab(page, "agenda");
  await shot(page, "escritorio-agenda-1440");
  // ⌘K.
  await page.keyboard.press("Control+k"); await page.waitForTimeout(200);
  ok("⌘K abre la barra de comandos", await page.evaluate(() => { const d = document.querySelector(".cmdk"); return Boolean(d && !d.hidden); }));
  await page.keyboard.type("Alfa"); await page.waitForTimeout(150);
  const items = await page.locator(".cmdk-item").allInnerTexts();
  ok("⌘K busca en tus datos y dice de dónde viene", items.some((t) => /Proyecto Alfa/.test(t) && /Proyecto/i.test(t)), items.join(" | "));
  await page.locator(".cmdk-item", { hasText: "Proyecto Alfa" }).first().click(); await page.waitForTimeout(250);
  ok("⌘K abre el resultado", /Proyecto Alfa/.test(await page.locator("#screen").innerText()) && (await page.evaluate(() => document.querySelector(".tab[aria-selected=true]")?.dataset.tab)) === "proyectos");
  await page.keyboard.press("Control+k"); await page.keyboard.type("oscuro"); await page.waitForTimeout(150);
  ok("⌘K encuentra las pantallas nuevas", (await page.locator(".cmdk-item").allInnerTexts()).some((t) => /Apariencia/.test(t)));
  await page.keyboard.press("Escape");
  ok("sin errores de JS (1440)", !errors.length, errors.join(" | "));
  await ctx.close();
}

// 2. Anchos: 1024 y 1920 en escritorio; 320/390/768 siguen con barra inferior.
for (const w of [1024, 1920]) {
  const { ctx, page, errors } = await open({ viewport: { width: w, height: 900 }, shell: { ctx: true } });
  ok(`barra lateral a ${w}`, (await box(page, "#sidebar"))?.h >= 800);
  ok(`sin desbordes ${w}`, !(await overflow(page)));
  ok(`panel visible a ${w}`, (await ctxText(page)) !== null);
  for (const t of ["agenda", "manu", "dinero", "proyectos", "tu"]) { await goTab(page, t); ok(`sin desbordes ${w} ${t}`, !(await overflow(page))); }
  ok(`sin errores de JS (${w})`, !errors.length, errors.join(" | "));
  await ctx.close();
}
for (const [label, opts] of [["320", { viewport: { width: 320, height: 640 } }], ["390", { device: devices["iPhone 14"] }], ["768", { viewport: { width: 768, height: 1024 } }]]) {
  const { ctx, page, errors } = await open(opts);
  const tabs = await box(page, "#tabs");
  ok(`móvil ${label}: barra de pestañas abajo`, tabs && tabs.y > 400, JSON.stringify(tabs));
  ok(`móvil ${label}: sin cabecera ni pie laterales`, await page.evaluate(() => getComputedStyle(document.getElementById("sideHead")).display === "none" && getComputedStyle(document.getElementById("sideFoot")).display === "none"));
  ok(`móvil ${label}: panel cerrado por defecto`, (await ctxText(page)) === null);
  for (const t of ["hoy", "agenda", "manu", "dinero", "proyectos", "tu"]) { await goTab(page, t); ok(`móvil ${label}: sin desbordes ${t}`, !(await overflow(page))); }
  ok(`móvil ${label}: sin errores de JS`, !errors.length, errors.join(" | "));
  if (label === "390") await shot(page, "movil-tu-390");
  await ctx.close();
}

// 3. Movimiento reducido: sin transiciones en la barra ni en el panel.
{
  const { ctx, page } = await open({ reduced: true });
  ok("movimiento reducido: barra sin transición", await page.evaluate(() => ["0s", ""].includes(getComputedStyle(document.getElementById("sidebar")).transitionDuration.split(",")[0])));
  await ctx.close();
}

// 4. mp. claro y oscuro: contraste AA en las seis áreas, escritorio y móvil; el modo se elige en Apariencia.
for (const look of ["light", "dark", "auto"]) {
  for (const [label, opts] of [["1440", { viewport: { width: 1440, height: 900 }, shell: { ctx: true } }], ["390", { device: devices["iPhone 14"] }]]) {
    const { ctx, page, errors } = await open({ ...opts, v: seed({ skin: "mp", mpLook: look }), scheme: look === "auto" ? "dark" : "light" });
    const want = look === "light" ? "light" : "dark";
    ok(`${look} ${label}: data-look`, (await page.evaluate(() => document.documentElement.dataset.look)) === look);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    ok(`${look} ${label}: fondo ${want}`, want === "dark" ? /rgb\(11, 11, 13\)/.test(bg) : /rgb\(255, 255, 255\)/.test(bg), bg);
    ok(`${look} ${label}: theme-color`, (await page.getAttribute('meta[name="theme-color"]', "content")) === (want === "dark" ? "#0B0B0D" : "#FFFFFF"));
    for (const t of ["hoy", "agenda", "manu", "dinero", "proyectos", "tu"]) {
      await goTab(page, t);
      const bad = await contrast(page);
      ok(`${look} ${label} ${t}: contraste AA`, !bad.length, bad.slice(0, 6).join(" | "));
      if (look !== "auto") await shot(page, `${label === "390" ? "movil" : "escritorio"}-${t}-${look}`);
      if (t === "tu") ok(`${look} ${label}: el avatar se ve en ${want}`, (await page.evaluate(() => getComputedStyle(document.querySelector(".mp-avatar img")).filter)).includes("invert") === (want === "dark"));
    }
    if (label === "1440") { await page.click(".tab[data-tab=proyectos]"); await page.click('#sideSub [data-id="p1"]'); await page.waitForTimeout(250); await settle(page); const bad = await contrast(page); ok(`${look} proyecto abierto: contraste AA`, !bad.length, bad.slice(0, 6).join(" | ")); if (look !== "auto") await shot(page, `escritorio-proyecto-${look}`); }
    ok(`${look} ${label}: sin errores de JS`, !errors.length, errors.join(" | "));
    await ctx.close();
  }
}
{
  const { ctx, page } = await open({ tab: "tu" });
  await page.click('#sideSub [data-to="apariencia"]'); await page.waitForTimeout(200);
  ok("Apariencia ofrece claro/oscuro/sistema", (await page.locator("[data-act=hz-look]").count()) === 3);
  const before = await page.evaluate(() => localStorage.getItem("manuos.vault"));
  await page.click('[data-act=hz-look][data-v="dark"]'); await page.waitForTimeout(200);
  ok("elegir oscuro lo aplica al momento", (await page.evaluate(() => document.documentElement.dataset.look)) === "dark");
  const after = JSON.parse(await page.evaluate(() => localStorage.getItem("manuos.vault")));
  const b = JSON.parse(before); delete b.settings.mpLook; const a2 = { ...after, settings: { ...after.settings } }; delete a2.settings.mpLook;
  ok("cambiar el modo solo toca ese ajuste", after.settings.mpLook === "dark" && JSON.stringify(a2.inbox, noFiled) === JSON.stringify(b.inbox, noFiled) && JSON.stringify(a2.spending) === JSON.stringify(b.spending));
  await page.click('[data-act=hz-skin][data-v="design"]'); await page.waitForTimeout(200);
  ok("los temas anteriores siguen ahí", (await page.evaluate(() => [document.documentElement.dataset.skin, document.documentElement.dataset.look ?? null].join())) === "design,");
  await ctx.close();
}

// 5. Flujo A: idea suelta → el panel del proyecto la propone con el motivo; aceptar la enlaza sin duplicar.
{
  const v = seed(); v.inbox.push({ id: "i9", status: "IDEA", text: "Logo nuevo para Alfa", at: iso("2026-11-19", 12) });
  const { ctx, page, errors } = await open({ v, tab: "proyectos", shell: { ctx: true } });
  await page.click('#sideSub [data-id="p1"]'); await page.waitForTimeout(250);
  const t = (await ctxText(page)) ?? "";
  ok("flujo A: propone la idea con el motivo", /Te propongo/i.test(t) && /Logo nuevo para Alfa/.test(t) && /«alfa»/i.test(t) && /suposición/i.test(t), t);
  const before = (await page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")))).inbox.length;
  await page.click('#ctxPanel [data-act=rel-ok]'); await page.waitForTimeout(300);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
  ok("flujo A: la idea queda enlazada al proyecto", after.inbox.find((i) => i.id === "i9")?.filed === "p1");
  ok("flujo A: no duplica la idea", after.inbox.length === before);
  ok("flujo A: el proyecto la recibe como fuente", after.projects.find((p) => p.id === "p1").sources.some((x) => /Logo nuevo/.test(x.text ?? "")));
  ok("flujo A: la propuesta desaparece", !/Logo nuevo para Alfa/.test(((await ctxText(page)) ?? "").split("Te propongo")[1] ?? ""));
  ok("flujo A: sin errores de JS", !errors.length, errors.join(" | "));
  await ctx.close();
}

console.log(`escritorio: ${passes} ok, ${fails} fallos`);
await browser.close();
process.exit(fails ? 1 : 0);
