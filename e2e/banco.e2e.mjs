// Vuelta de Enable Banking y páginas legales, en el navegador (Chromium con emulación de iPhone 14).
// Run: python3 -m http.server 8765 --directory web  &  node e2e/banco.e2e.mjs
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
let fails = 0;
const ok = (l, v) => { console.log(v ? "PASS" : "FAIL", l); if (!v) { fails++; process.exitCode = 1; } };
const B = "http://localhost:8765";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 14"] });
const page = await ctx.newPage(); const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
for (const [p, re] of [["/privacidad/", /Política de privacidad de MANU OS/], ["/condiciones/", /Condiciones de uso de MANU OS/]]) {
  const r = await page.goto(B + p); ok(`${p} responds 200 and has its title`, r.status() === 200 && re.test(await page.textContent("h1")));
}
ok("privacy page states the limits honestly", /no tiene cifrado de extremo a extremo/.test(await (await page.goto(B + "/privacidad/"), page.textContent("main"))));
// A valid return: the state was created by this device just before.
await page.goto(B + "/banco/vuelta/");
await page.evaluate(() => localStorage.setItem("manuos.bank.state", JSON.stringify({ state: "estado-inventado-123456", at: Date.now() })));
await page.goto(B + "/banco/vuelta/?code=codigo-inventado-0001&state=estado-inventado-123456"); await page.waitForTimeout(300);
ok("valid return: accepted", (await page.evaluate(() => document.body.dataset.result)) === "ok");
ok("the code is gone from the address bar", !page.url().includes("code=") && page.url().endsWith("/banco/vuelta/"));
ok("the code waits only in this tab (sessionStorage), the state is consumed", await page.evaluate(() => JSON.parse(sessionStorage.getItem("manuos.bank.pending")).code === "codigo-inventado-0001" && localStorage.getItem("manuos.bank.state") === null && !JSON.stringify(localStorage).includes("codigo-inventado")));
// Replaying the same URL: the state was single-use.
await page.goto(B + "/banco/vuelta/?code=codigo-inventado-0001&state=estado-inventado-123456"); await page.waitForTimeout(300);
ok("replay is refused (state already used)", (await page.evaluate(() => document.body.dataset.result)) === "unknown-state");
await page.goto(B + "/banco/vuelta/?error=access_denied&error_description=Cancelled%20by%20user&state=x"); await page.waitForTimeout(300);
ok("error from the bank: shown as text", (await page.evaluate(() => document.body.dataset.result)) === "error" && /Cancelled by user/.test(await page.textContent("#d")));
await page.goto(B + "/banco/vuelta/?error=x&error_description=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E"); await page.waitForTimeout(300);
ok("no HTML injection from error_description", (await page.locator("#d img").count()) === 0);
const r = await page.goto(B + "/"); ok("the app still loads", r.status() === 200);
ok("no console errors", errors.length === 0); if (errors.length) console.log(errors.join("\n"));
await browser.close(); console.log(fails ? `${fails} FAIL` : "ALL PASS");
