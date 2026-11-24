// DJ (WEB-123): el bucle con un Spotify falso, el catálogo y el adaptador. Datos ficticios.
import test from "node:test";
import assert from "node:assert/strict";
import { DjRunner } from "../dj/runner.js";
import { spotifyClient, toTrack, hasDjScopes, DJ_SCOPES } from "../dj/spotify.js";
import { buildCatalog, seedBrain, defaultRole } from "../dj/catalog.js";
import { applyLanguages, manualLanguageSource } from "../dj/language.js";
import { historyRows } from "../dj/history.js";
import { SPOTIFY_SCOPES } from "../core/spotify.js";
import { makeBrain, ids, FIX } from "./dj-helpers.js";

// Spotify falso: reproduce lo que le mandan, lleva su cola y avanza el tiempo a mano.
function fakeSpotify(catalog, { devices = [{ id: "d1", name: "iPhone de prueba", type: "Smartphone", is_active: true }] } = {}) {
  const f = { devList: devices, queueList: [], cur: null, progress: 0, playing: false, calls: [] };
  const item = (uri) => { const t = catalog.get(uri); return { uri, name: t.title, duration_ms: t.durationMs, artists: [{ uri: t.artistId, name: t.artistName }], album: { name: "x", images: [] }, type: "track" }; };
  Object.assign(f, {
    devices: async () => f.devList, shuffleOff: async () => null,
    play: async (uris) => { f.calls.push(["play", uris[0]]); f.cur = uris[0]; f.progress = 0; f.playing = true; f.queueList = []; },
    queue: async (uri) => { f.calls.push(["queue", uri]); f.queueList.push(uri); },
    current: async () => (f.cur ? { item: item(f.cur), progress_ms: f.progress, is_playing: f.playing } : null),
    next: async () => { f.advanceToNext(); }, pause: async () => { f.playing = false; }, resume: async () => { f.playing = true; },
    advanceToNext() { f.cur = f.queueList.shift() ?? null; f.progress = 0; },
    listen(ms) { f.progress += ms; const d = catalog.get(f.cur)?.durationMs ?? 0; if (f.progress >= d) f.advanceToNext(); },
  });
  return f;
}
const clockAt = (iso) => { let t = Date.parse(iso); return { now: () => t, add: (ms) => { t += ms; } }; };

test("Reproducir: el motor elige, Spotify suena y siempre hay una siguiente encolada", async () => {
  const b = makeBrain(), sp = fakeSpotify(b.catalog), c = clockAt("2026-03-04T18:00:00Z");
  const r = new DjRunner({ api: sp, brain: b, now: c.now });
  assert.equal(await r.start(), true);
  assert.equal(r.s.status, "playing");
  assert.equal(sp.calls[0][0], "play"); assert.ok(b.catalog.has(sp.calls[0][1]));
  assert.equal(sp.queueList.length, 1, "una en cola: lo que aprende se nota pronto");
  assert.equal(b.session.state, "START");
});

test("saltar 3 rápidas → SEARCHING; dejar sonar una → ancla y LOCKED_IN; la cola se rellena sola", async () => {
  const b = makeBrain(), sp = fakeSpotify(b.catalog), c = clockAt("2026-03-04T18:00:00Z");
  const r = new DjRunner({ api: sp, brain: b, now: c.now });
  await r.start();
  for (let i = 0; i < 3; i++) { c.add(3000); sp.listen(3000); await r.tick(); await sp.next(); c.add(500); await r.tick(); }
  assert.equal(b.session.state, "SEARCHING");
  assert.ok(r.s.played.filter((p) => !p.done).length >= 3);
  const playing = sp.cur;
  for (let k = 0; k < 80 && sp.cur === playing; k++) { c.add(3000); sp.listen(3000); await r.tick(); }
  await r.tick();
  assert.equal(b.session.state, "LOCKED_IN");
  assert.equal(b.session.anchor.id, playing, "la que dejaste sonar es el ancla");
  assert.ok(sp.queueList.length >= 1);
  const next = sp.queueList.at(-1);
  assert.notEqual(next, playing);
});

test("saltos en Spotify entre dos vistazos: las intermedias cuentan como saltos de 0 s", async () => {
  const b = makeBrain(), sp = fakeSpotify(b.catalog), c = clockAt("2026-03-04T18:00:00Z");
  const r = new DjRunner({ api: sp, brain: b, now: c.now });
  await r.start(); await r.setBuffer(3);
  const skipped = sp.queueList.slice(0, 2);
  await sp.next(); await sp.next(); await sp.next();
  c.add(3000); await r.tick();
  for (const uri of skipped) assert.ok(r.s.played.some((p) => p.uri === uri && !p.done && p.ms === 0), uri);
});

test("lo que pones tú en Spotify se aprende como elegido por ti, y el DJ sigue", async () => {
  const b = makeBrain(), sp = fakeSpotify(b.catalog), c = clockAt("2026-03-04T18:00:00Z");
  const r = new DjRunner({ api: sp, brain: b, now: c.now });
  await r.start();
  sp.cur = ids("a-doce")[3]; sp.progress = 0; sp.queueList = []; // Manu elige otra a mano
  c.add(3000); await r.tick();
  assert.equal(r.s.current.uri, ids("a-doce")[3]); assert.equal(r.s.current.ours, false);
  assert.equal(sp.queueList.length, 1, "vuelve a encolar");
});

test("si no hay nada sonando y se acabó la cola, el DJ continúa", async () => {
  const b = makeBrain(), sp = fakeSpotify(b.catalog), c = clockAt("2026-03-04T18:00:00Z");
  const r = new DjRunner({ api: sp, brain: b, now: c.now });
  await r.start(); sp.cur = null; sp.queueList = [];
  await r.tick();
  assert.ok(sp.cur, "pone otra");
});

test("sin dispositivo abierto, lo dice y no finge que suena", async () => {
  const b = makeBrain(), sp = fakeSpotify(b.catalog, { devices: [] });
  const r = new DjRunner({ api: sp, brain: b, now: () => Date.parse("2026-03-04T18:00:00Z") });
  assert.equal(await r.start(), false);
  assert.equal(r.s.status, "needs-device"); assert.match(r.s.message, /Abre Spotify/);
});

test("adaptador: permisos, conversión y nada de endpoints retirados", async () => {
  assert.equal(SPOTIFY_SCOPES, DJ_SCOPES, "un solo permiso para altavoz y DJ");
  assert.equal(hasDjScopes(DJ_SCOPES), true); assert.equal(hasDjScopes("user-read-playback-state user-modify-playback-state"), false); assert.equal(hasDjScopes(null), false);
  assert.equal(toTrack({ type: "episode", uri: "x" }), null);
  const t = toTrack({ uri: "spotify:track:prueba", name: "N", duration_ms: 1000, popularity: 50, artists: [{ uri: "spotify:artist:p", name: "A" }], album: { name: "Al", images: [{ url: "https://i.scdn.co/image/x" }] } }, { "spotify:artist:p": ["pop"] });
  assert.deepEqual([t.language, t.tags, t.popularity, t.image], ["unknown", ["pop"], 0.5, "https://i.scdn.co/image/x"]);
  const seen = [];
  const api = spotifyClient(async () => "tok", async (url, init) => { seen.push([init.method ?? "GET", url]); return { ok: true, status: 200, text: async () => JSON.stringify({ items: [], devices: [], tracks: { items: [] }, artists: [] }) }; });
  await buildCatalog(api, { now: Date.parse("2026-03-04T18:00:00Z") });
  const urls = seen.map(([, u]) => u).join(" ");
  assert.doesNotMatch(urls, /recommendations|related-artists|audio-features|audio-analysis/);
  await api.play(["spotify:track:x"], "d1"); await api.queue("spotify:track:y", "d1");
  assert.ok(seen.some(([m, u]) => m === "PUT" && /\/me\/player\/play\?device_id=d1/.test(u)));
  assert.ok(seen.some(([m, u]) => m === "POST" && /\/me\/player\/queue\?uri=spotify%3Atrack%3Ay&device_id=d1/.test(u)));
  const e401 = spotifyClient(async () => "tok", async () => ({ ok: false, status: 401, text: async () => "" }));
  await assert.rejects(e401.me(), (e) => e.code === "auth");
  const e403 = spotifyClient(async () => "tok", async () => ({ ok: false, status: 403, text: async () => "" }));
  await assert.rejects(e403.play(["x"]), /Premium/);
});

test("catálogo: playlists con semántica, tops, nuevas de tus artistas y artistas nuevos por género", async () => {
  const tr = (n, artist, pop = 50) => ({ uri: `spotify:track:${n}`, name: n, duration_ms: 200000, popularity: pop, artists: [{ uri: `spotify:artist:${artist}`, name: artist }], album: { name: "a", images: [] } });
  const pages = {
    "/me": { id: "yo", country: "ES" },
    "/me/playlists": { items: [{ id: "pn", name: "Núcleo", owner: { id: "yo" }, collaborative: false }, { id: "po", name: "Compartida", owner: { id: "otro" }, collaborative: true }] },
    "/playlists/pn/tracks": { items: [{ track: tr("n1", "arA") }] },
    "/playlists/po/tracks": { items: [{ track: tr("o1", "arO") }] },
    "/me/top/tracks": { items: [tr("t1", "arA")] },
    "/me/top/artists": { items: [{ uri: "spotify:artist:arA", id: "arA", name: "arA", genres: ["indie"] }] },
    "/me/tracks": { items: [{ track: tr("s1", "arB") }] },
    "/me/player/recently-played": { items: [{ track: tr("r1", "arB"), played_at: "2026-03-04T10:00:00Z" }] },
    "/artists": { artists: [{ uri: "spotify:artist:arB", genres: ["indie"] }, { uri: "spotify:artist:arO", genres: [] }] },
    "/artists/arA/top-tracks": { tracks: [tr("new1", "arA", 30)] },
    "/artists/arA/albums": { items: [{ id: "al1", name: "Nuevo", images: [] }] },
    "/albums/al1/tracks": { items: [{ ...tr("new2", "arA"), album: undefined }] },
    "/search": { tracks: { items: [tr("far1", "arZ")] } },
  };
  const api = spotifyClient(async () => "tok", async (url) => { const path = new URL(url).pathname.replace("/v1", ""); const body = pages[path] ?? { items: [] }; return { ok: true, status: 200, text: async () => JSON.stringify(body) }; });
  const cat = await buildCatalog(api, { roles: { pn: { role: "core" } }, now: Date.parse("2026-03-04T18:00:00Z") });
  const idsOf = new Set(cat.tracks.map((t) => t.id));
  for (const id of ["n1", "o1", "t1", "s1", "r1", "new1", "new2", "far1"]) assert.ok(idsOf.has(`spotify:track:${id}`), id);
  assert.deepEqual(cat.playlists.map((p) => p.role.role), ["core", "shared"], "la colaborativa es compartida por defecto");
  assert.deepEqual(defaultRole({ collaborative: false }), { role: "discovery" });
  const b = seedBrain(makeBrain(), cat, { at: "2026-03-04T18:00:00Z" });
  const ev = (id) => b.taste.tracks[`spotify:track:${id}`]?.personal ?? 0;
  assert.ok(ev("n1") >= 1 && ev("t1") > 0.5 && ev("o1") < 0.05, "núcleo fuerte, top moderado, compartida casi nada");
  assert.ok((b.taste.tracks["spotify:track:o1"].shared ?? 0) > 0);
  assert.equal(b.taste.tracks["spotify:track:far1"], undefined, "lo descubierto no tiene gusto inventado");
  assert.equal(b.session.lastAt, null, "sembrar no abre una sesión");
});

test("idioma: solo lo que marcas tú (nada inventado) y el filtro estricto lo respeta", () => {
  const b = makeBrain();
  for (const t of b.catalog.values()) t.language = "unknown";
  const tags = { [ids("a-seis")[0]]: "en", [ids("a-uno")[0]]: "es" };
  assert.equal(applyLanguages(b.catalog, [manualLanguageSource(tags)]), 2);
  b.process({ type: "explicit_preference", at: "2026-03-04T18:00:00Z", rule: { kind: "language", only: "en" } });
  const res = b.rank([...b.catalog.keys()], { at: "2026-03-04T18:00:00Z" });
  assert.deepEqual(res.ranked.map((x) => x.track.id), [ids("a-seis")[0]]);
});

test("historial importado: compacto, sin IP ni país", () => {
  const rows = historyRows([{ ts: "2026-01-05T15:20:00Z", ip_addr: "203.0.113.5", conn_country: "XX", platform: "ios", ms_played: 3000, master_metadata_track_name: "N", master_metadata_album_artist_name: "A", spotify_track_uri: "spotify:track:z", reason_end: "fwdbtn" }, { ts: "2026-01-05T15:10:00Z", ms_played: 9, master_metadata_track_name: "M", spotify_track_uri: "spotify:track:y", reason_end: "trackdone" }, { ts: "x" }]);
  assert.deepEqual(rows.map((r) => Object.keys(r).sort().join(",")), ["artist,done,ms,t,title,uri", "artist,done,ms,t,title,uri"]);
  assert.equal(rows[0].uri, "spotify:track:y", "ordenado por fecha");
  assert.doesNotMatch(JSON.stringify(rows), /203\.0|XX|ios/);
  const b = makeBrain();
  b.importListen({ id: "spotify:track:y", title: "M", artistId: "a", artistName: "A", durationMs: 0 }, { msPlayed: 200000, completed: true }, Date.parse("2026-01-05T15:10:00Z"));
  assert.ok(b.taste.tracks["spotify:track:y"].personal > 0);
});

test("retomar sin cortar: adopta lo que suena y encola la siguiente", async () => {
  const b = makeBrain();
  const sp = { devices: async () => [{ id: "d1", name: "x", type: "Smartphone", is_active: true }], current: async () => ({ item: { uri: ids("a-seis")[0], name: "N", duration_ms: 1000, artists: [{ uri: "a-seis", name: "A" }], type: "track" }, progress_ms: 40000, is_playing: true }), queue: async (u) => { sp.q.push(u); }, play: async () => { throw new Error("no debería cortar"); }, q: [] };
  const r = new DjRunner({ api: sp, brain: b, now: () => Date.parse("2026-03-04T18:00:00Z") });
  assert.equal(await r.attach(), true);
  assert.equal(r.s.current.uri, ids("a-seis")[0]); assert.equal(r.s.current.progress, 40000);
  assert.equal(sp.q.length, 1); assert.equal(r.s.status, "playing");
});
