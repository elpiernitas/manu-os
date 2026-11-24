// DJ (WEB-123). Los 12 criterios de aceptación de DJ-BRAIN-00 §25. Datos ficticios.
import test from "node:test";
import assert from "node:assert/strict";
import { makeBrain, clock, listen, ids, all, FIX } from "./dj-helpers.js";
import { personalFit } from "../dj/brain/scoring.js";
import { PlaylistRefresher } from "../dj/brain/playlistRefresh.js";
import { personalAt } from "../dj/brain/memory/taste.js";

const pf = (b, id, at) => personalFit(b.catalog.get(id), b, Date.parse(at)).value;

test("1 · tres saltos rápidos no degradan permanentemente a los artistas", () => {
  const b = makeBrain(), c = clock();
  for (let d = 0; d < 4; d++) { for (const a of ["a-uno", "a-dos", "a-tres"]) listen(b, c, ids(a)[d], "complete"); c.days(1); }
  b.process({ type: "session_started", at: c.now() });
  const before = Object.fromEntries(["a-uno", "a-dos", "a-tres"].map((a) => [a, pf(b, ids(a)[4], c.now())]));
  listen(b, c, ids("a-uno")[4], "quick"); listen(b, c, ids("a-dos")[4], "quick"); const r = listen(b, c, ids("a-tres")[4], "quick");
  assert.equal(r.state, "SEARCHING");
  assert.match(r.explanation.join(" "), /no los artistas/);
  b.process({ type: "session_ended", at: c.now() });
  for (const a of ["a-uno", "a-dos", "a-tres"]) {
    const after = pf(b, ids(a)[4], c.now());
    assert.ok(after >= before[a] * 0.99, `${a}: ${before[a].toFixed(3)} → ${after.toFixed(3)}`);
  }
});

test("2 · una canción aceptada tras una racha de saltos cambia la dirección", () => {
  const b = makeBrain(), c = clock();
  b.process({ type: "session_started", at: c.now() });
  for (const id of [ids("a-uno")[0], ids("a-dos")[0], ids("a-tres")[0]]) listen(b, c, id, "quick");
  assert.equal(b.session.state, "SEARCHING");
  const r = listen(b, c, ids("a-seis")[0], "complete"); // rock con guitarras
  assert.equal(r.state, "LOCKED_IN");
  assert.equal(b.session.anchor.id, ids("a-seis")[0]);
  const res = b.rank(all(), { at: c.now() });
  const top = res.ranked.slice(0, 5).map((x) => x.track);
  assert.ok(top.every((t) => t.tags.some((g) => ["rock", "guitarras"].includes(g))), top.map((t) => t.id).join(","));
  const pos = (id) => res.ranked.findIndex((x) => x.track.id === id);
  assert.ok(pos(ids("a-siete")[0]) < pos(ids("a-uno")[1]), "el rock cercano va por delante del indie-pop que fallaba");
});

test("3 · la música compartida (oficina) no domina; con señal independiente sí cuenta", () => {
  const b = makeBrain(), c = clock("2026-03-04T15:00:00Z");
  for (let i = 0; i < 30; i++) listen(b, c, ids("a-once")[i % 5], "complete", { playlistId: "pl-oficina" });
  c.days(1);
  for (let i = 0; i < 3; i++) listen(b, c, ids("a-doce")[i], "complete");
  b.process({ type: "session_started", at: c.days(1) });
  const res = b.rank(all(), { at: c.now() });
  const top10 = res.ranked.slice(0, 10).map((x) => x.track.artistId);
  assert.ok(!top10.includes("a-once"), `oficina en el top 10: ${top10}`);
  assert.ok(personalAt(b.taste.tracks[ids("a-once")[0]], Date.parse(c.now()), b.config.taste) < personalAt(b.taste.tracks[ids("a-doce")[0]], Date.parse(c.now()), b.config.taste));
  // Señal independiente: la guarda en su playlist núcleo → sí es gusto personal.
  b.process({ type: "track_saved_to_playlist", at: c.add(1000), trackId: ids("a-once")[0], playlistId: "pl-nucleo" });
  const res2 = b.rank(all(), { at: c.now() });
  assert.ok(res2.ranked.slice(0, 5).some((x) => x.track.id === ids("a-once")[0]));
});

test("4 · añadir a la playlist núcleo aumenta mucho la evidencia personal", () => {
  const b = makeBrain(), c = clock();
  const [x, y] = [ids("a-doce")[0], ids("a-trece")[0]];
  listen(b, c, x, "complete");
  b.process({ type: "track_saved_to_playlist", at: c.now(), trackId: y, playlistId: "pl-nucleo" });
  const t = Date.parse(c.now());
  const ex = personalAt(b.taste.tracks[x], t, b.config.taste), ey = personalAt(b.taste.tracks[y], t, b.config.taste);
  assert.ok(ey >= ex * 4, `núcleo ${ey} vs escucha completa ${ex}`);
  assert.ok(pf(b, y, c.now()) > 0.85);
});

test("5 · añadir a una playlist de modo aumenta sobre todo la afinidad con ese modo", () => {
  const b = makeBrain(), c = clock();
  const sad = ids("a-nueve")[0], core = ids("a-doce")[0];
  b.process({ type: "track_saved_to_playlist", at: c.now(), trackId: sad, playlistId: "pl-triste" });
  b.process({ type: "track_saved_to_playlist", at: c.now(), trackId: core, playlistId: "pl-nucleo" });
  const rs = b.taste.tracks[sad];
  assert.equal(rs.modes.triste, 1);
  assert.ok(rs.personal < b.taste.tracks[core].personal / 5, "poca evidencia personal");
  const pos = (res, id) => res.ranked.findIndex((x) => x.track.id === id);
  const normal = b.rank(all(), { at: c.now() });
  assert.ok(pos(normal, core) < pos(normal, sad), "fuera del modo, la de modo no manda");
  b.process({ type: "explicit_preference", at: c.add(1000), rule: { kind: "mode", mode: "triste" } });
  const sadMode = b.rank(all(), { at: c.now() });
  assert.equal(sadMode.ranked[0].track.id, sad, "con el modo activo, sí");
  assert.equal(sadMode.ranked[0].pool, "Contextual");
});

test("6 · el histórico antiguo no supera una corrección explícita reciente", () => {
  const b = makeBrain(), c = clock("2021-03-01T10:00:00Z");
  for (let d = 0; d < 60; d++) { listen(b, c, ids("a-cuatro")[d % 5], "complete"); c.days(3); }
  const at = "2026-11-20T10:00:00Z";
  b.process({ type: "explicit_preference", at, rule: { kind: "artist", artistId: "a-cuatro", stance: "not_now" } });
  const res = b.rank(all(), { at });
  const best = res.ranked.findIndex((x) => x.track.artistId === "a-cuatro");
  assert.ok(best >= res.ranked.length - 6, `el artista corregido sigue arriba (puesto ${best})`);
  assert.equal(res.ranked[best].factors.personal.stance, "not_now");
});

test("7 · puede recomendar música nunca escuchada", () => {
  const b = makeBrain(), c = clock();
  for (const id of ids("a-uno").slice(0, 3)) listen(b, c, id, "complete");
  b.process({ type: "track_saved_to_playlist", at: c.now(), trackId: ids("a-uno")[0], playlistId: "pl-nucleo" });
  const { batch } = b.nextBatch(all(), { at: c.now(), n: 10 });
  const novel = batch.filter((x) => x.factors.discovery.novel);
  assert.ok(novel.length >= 5, `nuevas: ${novel.length}`);
  assert.ok(batch.some((x) => x.pool === "FarDiscovery"), "también descubrimiento lejano (anti-burbuja)");
});

test("8 · tras un artista nuevo que funciona, profundiza en su catálogo sin monopolizar", () => {
  const b = makeBrain(), c = clock();
  b.process({ type: "session_started", at: c.now() });
  listen(b, c, ids("a-doce")[0], "complete");
  let r = listen(b, c, ids("a-trece")[0], "complete");
  assert.match(r.explanation.join(" "), /new_artist_hit/);
  listen(b, c, ids("a-doce")[1], "complete");
  r = listen(b, c, ids("a-trece")[2], "complete");
  assert.match(r.explanation.join(" "), /ArtistDeepDive abierto/);
  const { batch } = b.nextBatch(all(), { at: c.now(), n: 10 });
  const mine = batch.filter((x) => x.track.artistId === "a-trece");
  assert.ok(mine.length >= 2 && mine.length <= 4, `del artista nuevo: ${mine.length}`);
  assert.ok(mine.every((x) => x.pool === "ArtistDeepDive"));
  for (let i = 1; i < batch.length; i++) assert.notEqual(batch[i].track.artistId === "a-trece" && batch[i - 1].track.artistId === "a-trece", true, "nunca dos seguidas");
  const pops = mine.map((x) => x.track.popularity);
  assert.ok(pops[0] <= Math.max(...pops), "prefiere lo menos obvio primero");
});

test("9 · un filtro de idioma estricto no se salta por el ranking", () => {
  const b = makeBrain(), c = clock();
  const loved = ids("a-tres")[0]; // bilingüe
  for (let i = 0; i < 5; i++) b.process({ type: "track_saved_to_playlist", at: c.add(1000), trackId: loved, playlistId: "pl-nucleo" });
  b.process({ type: "explicit_preference", at: c.now(), rule: { kind: "language", only: "en" } });
  const res = b.rank(all(), { at: c.now() });
  assert.ok(res.ranked.every((x) => x.track.language === "en"), "solo inglés");
  assert.ok(res.excluded.some((x) => x.id === loved && /multi/.test(x.why)));
  for (const lang of ["es", "multi", "unknown", "instrumental"]) assert.ok(res.excluded.some((x) => b.catalog.get(x.id).language === lang), `${lang} excluido`);
  const { batch } = b.nextBatch(all(), { at: c.now(), n: 20 });
  assert.ok(batch.every((x) => x.track.language === "en"));
  b.process({ type: "explicit_preference", at: c.add(1000), rule: { kind: "language", only: "en", instrumental: "allow" } });
  assert.ok(b.rank(all(), { at: c.now() }).ranked.some((x) => x.track.language === "instrumental"), "política de instrumentales configurable");
});

test("10 · las recomendaciones de playlist se pueden refrescar repetidamente", () => {
  const b = makeBrain(), c = clock();
  const ref = new PlaylistRefresher(b, "pl-nucleo", ids("a-uno").slice(0, 2));
  const seen = new Set();
  for (let round = 0; round < 12; round++) {
    const more = ref.more(5, { at: c.add(60_000) });
    assert.equal(more.length, 5, `ronda ${round}`);
    for (const t of more) { assert.ok(!seen.has(t.id), `repetida ${t.id}`); seen.add(t.id); }
    ref.add(more[0].id, c.now()); for (const t of more.slice(1)) ref.reject(t.id);
  }
  assert.equal(seen.size, 60);
  // Se acaba el catálogo inédito: tras el tiempo de espera vuelve lo enseñado y no rechazado.
  const later = ref.more(5, { at: c.days(31) });
  assert.ok(later.length > 0 && later.every((t) => !ref.rejected.has(t.id)));
});

test("11 · gusto alto con fatiga alta deja de recomendarse un tiempo sin perder el gusto", () => {
  const b = makeBrain(), c = clock();
  const fav = ids("a-doce")[0];
  b.process({ type: "track_saved_to_playlist", at: c.now(), trackId: fav, playlistId: "pl-nucleo" });
  for (let d = 0; d < 3; d++) { b.process({ type: "session_started", at: c.days(1) }); listen(b, c, ids("a-seis")[d], "complete"); listen(b, c, fav, "moderate"); }
  const t = Date.parse(c.now());
  assert.ok(personalAt(b.taste.tracks[fav], t, b.config.taste) > 0.8, "el gusto base sigue alto");
  const res = b.rank(all(), { at: c.add(4 * 3600_000) });
  const f = res.ranked.find((x) => x.track.id === fav);
  assert.ok(f.factors.fatigue.fatigue >= b.config.fatigue.threshold, `fatiga ${f.factors.fatigue.fatigue}`);
  assert.ok(res.ranked.indexOf(f) > 20, "ahora no se recomienda");
  const res2 = b.rank(all(), { at: c.days(21) });
  assert.ok(res2.ranked.findIndex((x) => x.track.id === fav) < 3, "pasado un tiempo vuelve arriba");
});

test("12 · un cambio de dispositivo no reinicia el rollo de la sesión", () => {
  const b = makeBrain(), c = clock("2026-03-04T17:30:00Z");
  b.process({ type: "session_started", at: c.now(), context: { device: "cast" } });
  for (const id of ids("a-seis").slice(0, 3)) listen(b, c, id, "complete");
  assert.equal(b.session.state, "LOCKED_IN");
  const anchor = b.session.anchor.id;
  const before = b.rank(all(), { at: c.now() }).ranked.slice(0, 5).map((x) => x.track.id);
  const r = b.process({ type: "context_changed", at: c.add(20 * 60_000), context: { device: "iphone", label: "transporte" } });
  assert.equal(r.state, "LOCKED_IN"); assert.equal(b.session.anchor.id, anchor);
  const after = b.rank(all(), { at: c.now() }).ranked.slice(0, 5).map((x) => x.track.id);
  assert.deepEqual(after, before, "mismo rollo tras pasar del altavoz al móvil");
});
