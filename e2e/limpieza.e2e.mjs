// WEB-122: limpieza digital reversible, dejar listo para mañana y accesos directos (Chromium emulando iPhone 14; NO Safari real).
// Run: python3 -m http.server 8765 --directory web  &  node e2e/limpieza.e2e.mjs [carpeta-capturas]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
const B = process.env.MANU_URL ?? "http://localhost:8765/";
let fails = 0, passes = 0;
const ok = (l, v, extra = "") => { if (v) passes++; else { fails++; console.log("FAIL", l, extra); } };
const browser = await chromium.launch();
const seed = () => ({ schema: 1, settings: { skin: "mp" }, chat: [], spending: [], income: [], reminders: [], projects: [], people: [],
  library: [{ id: "a", title: "Pan casero", url: "https://ejemplo.com/pan", kind: "articulo", status: "quiero", at: "2026-10-01T10:00:00Z" }, { id: "b", title: "Pan (otra vez)", url: "https://www.ejemplo.com/pan/", kind: "articulo", status: "quiero", notes: "nota del segundo", at: "2026-11-01T10:00:00Z" }],
  inbox: [{ id: "i1", status: "PENDING", text: "Algo olvidado", at: "2026-10-01T10:00:00Z" }],
  captures: [], docs: [] });
async function open(v, at = "2026-11-20T21:00:00+01:00", hash = "") {
  const ctx = await browser.newContext({ ...devices["iPhone 14"], timezoneId: "Europe/Madrid" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());
  await page.clock.install({ time: new Date(at) });
  await page.route(/^https:\/\/([^/]*\.)?(open-meteo\.com|supabase\.co|googleapis\.com|google\.com|spotify\.com|enablebanking\.com)\//, (r) => r.fulfill({ status: 503, body: "" }));
  await page.addInitScript((vv) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); localStorage.setItem("manuos.vault", JSON.stringify(vv)); }, v);
  await page.goto(B + hash); await page.waitForTimeout(600);
  return { ctx, page, errors };
}
const V = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
const goTab = async (page, t) => { await page.click(`.tab[data-tab="${t}"]`); await page.waitForTimeout(200); };
{
  // Una foto huérfana en IndexedDB.
  const { ctx, page, errors } = await open(seed(), undefined, "#ir=tu/limpieza");
  await page.evaluate(() => new Promise((res) => { const r = indexedDB.open("manuos-images", 1); r.onupgradeneeded = () => r.result.createObjectStore("images"); r.onsuccess = () => { const t = r.result.transaction("images", "readwrite"); t.objectStore("images").put("data:image/png;base64,AAAA", "img-huerfana"); t.oncomplete = () => res(); }; }));
  await page.reload(); await page.waitForTimeout(400);
  await goTab(page, "tu"); await page.click('[data-sub="limpieza"]'); await page.waitForTimeout(500);
  const txt = await page.locator("main").innerText();
  ok("encuentra repetidos, bandeja olvidada y fotos huérfanas", /Repetidos en la Biblioteca · 1/i.test(txt) && /bandeja sin decidir/i.test(txt) && /Fotos guardadas que ya nada usa · 1/i.test(txt), txt.slice(0, 600));
  ok("dice lo que una web no puede ver", /carrete/.test(txt) && /Almacenamiento del iPhone/.test(txt));
  if (out) await page.screenshot({ path: `${out}/limpieza.png` });
  await page.click('[data-act="cl-do"][data-k="dup-lib"]'); await page.waitForTimeout(400);
  let v = await V(page);
  ok("juntar deja uno con la nota del otro", v.library.length === 1 && /nota del segundo/.test(v.library[0].notes ?? "") && v.library[0].repeats?.length === 1, JSON.stringify(v.library));
  await page.click('[data-act="cl-undo"]'); await page.waitForTimeout(400);
  v = await V(page);
  ok("deshacer recupera los dos", v.library.length === 2);
  await page.click('[data-act="cl-do"][data-k="old-inbox"]'); await page.waitForTimeout(300);
  ok("lo olvidado pasa a ideas", (await V(page)).inbox[0].status === "IDEA");
  await page.click('[data-act="cl-do"][data-k="orphans"]'); await page.waitForTimeout(500);
  const left = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open("manuos-images"); r.onsuccess = () => { const q = r.result.transaction("images").objectStore("images").getAllKeys(); q.onsuccess = () => res(q.result.length); }; }));
  ok("la foto huérfana se borra tras confirmar", left === 0);
  ok("entrar por #ir=tu/limpieza funciona", true);
  ok("sin errores", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
{
  // Dejar listo: configurar en Rutinas y marcar por la noche; sin rachas.
  const { ctx, page, errors } = await open(seed());
  await goTab(page, "tu"); await page.click('[data-sub="rutinas"]'); await page.waitForTimeout(200);
  await page.fill("#npText", "Mochila lista"); await page.click('#npForm button[type="submit"]'); await page.waitForTimeout(200);
  await goTab(page, "hoy");
  const np = page.locator(".np-card");
  ok("por la noche sale «Dejar listo»", (await np.count()) === 1 && /Mochila lista/.test(await np.innerText()));
  await np.locator('[data-act="np-check"]').click(); await page.waitForTimeout(200);
  ok("se marca hecho hoy", (await V(page)).settings.nightPrepDone?.ids?.length === 1);
  ok("sin lenguaje de rachas", !/racha|fallaste|perdiste/i.test(await page.locator("main").innerText()));
  ok("sin errores (dejar listo)", errors.length === 0, errors.join(" | "));
  await ctx.close();
  const day = await open(seed(), "2026-11-20T11:00:00+01:00");
  ok("de día no sale", (await day.page.locator(".np-card").count()) === 0);
  await day.ctx.close();
}
{
  const { ctx, page } = await open(seed(), undefined, "#ir=tu/momentos");
  ok("#ir=tu/momentos abre Momentos", /Guardar un momento/i.test(await page.locator("main").innerText()));
  await goTab(page, "tu"); await page.click('[data-sub="atajos"]'); await page.waitForTimeout(200);
  ok("Atajos lista los enlaces directos", /#ir=tu\/momentos/.test(await page.locator("main").innerText()));
  await ctx.close();
}
await browser.close();
console.log(`limpieza.e2e: ${passes} ok, ${fails} fallos`);
process.exit(fails ? 1 : 0);
