// WEB-99: avisos con MANU cerrada — gestión completa desde la app, contra un Supabase FALSO y un
// PushManager simulado (Chromium sin interfaz no tiene servicio push). Nada sale a la red.
// Run: python3 -m http.server 8765 --directory web  &  node e2e/push.e2e.mjs [screenshot-dir]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
let fails = 0;
const ok = (l, v) => { console.log(v ? "PASS" : "FAIL", l); if (!v) { fails++; process.exitCode = 1; } };
const KEY = "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"; // RFC 8291 example key (public)
const T0 = Date.parse("2026-11-09T10:00:00+01:00");
const seed = { schema: 1, settings: {}, inbox: [], chat: [], income: [], spending: [], projects: [], reminders: [
  { id: "r1", text: "Recordatorio inventado con datos personales", at: new Date(T0 + 30 * 60000).toISOString() },
  { id: "r2", text: "Hecho", at: new Date(T0 + 60 * 60000).toISOString(), done: true }] };
const server = { subs: [], queue: [], installed: true, keysReadable: false, calls: [] };
const browser = await chromium.launch();
async function device(opts = {}) {
  const ctx = await browser.newContext({ ...devices["iPhone 14"], timezoneId: "Europe/Madrid" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/open-meteo|Failed to load resource|Applying inline style violates/.test(m.text())) errors.push(m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.clock.install({ time: new Date(T0) });
  await page.route(/open-meteo\.com/, (r) => r.fulfill({ status: 503, body: "" }));
  await page.route(/supabase\.co\/rest\/v1\//, async (r) => {
    const req = r.request(), url = new URL(req.url()), m = req.method(), path = url.pathname.split("/rest/v1/")[1];
    const authed = /Bearer /.test(req.headers().authorization ?? "");
    server.calls.push({ m, path, q: url.search, authed });
    if (path === "rpc/manu_push_public_key") return server.installed ? r.fulfill({ json: KEY }) : r.fulfill({ status: 404, json: { code: "PGRST202", message: "Could not find the function" } });
    if (path === "manu_sync") return r.fulfill({ json: [] });
    if (!authed) return r.fulfill({ json: [] }); // RLS: anon sees nothing
    if (path === "manu_push_keys" || path === "manu_push_cron") return server.keysReadable ? r.fulfill({ json: [{ id: 1 }] }) : r.fulfill({ status: 401, json: { message: "permission denied" } });
    if (path === "manu_push_subs" && m === "POST") { const b = JSON.parse(req.postData()); server.subs = [...server.subs.filter((s) => s.endpoint !== b.endpoint), b]; return r.fulfill({ status: 201, body: "" }); }
    if (path === "manu_push_subs" && m === "DELETE") { const e = url.searchParams.get("endpoint"); server.subs = e ? server.subs.filter((s) => `eq.${s.endpoint}` !== e) : []; return r.fulfill({ status: 204, body: "" }); }
    if (path === "manu_push_queue" && m === "POST") { for (const row of JSON.parse(req.postData())) server.queue = [...server.queue.filter((x) => x.id !== row.id), row]; return r.fulfill({ status: 201, body: "" }); }
    if (path === "manu_push_queue" && m === "DELETE") { const keep = /id=not\.in\.\(([^)]*)\)/.exec(decodeURIComponent(url.search))?.[1]?.split(",") ?? []; server.queue = server.queue.filter((x) => keep.includes(x.id)); return r.fulfill({ status: 204, body: "" }); }
    return r.fulfill({ json: [] });
  });
  // The iOS permission prompt and the push service are simulated (as if Manu tapped «Permitir»).
  await page.addInitScript(() => {
    let perm = "default";
    window.Notification = class { static get permission() { return perm; } static async requestPermission() { perm = "granted"; return perm; } };
    let sub = null;
    const pm = { getSubscription: async () => sub, subscribe: async (o) => { window.__subscribed = o; sub = { endpoint: "https://web.push.apple.com/QFakeDeviceToken", options: o, toJSON: () => ({ endpoint: "https://web.push.apple.com/QFakeDeviceToken", keys: { p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth: "BTBZMqHH6r4Tts7J_aSIgg" } }), unsubscribe: async () => { sub = null; window.__unsubscribed = true; return true; } }; return sub; } };
    Object.defineProperty(ServiceWorkerRegistration.prototype, "pushManager", { get: () => pm });
  });
  await page.addInitScript((v) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); sessionStorage.setItem("manuos.tab", "tu");
    localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); localStorage.setItem("manuos.vault", JSON.stringify(v));
    localStorage.setItem("manuos.nube.token", JSON.stringify({ access: "falso", refresh: "falso", exp: Date.parse("2027-01-01"), userId: "u-falso", email: "prueba@example.invalid" }));
    localStorage.setItem("manuos.nube", JSON.stringify({ email: "prueba@example.invalid", lastRev: null })); }, seed);
  await page.goto("http://localhost:8765/"); await page.waitForTimeout(800);
  return { ctx, page, errors };
}
const { ctx, page, errors } = await device();
const vault = () => page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
const shot = async (n) => { if (out) await page.screenshot({ path: `${out}/${n}.png` }); };
await page.click('[data-sub="avisos"]'); await page.waitForTimeout(500);
let text = await page.textContent("#pushCard");
ok("the card offers to turn it on in this device", /Desactivados/.test(text) && (await page.locator('[data-act="push-on"]').count()) === 1);
await page.click('[data-act="push-on"]'); await page.waitForTimeout(800);
ok("subscribed with the server's public key", await page.evaluate(() => Boolean(window.__subscribed?.applicationServerKey && window.__subscribed.userVisibleOnly)));
ok("the subscription is stored for Manu's account only (with session)", server.subs.length === 1 && server.subs[0].endpoint.startsWith("https://web.push.apple.com/") && server.calls.filter((c) => c.path === "manu_push_subs").every((c) => c.authed));
ok("the queue has the pending reminder only, with no text", server.queue.length === 1 && server.queue[0].body === null && /^r_r1_/.test(server.queue[0].id));
ok("nothing personal reaches the server by default", !JSON.stringify(server.queue).includes("inventado") && !JSON.stringify(server.subs).includes("inventado"));
ok("the device subscription is not in the vault (nor in backups)", !JSON.stringify(await vault()).includes("QFakeDeviceToken"));
await shot("01-avisos");

await page.click('[data-act="push-text"]'); await page.waitForTimeout(500);
ok("«Mostrar el texto» on: the text goes, cut to 120", server.queue[0].body === "Recordatorio inventado con datos personales");
await page.click('[data-act="push-text"]'); await page.waitForTimeout(500);
ok("…and off again: the text is gone from the server", server.queue[0].body === null);

await page.click('[data-act="push-test"]'); await page.waitForTimeout(500);
ok("«Probar» queues one test notice (no duplicates)", server.queue.filter((x) => x.id.startsWith("test_")).length === 1 && server.queue.length === 2);
await page.click('[data-act="push-test"]'); await page.waitForTimeout(500);
ok("tapping it twice in the same minute still queues one", server.queue.filter((x) => x.id.startsWith("test_")).length === 1);

await page.click('[data-act="push-check"]'); await page.waitForTimeout(600);
text = await page.textContent("#pushCard");
ok("security check: everything blocked", (text.match(/✅/g) ?? []).length === 6 && !/⚠️/.test(text));
ok("the check only reads", server.calls.filter((c) => /manu_push_keys|manu_push_cron/.test(c.path)).every((c) => c.m === "GET"));

await page.click('[data-act="push-off-here"]'); await page.waitForTimeout(500);
ok("«Quitar de este dispositivo» unsubscribes and deletes this device's subscription", server.subs.length === 0 && (await page.evaluate(() => window.__unsubscribed)) === true);
await page.click('[data-act="push-on"]'); await page.waitForTimeout(800);
await page.click('[data-act="push-all-off"]'); await page.waitForTimeout(600);
ok("«Desactivar en todos» deletes every subscription and every pending notice", server.subs.length === 0 && server.queue.length === 0 && (await vault()).settings.push.on === false);
ok("the iPhone reminders alternative is still offered", /Al iPhone/.test(await page.textContent("#pushCard")));

// A leak would be visible: if the private keys were readable, the check says so.
server.keysReadable = true;
await page.click('[data-act="push-check"]'); await page.waitForTimeout(600);
ok("a readable private-key table is flagged", /⚠️ Claves privadas con tu sesión/.test(await page.textContent("#pushCard")));
server.keysReadable = false;

// Not installed yet: the app says so, and never asks Manu to paste SQL.
server.installed = false;
const other = await device();
await other.page.click('[data-sub="avisos"]'); await other.page.waitForTimeout(600);
const t2 = await other.page.textContent("#pushCard");
ok("not installed: says so without asking for manual SQL", /Falta instalar los avisos/.test(t2) && /no tienes que pegar nada/.test(t2) && (await other.page.locator('[data-act="push-on"]').count()) === 0);

ok("no console errors", errors.length === 0 && other.errors.length === 0);
if (errors.length || other.errors.length) console.log([...errors, ...other.errors].join("\n"));
await other.ctx.close(); await ctx.close(); await browser.close();
console.log(fails ? `${fails} FAIL` : "ALL PASS");
