// Pruebas de unidad: señales, máquina de estados, memorias, importador y persistencia. Datos ficticios.
import test from "node:test";
import assert from "node:assert/strict";
import { makeBrain, clock, listen, ids, all, FIX } from "./dj-helpers.js";
import { classifyListen } from "../dj/brain/signals.js";
import { validateEvent, EVENT_TYPES } from "../dj/brain/events.js";
import { DEFAULTS } from "../dj/brain/defaults.js";
import { DjBrain } from "../dj/brain/brain.js";
import { makeSemantics } from "../dj/brain/memory/playlists.js";
import { historyToEvents } from "../dj/history.js";
import { similarity } from "../dj/brain/similarity.js";

test("clasificación del salto según lo escuchado (§7.3)", () => {
  const k = (ms, dur = 200000, type = "track_skipped") => classifyListen({ type, msPlayed: ms, durationMs: dur }, DEFAULTS.skip).kind;
  assert.equal(k(3000), "skip_strong"); assert.equal(k(9000), "skip_moderate"); assert.equal(k(30000), "ambiguous");
  assert.equal(k(95000), "ambiguous", "entre 45 s y el 50 % sigue siendo ambiguo");
  assert.equal(k(120000), "accept"); assert.equal(k(180000), "accept_strong");
  assert.equal(k(0, 0, "track_completed"), "accept_strong"); assert.equal(k(0, 0, "track_repeated"), "repeat");
  assert.equal(classifyListen({ type: "track_skipped", msPlayed: 9000, durationMs: 200000 }, DEFAULTS.skip).quick, true);
  assert.equal(classifyListen({ type: "track_skipped", msPlayed: 12000, durationMs: 200000 }, DEFAULTS.skip).quick, false);
});

test("los nueve tipos de evento se validan", () => {
  assert.deepEqual(EVENT_TYPES, ["session_started", "session_ended", "track_started", "track_skipped", "track_completed", "track_repeated", "track_saved_to_playlist", "context_changed", "explicit_preference"]);
  assert.throws(() => validateEvent({ type: "otro", at: "2026-01-01T00:00:00Z" }), /desconocido/);
  assert.throws(() => validateEvent({ type: "track_skipped", at: "2026-01-01T00:00:00Z", trackId: "x" }), /msPlayed/);
  assert.throws(() => validateEvent({ type: "track_started", trackId: "x" }), /at/);
  assert.throws(() => validateEvent({ type: "track_saved_to_playlist", at: "2026-01-01T00:00:00Z", trackId: "x" }), /playlistId/);
  assert.throws(() => validateEvent({ type: "explicit_preference", at: "2026-01-01T00:00:00Z", rule: {} }), /rule.kind/);
  assert.throws(() => makeBrain().process({ type: "track_completed", at: "2026-01-01T00:00:00Z", trackId: "no-existe" }), /desconocida/);
});

test("START → STABLE → LOCKED_IN → FATIGUE → LOCKED_IN", () => {
  const b = makeBrain(), c = clock();
  b.process({ type: "session_started", at: c.now() });
  assert.equal(b.session.state, "START");
  listen(b, c, ids("a-seis")[0], "complete"); assert.equal(b.session.state, "START");
  listen(b, c, ids("a-seis")[1], "complete"); assert.equal(b.session.state, "STABLE");
  listen(b, c, ids("a-siete")[0], "complete"); assert.equal(b.session.state, "LOCKED_IN");
  listen(b, c, ids("a-seis")[2], "moderate");
  const r = listen(b, c, ids("a-siete")[1], "moderate");
  assert.equal(r.state, "FATIGUE"); assert.match(r.explanation.join(" "), /FATIGUE/);
  const r2 = listen(b, c, ids("a-doce")[0], "complete");
  assert.equal(r2.state, "LOCKED_IN"); assert.equal(b.session.anchor.id, ids("a-doce")[0]);
});

test("SEARCHING: 3 entra, 5 abre diversidad, 10 reinicia la dirección (con los filtros intactos)", () => {
  const b = makeBrain(), c = clock();
  b.process({ type: "session_started", at: c.now() });
  b.process({ type: "explicit_preference", at: c.now(), rule: { kind: "language", only: "en" } });
  for (const id of ids("a-seis").slice(0, 3)) listen(b, c, id, "complete");
  assert.equal(b.session.state, "LOCKED_IN");
  const pool = FIX.tracks.filter((t) => t.artistId !== "a-seis").map((t) => t.id);
  for (let i = 0; i < 3; i++) listen(b, c, pool[i], "quick");
  assert.equal(b.session.state, "SEARCHING"); assert.equal(b.session.diversity, 1);
  for (let i = 3; i < 5; i++) listen(b, c, pool[i], "quick");
  assert.equal(b.session.diversity, 2);
  for (let i = 5; i < 10; i++) listen(b, c, pool[i], "quick");
  assert.equal(b.session.diversity, 3); assert.equal(b.session.anchor, null, "dirección reiniciada");
  assert.equal(b.explicit.language.only, "en", "el filtro duro sigue");
  assert.ok(b.rank(all(), { at: c.now() }).ranked.every((x) => x.track.language === "en"));
});

test("un salto rápido repetido en días distintos sí pesa un poco a largo plazo", () => {
  const b = makeBrain(), c = clock();
  const x = ids("a-doce")[0];
  listen(b, c, x, "complete");
  const p0 = b.taste.tracks[x].personal;
  for (let d = 0; d < 3; d++) { b.process({ type: "session_started", at: c.days(1) }); listen(b, c, ids("a-seis")[d], "complete"); listen(b, c, x, "quick"); }
  assert.ok(b.taste.tracks[x].personal < p0, "patrón repetido en 3 días");
  assert.equal(b.taste.tracks[x].quickSkipDays.length, 3);
});

test("una sesión nueva tras un hueco largo; el contexto no reinicia nada", () => {
  const b = makeBrain(), c = clock();
  for (const id of ids("a-seis").slice(0, 3)) listen(b, c, id, "complete");
  assert.equal(b.session.state, "LOCKED_IN");
  const r = b.process({ type: "context_changed", at: c.add(10 * 60_000), context: { device: "iphone" } });
  assert.equal(r.state, "LOCKED_IN");
  const r2 = b.process({ type: "track_started", at: c.add(2 * 3600_000), trackId: ids("a-doce")[0] });
  assert.equal(r2.state, "START"); assert.match(r2.explanation.join(" "), /Hueco largo/);
});

test("semántica de playlists como datos, corregible con una regla explícita", () => {
  assert.throws(() => makeSemantics({ x: { role: "raro" } }), /rol desconocido/);
  assert.throws(() => makeSemantics({ x: { role: "mode" } }), /mode/);
  const b = makeBrain(), c = clock();
  b.process({ type: "explicit_preference", at: c.now(), rule: { kind: "playlist", playlistId: "pl-nueva", role: "shared" } });
  listen(b, c, ids("a-doce")[0], "complete", { playlistId: "pl-nueva" });
  assert.ok(b.taste.tracks[ids("a-doce")[0]].shared > 0, "ya cuenta como compartida");
  assert.ok(b.taste.tracks[ids("a-doce")[0]].personal < 0.02);
});

test("bloquear un artista es un filtro duro; «me encanta» sube su peso", () => {
  const b = makeBrain(), c = clock();
  b.process({ type: "explicit_preference", at: c.now(), rule: { kind: "artist", artistId: "a-cinco", stance: "block" } });
  b.process({ type: "explicit_preference", at: c.now(), rule: { kind: "artist", artistId: "a-doce", stance: "love" } });
  const res = b.rank(all(), { at: c.now() });
  assert.ok(res.ranked.every((x) => x.track.artistId !== "a-cinco"));
  assert.equal(res.ranked[0].track.artistId, "a-doce");
  assert.throws(() => b.process({ type: "explicit_preference", at: c.now(), rule: { kind: "artist", artistId: "x", stance: "odio" } }), /stance/);
});

test("similitud sin proveedor: etiquetas, rasgos y mismo artista", () => {
  const a = { id: "1", artistId: "x", tags: ["a", "b"] }, b = { id: "2", artistId: "y", tags: ["a", "b"] }, c = { id: "3", artistId: "x", tags: ["z"] };
  assert.equal(similarity(a, b), 1); assert.equal(similarity(a, c), 0.6);
  assert.ok(similarity({ id: "4", artistId: "p", tags: [], traits: { e: 1, v: 0 } }, { id: "5", artistId: "q", tags: [], traits: { e: 1, v: 0.1 } }) > 0.4);
});

test("exportar e importar el estado da el mismo ranking (para guardar datos reales en data/)", () => {
  const b = makeBrain(), c = clock();
  for (const id of ids("a-seis").slice(0, 3)) listen(b, c, id, "complete");
  b.process({ type: "explicit_preference", at: c.now(), rule: { kind: "language", only: "en" } });
  const b2 = DjBrain.fromState(JSON.parse(JSON.stringify(b.exportState())));
  const top = (x) => x.rank(all(), { at: c.now() }).ranked.slice(0, 10).map((y) => y.track.id);
  assert.deepEqual(top(b2), top(b));
  assert.throws(() => DjBrain.fromState({ version: 9 }), /no compatible/);
});

test("determinismo: el mismo escenario dos veces da lo mismo", () => {
  const run = () => { const b = makeBrain(), c = clock(); for (const [a, h] of [["a-uno", "quick"], ["a-dos", "quick"], ["a-tres", "quick"], ["a-seis", "complete"], ["a-siete", "complete"]]) listen(b, c, ids(a)[0], h); return JSON.stringify(b.nextBatch(all(), { at: c.now(), n: 10 }).batch.map((x) => [x.track.id, x.pool, x.score])); };
  assert.equal(run(), run());
});

test("importador local: descarta IP y país, ordena por fecha y crea eventos", () => {
  const recs = [
    { ts: "2026-01-05T15:20:00Z", platform: "ios", ms_played: 4000, conn_country: "XX", ip_addr: "203.0.113.9", master_metadata_track_name: "Canción B", master_metadata_album_artist_name: "Artista Ficticio", spotify_track_uri: "uri:ficticia:b", reason_end: "fwdbtn" },
    { ts: "2026-01-05T15:10:00Z", platform: "cast_to_device", ms_played: 200000, ip_addr: "203.0.113.9", master_metadata_track_name: "Canción A", master_metadata_album_artist_name: "Artista Ficticio", spotify_track_uri: "uri:ficticia:a", reason_end: "trackdone" },
    { ts: "2026-01-05T16:00:00Z", episode_name: "Un podcast", ms_played: 1000 },
  ];
  const out = historyToEvents(recs);
  const txt = JSON.stringify(out);
  assert.ok(!/203\.0\.113|conn_country|ip_addr|"XX"/.test(txt), "nada de IP ni país");
  assert.deepEqual(out.events.map((e) => e.type), ["track_started", "track_completed", "track_started", "track_skipped"]);
  assert.equal(out.events[0].source.device, "cast");
  const b = new DjBrain({ catalog: out.catalog });
  for (const e of out.events) b.process(e);
  assert.equal(b.taste.tracks["uri:ficticia:a"].plays, 1);
});
