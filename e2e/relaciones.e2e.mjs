// WEB-120: capturar una vez y relacionar, y Momentos (Chromium emulando iPhone 14; NO es Safari real).
// Run: python3 -m http.server 8765 --directory web  &  node e2e/relaciones.e2e.mjs [carpeta-capturas]
// Datos inventados. Ninguna llamada sale de la máquina.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
const B = process.env.MANU_URL ?? "http://localhost:8765/";
let fails = 0, passes = 0;
const ok = (l, v, extra = "") => { if (v) passes++; else { fails++; console.log("FAIL", l, extra); } };
const browser = await chromium.launch();
const iso = (d, h) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00+01:00`).toISOString();
const seed = () => ({ schema: 1, settings: { skin: "mp" }, chat: [], spending: [], income: [], reminders: [],
  inbox: [{ id: "i1", status: "IDEA", text: "Montar un podcast de marketing", at: iso("2026-11-01", 10) }],
  docs: [{ id: "d1", title: "Seguro de prueba", kind: "seguro", expires: "2026-12-12", at: iso("2026-01-01", 10) }],
  people: [{ id: "pe1", name: "Persona Prueba" }], projects: [], library: [] });
async function open(v, at = "2026-11-20T17:00:00+01:00") {
  const ctx = await browser.newContext({ ...devices["iPhone 14"], timezoneId: "Europe/Madrid" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());
  await page.clock.install({ time: new Date(at) });
  await page.route(/^https:\/\/([^/]*\.)?(open-meteo\.com|supabase\.co|googleapis\.com|google\.com|spotify\.com|enablebanking\.com|tiktok\.com|youtube\.com)\//, (r) => r.fulfill({ status: 503, body: "" }));
  await page.addInitScript((vv) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); localStorage.setItem("manuos.vault", JSON.stringify(vv)); }, v);
  await page.goto(B); await page.waitForTimeout(500);
  return { ctx, page, errors };
}
const V = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
const settle = (page) => page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch {} }));
const goTab = async (page, t) => { await page.click(`.tab[data-tab="${t}"]`); await page.waitForTimeout(200); await settle(page); };
const say = async (page, text) => { await goTab(page, "manu"); await page.fill("#msg", text); await page.click("#composer button[type=submit]"); await page.waitForTimeout(300); };
const shot = async (page, name) => { if (out) { await page.waitForTimeout(250); await page.screenshot({ path: `${out}/${name}.png` }); } };

{
  const { ctx, page, errors } = await open(seed());
  // 1. La misma idea otra vez desde el chat → se junta, no se duplica.
  await say(page, "apunta idea: podcast de marketing, montarlo");
  let v = await V(page);
  ok("la idea repetida no crea otro registro", v.inbox.filter((i) => /podcast/i.test(i.text)).length === 1, JSON.stringify(v.inbox.map((i) => i.text)));
  ok("se apunta la repetición con fecha", v.inbox.find((i) => i.id === "i1").repeats?.length === 1);
  ok("el texto nuevo se conserva como nota", /montarlo/.test(v.inbox.find((i) => i.id === "i1").notes?.[0] ?? ""));
  ok("MANU dice que la ha juntado", /Ya la tenías/.test(await page.locator(".bubble.manu").last().innerText()));
  await goTab(page, "agenda");
  ok("Agenda enseña ×2", /×2/.test(await page.locator("body").innerText()));
  // 2. Una idea nueva con fecha → Hoy propone pasarla a Agenda (sin crearla sola).
  await say(page, "apunta idea: cena con el equipo el 3 de diciembre a las 21:00");
  v = await V(page);
  ok("la idea con fecha no crea un recordatorio sola", v.reminders.length === 0);
  await goTab(page, "hoy");
  const card = page.locator(".rel-card");
  ok("Hoy enseña Conexiones", (await card.count()) === 1);
  const txt = (await card.innerText()).toLowerCase();
  ok("propone la fecha como suposición", /jueves 3 de diciembre a las 21:00/.test(txt) && /suposici/.test(txt), txt);
  ok("propone el recordatorio del seguro que vence", /seguro de prueba/.test(txt));
  await shot(page, "relaciones-hoy");
  await card.locator('[data-act="rel-ok"]').first().click(); await page.waitForTimeout(250);
  v = await V(page);
  const r = v.reminders[0];
  ok("al aceptar se crea el recordatorio con su fuente", r && /cena con el equipo/.test(r.text) && r.from?.list === "inbox" && r.at === "2026-12-03T20:00:00.000Z" /* 21:00 en Madrid */, JSON.stringify(r));
  ok("no se vuelve a proponer", !/cena con el equipo/i.test((await page.locator(".rel-card").innerText().catch(() => "")).toLowerCase()));
  // 3. «No, gracias» se recuerda.
  await page.locator('.rel-card [data-act="rel-no"]').first().click(); await page.waitForTimeout(200);
  v = await V(page);
  ok("lo descartado queda apuntado", v.settings.relDismissed?.includes("doc:d1"), JSON.stringify(v.settings.relDismissed));
  await page.reload(); await page.waitForTimeout(400);
  ok("lo descartado no vuelve tras recargar", !/seguro de prueba/i.test(await page.locator(".rel-card").innerText().catch(() => "")));
  // 4. Tres veces la misma idea → propone proyecto; al aceptar, la idea va dentro.
  await say(page, "apunta idea: montar podcast marketing");
  await goTab(page, "hoy");
  const pj = page.locator('.rel-card [data-act="rel-ok"]', { hasText: "Crear proyecto" });
  ok("tras tres veces propone un proyecto", (await pj.count()) === 1);
  await pj.click(); await page.waitForTimeout(400);
  v = await V(page);
  const p = v.projects.at(-1);
  ok("proyecto creado con la idea como fuente", p && p.sources.some((s) => /podcast/i.test(s.text)), JSON.stringify(p?.sources));
  ok("la idea queda archivada en el proyecto", v.inbox.find((i) => i.id === "i1").filed === p?.id);
  ok("sin errores", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
// 4b. En horario de trabajo, Conexiones (cosas personales) no sale.
{
  const v = seed(); v.inbox.push({ id: "i9", status: "IDEA", text: "Cena el 3 de diciembre a las 21:00", at: iso("2026-11-19", 10) });
  const { ctx, page } = await open(v, "2026-11-20T10:00:00+01:00");
  ok("en horario de trabajo no se enseñan conexiones personales", (await page.locator(".rel-card").count()) === 0);
  await ctx.close();
}

// 5. Guardar en MANU el mismo enlace dos veces → un solo registro.
{
  const { ctx, page, errors } = await open(seed());
  await goTab(page, "tu"); await page.click('[data-sub="biblioteca"]'); await page.waitForTimeout(200);
  for (let n = 0; n < 2; n++) {
    await page.fill("#saveText", "https://www.ejemplo.com/receta-de-pan-casero"); await page.click('#saveForm button[type="submit"]'); await page.waitForTimeout(200);
    await page.click('#saveConfirm button[type="submit"]'); await page.waitForTimeout(250);
  }
  const v = await V(page);
  ok("el mismo enlace no se guarda dos veces", v.library.length === 1 && v.library[0].repeats?.length === 1, JSON.stringify(v.library.map((x) => [x.title, x.repeats])));
  ok("sin errores (biblioteca)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 6. Momentos: frase, persona y foto; búsqueda; no suben a Tu nube; borrar.
{
  const { ctx, page, errors } = await open(seed());
  await goTab(page, "tu"); await page.click('[data-sub="momentos"]'); await page.waitForTimeout(200);
  await page.fill("#momentText", "Café al sol antes del trabajo");
  await page.fill("#momentPlace", "Puerto");
  await page.click('[data-act="moment-person"][data-id="pe1"]'); await page.waitForTimeout(150);
  ok("la frase se conserva al elegir persona", (await page.inputValue("#momentText")) === "Café al sol antes del trabajo");
  // Una imagen PNG mínima (1×1) generada aquí.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await page.setInputFiles("#momentImage", { name: "foto.png", mimeType: "image/png", buffer: png }); await page.waitForTimeout(400);
  ok("vista previa de la foto", (await page.locator(".moment-preview").count()) === 1);
  await page.click('#momentForm button[type="submit"]'); await page.waitForTimeout(400);
  let v = await V(page);
  const m = v.moments?.[0];
  ok("momento guardado con persona, lugar y foto", m && m.people[0] === "pe1" && m.place === "Puerto" && m.imageId && m.day === "2026-11-20", JSON.stringify(m));
  ok("la foto no está en el vault (solo su id)", !JSON.stringify(v).includes("data:image"));
  ok("la foto está en el dispositivo", await page.evaluate((id) => new Promise((res) => { const r = indexedDB.open("manuos-images"); r.onsuccess = () => { const db = r.result; const st = db.transaction(db.objectStoreNames[0]).objectStore(db.objectStoreNames[0]).get(id); st.onsuccess = () => res(Boolean(st.result)); st.onerror = () => res(false); }; r.onerror = () => res(false); }), m?.imageId));
  const listTxt = await page.locator("body").innerText();
  ok("se ve en la lista con la persona", /Con Persona Prueba/.test(listTxt));
  await shot(page, "momentos");
  await goTab(page, "tu"); await page.fill("#findQ", "café sol"); await page.click('#findForm button[type="submit"]'); await page.waitForTimeout(250);
  ok("Buscar en todo encuentra el momento", /Momento/.test(await page.locator(".find").innerText()));
  await page.click('[data-sub="momentos"]'); await page.waitForTimeout(200);
  await page.click('[data-act="moment-del"]'); await page.waitForTimeout(250);
  v = await V(page);
  ok("borrar quita el momento", (v.moments ?? []).length === 0);
  ok("sin errores (momentos)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(`relaciones.e2e: ${passes} ok, ${fails} fallos`);
process.exit(fails ? 1 : 0);
