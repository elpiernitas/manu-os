// E2E del prototipo HORIZONTE (web/vivo). Solo datos inventados; no toca red ni el vault real.
// Uso: python3 -m http.server 8766 --directory web/vivo &  →  node e2e/vivo.e2e.mjs [--capturas]
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(execSync("npm root -g").toString().trim() + "/playwright");
const B = process.env.VIVO_URL ?? "http://localhost:8766/", CAP = process.argv.includes("--capturas");
let ok = 0, mal = 0;
const t = (n, c) => { if (c) ok++; else { mal++; console.log("  ✗", n); } };
const b = await chromium.launch();
const errores = [], fuera = [];
async function pagina(opt) {
  const ctx = await b.newContext(opt); const p = await ctx.newPage();
  await p.addInitScript(() => localStorage.setItem("manuos.vault", '{"centinela":1}'));
  p.on("pageerror", (e) => errores.push(e.message)); p.on("console", (m) => m.type() === "error" && errores.push(m.text()));
  p.on("request", (r) => { if (!r.url().startsWith(B)) fuera.push(r.url()); });
  return p;
}
const iphone = { ...devices["iPhone 14"] };
const p = await pagina({ ...iphone, reducedMotion: "reduce" });

// 1. Las siete vistas pintan y la navegación marca dónde estás.
for (const [v, re] of [["hoy", /MANU/], ["bahia", /pueblo/], ["manu", /Hablar/i], ["dinero", /Mareas/], ["proyectos", /Astillero/], ["tu", /Bitácora/], ["agenda", /Tabla de mareas/]]) {
  await p.goto(`${B}?hora=10:30&tiempo=despejado#${v}`);
  await p.waitForSelector(".fondo");
  t(`vista ${v}`, re.test(await p.locator("main").innerText()));
  t(`${v}: marcado como demo`, (await p.locator(".demo").count()) > 0);
  t(`${v}: sin desbordar a lo ancho`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
await p.goto(`${B}?hora=10:30&tiempo=despejado#hoy`);
await p.click('#dique [data-ir="dinero"]');
t("el dique navega", (await p.locator('#dique [aria-current="page"]').innerText()).toLowerCase().includes("dinero"));

// 2. El cielo sigue a la hora: mediodía claro, noche oscura; el dial lo mueve.
await p.goto(`${B}?hora=12:00&tiempo=despejado#hoy`);
t("mediodía: tema de día", (await p.getAttribute("html", "data-tema")) === "dia");
await p.locator("#dial").fill("1380"); await p.locator("#dial").dispatchEvent("change");
t("dial a las 23:00: tema de noche y luna", (await p.getAttribute("html", "data-tema")) === "noche" && (await p.getAttribute("html", "data-astro")) === "luna");
t("el titular cambia con la hora", /hecho/.test(await p.locator(".titular").innerText()));
await p.click('[data-act="dial-ahora"]');
await p.click('[data-act="tiempo-ciclo"]');
t("el tiempo de demo cambia", (await p.getAttribute("html", "data-tiempo")) !== "despejado");

// 3. La botella: MANU propone, Manu decide.
t("hay botella", (await p.locator(".botella").count()) === 1);
await p.click('[data-act="botella-tirar"]');
t("devuelta al mar: desaparece", (await p.locator(".botella").count()) === 0);

// 4. MANU: zasca con pruebas, no saber, contradicción.
await p.goto(`${B}?hora=22:00#manu`);
await p.fill("#decir", "¿estoy ahorrando?"); await p.press("#decir", "Enter");
await p.waitForSelector(".cara-zasca");
t("zasca con recibo", (await p.locator(".recibo li").count()) >= 2 && (await p.locator(".sello-hipotesis").count()) >= 1);
await p.click('[data-act="zasca-touche"]');
await p.click('[data-act="decir"][data-id="¿Qué me regalo por Reyes?"]');
await p.waitForSelector(".el-niebla");
t("admite que no sabe", /no lo sé/i.test(await p.locator(".el-niebla").innerText()));

// 5. Constelación: dos estrellas, un hilo; olvidar pide dos toques y deja lápida.
await p.click('[data-act="manu-modo"][data-id="cielo"]');
const n0 = await p.locator(".estrella").count();
await p.locator('.estrella[data-id="m3"]').focus(); await p.keyboard.press("Enter");
await p.locator('.estrella[data-id="m4"]').focus(); await p.keyboard.press("Enter");
t("dos estrellas elegidas con teclado y su hilo", (await p.locator(".recuerdo").count()) === 2 && /trabajo/.test(await p.locator(".hilo-texto").innerText()));
await p.click('.recuerdo [data-act="mem-olvidar"][data-id="m4"]');
t("olvidar no borra al primer toque", (await p.locator(".estrella").count()) === n0);
await p.click('.recuerdo [data-act="mem-olvidar"][data-id="m4"]');
t("al segundo, sí", (await p.locator(".estrella").count()) === n0 - 1);
await p.click('#dique [data-ir="tu"]');
t("la bitácora cuenta lo borrado", (await p.locator("#h-olv + .cifra-n").innerText()).trim() === "1");
await p.click('.frase[data-id="m5"]'); await p.click('dialog [data-act="mem-confirmar"]');
t("confirmar una sospecha la vuelve certeza", (await p.locator('.frase-sabe[data-id="m5"]').count()) === 1);

// 6. Dinero: estados del banco y la importación con confirmación y sin duplicados.
await p.click('#dique [data-ir="dinero"]');
t("hecho e hipótesis conviven", (await p.locator(".hallazgos .sello-hecho").count()) >= 2 && (await p.locator(".hallazgos .sello-hipotesis").count()) >= 1);
for (const e of ["desconectado", "caducado", "error", "cargando", "conectado"]) { await p.selectOption('[data-input="banco"]', e); t(`banco: estado ${e}`, (await p.locator(".banco").innerText()).length > 40); }
await p.click('[data-act="importar"]');
t("importar pide confirmación", await p.locator("dialog[open]").isVisible());
await p.click('[data-act="cerrar-hoja"] >> nth=-1');
t("«ahora no» no importa nada", (await p.locator(".resultado").count()) === 0);
await p.click('[data-act="importar"]'); await p.click('[data-act="importar-si"]');
await p.waitForSelector(".resultado");
t("3 nuevos, 14 repetidos", /3 nuevos.*14 repetidos/.test(await p.locator(".resultado").innerText()));
await p.click('[data-act="importar"]'); await p.click('[data-act="importar-si"]'); await p.waitForFunction(() => /0 nuevos/.test(document.querySelector(".resultado")?.textContent ?? ""));
t("segunda vez: nada duplicado", true);
await p.click('[data-act="noche-si"]');
t("la fiesta solo es un recuerdo si Manu lo dice", /Me dijiste/.test(await p.locator(".noche").innerText()));

// 7. Astillero: botar solo cuando está terminado; el barco aparece en la Bahía.
await p.click('#dique [data-ir="proyectos"]');
await p.click('[data-act="proyecto"][data-id="p1"]');
t("faltan piezas: no se puede botar", await p.locator('[data-act="botar"]').isDisabled());
await p.check('[data-tid="t4"]');
await p.click('dialog [data-act="botar"]');
t("botadura", /Ya flota/.test(await p.locator(".botadura").innerText()));
await p.click('.botadura [data-ir="bahia"]');
t("dos barcos en la bahía", (await p.locator(".bahia .barco").count()) === 2);
await p.locator('.lugar[data-id="gaviota"]').focus(); await p.keyboard.press("Enter");
t("la gaviota", /bocadillo/.test(await p.locator(".titular").innerText()));

// 8. Agenda y sonda.
await p.goto(`${B}#agenda`);
await p.click(".dia >> nth=3"); t("día vacío: estado propio", /Día en blanco/.test(await p.locator(".dia-detalle").innerText()));
await p.click('[data-act="cita-nueva"]'); await p.fill('dialog [name="title"]', "Probar el prototipo"); await p.click("dialog form .boton");
t("cita añadida", /Probar el prototipo/.test(await p.locator(".dia-detalle").innerText()));
await p.keyboard.press("Control+k"); await p.fill("#sonda", "logo");
t("la sonda encuentra por capas", (await p.locator(".sonda-capa").count()) >= 2);
await p.fill("#sonda", "zzzz"); t("y dice cuando no hay fondo", /no toca nada/.test(await p.locator("#sonda-res").innerText()));
await p.keyboard.press("Escape");

// 9. Accesibilidad básica y privacidad.
await p.goto(`${B}?hora=10:30&tiempo=despejado#hoy`);
const peq = await p.evaluate(() => [...document.querySelectorAll("button, a, select, input")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 32 || r.width < 32) && !e.closest(".oculto") && e.type !== "hidden"; }).map((e) => e.outerHTML.slice(0, 70)));
t(`controles táctiles ≥ 32 px (${peq.join(" | ")})`, peq.length === 0);
t("un solo h1", (await p.locator("h1").count()) === 1);
t("el vault real no se toca", (await p.evaluate(() => localStorage.getItem("manuos.vault"))) === '{"centinela":1}');
t(`ninguna petición fuera del prototipo (${fuera.join(", ")})`, fuera.length === 0);
t(`sin errores de consola (${errores.join(" | ")})`, errores.length === 0);

// 10. 320 px y Mac.
const s = await pagina({ viewport: { width: 320, height: 568 }, hasTouch: true });
for (const v of ["hoy", "manu", "dinero", "bahia", "proyectos", "tu", "agenda"]) { await s.goto(`${B}?hora=10:30#${v}`); await s.waitForSelector(".fondo"); t(`320 px ${v}: sin desbordar`, await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
const m = await pagina({ viewport: { width: 1440, height: 900 } });
await m.goto(`${B}?hora=10:30&tiempo=despejado#hoy`);
t("Mac: muelle lateral con Agenda y Sonda", (await m.locator("#dique .solo-mac:visible").count()) === 2 && (await m.locator("#dique").boundingBox()).height > 800);
t("Mac: dos columnas", await m.evaluate(() => getComputedStyle(document.querySelector(".rejilla")).gridTemplateColumns.split(" ").length === 2));

if (CAP) {
  const c = await pagina({ ...iphone }), dir = new URL("../web/vivo/capturas/", import.meta.url).pathname;
  for (const [f, u] of [["iphone-hoy-manana", "?hora=10:30&tiempo=despejado#hoy"], ["iphone-hoy-lluvia", "?hora=13:00&tiempo=lluvia#hoy"], ["iphone-hoy-ocaso", "?hora=17:50&tiempo=despejado#hoy"], ["iphone-manu", "?hora=22:30&tiempo=despejado#manu"], ["iphone-dinero", "?hora=11:00&tiempo=nubes#dinero"], ["iphone-bahia-noche", "?hora=22:00&tiempo=despejado#bahia"], ["iphone-bahia-dia", "?hora=12:00&tiempo=despejado#bahia"], ["iphone-astillero", "?hora=12:00&tiempo=despejado#proyectos"], ["iphone-bitacora", "?hora=16:00&tiempo=niebla#tu"], ["iphone-agenda", "?hora=9:00&tiempo=despejado#agenda"]]) { await c.goto(B + u); await c.waitForTimeout(900); await c.screenshot({ path: `${dir}${f}.png` }); }
  await c.goto(`${B}?hora=22:30#manu`); await c.click('[data-act="manu-modo"][data-id="cielo"]'); await c.click('.estrella[data-id="m3"]'); await c.click('.estrella[data-id="m9"]'); await c.locator(".cons").scrollIntoViewIfNeeded(); await c.waitForTimeout(500); await c.screenshot({ path: `${dir}iphone-constelacion.png` });
  await c.goto(`${B}?hora=22:31#manu`); await c.click('[data-act="decir"] >> nth=0'); await c.waitForSelector(".cara-zasca"); await c.click(".recibo summary"); await c.waitForTimeout(700); await c.screenshot({ path: `${dir}iphone-zasca.png` });
  await c.goto(`${B}?hora=11:00#dinero`); await c.locator(".noche").scrollIntoViewIfNeeded(); await c.waitForTimeout(400); await c.screenshot({ path: `${dir}iphone-noche.png` });
  await c.goto(`${B}?hora=12:00&tiempo=despejado#proyectos`); await c.click('[data-act="proyecto"][data-id="p1"]'); await c.check('[data-tid="t4"]'); await c.click('dialog [data-act="botar"]'); await c.waitForTimeout(2300); await c.screenshot({ path: `${dir}iphone-botadura.png` });
  for (const [f, u] of [["mac-hoy", "?hora=10:30&tiempo=despejado#hoy"], ["mac-dinero", "?hora=21:30&tiempo=despejado#dinero"], ["mac-bahia", "?hora=18:05&tiempo=despejado#bahia"]]) { await m.goto(B + u); await m.waitForTimeout(900); await m.screenshot({ path: `${dir}${f}.png` }); }
}
await b.close();
console.log(`vivo.e2e: ${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
