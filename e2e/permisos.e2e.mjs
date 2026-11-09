// WEB-97: Centro de permisos y conexiones — en el navegador (Chromium con emulación de
// iPhone 14; no es Safari real: los estados de iOS reales quedan NO_VERIFICADO). Datos inventados.
// Run: python3 -m http.server 8765 --directory web  &  node e2e/permisos.e2e.mjs [screenshot-dir]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
let fails = 0;
const ok = (l, v) => { console.log(v ? "PASS" : "FAIL", l); if (!v) { fails++; process.exitCode = 1; } };
const browser = await chromium.launch();
const seed = { schema: 1, settings: { shortcutsDone: { salud: true } }, inbox: [], chat: [], income: [], spending: [], projects: [], reminders: [
  { id: "r1", text: "Recordatorio inventado A", at: "2026-11-09T18:00:00+01:00" }, { id: "r2", text: "Recordatorio inventado B", at: "2026-11-08T09:00:00+01:00" }, { id: "r3", text: "Mañana", at: "2026-11-10T09:00:00+01:00" }] };
const ctx = await browser.newContext({ ...devices["iPhone 14"], timezoneId: "Europe/Madrid", geolocation: { latitude: 43.53821, longitude: -5.66112 } });
const page = await ctx.newPage(); const errors = []; const meteo = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/open-meteo|Failed to load resource|Applying inline style violates/.test(m.text())) errors.push(m.text()); });
page.on("dialog", (d) => d.accept());
await page.clock.install({ time: new Date("2026-11-09T10:00:00+01:00") });
await page.route(/open-meteo\.com/, (r) => { meteo.push(r.request().url()); r.fulfill({ status: 503, body: "" }); });
// Headless Chromium always answers «denied» to notifications, so the iOS prompt is simulated:
// requestPermission() acts as if Manu tapped «Permitir». Badge calls are recorded.
await page.addInitScript(() => { let perm = "default"; window.Notification = class { static get permission() { return perm; } static async requestPermission() { perm = "granted"; return perm; } }; });
await page.addInitScript(() => { window.__badge = []; navigator.setAppBadge = async (n) => { window.__badge.push(n); }; navigator.clearAppBadge = async () => { window.__badge.push(0); }; });
await page.addInitScript((v) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); sessionStorage.setItem("manuos.tab", "tu"); localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); localStorage.setItem("manuos.vault", JSON.stringify(v)); }, seed);
await page.goto("http://localhost:8765/"); await page.waitForTimeout(800);
const vault = () => page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
const shot = async (n) => { if (out) await page.screenshot({ path: `${out}/${n}.png`, fullPage: false }); };
const state = (id) => page.locator(`.cap-row[data-cap="${id}"] .cap-state`).getAttribute("data-state");

await page.click('[data-sub="permisos"]'); await page.waitForTimeout(400);
const text = await page.textContent("#screen");
ok("the page opens with the four groups", ["Del iPhone", "Conexiones", "Solo con una app nativa", "No se puede o no se hará"].every((g) => text.includes(g)));
ok("principles are stated: only talks to Manu, no ad tracking", /MANU solo habla contigo/.test(text) && /Sin rastreo publicitario/.test(text));
ok("notifications start as «Sin pedir» (real state)", (await state("notificaciones")) === "ask");
ok("location starts as «Sin pedir»", (await state("ubicacion")) === "ask");
ok("a shortcut Manu marked is «Lo marcas tú», others pending", (await state("salud")) === "manual" && (await state("lugar")) === "pending");
ok("native-only and forbidden items have no buttons", (await page.locator('.cap-row[data-cap="healthkit"] button, .cap-row[data-cap="att"] button, .cap-row[data-cap="mensajes"] button').count()) === 0);
await shot("01-permisos");

// Persistent storage: asks the browser and shows its real answer.
await page.locator('.cap-row[data-cap="almacenamiento"] [data-act="cap-persist"]').click(); await page.waitForTimeout(300);
const persisted = await page.evaluate(() => navigator.storage.persisted());
ok("persist: the state shown is the browser's answer", (await state("almacenamiento")) === (persisted ? "on" : "off"));

// Badge: only after Manu turns it on; shows the count of reminders left today (2), not their text.
ok("no badge before opting in", (await page.evaluate(() => window.__badge.length)) === 0);
await page.locator('.cap-row[data-cap="globo"] [data-act="cap-badge"]').click(); await page.waitForTimeout(300);
ok("opting in asks for notifications first (iOS ties the badge to them)", (await state("notificaciones")) === "on");
ok("badge set to 2 (today + overdue) after opting in", (await page.evaluate(() => window.__badge.at(-1))) === 2 && (await vault()).settings.badge === true);
ok("badge state is «Activo» with notifications granted", (await state("globo")) === "on");
await page.locator('.cap-row[data-cap="globo"] [data-act="cap-badge"]').click(); await page.waitForTimeout(300);
ok("turning it off clears the badge", (await page.evaluate(() => window.__badge.at(-1))) === 0 && (await vault()).settings.badge === false);

// One-shot location for the weather: rounded coordinates only.
await ctx.grantPermissions(["geolocation"]); // as if Manu tapped «Permitir» in the iOS prompt
await page.locator('.cap-row[data-cap="ubicacion"] [data-act="cap-here"]').click(); await page.waitForTimeout(600);
const v = await vault();
ok("location stored only rounded (≈10 km), for today", v.settings.cityOverride?.city?.latitude === 43.5 && v.settings.cityOverride?.city?.longitude === -5.7 && !JSON.stringify(v).includes("43.538"));
ok("only rounded coordinates go to Open-Meteo", meteo.some((u) => /latitude=43\.5&longitude=-5\.7/.test(u)) && !meteo.some((u) => /43\.538/.test(u)));
ok("…and MANU shows Hoy with it", (await page.evaluate(() => document.body.dataset.screen)) === "hoy");
await page.click('[data-tab="tu"]'); await page.click('[data-sub="permisos"]'); await page.waitForTimeout(400);
ok("location state now «Activo»", (await state("ubicacion")) === "on");
await page.locator('.cap-row[data-cap="ubicacion"] summary').click(); await page.waitForTimeout(100);
await shot("02-detalles");

ok("Tú shows the summary on the list item", /activos/.test(await (await page.click('[data-act="back"]'), page.textContent("#screen"))));
ok("no console errors", errors.length === 0);
if (errors.length) console.log(errors.join("\n"));
await ctx.close(); await browser.close();
console.log(fails ? `${fails} FAIL` : "ALL PASS");
