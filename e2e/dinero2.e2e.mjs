// WEB-111 · Dinero 2.0 en la app real (Chromium con emulación de iPhone; NO es Safari real).
// Run: python3 -m http.server 8765 --directory web  &  node e2e/dinero2.e2e.mjs [carpeta-capturas]
// Datos ficticios. Ninguna llamada sale de la máquina (banco, nube y tiempo se interceptan).
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
const B = process.env.MANU_URL ?? "http://localhost:8765/";
let fails = 0, passes = 0;
const ok = (l, v) => { if (v) passes++; else { fails++; console.log("FAIL", l); } };
const at = (d, h = 10) => new Date(`2026-11-${d}T${String(h).padStart(2, "0")}:00:00+01:00`).toISOString();
const seed = () => ({ schema: 1, settings: {}, inbox: [], chat: [], projects: [],
  people: [{ id: "p1", name: "Luis Fernández de la Prueba" }, { id: "p2", name: "Ana Prueba" }],
  spending: [
    { id: "cafe", at: at("02", 9), cents: 1250, merchant: "CAFE UNO", category: "FOOD_AND_DRINK", source: "BANK" },
    { id: "cajero", at: at("03"), cents: 60000, merchant: "REINTEGRO CAJERO GIJON", category: "CASH", source: "BANK" },
    { id: "cena", at: at("14", 22), cents: 9000, merchant: "RESTAURANTE DOS", category: "FOOD_AND_DRINK", source: "BANK" },
    { id: "bizum", at: at("11"), cents: 2000, merchant: "BIZUM A PEPE PRUEBA", category: "TRANSFERS", source: "BANK" },
    { id: "farmacia", at: at("10"), cents: 4000, merchant: "FARMACIA CUATRO", category: "HEALTH", source: "BANK" },
  ],
  income: [
    { id: "nomina", at: at("01", 8), cents: 150000, concept: "NOMINA EMPRESA PRUEBA", payroll: true },
    { id: "ingreso", at: at("05"), cents: 60000, concept: "INGRESO EFECTIVO CAJERO" },
    { id: "mama", at: at("06"), cents: 50000, concept: "TRANSFERENCIA DE MAMA PRUEBA" },
  ] });
const browser = await chromium.launch();
async function open(opts = { ...devices["iPhone 14"] }) {
  const ctx = await browser.newContext({ timezoneId: "Europe/Madrid", ...opts });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|Applying inline style violates/.test(m.text())) errors.push(m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.clock.install({ time: new Date("2026-11-16T12:00:00+01:00") });
  await page.route(/^https:\/\/([^/]*\.)?(open-meteo\.com|supabase\.co|googleapis\.com|google\.com|spotify\.com|enablebanking\.com)\//, (r) => r.fulfill({ status: 503, body: "" }));
  await page.addInitScript((v) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); sessionStorage.setItem("manuos.tab", "dinero"); localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); localStorage.setItem("manuos.vault", JSON.stringify(v)); }, seed());
  await page.goto(B); await page.waitForTimeout(700);
  return { ctx, page, errors };
}
const vault = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
const shot = async (page, n) => { if (out) { await page.waitForTimeout(350); await page.screenshot({ path: `${out}/${n}.png`, fullPage: false }); } };
const bankSame = (v) => JSON.stringify(v.spending.map(({ id, at, cents, merchant, category }) => ({ id, at, cents, merchant, category }))) === JSON.stringify(seed().spending.map(({ id, at, cents, merchant, category }) => ({ id, at, cents, merchant, category }))) && JSON.stringify(v.income) === JSON.stringify(seed().income);

const { ctx, page, errors } = await open();
// 1. Resumen: el cajero no es consumo; cifras provisionales y sin consejos.
const sum = await page.locator(".lg-sum").innerText();
ok("resumen: cifras provisionales", /Cifras provisionales/.test(sum));
ok("resumen: consumo sin los 600 € del cajero (12,50 + 90 + 40)", /Consumo personal[\s\S]*?142,50/.test(sum));
ok("resumen: pendiente de atribuir visible", /Pendiente de atribuir/.test(sum));
ok("sin «tu día de más gasto» mientras no es fiable", !/Tu día de más gasto/.test(await page.locator("#screen").innerText()));
await page.locator(".lg-sum").scrollIntoViewIfNeeded(); await shot(page, "01-resumen");

// 2. La sugerencia del cajero: hay que confirmarla; no se aplica sola.
const sug = page.locator(".lg-sug-item", { hasText: "Efectivo que volví a ingresar" }).first();
ok("sugerencia del cajero", await sug.isVisible());
ok("la sugerencia explica por qué", /el ingreso es de efectivo/.test(await sug.innerText()));
await sug.scrollIntoViewIfNeeded(); await shot(page, "02-sugerencia");
await sug.locator('[data-s="CONFIRMED"]').click();
ok("confirmada: el cajero deja de estar pendiente", !/REINTEGRO CAJERO[\s\S]{0,80}Pendiente/i.test(await page.locator(".lg-moves").innerText()));
ok("confirmar no toca el banco", bankSame(await vault(page)));

// 3. Gasto compartido con nombres largos: horizontal, a partes iguales, porcentajes.
await page.click('[data-act="mv-open"][data-k="g:cena"]');
ok("ficha: concepto original del banco", /RESTAURANTE DOS/.test(await page.locator(".lg-orig").innerText()));
await page.check('input[name="mvKind"][value="SHARED"]');
await page.click('.lg-people [data-who="p:p1"]');
await page.fill("#mvPerson", "Ana Prueba"); await page.click('[data-act="mv-person-add"]');
const parts = await page.locator(".lg-part").count();
ok("tres partes: yo, Luis y Ana", parts === 3);
const nameBox = await page.locator('.lg-part[data-who="p:p1"] .lg-part-name b').boundingBox();
ok(`el nombre largo se lee en horizontal (alto ${Math.round(nameBox.height)} px, ancho ${Math.round(nameBox.width)} px)`, nameBox.width > 120 && nameBox.height < 60);
ok("a partes iguales: 30 € cada uno", /Repartido: 90,00 € de 90,00 €/.test(await page.locator("#mvTotal").innerText()));
await page.fill('[data-mv-pct="p:p2"]', "50");
ok("al poner 50 % a Ana se recalcula su importe", (await page.inputValue('[data-mv-cents="p:p2"]')) === "45,00");
ok("y el total avisa de que se pasa", /Te pasas/.test(await page.locator("#mvTotal").innerText()));
await page.fill('[data-mv-pct="p:p2"]', "33,3");
await page.fill('[data-mv-cents="me"]', "30,03");
await shot(page, "03-reparto");
await page.click('#mvForm button[type="submit"]');
let v = await vault(page);
ok("guardado como anotación compartida", v.ledger.notes["g:cena"].kind === "SHARED");
ok("el gasto no se duplica y el banco no cambia", v.spending.length === seed().spending.length && bankSame(v));
await page.click('[data-act="mv-close"]');
const bal = await page.locator(".lg-bal").innerText();
ok("Ana y Luis te deben su parte", /Ana Prueba[\s\S]*Te debe/.test(bal) && /Luis Fernández de la Prueba/.test(bal));

// 4. Dinero de mamá: entra en tu cuenta pero no es tuyo.
await page.click('[data-act="mv-open"][data-k="i:mama"]');
await page.check('input[name="mvKind"][value="OTHERS"]');
await page.fill("#mvPerson", "Mamá"); await page.click('[data-act="mv-person-add"]');
ok("de mamá: todo el importe para ella", (await page.inputValue('.lg-part:not([data-who="me"]) [data-mv-cents]')) === "500,00");
await page.click('#mvForm button[type="submit"]');
await page.click('[data-act="mv-close"]');
const sum2 = await page.locator(".lg-sum").innerText();
ok("lo de mamá no es ingreso propio", /Ingresos propios[\s\S]*?1500,00|Ingresos propios[\s\S]*?1\.500,00/.test(sum2));
ok("aparece como dinero de otras personas", /Dinero de otras personas/.test(sum2));
ok("saldo con mamá", /Mamá[\s\S]*Tienes 500,00 € suyos en tu cuenta/.test(await page.locator(".lg-bal").innerText()));
await page.locator(".lg-bal").scrollIntoViewIfNeeded(); await shot(page, "04-personas");

// 5. Corrección múltiple con revisión previa.
await page.click('.lg-sum [data-act="lg-select"]');
await page.waitForSelector(".lg-bulk");
ok("en modo selección ningún importe queda cortado", await page.evaluate(() => [...document.querySelectorAll(".lg-amt")].every((a) => a.getBoundingClientRect().right <= a.closest(".card").getBoundingClientRect().right + 1)));
// Con el reloj simulado, las animaciones de entrada se quedan en su primer fotograma: se terminan.
await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
for (const k of ["g:bizum", "g:farmacia"]) { const l = page.locator(`.lg-pick:has([data-k="${k}"])`); await l.scrollIntoViewIfNeeded(); await page.waitForTimeout(150); await l.click(); }
ok("dos elegidos", (await page.locator(".lg-bulk p b").innerText()) === "2");
await page.selectOption("#lgBulkKind", "MINE");
await page.click('[data-act="lg-bulk-plan"]');
ok("revisión previa con el antes y el después", /Pendiente de revisar[\s\S]*Gasto propio/.test(await page.locator("#screen").innerText()));
ok("revisar no guarda nada", !(await vault(page)).ledger.notes["g:bizum"]);
await shot(page, "05-revision");
await page.click('[data-act="lg-bulk-apply"]');
v = await vault(page);
ok("aplicado a los dos", v.ledger.notes["g:bizum"]?.kind === "MINE" && v.ledger.notes["g:farmacia"]?.kind === "MINE");

// 6. Historial y vuelta atrás.
await page.click('[data-act="mv-open"][data-k="g:bizum"]');
await page.check('input[name="mvKind"][value="REVIEW"]');
await page.click('#mvForm button[type="submit"]');
ok("historial con la versión anterior", /Gasto propio/.test(await page.locator(".card", { hasText: "Historial" }).innerText()));
await page.click('[data-act="mv-restore"][data-i="0"]');
ok("restaurada", (await vault(page)).ledger.notes["g:bizum"].kind === "MINE");
await page.click('[data-act="mv-revert"]');
ok("volver a lo que dice el banco", !(await vault(page)).ledger.notes["g:bizum"]);
ok("el banco sigue intacto al final", bankSame(await vault(page)));
ok(`sin errores (${errors.join(" | ")})`, errors.length === 0);
await ctx.close();

// 7. El reparto de antes (tarjeta «¿Con quién estabas?»): nombres en horizontal.
{
  const s2 = seed(); s2.spending = [{ id: "bar", at: at("15", 23), cents: 3600, merchant: "BAR CINCO", category: "NIGHTLIFE", source: "BANK" }];
  const c = await browser.newContext({ ...devices["iPhone 14"], timezoneId: "Europe/Madrid" });
  const p = await c.newPage(); p.on("dialog", (d) => d.accept());
  await p.clock.install({ time: new Date("2026-11-16T12:00:00+01:00") });
  await p.addInitScript((vv) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); sessionStorage.setItem("manuos.tab", "dinero"); localStorage.setItem("manuos.vault", JSON.stringify(vv)); }, s2);
  await p.goto(B); await p.waitForTimeout(600);
  await p.click('.split-ask [data-act="split-person"][data-key="p1"]');
  await p.click('[data-act="split-mode"][data-mode="detail"]');
  const box = await p.locator(".split-detail .row .grow").first().boundingBox();
  ok(`reparto detallado: «Luis» en horizontal (ancho ${Math.round(box.width)} px)`, box.width > 120 && box.height < 40);
  await p.locator(".split-ask").scrollIntoViewIfNeeded(); if (out) { await p.waitForTimeout(300); await p.screenshot({ path: `${out}/06-reparto-antiguo.png` }); }
  await p.fill('[data-split-cents="p1"]', "12");
  await p.click('[data-act="split-save"][data-mode="detail"]');
  const vv = await p.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
  ok("el reparto antiguo ya no escribe en el movimiento", !vv.spending[0].split && !vv.spending[0].splitAsked);
  ok("se guarda como anotación compartida", vv.ledger.notes["g:bar"].kind === "SHARED" && vv.ledger.notes["g:bar"].parts.find((x) => x.who === "p:p1").cents === 1200);
  await c.close();
}

// 8. Anchos de iPhone y Mac sin desbordes, ficha incluida.
for (const w of [320, 375, 390, 430, 1280]) {
  const { ctx: c, page: p } = await open({ viewport: { width: w, height: 800 }, isMobile: w < 900, hasTouch: w < 900 });
  const over = () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  ok(`${w}px Dinero sin desbordar`, !(await over()));
  await p.click('[data-act="mv-open"][data-k="g:cena"]'); await p.check('input[name="mvKind"][value="SHARED"]'); await p.click('.lg-people [data-who="p:p1"]');
  ok(`${w}px ficha con reparto sin desbordar`, !(await over()));
  await p.click('[data-act="mv-close"]'); await p.click('.lg-sum [data-act="lg-select"]');
  ok(`${w}px modo selección: importes enteros`, await p.evaluate(() => [...document.querySelectorAll(".lg-amt")].every((a) => a.getBoundingClientRect().right <= a.closest(".card").getBoundingClientRect().right + 1)));
  if (w === 320) await shot(p, "07-ficha-320");
  await c.close();
}
// 9. Una sola cifra: MANU responde con el consumo personal y avisa de que es provisional.
{
  const { ctx: c, page: p, errors: errs } = await open();
  await p.evaluate(() => { sessionStorage.setItem("manuos.tab", "manu"); }); await p.reload(); await p.waitForTimeout(600);
  await p.fill("#msg", "¿cuánto he gastado este mes?"); await p.press("#msg", "Enter"); await p.waitForTimeout(600);
  const said = await p.locator("#chat .bubble").last().innerText();
  ok("MANU: consumo personal, no el banco en bruto (142,50, sin los 600 €)", /142,50/.test(said) && !/742|756/.test(said));
  ok("MANU: avisa de que es provisional y por qué", /provisional/.test(said) && /sin atribuir/.test(said));
  ok("MANU: dice de dónde sale la cifra", /Fuente:/.test(said));
  ok("MANU: sin errores", !errs.length);
  await c.close();
}
await browser.close();
console.log(`dinero2.e2e: ${passes} correctas, ${fails} fallos`);
process.exit(fails ? 1 : 0);
