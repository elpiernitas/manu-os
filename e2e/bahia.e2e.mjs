// WEB-91: Bahía 00 in a browser. Run: node e2e/bahia.e2e.mjs [screenshot-dir]
// Needs a server on :8765 serving web/ (python3 -m http.server 8765 --directory web).
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
const ok = (l, v) => { console.log(v ? "PASS" : "FAIL", l); if (!v) process.exitCode = 1; };
const browser = await chromium.launch();
async function run(name, time, seed) {
  const ctx = await browser.newContext({ ...devices["iPhone 14"], timezoneId: "Europe/Madrid" });
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());
  await page.clock.install({ time: new Date(time) });
  await page.route(/open-meteo\.com/, (r) => r.fulfill({ status: 503, body: "" }));
  await page.addInitScript((v) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); localStorage.setItem("manuos.vault", JSON.stringify(v)); }, seed);
  await page.goto("http://localhost:8765/"); await page.waitForTimeout(900);
  return { page, ctx, errors };
}
const iso = (d, h = 12) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00+01:00`).toISOString();
const empty = { schema: 1, settings: {}, inbox: [], chat: [], spending: [], income: [], projects: [{ id: "p1", name: "Portfolio", emoji: "🎨", sources: [], chat: [] }] };

// 1. A first visit: everything at level 1, the town opens by default.
{
  const seed = structuredClone(empty);
  seed.spending = [{ id: "n1", cents: 2300, merchant: "PUB EJEMPLO", category: "NIGHTLIFE", at: iso("2026-11-04", 23) }];
  const { page, ctx, errors } = await run("first", "2026-11-05T11:00:00+01:00", seed);
  ok("opens on Bahía 00", (await page.textContent("h1")) === "Bahía 00");
  ok("canvas drawn", await page.evaluate(() => { const c = document.getElementById("bzCanvas"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) n += d[i] > 0; return n > 1000; }));
  ok("five places to tap", (await page.locator(".bz-spot").count()) === 5);
  ok("night question after a pub", /¿Qué tal anoche\?/.test(await page.textContent("#screen")));
  if (out) await page.screenshot({ path: `${out}/bahia-1.png`, fullPage: true });
  await page.click('[data-act="bz-night"][data-v="3"]'); await page.waitForTimeout(200);
  let v = await page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")).settings.game);
  ok("night answered once", v.nights["2026-11-04"] === 3 && !/¿Qué tal anoche\?/.test(await page.textContent("#screen")));
  await page.click('[data-act="bz-move"]'); await page.waitForTimeout(200);
  v = await page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")).settings.game);
  ok("treadmill marked today", v.treadmill["2026-11-05"] === true);
  await page.selectOption("#bzProject", "p1"); await page.click('[data-act="bz-timer"]'); await page.waitForTimeout(200);
  await page.clock.runFor(65 * 60000); await page.click('[data-act="bz-timer"]'); await page.waitForTimeout(200);
  v = await page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")).settings.game);
  ok("a project session of about an hour", v.sessions.length === 1 && v.sessions[0].projectId === "p1" && !v.timer);
  await page.fill("#bzIdeaIn", "campaña con pisos de película"); await page.click('#bzIdea button[type="submit"]'); await page.waitForTimeout(200);
  const inbox = await page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")).inbox);
  ok("idea saved as an idea", inbox.some((i) => i.status === "IDEA" && /pisos de película/.test(i.text)));
  await page.click('.bz-spot[data-id="muro"]'); await page.waitForTimeout(200);
  ok("place sheet opens", /El Muro de las Vueltas/.test(await page.textContent(".bz-place")));
  ok("Agenda still reachable from Hoy", await (async () => { await page.click('[data-tab="hoy"]'); await page.waitForTimeout(200); return page.isVisible('#screen [data-tab="agenda"]'); })());
  ok("no page errors", errors.length === 0); if (errors.length) console.log(errors);
  await ctx.close();
}
// 2. A built town at night: levels from history, celebration once.
{
  const seed = structuredClone(empty);
  seed.health = Array.from({ length: 31 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, kind: "STEPS", value: 12000 }));
  seed.inbox = Array.from({ length: 45 }, (_, i) => ({ id: `i${i}`, status: "IDEA", text: "x", at: iso(`2026-10-${String((i % 30) + 1).padStart(2, "0")}`) }));
  seed.income = [{ id: "a", cents: 200000, at: iso("2026-08-01") }, { id: "b", cents: 200000, at: iso("2026-09-01") }, { id: "c", cents: 200000, at: iso("2026-10-01") }];
  seed.settings = { game: { rest: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`2026-10-0${i + 1}`, true])), sessions: Array.from({ length: 15 }, (_, i) => ({ id: `s${i}`, start: iso(`2026-10-${String(i + 1).padStart(2, "0")}`, 10), end: iso(`2026-10-${String(i + 1).padStart(2, "0")}`, 13) })) } };
  const { page, ctx, errors } = await run("built", "2026-11-05T22:30:00+01:00", seed);
  const levels = await page.$$eval(".bz-spot span", (s) => s.map((x) => x.textContent).join(""));
  ok(`levels from history (${levels})`, levels === "33233" || levels === "33323" || levels.split("").every((x) => x >= "2"));
  ok("celebration shown", /Obra terminada/.test(await page.textContent("#screen")));
  if (out) await page.screenshot({ path: `${out}/bahia-2.png`, fullPage: true });
  await page.click('[data-act="bz-seen"]'); await page.waitForTimeout(200);
  ok("celebration only once", !/Obra terminada/.test(await page.textContent("#screen")));
  ok("no page errors", errors.length === 0); if (errors.length) console.log(errors);
  await ctx.close();
}
await browser.close(); console.log("DONE");
