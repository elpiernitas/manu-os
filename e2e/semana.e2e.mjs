// WEB-121: la semana, el tiempo reservado, preparar la semana y aficiones (Chromium emulando iPhone 14; NO Safari real).
// Run: python3 -m http.server 8765 --directory web  &  node e2e/semana.e2e.mjs [carpeta-capturas]
// Datos inventados. Ninguna llamada sale de la máquina.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
const B = process.env.MANU_URL ?? "http://localhost:8765/";
let fails = 0, passes = 0;
const ok = (l, v, extra = "") => { if (v) passes++; else { fails++; console.log("FAIL", l, extra); } };
const browser = await chromium.launch();
const iso = (d, h, m = 0) => new Date(`${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+01:00`).toISOString();
const seed = (extra = {}) => ({ schema: 1, settings: { skin: "mp", ...(extra.settings ?? {}) }, chat: [], spending: [], income: [],
  reminders: [{ id: "r1", text: "Llamar al taller (prueba)", at: iso("2026-11-21", 10), done: false }],
  inbox: [{ id: "t1", status: "TASK", text: "Tarea vieja de prueba", at: iso("2026-11-01", 10) }, { id: "i1", status: "IDEA", text: "Comida familiar el domingo a las 14:00", at: iso("2026-11-19", 10) }],
  calendar: { days: { "2026-11-23": [{ time: "18:30", end: "19:30", title: "Cena de prueba" }] } },
  docs: [{ id: "d1", title: "Seguro de prueba", kind: "seguro", expires: "2026-12-10", at: iso("2026-01-01", 10) }],
  library: [{ id: "l1", kind: "libro", title: "Manual de fotografía", status: "quiero", at: iso("2026-11-01", 10) }, { id: "l2", kind: "articulo", title: "Artículo", status: "quiero", at: iso("2026-11-01", 10) }],
  projects: [], people: [], ...extra.v });
async function open(v, at = "2026-11-20T17:00:00+01:00") {
  const ctx = await browser.newContext({ ...devices["iPhone 14"], timezoneId: "Europe/Madrid" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());
  await page.clock.install({ time: new Date(at) });
  await page.route(/^https:\/\/([^/]*\.)?(open-meteo\.com|supabase\.co|googleapis\.com|google\.com|spotify\.com|enablebanking\.com)\//, (r) => r.fulfill({ status: 503, body: "" }));
  await page.addInitScript((vv) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); localStorage.setItem("manuos.vault", JSON.stringify(vv)); }, v);
  await page.goto(B); await page.waitForTimeout(500);
  return { ctx, page, errors };
}
const V = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
const goTab = async (page, t) => { await page.click(`.tab[data-tab="${t}"]`); await page.waitForTimeout(200); await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch {} })); };
const shot = async (page, name) => { if (out) { await page.waitForTimeout(250); await page.screenshot({ path: `${out}/${name}.png`, fullPage: false }); } };

{
  const { ctx, page, errors } = await open(seed());
  await goTab(page, "agenda");
  const card = page.locator(".week-card");
  ok("Agenda enseña Tu semana", (await card.count()) === 1);
  await page.click('[data-act="wk-toggle"]'); await page.waitForTimeout(150);
  const txt = await card.innerText();
  ok("recordatorio etiquetado", /Recordatorio\s*10:00\s*Llamar al taller/i.test(txt), txt.slice(0, 400));
  ok("lo supuesto va como propuesta", /Propuesta[\s\S]*Comida familiar[\s\S]*suposición/i.test(txt));
  ok("evento de calendario etiquetado", /Evento\s*18:30–19:30\s*Cena de prueba/i.test(txt));
  // Reservar el lunes de 18 a 21 → conflicto con la cena.
  await page.click('[data-act="wk-reserve-open"]'); await page.waitForTimeout(150);
  await page.selectOption("#rsDay", "d:2026-11-23"); await page.fill("#rsFrom", "18:00"); await page.fill("#rsTo", "21:00"); await page.fill("#rsLabel", "Nada");
  await page.click('#reserveForm button[type="submit"]'); await page.waitForTimeout(250);
  let v = await V(page);
  ok("rato reservado guardado", v.settings.reserved?.[0]?.day === "2026-11-23" && v.settings.reserved[0].from === "18:00");
  const t2 = await page.locator(".week-card").innerText();
  ok("avisa del choque y deja decidir", /choca con tu rato reservado[\s\S]*Tú decides/i.test(t2), t2.slice(0, 300));
  ok("el rato reservado aparece como tal", /Reservado\s*18:00–21:00\s*Nada/i.test(t2));
  await page.locator('[data-act="wk-decline"]').first().click(); await page.waitForTimeout(150);
  ok("prepara una respuesta para copiar, sin enviarla", /esta vez no puedo/i.test(await page.inputValue("#wkDeclineText")) && /MANU no la envía/.test(await page.locator(".week-card").innerText()));
  await shot(page, "semana-agenda");
  ok("MANU no ha creado ni enviado nada", (await V(page)).reminders.length === 1);
  // Preparar la semana (rápido y completo) en Repaso.
  await goTab(page, "tu"); await page.click('[data-sub="repaso"]'); await page.waitForTimeout(150);
  await page.click('[data-act="wk-prep"][data-v="rapido"]'); await page.waitForTimeout(150);
  const prep = await page.locator(".prep-card").innerText();
  ok("preparar rápido reúne citas, tareas, documentos, pagos y tiempo", /rápido \(10 min\)/i.test(prep) && /Citas y compromisos/i.test(prep) && /Tarea vieja/.test(prep) && /Seguro de prueba/.test(prep) && /tiempo reservado/i.test(prep), prep.slice(0, 500));
  ok("cada bloque dice de dónde sale", /De: Agenda y recordatorios/.test(prep));
  await page.click('.prep-card [data-act="wk-prep"][data-v="completo"]'); await page.waitForTimeout(150);
  ok("completo añade ideas y proyectos", /Ideas aparcadas/i.test(await page.locator(".prep-card").innerText()));
  await shot(page, "semana-preparar");
  await page.click('[data-act="wk-prep-done"]'); await page.waitForTimeout(150);
  ok("listo se apunta", Boolean((await V(page)).settings.weekPrepared));
  // Aficiones y aprender.
  await goTab(page, "tu"); await page.click('[data-sub="aficiones"]'); await page.waitForTimeout(150);
  await page.fill("#intName", "Fotografía analógica"); await page.click('#intForm button[type="submit"]'); await page.waitForTimeout(200);
  v = await V(page);
  ok("afición guardada sin paso inventado", v.interests?.[0]?.name === "Fotografía analógica" && v.interests[0].step === undefined);
  ok("enlaza lo que ya hay en la Biblioteca", /En tu Biblioteca: Manual de fotografía/.test(await page.locator("body").innerText()));
  await page.fill('[data-int-step]', "Revelar un carrete"); await page.locator('[data-int-step]').dispatchEvent("change"); await page.waitForTimeout(150);
  ok("el paso lo escribe Manu", (await V(page)).interests[0].step === "Revelar un carrete");
  await page.click('[data-act="int-books"]'); await page.waitForTimeout(200);
  const lib = await page.locator("body").innerText();
  ok("Lectura abre los libros para leer en Biblioteca", /Manual de fotografía/.test(lib) && !/\bArtículo\b/.test(lib.split("para leer")[1] ?? ""), lib.slice(0, 200));
  await goTab(page, "tu"); await page.click('[data-sub="aficiones"]'); await page.waitForTimeout(150);
  await page.click('[data-act="int-reserve"]'); await page.waitForTimeout(250);
  ok("reservar un rato para la afición abre el formulario", (await page.locator("#reserveForm").count()) === 1 && (await page.inputValue("#rsLabel")) === "Fotografía analógica" && (await page.inputValue("#rsKind")) === "aficion");
  ok("sin errores", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
// Durante un rato reservado, Hoy no propone nada.
{
  const v = seed({ settings: { reserved: [{ id: "z", weekday: 5, from: "16:00", to: "19:00", kind: "descanso", label: "" }] } });
  const { ctx, page } = await open(v, "2026-11-20T17:00:00+01:00");
  ok("Hoy avisa de tu rato", /Descanso, sin planes hasta las 19:00/.test(await page.locator(".rest-card").innerText().catch(() => "")));
  ok("y no enseña conexiones", (await page.locator(".rel-card").count()) === 0);
  await ctx.close();
  const b = await open(v, "2026-11-20T19:30:00+01:00");
  ok("fuera del rato vuelven las conexiones", (await b.page.locator(".rel-card").count()) === 1 && (await b.page.locator(".rest-card").count()) === 0);
  await b.ctx.close();
}
await browser.close();
console.log(`semana.e2e: ${passes} ok, ${fails} fallos`);
process.exit(fails ? 1 : 0);
