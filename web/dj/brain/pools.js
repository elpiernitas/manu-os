// Grupos de candidatas A–F (§9) y mezcla exploración/familiaridad (§10).
import { similarity } from "./similarity.js";
import { personalAt } from "./memory/taste.js";
const DAY = 864e5;
export const POOLS = ["KnownCore", "Rediscovery", "ArtistDeepDive", "AdjacentDiscovery", "FarDiscovery", "Contextual"];
export const BUCKET = { KnownCore: "known", Rediscovery: "known", Contextual: "known", ArtistDeepDive: "near", AdjacentDiscovery: "near", FarDiscovery: "far" };

/** Anclas positivas para medir cercanía: el ancla de sesión y lo más querido. */
export function positiveAnchors(brain, catalog, t) {
  const out = brain.session.anchor ? [brain.session.anchor] : [];
  const loved = Object.entries(brain.taste.tracks).map(([id, r]) => [id, personalAt(r, t, brain.config.taste)]).filter(([, v]) => v >= brain.config.pools.knownPersonal).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20);
  for (const [id] of loved) { const tr = catalog.get(id); if (tr) out.push(tr); }
  return out;
}

export function poolOf(track, brain, t, anchors) {
  const cfg = brain.config;
  const rec = brain.taste.tracks[track.id];
  const mode = brain.explicit.mode?.mode ?? brain.context.mode;
  if (mode && (rec?.modes?.[mode] ?? 0) > 0) return "Contextual";
  const heard = (rec?.plays ?? 0) > 0 || (rec?.personal ?? 0) !== 0;
  if (heard) {
    const p = personalAt(rec, t, cfg.taste);
    const stale = rec.lastAt ? t - rec.lastAt > cfg.pools.rediscoveryDays * DAY : true;
    if (p >= cfg.pools.knownPersonal && !stale) return "KnownCore";
    if (p >= cfg.pools.knownPersonal * 0.5) return "Rediscovery";
  }
  const dd = brain.session.deepDive[track.artistId];
  if (!heard && dd && !dd.closed && dd.hits >= 1) return "ArtistDeepDive";
  const near = Math.max(0, ...anchors.map((a) => similarity(a, track)));
  if (!heard) return near >= cfg.pools.adjacentSimilarity ? "AdjacentDiscovery" : "FarDiscovery";
  return "Rediscovery"; // conocida con poca evidencia: «redescubrimiento» suave
}

/** Reparto según el estado: buscando → más lejos; receptivo a lo nuevo → más descubrimiento. */
export function mixFor(brain) {
  const base = { ...brain.config.pools.mix };
  const s = brain.session;
  if (s.state === "SEARCHING") { base.far += 0.1 * s.diversity; base.known -= 0.05 * s.diversity; }
  const d = s.discoveries; if (d.tried >= 3 && d.accepted / d.tried >= 0.6) { base.far += 0.05; base.known -= 0.05; }
  const sum = base.known + base.near + base.far;
  return { known: base.known / sum, near: base.near / sum, far: base.far / sum };
}
