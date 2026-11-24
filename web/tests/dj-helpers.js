// Utilidades de prueba. Todo es ficticio (fixtures/catalog.json).
import { readFileSync } from "node:fs";
import { DjBrain } from "../dj/brain/brain.js";
export const FIX = JSON.parse(readFileSync(new URL("./dj-fixture.json", import.meta.url), "utf8"));
export const makeBrain = (config = {}) => new DjBrain({ catalog: FIX.tracks, playlists: FIX.playlists, config });
export const ids = (artist) => FIX.tracks.filter((t) => t.artistId === artist).map((t) => t.id);
export const all = () => FIX.tracks.map((t) => t.id);

/** Reloj de prueba: avanza a mano. */
export function clock(start = "2026-03-04T10:40:00Z") {
  let t = Date.parse(start);
  return { now: () => new Date(t).toISOString(), add: (ms) => { t += ms; return new Date(t).toISOString(); }, days: (d) => { t += d * 864e5; return new Date(t).toISOString(); } };
}
/** Escucha una canción: «quick» (3 s), «moderate» (12 s), «ambiguous» (30 s), «accept» (60 %), «complete». */
export function listen(b, c, trackId, how, source) {
  b.process({ type: "track_started", at: c.now(), trackId, ...(source ? { source } : {}) });
  const tr = b.catalog.get(trackId);
  const ms = { quick: 3000, moderate: 12000, ambiguous: 30000, accept: Math.round(tr.durationMs * 0.6) }[how];
  const r = how === "complete" ? b.process({ type: "track_completed", at: c.add(tr.durationMs), trackId }) : b.process({ type: "track_skipped", at: c.add(ms), trackId, msPlayed: ms });
  c.add(2000);
  return r;
}
export const topIds = (res, n) => res.ranked.slice(0, n).map((x) => x.track.id);
