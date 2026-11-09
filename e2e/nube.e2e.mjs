// WEB-98: memoria y estilo en Tu nube — en el navegador, con un Supabase FALSO (rutas de
// Playwright; nada sale a la red). Chromium con emulación de iPhone 14, no Safari. Datos inventados.
// Run: python3 -m http.server 8765 --directory web  &  node e2e/nube.e2e.mjs [screenshot-dir]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
let fails = 0;
const ok = (l, v) => { console.log(v ? "PASS" : "FAIL", l); if (!v) { fails++; process.exitCode = 1; } };
const brain = { schema: 1, claims: [
  { id: "c1", text: "Me gusta el café solo", kind: "PREFERENCE", status: "ACTIVE", subject: "Manu", tags: [], sensitive: false, source: { kind: "manu" }, recordedAt: "2026-11-08T09:00:00.000Z", validFrom: "2026-11-08T09:00:00.000Z", confirmedAt: "2026-11-08T09:00:00.000Z" },
  { id: "c2", text: "A Persona Inventada le gusta el té", kind: "FACT", status: "ACTIVE", subject: "Persona Inventada", thirdParty: true, tags: [], sensitive: true, source: { kind: "manu" }, recordedAt: "2026-11-08T09:00:00.000Z", validFrom: "2026-11-08T09:00:00.000Z", confirmedAt: "2026-11-08T09:00:00.000Z" }],
  events: [], learn: { obs: {}, rules: [] }, outcomes: {}, answers: {}, voice: { humor: 1, franqueza: 1, examples: [], jokes: [] }, settings: { maxPerDay: 3 },
  style: { on: true, msgs: 3, days: ["2026-11-08"], grams: { "que maquina": { n: 3, days: ["2026-11-08"], ex: "ayer con Lucía en el bar, qué máquina" } }, laugh: {}, emoji: {}, emojiMsgs: 0, decided: {}, since: "2026-11-08T09:00:00.000Z" }, topics: null };
const seed = { schema: 1, settings: {}, inbox: [{ id: "i1", text: "Tarea inventada", kind: "TASK", at: "2026-11-08T09:00:00.000Z" }], chat: [{ id: "m1", from: "me", text: "Conversación inventada que no debe subir", at: "2026-11-08T09:00:00.000Z" }], income: [], spending: [], projects: [], reminders: [], brain };

// The fake cloud: one row, with the same rev rule as PostgREST + RLS (PATCH only at the expected rev).
const cloud = { row: { rev: 1, device: "Mac", updated_at: "2026-11-08T09:00:00Z", data: seed }, puts: [] };
const browser = await chromium.launch();
async function device() {
  const ctx = await browser.newContext({ ...devices["iPhone 14"], timezoneId: "Europe/Madrid" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/open-meteo|Failed to load resource|Applying inline style violates/.test(m.text())) errors.push(m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.clock.install({ time: new Date("2026-11-09T10:00:00+01:00") });
  await page.route(/open-meteo\.com/, (r) => r.fulfill({ status: 503, body: "" }));
  await page.route(/supabase\.co\/rest\/v1\/manu_sync/, async (r) => {
    const req = r.request(), url = new URL(req.url()), m = req.method();
    if (m === "GET") return r.fulfill({ json: cloud.row ? [url.searchParams.get("select").includes("data") ? cloud.row : { rev: cloud.row.rev, device: cloud.row.device, updated_at: cloud.row.updated_at }] : [] });
    if (m === "PATCH") {
      const base = Number(/rev=eq\.(\d+)/.exec(req.url())?.[1]);
      if (!cloud.row || cloud.row.rev !== base) return r.fulfill({ json: [] });
      const b = JSON.parse(req.postData()); cloud.row = { ...cloud.row, ...b }; cloud.puts.push(b.data);
      return r.fulfill({ json: [{ rev: cloud.row.rev }] });
    }
    return r.fulfill({ status: 405, body: "" });
  });
  await page.addInitScript((v) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); sessionStorage.setItem("manuos.tab", "tu");
    localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); localStorage.setItem("manuos.vault", JSON.stringify(v));
    localStorage.setItem("manuos.nube.token", JSON.stringify({ access: "falso", refresh: "falso", exp: Date.parse("2027-01-01"), userId: "u-falso", email: "prueba@example.invalid" }));
    localStorage.setItem("manuos.nube", JSON.stringify({ email: "prueba@example.invalid", lastRev: 1, lastAt: "2026-11-08T09:00:00Z" })); }, seed);
  await page.goto("http://localhost:8765/"); await page.waitForTimeout(800);
  return { ctx, page, errors };
}
const { ctx, page, errors } = await device();
const vault = () => page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
const nubeState = () => page.evaluate(() => [JSON.parse(localStorage.getItem("manuos.nube") || "{}"), localStorage.getItem("manuos.nube.token")]);
const shot = async (n) => { if (out) await page.screenshot({ path: `${out}/${n}.png` }); };
let v;
const syncNow = async () => { await page.click('[data-act="nube-sync"]'); await page.waitForTimeout(500); };

await page.click('[data-sub="nube"]'); await page.waitForTimeout(300);
let text = await page.textContent("#screen");
ok("Tu nube counts: 1 memory travels, 1 about another person stays on this device", /1 recuerdo\b/.test(text) && /1 sobre otras personas solo en este dispositivo/.test(text));
ok("…and says conversations do not go up", /Tus conversaciones .* no suben/.test(text));
ok("states honestly that it is not end-to-end encrypted", /No es de extremo a extremo/.test(text));
ok("the inventory never shows the memories' text", !/café solo|le gusta el té/.test(text));
await shot("01-nube");

// An edit uploads the memory (Manu's decision), with the old example masked.
await page.click('[data-act="nube-brain"]'); await page.waitForTimeout(200); // off (confirm accepted)
await page.click('[data-act="nube-brain"]'); await page.waitForTimeout(200); // back on
await syncNow();
let up = cloud.puts.at(-1);
ok("memory and style go up, without the memory about another person", up?.brain?.claims?.map((c) => c.id).join() === "c1" && up.brain.style.grams["que maquina"]);
ok("the conversation never goes up", !("chat" in up) && !JSON.stringify(up).includes("Conversación inventada"));
ok("the old style example goes up masked (no name)", up.brain.style.grams["que maquina"].ex === "ayer con … en el bar, qué máquina" && !JSON.stringify(up).includes("Lucía"));

// Switch off: the next upload has no memory; this device keeps it.
await page.click('[data-act="nube-brain"]'); await page.waitForTimeout(200);
await syncNow();
up = cloud.puts.at(-1);
ok("switched off: the cloud copy has no memory any more", up && !("brain" in up) && up.settings.cloudBrain === false);
ok("…and this device keeps its memory", (await vault()).brain.claims.length === 2);
text = await page.textContent("#screen");
ok("the card says each device keeps its own", /Cada dispositivo guarda su propia memoria/.test(text));

// The other device uploads a change (without memory): this one downloads it and keeps its memory.
cloud.row = { ...cloud.row, rev: cloud.row.rev + 1, device: "Mac", data: { ...up, inbox: [...up.inbox, { id: "i2", text: "Tarea del Mac", kind: "TASK", at: "2026-11-09T09:00:00.000Z" }] } };
await syncNow();
v = await vault();
ok("download from the Mac: the new task arrives, the memory stays", v.inbox.some((x) => x.id === "i2") && v.brain?.claims?.length === 2);

// Back on and «Vaciar mi nube».
await page.click('[data-act="nube-brain"]'); await page.waitForTimeout(200); await syncNow();
ok("switched on again: the memory goes back up", cloud.puts.at(-1)?.brain?.claims?.length === 1);
ok("the local-only memory survived all of it", (await vault()).brain.claims.some((c) => c.id === "c2"));

// Authorize the memory about another person from Memoria: it travels from now on.
await page.click('[data-act="back"]'); await page.click('[data-sub="memoria"]'); await page.waitForTimeout(300);
await page.click('[data-act="mem-open"][data-id="c2"]'); await page.waitForTimeout(200);
ok("Memoria explains where it lives", /solo en este dispositivo salvo que lo autorices/.test(await page.textContent("#screen")));
await page.click('[data-act="mem-cloud"][data-id="c2"]'); await page.waitForTimeout(200);
await page.click('[data-act="back"]').catch(() => {}); await page.waitForTimeout(100);
await page.click('[data-sub="nube"]'); await page.waitForTimeout(200); await syncNow();
ok("authorized: it travels between devices", cloud.puts.at(-1)?.brain?.claims?.some((c) => c.id === "c2"));

// A conversation on this device (it must never go up, and must survive downloads).
await page.click('[data-tab="manu"]'); await page.fill("#msg", "hola, esto es una conversación inventada"); await page.press("#msg", "Enter"); await page.waitForTimeout(400);
await page.click('[data-tab="tu"]'); await page.click('[data-sub="nube"]'); await page.waitForTimeout(200);
// Conflict: the iPhone forgets c1 while the Mac uploads a change that still has it.
await page.click('[data-act="back"]'); await page.click('[data-sub="memoria"]'); await page.waitForTimeout(300);
await page.click('[data-act="mem-open"][data-id="c1"]'); await page.waitForTimeout(200);
await page.click('[data-act="mem-forget"][data-id="c1"]'); await page.waitForTimeout(300);
const macUp = { ...cloud.row.data, inbox: [...cloud.row.data.inbox, { id: "i3", text: "Otra tarea del Mac", kind: "TASK", at: "2026-11-09T09:30:00.000Z" }] };
cloud.row = { ...cloud.row, rev: cloud.row.rev + 1, device: "Mac", data: { ...macUp, brain: { ...macUp.brain, claims: [brain.claims[0], ...macUp.brain.claims.filter((c) => c.id !== "c1")] } } };
await page.click('[data-act="back"]').catch(() => {}); await page.click('[data-sub="nube"]'); await page.waitForTimeout(200); await syncNow();
ok("a real conflict is offered", (await page.locator('[data-act="nube-keep-local"]').count()) === 1);
const chatBefore = JSON.stringify((await vault()).chat);
await page.click('[data-act="nube-keep-remote"]'); await page.waitForTimeout(600);
v = await vault();
ok("«Traer la de la nube»: the Mac's task arrives but the forgotten memory does not come back", v.inbox.some((x) => x.id === "i3") && !v.brain.claims.some((c) => c.id === "c1"));
ok("…and this device's conversation is exactly as it was (the cloud has none)", JSON.parse(chatBefore).length > 0 && JSON.stringify(v.chat) === chatBefore);
await syncNow();
ok("after the conflict, the cloud copy has no forgotten memory either", !cloud.row.data.brain.claims.some((c) => c.id === "c1") && cloud.row.data.brain.forgotten.some((t) => t.id === "c1"));
await page.click('[data-act="nube-erase"]'); await page.waitForTimeout(600);
ok("«Vaciar mi nube» leaves an empty, marked copy in the cloud", cloud.row.data.erased && cloud.row.data.inbox.length === 0 && !cloud.row.data.brain && !JSON.stringify(cloud.row.data).includes("Tarea"));
const [st, token] = await nubeState();
v = await vault();
ok("this device keeps its data and is disconnected", v.inbox.length === 3 && v.brain.claims.length === 1 && token === null && st.erasedNotice?.self === true);
ok("the page says the cloud is empty", /Tu nube está vacía/.test(await page.textContent("#screen")));
await shot("02-vaciada");

// The other device (linked at an older rev) sees the mark: it keeps everything and disconnects.
const other = await device();
await other.page.waitForTimeout(600);
await other.page.click('[data-sub="nube"]').catch(() => {}); await other.page.waitForTimeout(300);
if (await other.page.locator('[data-act="nube-sync"]').count()) { await other.page.click('[data-act="nube-sync"]'); await other.page.waitForTimeout(600); }
const ov = await other.page.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
const otok = await other.page.evaluate(() => localStorage.getItem("manuos.nube.token"));
ok("the other device never applies the empty copy over its data", ov.inbox.length === 1 && ov.brain.claims.length === 2);
ok("…and disconnects with a notice", otok === null && /Tu nube está vacía/.test(await other.page.textContent("#screen")));

ok("no console errors", errors.length === 0 && other.errors.length === 0);
if (errors.length || other.errors.length) console.log([...errors, ...other.errors].join("\n"));
await other.ctx.close(); await ctx.close(); await browser.close();
console.log(fails ? `${fails} FAIL` : "ALL PASS");
