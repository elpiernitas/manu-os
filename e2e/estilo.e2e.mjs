// WEB-95: aprender de ideas, decisiones, correcciones y conversaciones — en el navegador
// (Chromium con emulación de iPhone 14; no es Safari real). Datos inventados.
// Run: python3 -m http.server 8765 --directory web  &  node e2e/estilo.e2e.mjs [screenshot-dir]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
let fails = 0;
const ok = (l, v) => { console.log(v ? "PASS" : "FAIL", l); if (!v) { fails++; process.exitCode = 1; } };
const browser = await chromium.launch();
const seed = { schema: 1, settings: {}, inbox: [], chat: [], income: [], spending: [], projects: [{ id: "p1", name: "Onda Norte", emoji: "📻", keywords: [], sources: [], chat: [] }] };
const ctx = await browser.newContext({ ...devices["iPhone 14"], timezoneId: "Europe/Madrid" });
const page = await ctx.newPage(); const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
// Pre-existing and unrelated: Google Identity Services and the app's CSP (see WEB-94 report).
page.on("console", (m) => { if (m.type() === "error" && !/open-meteo|Failed to load resource|Applying inline style violates/.test(m.text())) errors.push(m.text()); });
page.on("dialog", (d) => d.accept());
await page.clock.install({ time: new Date("2026-11-09T10:00:00+01:00") });
await page.route(/open-meteo\.com/, (r) => r.fulfill({ status: 503, body: "" }));
await page.addInitScript((v) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); sessionStorage.setItem("manuos.tab", "manu"); localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); localStorage.setItem("manuos.vault", JSON.stringify(v)); }, seed);
await page.goto("http://localhost:8765/"); await page.waitForTimeout(800);
const vault = () => page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
const shot = async (n) => { if (out) await page.screenshot({ path: `${out}/${n}.png` }); };
const send = async (t) => { await page.fill("#msg", t); await page.press("#msg", "Enter"); await page.waitForTimeout(220); };
const lastManu = () => page.locator(".bubble.manu").last().textContent();

// 1. Conversation: an expression on several days, a laugh, a joke kept on purpose.
await send("Qué máquina eres, de verdad");
await send("jajaja vale");
await send("Eres más lento que el wifi del bus");
await send("guárdate esa");
ok("«guárdate esa» keeps the previous message verbatim", /Guardada tal cual: «Eres más lento que el wifi del bus»/.test(await lastManu()));
await page.clock.setSystemTime(new Date("2026-11-10T10:00:00+01:00"));
await send("qué máquina, en serio"); await send("jajaja"); await send("bueno, qué máquina");
await send("jajajaja");
await send("cuéntame uno de mis chistes");
ok("his joke comes back with its date, never an invented one", /wifi del bus/.test(await lastManu()) && /noviembre de 2026/.test(await lastManu()));
await send("gasté 12 en pan"); // an order to MANU (a spend), not his way of talking
let v = await vault();
ok("style counts his messages but not orders or commands", v.brain.style.msgs === 7);
ok("the style model keeps counters and short examples only (no message list)", !("messages" in v.brain.style) && Object.values(v.brain.style.grams).every((g) => !g.ex || g.ex.length <= 120));

// 2. A decision is offered, saved only with his tap, and found later.
await send("He decidido no pedir comida a domicilio entre semana");
ok("decision offered, not assumed", /¿Lo guardo como decisión tuya\?/.test(await lastManu()) && !(await vault()).brain.claims.length);
await page.locator('[data-act="mem-chat-decision"][data-yes="1"]').click(); await page.waitForTimeout(200);
await send("¿qué decidí sobre la comida?");
ok("«¿qué decidí…?» finds it", /no pedir comida a domicilio/.test(await lastManu()));
await shot("01-chat");

// 3. Memoria proposes what it observed, with counts; Manu decides.
await page.click('[data-tab="tu"]'); await page.click('[data-sub="memoria"]'); await page.waitForTimeout(250);
const expr = page.locator('.mem-prop[data-kind="expresion"]');
ok("an expression is proposed with its count", (await expr.count()) === 1 && /«que maquina» \(3 veces, en 2 días/.test(await expr.textContent()));
await expr.locator('[data-action="when:acierto"]').click(); await page.waitForTimeout(150);
const risa = page.locator('.mem-prop[data-kind="risa"]');
ok("his laugh is proposed", (await risa.count()) === 1 && /«jajaja»/.test(await risa.textContent()));
await risa.locator('[data-action="accept"]').click(); await page.waitForTimeout(150);
v = await vault();
ok("adopted only after his yes", v.brain.voice.examples.some((e) => e.text === "que maquina" && e.when === "acierto") && v.brain.voice.laugh === "jajaja");
ok("«Tu estilo» shows counts and his saved joke", /Tu estilo/.test(await page.textContent("#screen")) && /wifi del bus/.test(await page.textContent("#screen")));
await shot("02-tu-estilo");
await page.locator('[data-act="mem-style-on"]').click(); await page.waitForTimeout(150);
ok("learning can be switched off", (await vault()).brain.style.on === false);
await page.click('[data-tab="manu"]'); await send("qué máquina otra vez");
ok("…and then nothing is counted", (await vault()).brain.style.msgs === 7);

// 4. Ideas and projects: his own notes teach a keyword; accepting it files the next idea by itself.
await page.click('[data-tab="proyectos"]'); await page.waitForTimeout(200);
await page.click('[data-act="proj-open"]'); await page.waitForTimeout(200);
for (const t of ["Nuevo jingle para la mañana", "El jingle más corto", "Jingle de verano"]) { await page.fill("#projText", t); await page.click('#projSource button[type="submit"]'); await page.waitForTimeout(150); }
await page.click('[data-tab="tu"]'); await page.click('[data-sub="memoria"]'); await page.waitForTimeout(250);
const kw = page.locator('.mem-prop[data-kind="palabra"]');
ok("a keyword is proposed from his own filing", (await kw.count()) === 1 && /«jingle»/.test(await kw.textContent()));
await kw.locator('[data-action="accept"]').click(); await page.waitForTimeout(150);
ok("…and added to the project", (await vault()).projects[0].keywords.includes("jingle"));
await page.click('[data-tab="manu"]'); await send("apunta idea: un jingle con olas de fondo"); await page.waitForTimeout(300);
v = await vault();
ok("the next idea is filed into the project automatically", v.projects[0].sources.some((s) => s.auto && /olas de fondo/.test(s.text)));

ok("no console errors", errors.length === 0);
if (errors.length) console.log(errors.join("\n"));
await ctx.close(); await browser.close();
console.log(fails ? `${fails} FAIL` : "ALL PASS");
