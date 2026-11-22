// WEB-119: tema «mp.» en la app real (Chromium con emulación de iPhone 14; NO es Safari real).
// Run: python3 -m http.server 8765 --directory web  &  node e2e/mp.e2e.mjs [carpeta-capturas]
// Datos inventados. Ninguna llamada sale de la máquina: los servicios externos se interceptan.
// Comprueba: instalación nueva → mp.; instalación anterior → conserva su tema y se le ofrece mp.;
// cambiar de tema no toca los datos; contraste AA del texto en las seis pantallas y en subpantallas;
// sin desbordes en 320/390/768; texto grande; movimiento reducido.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
const B = process.env.MANU_URL ?? "http://localhost:8765/";
let fails = 0, passes = 0;
const ok = (l, v, extra = "") => { if (v) passes++; else { fails++; console.log("FAIL", l, extra); } };
const browser = await chromium.launch();
const iso = (d, h, m = 0) => new Date(`${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+01:00`).toISOString();

function seed(settings = {}) {
  const spending = [];
  for (let d = 1; d <= 40; d++) { const day = new Date(Date.UTC(2026, 10, 20) - d * 864e5).toISOString().slice(0, 10); spending.push({ id: `g${d}`, at: iso(day, 9, 10), merchant: d % 5 ? "CAFE UNO" : "SUPER PRUEBA", category: d % 5 ? "FOOD_AND_DRINK" : "GROCERIES", cents: 180 + (d % 4) * 20, source: "MANUAL" }); }
  for (const m of ["2026-09-03", "2026-10-03", "2026-11-03"]) spending.push({ id: `s${m}`, at: iso(m, 8), merchant: "STREAMING PRUEBA", category: "SUBSCRIPTIONS", cents: 1299, source: "MANUAL" });
  return { schema: 1, settings, chat: [{ from: "manu", text: "Hola, Manu. ¿Qué apuntamos?" }, { from: "me", text: "gasté 3 en café" }],
    inbox: [{ id: "t1", status: "TASK", text: "Revisar presupuesto de prueba", done: false, at: iso("2026-11-19", 11) }, { id: "i1", status: "IDEA", text: "Idea de prueba para el blog", at: iso("2026-11-18", 11) }],
    income: [{ id: "n1", at: iso("2026-10-28", 8), merchant: "NOMINA PRUEBA", cents: 120000 }], spending,
    reminders: [{ id: "r1", text: "Llamar al taller (prueba)", at: iso("2026-11-20", 17), done: false }],
    agenda: { day: "2026-11-20", source: "PASTE", events: [{ time: "09:30", title: "Reunión de prueba" }, { time: "18:00", title: "Pádel (prueba)" }] },
    projects: [{ id: "p1", name: "Proyecto Alfa", emoji: "📁", createdAt: iso("2026-10-01", 10), sources: [{ id: "s1", kind: "note", title: "Nota", text: "Texto de prueba" }], chat: [] }],
    library: [{ id: "l1", kind: "book", title: "Libro de prueba", status: "pending", at: iso("2026-11-01", 10) }],
    people: [{ id: "pe1", name: "Persona Prueba", birthday: "03-14" }],
  };
}
async function open({ v = null, device = devices["iPhone 14"], tab = "hoy", deviceDefault = null, reduced = false, viewport = null } = {}) {
  const ctx = await browser.newContext({ ...device, ...(viewport ? { viewport } : {}), timezoneId: "Europe/Madrid", reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.clock.install({ time: new Date("2026-11-20T10:00:00+01:00") });
  await page.route(/^https:\/\/([^/]*\.)?(open-meteo\.com|supabase\.co|googleapis\.com|google\.com|spotify\.com|enablebanking\.com|tiktok\.com|youtube\.com)\//, (r) => r.fulfill({ status: 503, body: "" }));
  await page.addInitScript(([vv, t, dd]) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); sessionStorage.setItem("manuos.tab", t); localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); if (vv) localStorage.setItem("manuos.vault", JSON.stringify(vv)); if (dd) localStorage.setItem("manuos.skinDefault", dd); }, [v, tab, deviceDefault]);
  await page.goto(B); await page.waitForTimeout(600);
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch {} }));
  return { ctx, page, errors };
}
const noFiled = (k, v) => (k === "filed" ? undefined : v);
const skinNow = (page) => page.evaluate(() => document.documentElement.dataset.skin);
const vaultNow = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault") ?? "null"));
const goTab = async (page, t) => { await page.click(`.tab[data-tab="${t}"]`); await page.waitForTimeout(250); await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch {} })); };
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
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

// 1. Instalación nueva: mp. sin escribir nada en el vault.
{
  const { ctx, page, errors } = await open();
  ok("instalación nueva abre mp.", (await skinNow(page)) === "mp");
  ok("meta theme-color blanco", (await page.getAttribute('meta[name="theme-color"]', "content")) === "#FFFFFF");
  ok("Montserrat aplicada", /Montserrat/.test(await page.evaluate(() => getComputedStyle(document.body).fontFamily)));
  await page.evaluate(() => document.fonts.ready);
  ok("Montserrat cargada de verdad", await page.evaluate(() => document.fonts.check('600 16px "Montserrat"')));
  const v = await vaultNow(page);
  ok("el tema por defecto no se escribe en el vault", !v?.settings?.skin, JSON.stringify(v?.settings));
  ok("sin oferta en instalación nueva", (await page.locator(".mp-offer").count()) === 0);
  ok("sin errores", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 2. Instalación anterior sin elección: sigue en Claude Design y se le ofrece mp. una vez.
{
  const { ctx, page, errors } = await open({ v: seed() });
  ok("instalación anterior conserva su tema", (await skinNow(page)) === "design");
  ok("se ofrece mp.", (await page.locator(".mp-offer").count()) === 1);
  const before = await vaultNow(page);
  await page.click('.mp-offer [data-act="hz-skin"][data-v="mp"]'); await page.waitForTimeout(300);
  ok("al probarlo cambia a mp.", (await skinNow(page)) === "mp");
  const after = await vaultNow(page);
  const strip = (x) => { const c = structuredClone(x); delete c.settings.skin; return JSON.stringify(c); };
  // El primer guardado normaliza el vault (listas vacías por defecto): se comparan los datos, no la forma.
  const count = (x) => ["spending", "income", "inbox", "projects", "reminders", "library", "people", "chat"].map((k) => `${k}:${JSON.stringify(x[k])}`).join("|");
  const dk = ["spending", "income", "inbox", "projects", "reminders", "library", "people", "chat"].filter((k) => JSON.stringify(after[k], noFiled) !== JSON.stringify(before[k], noFiled)); // «filed» es la marca del archivado automático (WEB-60), no del tema
  ok("al probar mp. no se pierde ni cambia ningún dato", after.settings.skin === "mp" && !dk.length, dk.map((k) => `${k}: ${JSON.stringify(before[k]).slice(0, 150)} => ${JSON.stringify(after[k]).slice(0, 150)}`).join(" || "));
  ok("la oferta desaparece", (await page.locator(".mp-offer").count()) === 0);
  // Ida y vuelta por los cuatro temas: los datos siguen iguales.
  await goTab(page, "tu"); await page.click('[data-sub="apariencia"]'); await page.waitForTimeout(200);
  const base = await vaultNow(page);
  for (const s of ["clasico", "horizonte", "design", "mp"]) { await page.click(`[data-act="hz-skin"][data-v="${s}"]`); await page.waitForTimeout(200); ok(`tema ${s} aplicado`, (await skinNow(page)) === s); }
  ok("tras cuatro cambios el vault es idéntico salvo el tema", strip(await vaultNow(page)) === strip(base));
  await page.reload(); await page.waitForTimeout(500);
  ok("la elección sobrevive a recargar", (await skinNow(page)) === "mp");
  ok("sin errores", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
// 2b. «Ahora no» se recuerda y no cambia el tema.
{
  const { ctx, page } = await open({ v: seed() });
  await page.click('[data-act="hz-mp-no"]'); await page.waitForTimeout(200);
  ok("«Ahora no» mantiene Claude Design", (await skinNow(page)) === "design");
  await page.reload(); await page.waitForTimeout(400);
  ok("«Ahora no» no vuelve a salir", (await page.locator(".mp-offer").count()) === 0);
  await ctx.close();
}
// 2c. Una elección explícita gana al predeterminado del dispositivo.
for (const s of ["clasico", "horizonte", "design"]) {
  const { ctx, page } = await open({ v: seed({ skin: s }), deviceDefault: "mp" });
  ok(`elección guardada ${s} respetada`, (await skinNow(page)) === s);
  await ctx.close();
}

// 3. Las seis pantallas y subpantallas en mp.: contraste, desbordes y capturas.
{
  const { ctx, page, errors } = await open({ v: seed({ skin: "mp" }) });
  for (const t of ["hoy", "agenda", "manu", "dinero", "proyectos", "tu"]) {
    await goTab(page, t);
    const bad = await contrast(page);
    ok(`contraste AA en ${t}`, bad.length === 0, bad.slice(0, 6).join(" ; "));
    ok(`sin desborde en ${t}`, !(await overflow(page)));
    await shot(page, `mp-${t}`);
  }
  await goTab(page, "proyectos"); await page.click('[data-act="proj-open"]'); await page.waitForTimeout(250);
  ok("contraste en el detalle de proyecto", (await contrast(page)).length === 0, (await contrast(page)).slice(0, 4).join(" ; "));
  await shot(page, "mp-proyecto");
  for (const s of ["memoria", "biblioteca", "permisos", "apariencia", "repaso", "rutinas", "cerebro", "datos"]) {
    await goTab(page, "tu"); const b = page.locator(`[data-sub="${s}"]`).first();
    if (!(await b.count())) { ok(`existe Tú → ${s}`, false); continue; }
    await b.click(); await page.waitForTimeout(250);
    const bad = await contrast(page);
    ok(`contraste AA en Tú → ${s}`, bad.length === 0, bad.slice(0, 5).join(" ; "));
    ok(`sin desborde en Tú → ${s}`, !(await overflow(page)));
    if (["memoria", "biblioteca", "permisos"].includes(s)) await shot(page, `mp-tu-${s}`);
  }
  // La hoja de captura rápida y la barra de comandos.
  await goTab(page, "hoy");
  if (await page.locator('[data-act="cmdk"]').count()) { await page.click('[data-act="cmdk"]'); await page.waitForTimeout(250); const bad = await contrast(page); ok("contraste en la barra de comandos", bad.length === 0, bad.slice(0, 4).join(" ; ")); await page.keyboard.press("Escape"); }
  ok("la barra inferior tiene seis destinos", (await page.locator(".tab").count()) === 6);
  const tabH = await page.evaluate(() => [...document.querySelectorAll(".tab")].map((t) => t.getBoundingClientRect().height));
  ok("destinos de la barra ≥ 44 px", tabH.every((h) => h >= 44), tabH.join(","));
  ok("sin errores en las pantallas", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 4. Anchos 320 / 768 y texto grande (zoom de texto al 130 %).
for (const w of [320, 768]) {
  const { ctx, page } = await open({ v: seed({ skin: "mp" }), viewport: { width: w, height: 800 } });
  for (const t of ["hoy", "agenda", "manu", "dinero", "proyectos", "tu"]) { await goTab(page, t); ok(`sin desborde a ${w}px en ${t}`, !(await overflow(page))); }
  await ctx.close();
}
{
  const { ctx, page } = await open({ v: seed({ skin: "mp" }) });
  await page.addStyleTag({ content: "html{font-size:130%} body{font-size:22px}" }).catch(() => {});
  for (const t of ["hoy", "dinero", "tu"]) { await goTab(page, t); ok(`texto grande sin desborde en ${t}`, !(await overflow(page))); }
  await ctx.close();
}
// 5. Movimiento reducido: ninguna animación infinita en marcha.
{
  const { ctx, page } = await open({ v: seed({ skin: "mp" }), reduced: true });
  const inf = await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming?.().iterations === Infinity && a.playState === "running").length);
  ok("movimiento reducido: sin animaciones infinitas", inf === 0, String(inf));
  await ctx.close();
}

await browser.close();
console.log(`mp.e2e: ${passes} ok, ${fails} fallos`);
process.exit(fails ? 1 : 0);
