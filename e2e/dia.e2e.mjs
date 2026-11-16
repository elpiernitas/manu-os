// WEB-115 · UX hecha para Manu: Hoy cambia con la hora, «Ahora» una sola cosa, trabajo que se
// guarda tras el cierre, fin de semana preguntado, ideas aparcadas, el porqué de cada proyecto,
// dinero en una línea y su forma de hablar. Chromium con emulación de iPhone (NO es Safari).
// Run: python3 -m http.server 8765 --directory web  &  node e2e/dia.e2e.mjs [carpeta-capturas]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
const B = process.env.MANU_URL ?? "http://localhost:8765/";
let fails = 0, passes = 0;
const ok = (l, v) => { if (v) passes++; else { fails++; console.log("FAIL", l); } };
const t = (d, h, m = 0) => new Date(`2026-11-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+01:00`).toISOString();
const seed = () => ({ schema: 1, chat: [], settings: {},
  inbox: [
    { id: "w1", text: "Enviar planos al cliente", status: "TASK", work: true, at: t(10, 9) },
    { id: "p1", text: "Llamar al taller", status: "TASK", at: t(11, 18) },
    { id: "i1", text: "Hacer un podcast de inmobiliaria", status: "IDEA", at: t(14, 20) },
  ],
  projects: [
    { id: "a", name: "Reforma baño", emoji: "🛁", why: "Tener la casa lista antes de Navidad", createdAt: t(1, 9), sources: [], chat: [] },
    { id: "b", name: "Web personal", emoji: "🌐", createdAt: t(14, 9), sources: [], chat: [] },
    { id: "c", name: "Curso de inglés", emoji: "🇬🇧", createdAt: t(13, 9), sources: [], chat: [] },
    { id: "d", name: "Viaje a Lisboa", emoji: "✈️", createdAt: t(12, 9), sources: [], chat: [] },
  ],
  spending: [{ id: "c1", at: t(2, 10), cents: 3120, merchant: "CAFE UNO", category: "FOOD_AND_DRINK", source: "BANK" }, { id: "c0", at: new Date("2026-10-02T10:00:00+01:00").toISOString(), cents: 3000, merchant: "CAFE UNO", category: "FOOD_AND_DRINK", source: "BANK" }],
  income: [] });
const browser = await chromium.launch();
async function open(when, { vault = seed(), tab = "hoy", opts = { ...devices["iPhone 14"] } } = {}) {
  const ctx = await browser.newContext({ timezoneId: "Europe/Madrid", ...opts });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|Applying inline style violates/.test(m.text())) errors.push(m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.clock.install({ time: new Date(when) });
  await page.route(/^https:\/\/([^/]*\.)?(open-meteo\.com|supabase\.co|googleapis\.com|google\.com|spotify\.com|enablebanking\.com|gstatic\.com)\//, (r) => r.fulfill({ status: 503, body: "" }));
  await page.addInitScript(([v, tb]) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); sessionStorage.setItem("manuos.tab", tb); localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); localStorage.setItem("manuos.vault", JSON.stringify(v)); }, [vault, tab]);
  await page.goto(B); await page.waitForTimeout(700);
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch {} }));
  return { ctx, page, errors };
}
const vaultOf = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("manuos.vault")));
const ctl = (p) => p.locator(".ctl").innerText();
const shot = async (p, n) => { if (out) { await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${n}.png` }); } };

// 1. Lunes 10:00 · Trabajo: «Ahora» es lo siguiente de trabajo.
{
  const { ctx, page, errors } = await open(t(16, 10));
  const c = await ctl(page);
  ok("10:00: la franja es Trabajo", /^Trabajo/i.test(c.trim()));
  ok("10:00: «Ahora» propone lo siguiente de trabajo", /Lo siguiente: Enviar planos al cliente/.test(c));
  ok("10:00: no propone proyectos parados en horario de trabajo", !/Diez minutos para/.test(c));
  const money = await page.evaluate(() => [...document.querySelectorAll(".ctl-title")].map((e) => e.textContent).find((x) => /^Llevas/.test(x)) ?? "");
  ok("10:00: dinero en una línea, con comparación y sin juzgar", /^Llevas 31,20 € este mes\. .*mes pasado/.test(money) && !/deberías|cuidado/i.test(money));
  await shot(page, "01-trabajo");
  // Una tarea apuntada en horario de trabajo queda como de trabajo (supuesto).
  await page.click('[data-tab="manu"]'); await page.fill("#msg", "tarea: revisar contrato de arras"); await page.press("#msg", "Enter"); await page.waitForTimeout(400);
  const nt = (await vaultOf(page)).inbox.find((i) => /contrato de arras/.test(i.text));
  ok("tarea nueva en horario de trabajo: marcada de trabajo como supuesto", nt?.work === true && nt?.workGuess === true);
  ok("10:00: sin errores", !errors.length);
  await ctx.close();
}

// 2. Lunes 13:20 · Desconexión → cerrar jornada → el trabajo desaparece hasta mañana.
{
  const { ctx, page, errors } = await open(t(16, 13, 20));
  ok("13:20: la franja es Desconexión", /^Desconexión/i.test((await ctl(page)).trim()));
  await page.click('[data-act="close-day"]'); await page.waitForTimeout(300);
  const c = await ctl(page);
  ok("cerrada la jornada: Tarde", /^Tarde/i.test(c.trim()));
  ok("y dice cuántas de trabajo esperan, sin enseñarlas", /1 de trabajo espera al próximo día laborable/.test(c));
  const screen = await page.locator("#screen").innerText();
  ok("la tarea de trabajo ya no sale en Hoy", !/Enviar planos al cliente/.test(screen) && /Llamar al taller/.test(screen));
  ok("«Ahora» propone lo tuyo, no el trabajo", !/Enviar planos/.test(c));
  // «Ahora no» aparta la propuesta por hoy.
  const first = await page.locator(".ctl-now-t").innerText();
  await page.click('.ctl-now [data-act="now-skip"]'); await page.waitForTimeout(250);
  ok("«Ahora no» la aparta y propone otra o ninguna", !(await page.locator(".ctl-now-t").count()) || (await page.locator(".ctl-now-t").innerText()) !== first);
  ok("13:20: sin errores", !errors.length);
  await shot(page, "02-tarde");
  await ctx.close();
}

// 3. Sábado 11:00 · Fin de semana: se pregunta; «Descanso» quita proyectos y pendientes no urgentes.
{
  const { ctx, page, errors } = await open(t(21, 11));
  let c = await ctl(page);
  ok("sábado: Fin de semana", /^Fin de semana/i.test(c.trim()));
  ok("sábado: pregunta si descansa o lo usa", /descansas o lo usas/.test(c));
  ok("sábado: sin trabajo", !/Enviar planos/.test(await page.locator("#screen").innerText()));
  await shot(page, "03-finde");
  await page.click('[data-act="weekend-plan"][data-v="descanso"]'); await page.waitForTimeout(250);
  c = await ctl(page);
  ok("descanso: ya no pregunta y lo dice", !/descansas o lo usas/.test(c) && /Toca descansar/.test(c));
  ok("descanso: sin proyectos parados", !/sin novedades|Diez minutos para/.test(c));
  const v = await vaultOf(page);
  ok("descanso: guardado solo para este fin de semana", Object.values(v.settings.weekendPlans ?? {}).includes("descanso"));
  ok("sábado: sin errores", !errors.length);
  await ctx.close();
}

// 4. Proyectos: idea aparcada → proyecto (avisa de la carga); porqué y paso de 10 minutos.
{
  const { ctx, page, errors } = await open(t(16, 18), { tab: "proyectos" });
  const txt = await page.locator("#screen").innerText();
  ok("ideas aparcadas visibles, con la carga actual", /Ideas aparcadas/i.test(txt) && /proyectos? con movimiento/.test(txt));
  await page.click('[data-act="idea-to-project"][data-id="i1"]'); await page.waitForTimeout(500);
  let v = await vaultOf(page);
  const np = v.projects.find((p) => /podcast/.test(p.name));
  ok("la idea se hace proyecto con su porqué", np && np.why === "Hacer un podcast de inmobiliaria");
  ok("la idea queda enlazada y fuera del aparcadero", v.inbox.find((i) => i.id === "i1").done === true);
  ok("se abre el proyecto con «Para qué lo empezaste»", (await page.inputValue("#pWhy")) === "Hacer un podcast de inmobiliaria");
  await page.fill("#pStep", "Escuchar dos episodios de referencia"); await page.click('#projStepForm button[type="submit"]'); await page.waitForTimeout(300);
  v = await vaultOf(page);
  ok("paso de 10 minutos apuntado como tarea del proyecto", v.inbox.some((i) => i.project === np.id && /Escuchar dos episodios/.test(i.text) && i.status === "TASK"));
  ok("proyectos: sin errores", !errors.length);
  await shot(page, "04-proyecto");
  await ctx.close();
}

// 5. Un proyecto parado recuerda para qué lo empezaste (por la tarde).
{
  const { ctx, page } = await open(t(16, 18));
  const c = await ctl(page);
  ok("proyecto parado: recuerda para qué lo empezaste", /Tener la casa lista antes de Navidad/.test(c));
  await ctx.close();
}

// 6. Tu forma de hablar: se guarda en Memoria.
{
  const { ctx, page, errors } = await open(t(16, 18), { tab: "tu" });
  await page.evaluate(() => { const b = document.createElement("button"); b.dataset.subGo = "memoria"; document.body.append(b); b.click(); b.remove(); }); await page.waitForTimeout(300);
  const form = page.locator("#memVoiceDesc");
  if (!(await form.isVisible())) await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
  await page.fill("#memVoiceDesc", "Directo, cercano, frases cortas, algo de ironía asturiana.");
  await page.click('#memVoiceForm button[type="submit"]'); await page.waitForTimeout(300);
  ok("forma de hablar guardada", (await vaultOf(page)).brain?.voice?.description === "Directo, cercano, frases cortas, algo de ironía asturiana.");
  ok("memoria: sin errores", !errors.length);
  await ctx.close();
}

// 7. Agenda: el chip 💼 cambia una tarea a trabajo; anchos de iPhone sin desbordes.
for (const w of [320, 375, 390, 430]) {
  const { ctx, page } = await open(t(16, 10), { opts: { viewport: { width: w, height: 760 }, isMobile: true, hasTouch: true } });
  const over = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  ok(`${w}px Hoy sin desbordar`, !(await over()));
  ok(`${w}px «Ahora» dentro de su tarjeta`, await page.evaluate(() => { const n = document.querySelector(".ctl-now"); if (!n) return true; return n.getBoundingClientRect().right <= n.closest(".card").getBoundingClientRect().right + 1; }));
  await page.click('[data-tab="agenda"]'); await page.waitForTimeout(250);
  ok(`${w}px Agenda sin desbordar`, !(await over()));
  if (w === 390) {
    await page.click('[data-act="task-work"][data-id="p1"]'); await page.waitForTimeout(200);
    ok("chip 💼: la tarea pasa a ser de trabajo", (await vaultOf(page)).inbox.find((i) => i.id === "p1").work === true);
    ok("chip 💼: 44 px de zona táctil", await page.evaluate(() => [...document.querySelectorAll(".work-chip")].every((e) => e.getBoundingClientRect().height >= 44 && e.getBoundingClientRect().width >= 44)));
  }
  await page.click('[data-tab="proyectos"]'); await page.waitForTimeout(250);
  ok(`${w}px Proyectos sin desbordar`, !(await over()));
  if (w === 320) await shot(page, "07-proyectos-320");
  await ctx.close();
}
await browser.close();
console.log(`dia.e2e: ${passes} correctas, ${fails} fallos`);
process.exit(fails ? 1 : 0);
