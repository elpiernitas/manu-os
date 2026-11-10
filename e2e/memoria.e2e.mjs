// WEB-94: Memoria en el navegador (Chromium con emulación de iPhone 14; no es Safari real).
// Run: python3 -m http.server 8765 --directory web  &  node e2e/memoria.e2e.mjs [screenshot-dir]
// Datos inventados: comercios «BAR UNO», «PUB DOS»… no son reales.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
let fails = 0;
const ok = (l, v) => { console.log(v ? "PASS" : "FAIL", l); if (!v) { fails++; process.exitCode = 1; } };
const browser = await chromium.launch();
const iso = (d, h, m = 0) => new Date(`${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+01:00`).toISOString();
const seed = { schema: 1, settings: {}, inbox: [], chat: [], income: [], projects: [],
  spending: [
    { id: "n1", cents: 900, merchant: "BAR UNO", category: "OTHER", inferred: true, at: iso("2026-11-01", 1, 30) },
    { id: "n2", cents: 1200, merchant: "PUB DOS", category: "OTHER", inferred: true, at: iso("2026-11-02", 2, 10) },
    { id: "n3", cents: 700, merchant: "TABERNA TRES", category: "OTHER", inferred: true, at: iso("2026-11-07", 23, 40) },
    { id: "n4", cents: 1100, merchant: "BODEGA CUATRO", category: "OTHER", inferred: true, at: iso("2026-10-31", 0, 20) },
  ] };
const ctx = await browser.newContext({ ...devices["iPhone 14"], timezoneId: "Europe/Madrid" });
const page = await ctx.newPage(); const errors = [];
page.on("pageerror", (e) => errors.push(String(e))); // Pre-existing and unrelated: opening Tú loads Google Identity Services, which tries to add inline
// styles that the app's CSP blocks («Applying inline style violates…»). It also happens on main.
page.on("console", (m) => { if (m.type() === "error" && !/open-meteo|Failed to load resource|Applying inline style violates/.test(m.text())) errors.push(m.text()); });
page.on("dialog", (d) => d.accept());
await page.clock.install({ time: new Date("2026-11-09T10:00:00+01:00") });
await page.route(/open-meteo\.com/, (r) => r.fulfill({ status: 503, body: "" }));
await page.addInitScript((v) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); sessionStorage.setItem("manuos.tab", "hoy"); localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); localStorage.setItem("manuos.vault", JSON.stringify(v)); }, seed);
await page.goto("http://localhost:8765/"); await page.waitForTimeout(800);
const vault = () => page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
const shot = async (n) => { if (out) await page.screenshot({ path: `${out}/${n}.png` }); };
const goMemoria = async () => { await page.click('[data-tab="tu"]'); await page.click('[data-sub="memoria"]'); await page.waitForTimeout(250); };

// 1. Hoy offers a single proposal (the most useful one), with «Luego».
// WEB-108: con Horizonte (tema por defecto) la misma propuesta llega como «botella».
const hoyCard = page.locator(".mem-hoy, .hz-botella");
ok("Hoy shows one Memoria proposal", (await hoyCard.count()) === 1);
ok("…the most useful first: an unknown expense", /¿Qué es este gasto\?/i.test(await hoyCard.textContent()));
await shot("01-hoy");

// 2. Unknown spending → Manu answers three times → MANU proposes a rule.
await goMemoria();
ok("Memoria page opens", (await page.textContent("h1")) === "Memoria");
await shot("02-memoria");
for (let i = 0; i < 3; i++) {
  const card = page.locator('.mem-prop[data-kind="gasto"]').first();
  await card.locator('[data-action="choose"]').click();
  await page.selectOption("#memCat", "NIGHTLIFE");
  await page.click('#memCatForm button[type="submit"]'); await page.waitForTimeout(150);
}
const v1 = await vault();
ok("three answers saved as Manu's decisions", ["n1", "n2", "n3"].every((id) => { const e = v1.spending.find((x) => x.id === id); return e.category === "NIGHTLIFE" && e.inferred === false; }));
const rule = page.locator('.mem-prop[data-kind="regla"]');
ok("a pattern is proposed as a rule, with its reason", (await rule.count()) === 1 && /3 de 3 gastos de noche/.test(await rule.textContent()));
await shot("03-patron");
await rule.locator('[data-action="accept"]').click(); await page.waitForTimeout(200);
const v2 = await vault();
const n4 = v2.spending.find((x) => x.id === "n4");
ok("the accepted rule labels the next unknown spend as a deduction", n4.category === "NIGHTLIFE" && n4.inferred === true && n4.learned?.confidence < 1);
ok("«Lo que he aprendido» lists the rule", /Lo que he aprendido/.test(await page.textContent("#screen")));
await page.click('[data-tab="dinero"]'); await page.waitForTimeout(250);
ok("Dinero marks it as a learned deduction with confidence", /deducción aprendida \(\d+ %\)/.test(await page.textContent("#screen")));

// 3. Getting to know each other: answer, decline, tone.
await goMemoria();
const q = page.locator('.mem-prop[data-kind="pregunta"]');
ok("a getting-to-know-you question is there", (await q.count()) === 1 && /¿Cómo quieres que te llame\?/.test(await q.textContent()));
await page.fill("#memAnswer", "Manolo de prueba"); await page.click('#memAnswerForm button[type="submit"]'); await page.waitForTimeout(150);
await page.locator('.mem-prop[data-kind="pregunta"] [data-forever="1"]').click(); await page.waitForTimeout(150);
const v3 = await vault();
const answered = v3.brain.claims.find((c) => c.source?.ref === "nombre");
ok("the answer is a claim with provenance «pregunta»", answered?.status === "ACTIVE" && answered.source.kind === "pregunta" && /Manolo de prueba/.test(answered.text));
ok("the declined question is remembered as declined", v3.brain.answers.ciudad?.state === "declined");
await page.locator('[data-act="mem-voice"][data-k="franqueza"][data-v="2"]').click(); await page.waitForTimeout(100);
ok("franqueza set to «zasca con fundamento»", (await vault()).brain.voice.franqueza === 2);

// 4. Chat: remember, contradiction with evidence, «¿qué sabes de…?».
await page.click('[data-tab="manu"]'); await page.waitForTimeout(200);
const send = async (t) => { await page.fill("#msg", t); await page.press("#msg", "Enter"); await page.waitForTimeout(250); };
await send("recuerda que mi café favorito es el cortado");
ok("chat remembers", /preferencia/.test(await page.locator(".bubble.manu").last().textContent()));
await send("recuerda que mi café favorito es el solo");
const zasca = await page.locator(".bubble.manu").last().textContent();
ok("a contradiction is pointed out, citing the earlier words and date", /cortado/.test(zasca) && /noviembre/.test(zasca) && /en duda/.test(zasca));
await shot("04-chat-contradiccion");
await send("¿qué sabes del café?");
ok("«¿qué sabes de…?» separates what is in doubt", /En duda:/.test(await page.locator(".bubble.manu").last().textContent()));

// 5. Manu resolves the doubt; corrects; forgets for real; everything survives a reload.
await goMemoria();
const duda = page.locator('.mem-prop[data-kind="duda"]');
ok("the doubt becomes a proposal", (await duda.count()) === 1);
await duda.locator('[data-action^="keep:"]').last().click(); await page.waitForTimeout(150);
let br = (await vault()).brain;
ok("Manu's pick is the only current value; the other is history", br.claims.filter((c) => c.key === "cafe favorito" && c.status === "ACTIVE").length === 1 && br.claims.some((c) => c.key === "cafe favorito" && c.status === "SUPERSEDED"));
await page.fill("#memText", "El 3 de marzo fui a Oviedo a un concierto de prueba"); await page.fill("#memWhen", "2024-03-03"); await page.fill("#memPlace", "Oviedo");
await page.click('#memAddForm button[type="submit"]'); await page.waitForTimeout(150);
await page.fill("#memQuery", "marzo de 2024"); await page.click('#memSearchForm button[type="submit"]'); await page.waitForTimeout(150);
ok("search by date finds it", (await page.locator(".mem-row").count()) === 1);
await page.locator(".mem-row").first().click(); await page.waitForTimeout(150);
await page.click('.mem-detail [data-act="mem-correct"]'); await page.fill("#memCorrectText", "El 3 de marzo fui a Oviedo a dos conciertos de prueba"); await page.click('#memCorrectForm button[type="submit"]'); await page.waitForTimeout(150);
ok("the correction keeps the history", /Historial/.test(await page.textContent(".mem-detail")) && (await page.locator(".mem-hist li").count()) === 2);
await shot("05-detalle-historial");
await page.reload(); await page.waitForTimeout(700); await goMemoria();
ok("everything is still there after a reload", /dos conciertos/.test(await page.textContent("#screen")) || (await vault()).brain.claims.some((c) => /dos conciertos/.test(c.text)));
await page.fill("#memQuery", "conciertos"); await page.click('#memSearchForm button[type="submit"]'); await page.waitForTimeout(150);
await page.locator(".mem-row").first().click(); await page.waitForTimeout(150);
await page.click('.mem-detail [data-act="mem-forget"]'); await page.waitForTimeout(200);
const raw = await page.evaluate(() => localStorage.getItem("manuos.vault"));
ok("forgetting removes the text of every version from storage", !/concierto/.test(raw));
ok("…and leaves a content-free event", JSON.parse(raw).brain.events.some((e) => e.type === "forget" && e.count === 2 && !("text" in e)));
await page.click('[data-tab="hoy"]'); await page.waitForTimeout(250);
await shot("06-hoy-despues");

ok("no console errors", errors.length === 0);
if (errors.length) console.log(errors.join("\n"));
await ctx.close(); await browser.close();
console.log(fails ? `${fails} FAIL` : "ALL PASS");
