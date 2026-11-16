// Misión «asistente real» (WEB-112) en la app real: Hoy como centro de control, triaje del correo,
// «Guardar en MANU» y búsqueda, agenda, MANU con fuentes, anchos de iPhone, tema y estado vacío.
// Chromium con emulación de iPhone: NO es Safari real. Datos ficticios; la red externa se corta.
// Run: python3 -m http.server 8765 --directory web  &  node e2e/asistente.e2e.mjs [carpeta-capturas]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
const B = process.env.MANU_URL ?? "http://localhost:8765/";
let fails = 0, passes = 0;
const ok = (l, v) => { if (v) passes++; else { fails++; console.log("FAIL", l); } };
const NOW = new Date("2026-11-16T10:00:00+01:00");
const t = (h, m = 0, d = 16) => new Date(`2026-11-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+01:00`).toISOString();
const ms = (h, d = 16) => Date.parse(t(h, 0, d));
const seed = () => ({ schema: 1, chat: [], inbox: [{ id: "t1", text: "Llamar al fontanero", status: "TASK", at: t(8, 0, 10) }],
  settings: { google: { gmail: true, calendar: true } },
  projects: [{ id: "pr1", name: "Reforma baño", emoji: "🛁", createdAt: t(9, 0, 1), sources: [], chat: [] }],
  reminders: [{ id: "r1", text: "Pagar el IBI", at: t(9), done: false, notified: true }],
  spending: [{ id: "cafe", at: t(9, 0, 2), cents: 1250, merchant: "CAFE UNO", category: "FOOD_AND_DRINK", source: "BANK" }, { id: "cajero", at: t(10, 0, 3), cents: 60000, merchant: "REINTEGRO CAJERO", category: "CASH", source: "BANK" }],
  income: [],
  agenda: { day: "2026-11-16", source: "GOOGLE", importedAt: t(9, 50), events: [{ id: "e1", title: "Dentista", time: "11:00", end: "11:30", calendar: "Personal", color: "#1a73e8" }, { id: "e2", title: "Vacaciones de invierno en la casa del pueblo con toda la familia", allDay: true, calendars: ["Personal", "Familia"], calendar: "Personal" }] },
  calendar: { from: "2026-10-01", to: "2026-12-31", syncedAt: t(9, 50), days: {} },
  library: [{ id: "l1", title: "Pan de masa madre", kind: "articulo", status: "quiero", url: "https://ejemplo.test/pan", topic: "Cocina", at: t(9, 0, 1) }],
  mail: { syncedAt: t(9, 55), total: 4, senders: [], important: [], chatgptExport: null, chatgptExportPending: null, triage: [
    { id: "m1", threadId: "a", from: { name: "Ana Prueba", email: "ana@ejemplo.test" }, subject: "¿Puedes revisar el presupuesto?", at: ms(8), labels: ["INBOX", "UNREAD"], unsub: null },
    { id: "m2", threadId: "b", from: { name: "Aseguradora Prueba", email: "no-reply@seguro.test" }, subject: "Tu póliza vence el 30", at: ms(7), labels: ["INBOX"], unsub: null },
    { id: "m3", threadId: "c", from: { name: "Tienda", email: "news@tienda.test" }, subject: "Ofertas de la semana", at: ms(6), labels: ["INBOX", "CATEGORY_PROMOTIONS"], unsub: true },
    { id: "m4", threadId: "d", from: { name: "Luis Prueba", email: "luis@ejemplo.test" }, subject: "¿Quedamos el jueves?", at: ms(5), labels: ["INBOX"], unsub: null },
    { id: "s1", threadId: "d", from: { name: "Yo", email: "yo@ejemplo.test" }, subject: "Re: ¿Quedamos el jueves?", at: ms(6), labels: ["SENT"], unsub: null },
  ] },
});
const browser = await chromium.launch();
async function open({ tab = "hoy", vault = seed(), url = B, opts = { ...devices["iPhone 14"] } } = {}) {
  const ctx = await browser.newContext({ timezoneId: "Europe/Madrid", ...opts });
  const page = await ctx.newPage(); const errors = [], external = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|Applying inline style violates/.test(m.text())) errors.push(m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.clock.install({ time: NOW });
  await page.route(/^https:\/\/([^/]*\.)?(open-meteo\.com|supabase\.co|googleapis\.com|google\.com|spotify\.com|enablebanking\.com|gstatic\.com)\//, (r) => { external.push(r.request().url()); r.fulfill({ status: 503, body: "" }); });
  await page.addInitScript(([v, tb]) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); sessionStorage.setItem("manuos.tab", tb); localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); if (v) localStorage.setItem("manuos.vault", JSON.stringify(v)); }, [vault, tab]);
  await page.goto(url); await page.waitForTimeout(700);
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch {} }));
  return { ctx, page, errors, external };
}
const vaultOf = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
const shot = async (p, n) => { if (out) { await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${n}.png` }); } };
const sub = async (p, name) => { await p.evaluate((n) => { const b = document.createElement("button"); b.dataset.subGo = n; document.body.append(b); b.click(); b.remove(); }, name); await p.waitForTimeout(250); await p.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch {} })); };

// 1. Hoy: centro de control con niveles, fuentes y frescura; sin cifras rotas.
{
  const { ctx, page, errors } = await open();
  const ctl = page.locator(".ctl");
  ok("Hoy: hay centro de control", await ctl.isVisible());
  const txt = await ctl.innerText();
  ok("urgente: el dentista (en 1 h) y el recordatorio vencido", /Urgente[\s\S]*Dentista/i.test(txt) && /Urgente[\s\S]*Pagar el IBI/i.test(txt));
  ok("cada cosa dice su fuente", /Google Calendar · Personal/.test(txt) && /Recordatorios/.test(txt));
  ok("correo que pide algo, con su fuente", /presupuesto[\s\S]*Gmail/.test(txt));
  ok("el correo ya contestado no sale", !/Quedamos el jueves/.test(txt));
  ok("frescura: agenda y correo con su hora", /Agenda a las 09:50/.test(txt) && /Correo a las 09:55/.test(txt));
  ok("no promete actualizar con la app cerrada", /con la app cerrada no se actualiza nada/.test(txt));
  ok("dinero provisional pide revisar (600 € sin atribuir)", /movimientos sin atribuir/.test(txt));
  const hoy = await page.locator("#screen").innerText();
  ok("Hoy sin NaN ni undefined", !/NaN|undefined/.test(hoy));
  ok("sin la tarjeta duplicada «Este mes»", !/Este mes\s*Ver dinero/.test(hoy));
  ok("Hoy: sin errores", !errors.length);
  await shot(page, "01-hoy");
  await page.locator(".ctl-row", { hasText: "presupuesto" }).click(); await page.waitForTimeout(250);
  ok("tocar un correo abre Correo", /Para ti/i.test(await page.locator("#screen").innerText()));
  await ctx.close();
}

// 2. Correo: triaje, motivos, revisado, tarea con confirmación y corrección por remitente.
{
  const { ctx, page, errors, external } = await open({ tab: "tu" });
  await sub(page, "correo");
  const para = await page.locator(".mail-list").first().innerText();
  ok("Para ti: responder y vencimiento", /Ana Prueba/.test(para) && /Aseguradora Prueba/.test(para));
  ok("Para ti: sin publicidad ni lo ya contestado", !/Ofertas/.test(para) && !/Quedamos/.test(para));
  await page.click('[data-act="mail-open"][data-id="m1"]');
  const why = await page.locator(".mail-why").innerText();
  ok("explica por qué y que es una suposición", /Por qué lo creo/.test(why) && /no he leído el correo/.test(why));
  ok("abre el original en Gmail", (await page.locator('.mail-acts a').getAttribute("href")).startsWith("https://mail.google.com/"));
  await shot(page, "02-correo");
  await page.click('[data-act="mail-mode"][data-m="task"]');
  ok("la tarea no se crea hasta confirmar", !(await vaultOf(page)).inbox.some((i) => /Ana Prueba/.test(i.text)));
  await page.click('#mailTaskForm button[type="submit"]'); await page.waitForTimeout(200);
  let v = await vaultOf(page);
  ok("tarea creada con enlace al correo", v.inbox.some((i) => i.status === "TASK" && /Responder a Ana Prueba/.test(i.text) && i.link?.includes("mail.google.com")));
  ok("y el correo queda revisado (solo en MANU)", Boolean(v.mailTriage.reviewed.m1));
  await page.click('[data-act="mail-open"][data-id="m2"]'); await page.click('[data-act="mail-mode"][data-m="fix"]');
  await page.selectOption("#mailFixKind", "BULK"); await page.check("#mailFixSender"); await page.click('#mailFixForm button[type="submit"]'); await page.waitForTimeout(200);
  v = await vaultOf(page);
  ok("corrección por remitente recordada", v.mailTriage.senders["no-reply@seguro.test"] === "BULK");
  ok("ya no está en Para ti", !/Aseguradora/.test(await page.locator(".mail-list").first().innerText()));
  ok("nada se ha mandado a Gmail ni a una IA", !external.some((u) => /gmail|generativelanguage/.test(u)));
  ok("Correo: sin errores", !errors.length);
  await ctx.close();
}

// 3. Guardar en MANU: desde ?guardar= (Atajo), con propuesta revisable; archivo local; búsqueda.
{
  const { ctx, page, errors } = await open({ tab: "tu", url: `${B}?guardar=${encodeURIComponent("https://www.youtube.com/watch?v=abcDEF12345")}` });
  const card = await page.locator(".save-card").innerText();
  ok("?guardar= abre la propuesta, sin guardar aún", /¿Lo guardo así\?/i.test(card) && (await vaultOf(page)).library.length === 1);
  ok("pide revisar el título (no abre la página)", /Revísalo/.test(card));
  await page.fill("#svTitle", "Truco para dormir mejor"); await page.selectOption("#svProject", "pr1");
  await page.click('#saveConfirm button[type="submit"]'); await page.waitForTimeout(250);
  let v = await vaultOf(page);
  const it = v.library.find((x) => x.title === "Truco para dormir mejor");
  ok("guardado con proyecto y sin «por revisar» al cambiar el título", it && it.project === "pr1" && !it.needsReview && it.kind === "video");
  ok("y como fuente del proyecto", v.projects[0].sources.some((s) => /Truco para dormir/.test(s.title) && s.url));
  await page.setInputFiles("#saveFile", { name: "contrato-alquiler-2026.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 ficticio") });
  await page.waitForTimeout(300);
  ok("archivo: propone título por el nombre", (await page.inputValue("#svTitle")) === "contrato alquiler 2026");
  await page.click('#saveConfirm button[type="submit"]'); await page.waitForTimeout(300);
  v = await vaultOf(page);
  const f = v.library.find((x) => x.fileName === "contrato-alquiler-2026.pdf");
  ok("archivo guardado en el dispositivo, fuera del vault", f?.fileId && !JSON.stringify(v).includes("ficticio") && !JSON.stringify(v).includes("data:application/pdf"));
  await page.fill("#libQ", "masa madre"); await page.press("#libQ", "Enter"); await page.waitForTimeout(200);
  ok("búsqueda: encuentra y dice dónde", /Pan de masa madre/.test(await page.locator(".find").innerText()) && /Biblioteca/.test(await page.locator(".find").innerText()));
  await page.fill("#libQ", "alquiler"); await page.press("#libQ", "Enter"); await page.waitForTimeout(200);
  ok("búsqueda: el archivo por su nombre", /contrato alquiler 2026/.test(await page.locator(".find").innerText()));
  await shot(page, "03-biblioteca");
  ok("Biblioteca: sin errores", !errors.length);
  await ctx.close();
}

// 4. MANU: respuestas locales con fuente; sin fuente lo dice.
{
  const { ctx, page, errors } = await open({ tab: "manu" });
  const ask = async (q) => { await page.fill("#msg", q); await page.press("#msg", "Enter"); await page.waitForTimeout(500); return page.locator("#chat .bubble").last().innerText(); };
  const a1 = await ask("¿qué correos tengo?");
  ok("MANU correo: lo que pide algo, con fuente y hora", /presupuesto/.test(a1) && /Fuente: tu Gmail, leído a las 09:55/.test(a1) && /sin leer los correos/.test(a1));
  const a2 = await ask("busca masa madre");
  ok("MANU busca en la biblioteca", /Pan de masa madre/.test(a2) || (await page.locator("#screen").innerText()).includes("Pan de masa madre"));
  ok("MANU: sin errores", !errors.length);
  await ctx.close();
}

// 5. Anchos de iPhone: sin desbordes, textos largos sin cortar, y la barra no tapa los formularios.
for (const w of [320, 375, 390, 430]) {
  const { ctx, page } = await open({ opts: { viewport: { width: w, height: 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } });
  const over = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  ok(`${w}px Hoy sin desbordar`, !(await over()));
  ok(`${w}px Hoy: filas del centro de control dentro de su tarjeta`, await page.evaluate(() => [...document.querySelectorAll(".ctl-row")].every((e) => e.getBoundingClientRect().right <= e.closest(".card").getBoundingClientRect().right + 1)));
  await page.click('[data-tab="agenda"]'); await page.waitForTimeout(250);
  ok(`${w}px Agenda sin desbordar`, !(await over()));
  ok(`${w}px Agenda: el evento largo no se corta (varias líneas)`, await page.evaluate(() => { const el = [...document.querySelectorAll(".row.event .grow > div:first-child")].find((d) => /Vacaciones de invierno/.test(d.textContent)); if (!el) return true; return el.scrollWidth <= el.clientWidth + 1; }));
  await sub(page, "correo"); await page.click('[data-act="mail-open"][data-id="m1"]');
  ok(`${w}px Correo abierto sin desbordar`, !(await over()));
  ok(`${w}px Correo: botones dentro de la tarjeta`, await page.evaluate(() => [...document.querySelectorAll(".mail-acts > *")].every((e) => e.getBoundingClientRect().right <= e.closest(".card").getBoundingClientRect().right + 1)));
  await sub(page, "biblioteca");
  ok(`${w}px Biblioteca sin desbordar`, !(await over()));
  await page.fill("#saveText", "Idea de prueba"); await page.click('#saveForm button[type="submit"]'); await page.waitForTimeout(200);
  ok(`${w}px ficha de guardar: nada se sale de la tarjeta`, await page.evaluate(() => { const c = document.querySelector("#saveConfirm").getBoundingClientRect(); return [...document.querySelectorAll("#saveConfirm input, #saveConfirm select, #saveConfirm textarea, #saveConfirm button")].every((e) => { const r = e.getBoundingClientRect(); return r.width === 0 || (r.right <= c.right + 1 && r.left >= c.left - 1); }); }));
  const btn = page.locator('#saveConfirm button[type="submit"]'); await btn.scrollIntoViewIfNeeded();
  const hidden = await page.evaluate(() => { const b = document.querySelector('#saveConfirm button[type="submit"]').getBoundingClientRect(); const bar = document.querySelector(".tabbar, nav.tabs, #tabs, nav"); if (!bar) return false; const r = bar.getBoundingClientRect(); return r.height > 0 && b.bottom > r.top && b.top < r.bottom; });
  ok(`${w}px la barra inferior no tapa «Guardar»`, !hidden);
  if (w === 320) await shot(page, "05-320-guardar");
  await ctx.close();
}

// 6. Tema: la elección persiste al recargar; y estado vacío sin errores.
{
  const v = { ...seed(), settings: { ...seed().settings, skin: "clasico" } };
  const { ctx, page } = await open({ vault: v });
  await page.reload(); await page.waitForTimeout(500);
  ok("tema clásico persiste tras recargar", (await vaultOf(page)).settings.skin === "clasico");
  await ctx.close();
  const e = await open({ vault: null });
  const txt = await e.page.locator("#screen").innerText();
  ok("vacío: Hoy dice que no hay nada, sin inventar", /Nada urgente ni pendiente/.test(txt) && !/NaN|undefined/.test(txt));
  ok("vacío: sin errores", !e.errors.length);
  await e.ctx.close();
}
await browser.close();
console.log(`asistente.e2e: ${passes} correctas, ${fails} fallos`);
process.exit(fails ? 1 : 0);
