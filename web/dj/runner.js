// El bucle del DJ (WEB-123): Spotify reproduce; DJ-BRAIN decide la siguiente.
//
// Cómo funciona sin Recommendations ni control de la cola de Spotify:
//  - Reproducir: el motor elige la primera, Spotify la pone (PUT /me/player/play) y se encola SOLO
//    1 siguiente (2–3 si MANU pasa a segundo plano). Spotify no deja quitar de su cola, así que cuanto
//    más corta, antes se nota lo que aprende de tus saltos.
//  - Cada pocos segundos se mira qué suena. Si cambió de canción, la anterior se clasifica (completa o
//    saltada y cuánto se escuchó), se le cuenta al motor y se encola la siguiente que él elige.
//  - Lo que pongas tú a mano en Spotify también se aprende (como canción elegida por ti).
// Límite real: con MANU cerrada o bloqueada, el iPhone para este bucle; Spotify sigue con lo encolado y
// después con su autoplay. Al volver, el DJ retoma (ver docs/dj/DJ.md).
import { toTrack } from "./spotify.js";

export const STATUS_LABEL = { idle: "Listo", starting: "Arrancando…", playing: "Sonando", paused: "En pausa", "needs-device": "Abre Spotify", error: "Error" };
export const SESSION_LABEL = { START: "Calentando", STABLE: "Cogiendo el rollo", SEARCHING: "Buscando lo que te apetece", LOCKED_IN: "En el rollo", FATIGUE: "Cambiando de aires" };

export class DjRunner {
  constructor({ api, brain, now = () => Date.now(), onEvent = () => {}, onChange = () => {}, preferDevice = null }) {
    Object.assign(this, { api, brain, now, onEvent, onChange, preferDevice });
    this.s = { status: "idle", device: null, current: null, queued: [], played: [], message: "", buffer: 1, notes: [] };
  }
  iso(t = this.now()) { return new Date(t).toISOString(); }
  emit(e) { const r = this.brain.process(e); this.onEvent(e); if (r.explanation?.length) this.s.notes = [...r.explanation, ...this.s.notes].slice(0, 6); return r; }
  set(patch) { Object.assign(this.s, patch); this.onChange(this.s); }

  /** Las siguientes candidatas según el motor, sin repetir lo que suena, lo encolado ni lo recién sonado. */
  pickNext(n = 1) {
    const avoid = new Set([this.s.current?.uri, ...this.s.queued, ...this.s.played.slice(-40).map((p) => p.uri)].filter(Boolean));
    const ids = [...this.brain.catalog.keys()].filter((id) => !avoid.has(id));
    const upcomingArtists = [this.s.current?.uri, ...this.s.queued].filter(Boolean).map((u) => this.brain.catalog.get(u)?.artistId).filter(Boolean);
    return this.brain.nextBatch(ids, { at: this.iso(), n, upcomingArtists }).batch.map((x) => x.track);
  }

  async chooseDevice() {
    const devs = await this.api.devices();
    const pref = this.preferDevice ? devs.find((d) => d.id === this.preferDevice || d.name === this.preferDevice) : null;
    return devs.find((d) => d.is_active) ?? pref ?? devs.find((d) => d.type === "Smartphone") ?? devs[0] ?? null;
  }

  async start({ context = null } = {}) {
    this.set({ status: "starting", message: "Eligiendo la primera…" });
    try {
      const device = await this.chooseDevice();
      if (!device) { this.set({ status: "needs-device", message: "Spotify no tiene ningún dispositivo abierto. Abre Spotify un momento y vuelve." }); return false; }
      if (!this.brain.catalog.size) throw new Error("Aún no hay canciones para elegir");
      this.emit({ type: "session_started", at: this.iso(), context: { device: device.type?.toLowerCase() ?? null, ...(context ?? {}) } });
      const [first] = this.pickNext(1);
      await this.api.shuffleOff(device.id);
      await this.api.play([first.id], device.id);
      this.s.device = { id: device.id, name: device.name, type: device.type };
      this.startTrack(first, { ours: true, source: { dj: true } });
      this.s.queued = [];
      await this.topUp();
      this.set({ status: "playing", message: "" });
      return true;
    } catch (err) { this.set({ status: err.code === "device" ? "needs-device" : "error", message: err.message }); return false; }
  }

  startTrack(track, { ours, source }) {
    this.s.current = { uri: track.id, title: track.title, artist: track.artistName, image: track.image ?? null, duration: track.durationMs, progress: 0, ours, startedAt: this.now() };
    this.emit({ type: "track_started", at: this.iso(), trackId: track.id, source });
  }

  /** Cierra la canción anterior: completa (≥90 % o a <12 s del final) o saltada con lo escuchado. */
  finish(cur, { msPlayed = cur.progress } = {}) {
    const done = cur.duration > 0 && (msPlayed >= cur.duration * 0.9 || cur.duration - msPlayed < 12_000);
    const e = done ? { type: "track_completed", at: this.iso(), trackId: cur.uri } : { type: "track_skipped", at: this.iso(), trackId: cur.uri, msPlayed: Math.max(0, Math.round(msPlayed)) };
    this.emit(e);
    this.s.played = [...this.s.played, { uri: cur.uri, title: cur.title, artist: cur.artist, done, ms: msPlayed }].slice(-200);
  }

  async topUp() {
    if (!this.s.device) return;
    while (this.s.queued.length < this.s.buffer) {
      const [next] = this.pickNext(1);
      if (!next) break;
      await this.api.queue(next.id, this.s.device.id);
      this.s.queued = [...this.s.queued, next.id];
    }
  }
  async setBuffer(n) { this.s.buffer = Math.max(1, Math.min(4, n)); if (this.s.status === "playing") { try { await this.topUp(); } catch { /* lo reintenta el siguiente tick */ } } }

  /**
   * Retomar: si iOS cerró MANU (o la recargaste) con Spotify sonando, el DJ vuelve a tomar el control
   * sin cortar la canción: adopta la que suena y encola la siguiente.
   */
  async attach() {
    try {
      const device = await this.chooseDevice();
      const cur = await this.api.current();
      if (!device || !cur?.item) return this.start();
      this.s.device = { id: device.id, name: device.name, type: device.type };
      this.emit({ type: "session_started", at: this.iso(), context: { device: device.type?.toLowerCase() ?? null } });
      const track = this.brain.catalog.get(cur.item.uri) ?? toTrack(cur.item);
      if (track && !this.brain.catalog.has(track.id)) this.brain.addTrack(track);
      if (track) { this.startTrack(track, { ours: true, source: { dj: true } }); this.s.current.progress = cur.progress_ms ?? 0; }
      this.s.queued = [];
      await this.topUp();
      this.set({ status: cur.is_playing ? "playing" : "paused", message: "Retomado: sigo desde la que suena" });
      return true;
    } catch (err) { this.set({ status: "error", message: err.message }); return false; }
  }

  /** Un vistazo a Spotify. Llamar cada ~3 s con MANU abierta. Nunca dos a la vez. */
  async tick() {
    if (!["playing", "paused"].includes(this.s.status) || this.busy) return;
    this.busy = true;
    try { await this.tickOnce(); } finally { this.busy = false; }
  }
  async tickOnce() {
    let cur;
    try { cur = await this.api.current(); } catch (err) { if (err.code === "auth") this.set({ status: "error", message: err.message }); return; }
    const item = cur?.item;
    if (!item) {
      // Nada sonando: si se acabó lo encolado, el DJ sigue él solo.
      if (this.s.current && this.s.current.progress > 0) { this.finish(this.s.current); this.s.current = null; }
      this.s.queued = [];
      try { const [next] = this.pickNext(1); if (next) { await this.api.play([next.id], this.s.device?.id); this.startTrack(next, { ours: true, source: { dj: true } }); await this.topUp(); } } catch (err) { this.set({ message: err.message }); }
      this.set({ status: "playing" });
      return;
    }
    const prev = this.s.current;
    if (!prev || item.uri !== prev.uri) {
      if (prev) this.finish(prev);
      // Si saltaste varias encoladas entre dos vistazos, las intermedias son saltos de 0 s.
      const k = this.s.queued.indexOf(item.uri);
      for (const uri of k > 0 ? this.s.queued.slice(0, k) : []) { const t = this.brain.catalog.get(uri); if (t) { this.emit({ type: "track_started", at: this.iso(), trackId: uri, source: { dj: true } }); this.emit({ type: "track_skipped", at: this.iso(), trackId: uri, msPlayed: 0 }); this.s.played = [...this.s.played, { uri, title: t.title, artist: t.artistName, done: false, ms: 0 }].slice(-200); } }
      const ours = k >= 0;
      if (ours) this.s.queued = this.s.queued.slice(k + 1); else this.s.queued = [];
      const track = this.brain.catalog.get(item.uri) ?? toTrack(item);
      if (track && !this.brain.catalog.has(track.id)) this.brain.addTrack(track);
      if (track) this.startTrack(track, { ours, source: ours ? { dj: true } : { manual: true } });
      try { await this.topUp(); } catch (err) { this.set({ message: err.message }); }
    } else if (prev.progress > 30_000 && cur.progress_ms + 5_000 < prev.progress && cur.progress_ms < 15_000) {
      this.emit({ type: "track_repeated", at: this.iso(), trackId: prev.uri });
    }
    if (this.s.current) { this.s.current.progress = cur.progress_ms ?? 0; this.s.current.duration = item.duration_ms ?? this.s.current.duration; }
    this.set({ status: cur.is_playing ? "playing" : "paused" });
  }

  /** «Siguiente» desde MANU: se salta en Spotify y el próximo vistazo lo aprende como salto. */
  async skip() { try { await this.api.next(this.s.device?.id); setTimeout(() => this.tick(), 600); } catch (err) { this.set({ message: err.message }); } }
  async pause() { try { await this.api.pause(this.s.device?.id); this.set({ status: "paused" }); } catch (err) { this.set({ message: err.message }); } }
  async resume() { try { await this.api.resume(this.s.device?.id); this.set({ status: "playing" }); } catch (err) { this.set({ message: err.message }); } }
  stop() {
    if (this.s.current) this.finish(this.s.current);
    this.emit({ type: "session_ended", at: this.iso() });
    this.set({ status: "idle", current: null, queued: [], message: "DJ parado. Spotify sigue con lo que tenía en cola." });
  }
}
