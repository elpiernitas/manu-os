// Sugerencias para añadir a una playlist, ilimitadas (§14). Cada refresco excluye lo ya enseñado y
// lo rechazado, aprende de lo añadido y respeta la semántica de la playlist. Lo antiguo solo vuelve
// tras un tiempo de espera o un cambio de contexto.
import { similarity } from "./similarity.js";
import { hardFilter, personalFit } from "./scoring.js";
import { roleOf } from "./memory/playlists.js";

export class PlaylistRefresher {
  constructor(brain, playlistId, members = []) {
    this.brain = brain; this.playlistId = playlistId;
    this.members = new Set(members); this.shown = new Map(); this.rejected = new Set(); this.contextKey = null;
  }
  add(trackId, at) { this.members.add(trackId); this.brain.process({ type: "track_saved_to_playlist", trackId, playlistId: this.playlistId, at }); }
  reject(trackId) { this.rejected.add(trackId); }
  contextChanged(key) { this.contextKey = key; this.shown.clear(); }

  more(n, { at, catalog = [...this.brain.catalog.values()] }) {
    const t = Date.parse(at), cd = this.brain.config.refresh.cooldownMs;
    const sem = roleOf(this.brain.playlists, this.playlistId);
    const seeds = [...this.members].map((id) => this.brain.catalog.get(id)).filter(Boolean);
    const pick = (allowOld) => catalog.filter((tr) => !this.members.has(tr.id) && !this.rejected.has(tr.id) && hardFilter(tr, this.brain).ok && (!this.shown.has(tr.id) || (allowOld && t - this.shown.get(tr.id) >= cd)));
    let pool = pick(false); if (!pool.length) pool = pick(true);
    const scored = pool.map((tr) => {
      const near = seeds.length ? Math.max(...seeds.map((s) => similarity(s, tr))) : 0.5;
      const fit = sem.role === "mode" ? 1 + (this.brain.taste.tracks[tr.id]?.modes?.[sem.mode] ?? 0) : personalFit(tr, this.brain, t).value;
      return { track: tr, score: (0.4 + near) * fit };
    }).sort((a, b) => b.score - a.score || a.track.id.localeCompare(b.track.id)).slice(0, n);
    for (const x of scored) this.shown.set(x.track.id, t);
    return scored.map((x) => x.track);
  }
}
