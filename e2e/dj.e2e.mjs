// WEB-123: panel de acciones y DJ de extremo a extremo con un Spotify FALSO que responde como la API
// real (Chromium emulando iPhone 14; NO es Safari real ni el Spotify de Manu). Datos inventados.
// Run: python3 -m http.server 8765 --directory web  &  node e2e/dj.e2e.mjs [carpeta-capturas]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2] ?? null;
const B = process.env.MANU_URL ?? "http://localhost:8765/";
let fails = 0, passes = 0;
const ok = (l, v, extra = "") => { if (v) passes++; else { fails++; console.log("FAIL", l, extra); } };
const SCOPES = "user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-recently-played user-top-read user-library-read playlist-read-private playlist-read-collaborative user-read-private";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

// ---- Spotify falso ----
function fakeSpotify() {
  const tr = (n, artist, genre) => ({ uri: `spotify:track:${n}`, id: n, name: `Canción ${n}`, duration_ms: 180000, popularity: 40, type: "track", artists: [{ uri: `spotify:artist:${artist}`, id: artist, name: `Artista ${artist}` }], album: { name: "Álbum de prueba", images: [{ url: `https://i.scdn.co/image/${n}` }] }, _genre: genre });
  const lib = [];
  for (const [a, g] of [["uno", "indie"], ["dos", "indie"], ["tres", "rock"], ["cuatro", "rock"], ["cinco", "jazz"], ["seis", "jazz"]]) for (let i = 1; i <= 6; i++) lib.push(tr(`${a}${i}`, a, g));
  const S = { calls: [], cur: null, progress: 0, playing: false, queue: [], devices: [{ id: "dev1", name: "iPhone de prueba", type: "Smartphone", is_active: true }] };
  const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
  const find = (uri) => lib.find((t) => t.uri === uri);
  S.handle = (url, method) => {
    const u = new URL(url), p = u.pathname.replace("/v1", "");
    S.calls.push(`${method} ${p}`);
    if (p === "/me") return json({ id: "yo", country: "ES" });
    if (p === "/me/playlists") return json({ items: [{ id: "pl1", name: "Playlist núcleo de prueba", owner: { id: "yo" }, collaborative: false, tracks: { total: 6 } }, { id: "pl2", name: "Compartida de prueba", owner: { id: "otra" }, collaborative: true, tracks: { total: 3 } }], next: null });
    if (p === "/playlists/pl1/tracks") return json({ items: lib.filter((t) => t.artists[0].id === "uno").map((track) => ({ track })), next: null });
    if (p === "/playlists/pl2/tracks") return json({ items: lib.filter((t) => t.artists[0].id === "cinco").slice(0, 3).map((track) => ({ track })), next: null });
    if (p.startsWith("/me/top/tracks")) return json({ items: lib.filter((t) => t.artists[0].id === "dos"), next: null });
    if (p.startsWith("/me/top/artists")) return json({ items: [{ uri: "spotify:artist:uno", id: "uno", name: "Artista uno", genres: ["indie"] }, { uri: "spotify:artist:dos", id: "dos", name: "Artista dos", genres: ["indie"] }], next: null });
    if (p === "/me/tracks") return json({ items: lib.filter((t) => t.artists[0].id === "tres").slice(0, 2).map((track) => ({ track })), next: null });
    if (p === "/me/player/recently-played") return json({ items: [] });
    if (p === "/artists") return json({ artists: u.searchParams.get("ids").split(",").map((id) => ({ uri: `spotify:artist:${id}`, id, genres: [lib.find((t) => t.artists[0].id === id)?._genre ?? "x"] })) });
    if (/^\/artists\/[^/]+\/top-tracks$/.test(p)) { const id = p.split("/")[2]; return json({ tracks: lib.filter((t) => t.artists[0].id === id) }); }
    if (/^\/artists\/[^/]+\/albums$/.test(p)) return json({ items: [] });
    if (p === "/search") return json({ tracks: { items: lib.filter((t) => ["cuatro", "seis"].includes(t.artists[0].id)) } });
    if (p === "/me/player/devices") return json({ devices: S.devices });
    if (p === "/me/player/shuffle") return { status: 204, body: "" };
    if (p === "/me/player/play" && method === "PUT") { const body = S.lastBody ? JSON.parse(S.lastBody) : {}; if (body.uris) { S.cur = body.uris[0]; S.queue = []; S.progress = 0; } S.playing = true; return { status: 204, body: "" }; }
    if (p === "/me/player/queue") { S.queue.push(u.searchParams.get("uri")); return { status: 204, body: "" }; }
    if (p === "/me/player/next") { S.cur = S.queue.shift() ?? null; S.progress = 0; return { status: 204, body: "" }; }
    if (p === "/me/player/pause") { S.playing = false; return { status: 204, body: "" }; }
    if (p === "/me/player/currently-playing") { if (!S.cur) return { status: 204, body: "" }; const t = find(S.cur); return json({ item: t, progress_ms: S.progress, is_playing: S.playing }); }
    return json({ error: { status: 404 } }, 404);
  };
  return S;
}

const browser = await chromium.launch();
async function open({ tokens = { access: "tok", refresh: "r", expires: Date.now() + 3600_000, scope: SCOPES }, S = fakeSpotify() } = {}) {
  const ctx = await browser.newContext({ ...devices["iPhone 14"], timezoneId: "Europe/Madrid" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.route(/^https:\/\/api\.spotify\.com\//, async (r) => { S.lastBody = r.request().postData(); await r.fulfill(S.handle(r.request().url(), r.request().method())); });
  await page.route(/^https:\/\/i\.scdn\.co\//, (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await page.route(/^https:\/\/([^/]*\.)?(open-meteo\.com|supabase\.co|googleapis\.com|google\.com|accounts\.spotify\.com|enablebanking\.com)\//, (r) => r.fulfill({ status: 503, body: "" }));
  await page.addInitScript(([tk]) => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1"); localStorage.setItem("manuos.nudged", JSON.stringify({ day: "x", ids: [] })); localStorage.setItem("manuos.vault", JSON.stringify({ schema: 1, settings: { skin: "mp" }, inbox: [], spending: [], chat: [] })); if (tk) localStorage.setItem("manuos.spotify.tokens", JSON.stringify(tk)); }, [tokens]);
  await page.goto(B); await page.waitForTimeout(500);
  return { ctx, page, errors, S };
}
const settle = (page) => page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch {} }));
const shot = async (page, name) => { if (out) { await page.waitForTimeout(300); await page.screenshot({ path: `${out}/${name}.png` }); } };

// 1. El panel de acciones en Hoy.
{
  const { ctx, page, errors } = await open();
  const tiles = await page.locator(".action-panel .action-tile").allInnerTexts();
  ok("Hoy abre con el panel de acciones", tiles.length >= 8, tiles.join(" | "));
  ok("el DJ es la primera acción", /DJ/.test(tiles[0] ?? ""));
  ok("las acciones tienen al menos 44 px", (await page.locator(".action-tile").evaluateAll((els) => els.every((e) => e.getBoundingClientRect().height >= 44))));
  ok("sin desborde", !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  await shot(page, "dj-panel-hoy");
  await page.click(".tile-semana"); await page.waitForTimeout(250);
  ok("Mi semana abre Agenda", /Tu semana/i.test(await page.locator("main").innerText()));
  await page.click('.tab[data-tab="hoy"]'); await page.waitForTimeout(200);
  await page.click(".tile-idea"); await page.waitForTimeout(250);
  ok("Idea abre la hoja de captura", (await page.locator("#qText").count()) === 1);
  ok("sin errores (panel)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 2. DJ de extremo a extremo.
{
  const { ctx, page, errors, S } = await open();
  await page.click(".tile-dj"); await page.waitForTimeout(300);
  for (let i = 0; i < 40 && !(await page.locator('[data-act="dj-play"]').count()); i++) await page.waitForTimeout(150);
  ok("el DJ prepara el catálogo y enseña Reproducir", (await page.locator('[data-act="dj-play"]').count()) >= 1, (await page.locator("main").innerText()).slice(0, 300));
  ok("no llama a endpoints retirados", !S.calls.some((c) => /recommendations|related-artists|audio-features|audio-analysis/.test(c)));
  ok("lee playlists, tops, guardadas, artistas y búsqueda", ["/me/playlists", "/me/top/tracks", "/me/tracks", "/artists", "/search"].every((p) => S.calls.some((c) => c.includes(p))));
  await page.click('.dj-play'); await page.waitForTimeout(600);
  ok("Reproducir manda a Spotify una canción del motor", S.calls.some((c) => c === "PUT /me/player/play") && S.cur, S.calls.slice(-5).join(","));
  ok("y encola la siguiente", S.queue.length === 1);
  const first = S.cur;
  ok("la pantalla dice qué suena", (await page.locator(".dj-now").innerText()).includes(`Canción ${first.split(":").pop()}`));
  await shot(page, "dj-sonando");
  // Tres saltos rápidos en Spotify.
  for (let i = 0; i < 3; i++) { S.progress = 3000; await page.waitForTimeout(3300); S.cur = S.queue.shift() ?? null; S.progress = 0; await page.waitForTimeout(3300); }
  const txt = await page.locator("main").innerText();
  ok("aprende los saltos", (txt.match(/saltada/g) ?? []).length >= 3, txt.slice(0, 500));
  ok("entra en modo búsqueda", /Buscando lo que te apetece/i.test(txt));
  ok("la cola se sigue rellenando", S.queue.length >= 1);
  // Deja sonar una entera → ancla.
  S.progress = 179000; await page.waitForTimeout(3300); S.cur = S.queue.shift(); S.progress = 0; await page.waitForTimeout(3300);
  ok("una que funciona fija el rollo", /En el rollo/i.test(await page.locator(".dj-hero").innerText()));
  ok("lo aprendido se guarda en el dispositivo", await page.evaluate(() => new Promise((res) => { const r = indexedDB.open("manuos-dj"); r.onsuccess = () => { const q = r.result.transaction("kv").objectStore("kv").get("log"); q.onsuccess = () => res((q.result ?? []).length > 5); }; r.onerror = () => res(false); })));
  await page.click('[data-act="dj-skip"]'); await page.waitForTimeout(900);
  ok("Siguiente desde MANU salta en Spotify", S.calls.includes("POST /me/player/next"));
  await page.click('[data-act="dj-office"]'); await page.waitForTimeout(200);
  ok("modo oficina activable", (await page.locator('[data-act="dj-office"]').getAttribute("aria-pressed")) === "true");
  await page.click('[data-act="dj-lang"][data-v="en"]'); await page.waitForTimeout(200);
  ok("marcar idioma de la que suena", (await page.locator('[data-act="dj-lang"][data-v="en"]').getAttribute("aria-pressed")) === "true");
  await page.click('[data-act="dj-only-en"]'); await page.waitForTimeout(200);
  ok("«Solo inglés» no se activa sin datos de idioma suficientes", (await page.locator('[data-act="dj-only-en"]').getAttribute("aria-pressed")) === "false");
  await shot(page, "dj-aprendiendo");
  await page.click('[data-act="back"]'); await page.waitForTimeout(250);
  ok("volver desde el DJ lleva a Hoy", (await page.locator(".action-panel").count()) === 1);
  ok("el panel dice qué suena", /Sonando:/.test(await page.locator(".tile-dj").innerText()));
  ok("sin errores (DJ)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 3. Sin Spotify conectado, o con permisos viejos.
{
  const a = await open({ tokens: null });
  await a.page.click(".tile-dj"); await a.page.waitForTimeout(400);
  ok("sin conexión pide conectar", /Conectar Spotify/i.test(await a.page.locator("main").innerText()));
  await a.ctx.close();
  const b = await open({ tokens: { access: "tok", refresh: "r", expires: Date.now() + 3600_000 } });
  await b.page.click(".tile-dj"); await b.page.waitForTimeout(400);
  ok("con permisos viejos pide dar permisos al DJ", /Dar permisos al DJ/i.test(await b.page.locator("main").innerText()));
  await b.ctx.close();
}
// 4. Sin dispositivo abierto: lo dice, no finge.
{
  const S = fakeSpotify(); S.devices = [];
  const { ctx, page } = await open({ S });
  await page.click(".tile-dj");
  for (let i = 0; i < 40 && !(await page.locator(".dj-play").count()); i++) await page.waitForTimeout(150);
  await page.click(".dj-play"); await page.waitForTimeout(600);
  ok("sin dispositivo pide abrir Spotify", /Abre Spotify|Abrir Spotify/i.test(await page.locator("main").innerText()) && !S.cur);
  await ctx.close();
}
await browser.close();
console.log(`dj.e2e: ${passes} ok, ${fails} fallos`);
process.exit(fails ? 1 : 0);
