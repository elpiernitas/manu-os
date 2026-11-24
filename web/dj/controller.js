// DJ de MANU (WEB-123): une DJ-BRAIN (decide), Spotify (reproduce) y la pantalla. app.js solo le pasa
// el token, cómo pedir permiso y cómo repintar.
import { DjBrain } from "./brain/brain.js";
import { spotifyClient, hasDjScopes } from "./spotify.js";
import { buildCatalog, seedBrain } from "./catalog.js";
import { DjRunner, STATUS_LABEL, SESSION_LABEL } from "./runner.js";
import { djGet, djSet } from "./store.js";
import { LANGS, manualLanguageSource, applyLanguages } from "./language.js";
import { historyRows } from "./history.js";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const CATALOG_MAX_AGE = 20 * 3600_000;
const LOG_MAX = 5000;
const ROLE_LABEL = { core: "Núcleo (mi gusto)", mode: "Modo (p. ej. triste)", shared: "Compartida (oficina)", discovery: "Descubrimiento" };

export function createDj({ getTokens, startAuth, render, toast, now = () => Date.now(), fetchImpl, openSpotify }) {
  const st = { phase: "init", progress: "", error: "", brain: null, runner: null, catalog: null, log: [], roles: {}, langTags: {}, history: [], languagesKnown: 0, timer: null, saveTimer: null, office: false, mode: null, onlyEn: false, loading: null };
  const api = spotifyClient(async () => (await getTokens())?.access ?? null, fetchImpl);
  const iso = () => new Date(now()).toISOString();

  const scheduleSave = () => { clearTimeout(st.saveTimer); st.saveTimer = setTimeout(() => { djSet("log", st.log).catch(() => {}); }, 1500); };
  const logEvent = (e) => { st.log.push(e); if (st.log.length > LOG_MAX) st.log = st.log.slice(-LOG_MAX); scheduleSave(); };

  /** Reconstruye el cerebro: catálogo + semántica + historial importado + todo lo que el DJ aprendió. */
  function buildBrain() {
    const b = new DjBrain();
    seedBrain(b, st.catalog, { at: new Date(st.catalog.builtAt).toISOString() });
    // Historial importado: el artista por nombre se une con el de Spotify; si la canción está en una
    // playlist compartida (y no en el núcleo), cuenta como compartida (DJ-BRAIN §16).
    const byName = new Map([...b.catalog.values()].map((t) => [t.artistName?.toLowerCase(), t.artistId]));
    const sharedIds = new Set(st.catalog.seeds.filter((s) => b.playlists[s.playlistId]?.role === "shared").map((s) => s.trackId));
    const coreIds = new Set(st.catalog.seeds.filter((s) => b.playlists[s.playlistId]?.role === "core").map((s) => s.trackId));
    for (const r of st.history) {
      const known = b.catalog.get(r.uri);
      const track = known ?? { id: r.uri, title: r.title, artistId: byName.get(r.artist.toLowerCase()) ?? `artist:${r.artist.toLowerCase()}`, artistName: r.artist, durationMs: r.done ? r.ms : 0 };
      b.importListen(track, { msPlayed: r.ms, completed: r.done, shared: sharedIds.has(r.uri) && !coreIds.has(r.uri) }, r.t);
    }
    for (const e of st.log) { try { b.process(e); } catch { /* un evento viejo de una canción que ya no está */ } }
    st.languagesKnown = applyLanguages(b.catalog, [manualLanguageSource(st.langTags)]);
    b.session = new DjBrain().session; // la sesión empieza limpia al abrir
    st.brain = b;
    const prevRunner = st.runner;
    st.runner = new DjRunner({ api, brain: b, now, onEvent: logEvent, onChange: () => render() });
    if (prevRunner?.s.status === "playing") Object.assign(st.runner.s, prevRunner.s);
  }

  async function ensure({ force = false } = {}) {
    if (st.loading) return st.loading;
    st.loading = (async () => {
      try {
        const tokens = await getTokens();
        if (!tokens) { st.phase = "needs-auth"; return; }
        if (!hasDjScopes(tokens.scope)) { st.phase = "needs-scopes"; return; }
        if (!st.catalog) {
          const [cat, log, roles, langTags, history] = await Promise.all([djGet("catalog"), djGet("log"), djGet("roles"), djGet("langTags"), djGet("history")].map((p) => p.catch(() => null)));
          Object.assign(st, { catalog: cat ?? null, log: log ?? [], roles: roles ?? {}, langTags: langTags ?? {}, history: history ?? [] });
        }
        if (force || !st.catalog || now() - st.catalog.builtAt > CATALOG_MAX_AGE) {
          st.phase = "loading"; render();
          st.catalog = await buildCatalog(api, { roles: st.roles, now: now(), onProgress: (m) => { st.progress = m; render(); } });
          await djSet("catalog", st.catalog).catch(() => {});
        }
        buildBrain();
        st.phase = "ready"; st.error = "";
      } catch (err) {
        if (err.code === "auth") st.phase = "needs-auth";
        else { st.phase = "error"; st.error = err.message || "Spotify no ha respondido"; }
      } finally { st.loading = null; render(); }
    })();
    return st.loading;
  }

  function loop(on) {
    clearInterval(st.timer); st.timer = null;
    if (on) st.timer = setInterval(() => { if (document.visibilityState === "visible") st.runner?.tick().then(render); }, 3000);
  }
  document.addEventListener?.("visibilitychange", () => {
    if (!st.runner || !["playing", "paused"].includes(st.runner.s.status)) return;
    if (document.visibilityState === "hidden") st.runner.setBuffer(3); // que aguante un rato sin MANU abierta
    else { st.runner.setBuffer(1); st.runner.tick().then(render); }
  });

  async function act(a) {
    const r = st.runner, d = a.dataset;
    switch (d.act) {
      case "dj-connect": try { localStorage.setItem("manuos.dj.return", "1"); } catch {} startAuth(); return;
      case "dj-retry": await ensure({ force: d.force === "1" }); return;
      case "dj-open-spotify": openSpotify(); return;
      case "dj-play": {
        if (st.phase !== "ready") { await ensure(); if (st.phase !== "ready") return; }
        const ok = await st.runner.start({ context: st.office ? { shared: true, label: "oficina" } : null });
        if (ok) loop(true); else if (st.runner.s.status === "needs-device") openSpotify();
        render(); return;
      }
      case "dj-attach": {
        if (st.phase !== "ready") { await ensure(); if (st.phase !== "ready") return; }
        if (await st.runner.attach()) loop(true); render(); return;
      }
      case "dj-skip": await r?.skip(); return;
      case "dj-pause": await r?.pause(); return;
      case "dj-resume": await r?.resume(); return;
      case "dj-stop": r?.stop(); loop(false); render(); return;
      case "dj-office": st.office = !st.office; r?.emit({ type: "context_changed", at: iso(), context: { shared: st.office, label: st.office ? "oficina" : null } }); toast(st.office ? "Modo oficina: lo que suene no cuenta como tu gusto" : "Fuera de la oficina"); render(); return;
      case "dj-mode": st.mode = d.v || null; r?.emit({ type: "explicit_preference", at: iso(), rule: { kind: "mode", mode: st.mode } }); toast(st.mode ? `Modo ${st.mode}` : "Modo normal"); render(); return;
      case "dj-only-en": {
        if (!st.onlyEn && (st.brain ? [...st.brain.catalog.values()].filter((t) => t.language === "en").length : 0) < 15) { toast("Aún no sé el idioma de suficientes canciones. Márcalas mientras suenan"); return; }
        st.onlyEn = !st.onlyEn; r?.emit({ type: "explicit_preference", at: iso(), rule: { kind: "language", only: st.onlyEn ? "en" : null } }); render(); return;
      }
      case "dj-lang": {
        const uri = r?.s.current?.uri; if (!uri) return;
        st.langTags = { ...st.langTags, [uri]: d.v }; await djSet("langTags", st.langTags).catch(() => {});
        const t = st.brain.catalog.get(uri); if (t) t.language = d.v;
        st.languagesKnown = applyLanguages(st.brain.catalog, [manualLanguageSource(st.langTags)]); render(); return;
      }
      case "dj-love": { const uri = r?.s.current?.uri; const t = uri && st.brain.catalog.get(uri); if (!t) return; r.emit({ type: "explicit_preference", at: iso(), rule: { kind: "artist", artistId: t.artistId, stance: d.v } }); toast(d.v === "not_now" ? `${t.artistName}: ahora no` : `${t.artistName}: apuntado`); if (d.v === "not_now") await r.skip(); render(); return; }
    }
  }

  async function onRole(playlistId, role) {
    const [kind, mode] = String(role).split(":");
    st.roles = { ...st.roles, [playlistId]: { role: kind, ...(mode ? { mode } : {}) } };
    await djSet("roles", st.roles).catch(() => {});
    if (st.catalog) { st.catalog.playlists = st.catalog.playlists.map((p) => (p.id === playlistId ? { ...p, role: st.roles[playlistId] } : p)); await djSet("catalog", st.catalog).catch(() => {}); buildBrain(); }
    render();
  }

  async function onHistoryFiles(files) {
    let rows = [];
    for (const f of files) { try { const data = JSON.parse(await f.text()); rows = rows.concat(historyRows(Array.isArray(data) ? data : [])); } catch { toast(`No he podido leer ${f.name}`); } }
    if (!rows.length) { toast("No he encontrado escuchas en esos archivos"); return; }
    const seen = new Set(st.history.map((r) => `${r.uri}|${r.t}`));
    st.history = [...st.history, ...rows.filter((r) => !seen.has(`${r.uri}|${r.t}`))].sort((a, b) => a.t - b.t);
    await djSet("history", st.history).catch(() => {});
    if (st.catalog) buildBrain();
    toast(`${rows.length.toLocaleString("es-ES")} escuchas importadas en este iPhone`); render();
  }

  function view() {
    if (st.phase === "init") { ensure(); return card("<p class=\"muted\">Preparando el DJ…</p>"); }
    if (st.phase === "needs-auth" || st.phase === "needs-scopes") return card(`<h2>Conecta Spotify</h2><p class="muted small">${st.phase === "needs-scopes" ? "El DJ necesita más permisos que el botón del altavoz: leer lo que suena, tus tops, tus guardadas y tus playlists, y poner la cola." : "Para que el DJ elija y Spotify reproduzca."} Hace falta Spotify Premium para controlar la reproducción.</p><button class="btn block" data-act="dj-connect">${st.phase === "needs-scopes" ? "Dar permisos al DJ" : "Conectar Spotify"}</button>`);
    if (st.phase === "loading") return card(`<h2>Preparando tu música</h2><p class="muted">${esc(st.progress || "Un momento…")}</p><p class="muted small">La primera vez tarda unos segundos: leo tus playlists, tops y guardadas, y busco canciones nuevas.</p>`);
    if (st.phase === "error") return card(`<h2>Spotify no ha respondido</h2><p class="muted small">${esc(st.error)}</p><button class="btn" data-act="dj-retry">Reintentar</button>`);
    const r = st.runner, s = r.s, b = st.brain, playing = ["playing", "paused"].includes(s.status);
    const cur = s.current;
    const sess = b.session.state;
    const nowCard = cur ? `<div class="dj-now">${cur.image ? `<img class="dj-cover" src="${esc(cur.image)}" alt="" width="72" height="72">` : '<span class="dj-cover dj-cover-empty" aria-hidden="true">🎧</span>'}<div class="grow"><b>${esc(cur.title)}</b><br><span class="muted">${esc(cur.artist)}</span>${cur.ours ? "" : '<br><span class="muted small">Elegida por ti en Spotify</span>'}</div></div>` : "";
    const controls = playing ? `<div class="dj-controls"><button class="btn ghost" data-act="${s.status === "paused" ? "dj-resume" : "dj-pause"}">${s.status === "paused" ? "▶︎ Seguir" : "⏸ Pausa"}</button><button class="btn" data-act="dj-skip">⏭ Siguiente</button><button class="btn ghost" data-act="dj-stop">Parar DJ</button></div>`
      : `<button class="btn dj-play" data-act="dj-play">${s.status === "starting" ? "Arrancando…" : "▶︎ Reproducir DJ"}</button><button class="link small" data-act="dj-attach">¿Ya suena Spotify? Retomar sin cortar</button>`;
    const lang = cur ? `<div class="dj-tags"><span class="muted small">Idioma de esta:</span>${Object.entries(LANGS).map(([k, l]) => `<button class="chip" data-act="dj-lang" data-v="${k}" aria-pressed="${st.langTags[cur.uri] === k}">${l}</button>`).join("")}</div>` : "";
    const taste = cur ? `<div class="btns"><button class="link small" data-act="dj-love" data-v="love">Me encanta este artista</button><button class="link small" data-act="dj-love" data-v="not_now">Este artista, ahora no</button></div>` : "";
    const stats = `${b.catalog.size.toLocaleString("es-ES")} canciones para elegir${st.history.length ? ` · ${st.history.length.toLocaleString("es-ES")} escuchas de tu historial` : ""}`;
    return `<section class="card dj-hero"><div class="row"><h2>🎧 DJ</h2><span class="chip">${esc(playing ? SESSION_LABEL[sess] ?? sess : STATUS_LABEL[s.status])}</span></div>
        ${nowCard}${controls}
        ${s.message ? `<p class="muted small">${esc(s.message)}</p>` : ""}
        ${s.status === "needs-device" ? '<button class="btn ghost" data-act="dj-open-spotify">Abrir Spotify</button><button class="link small" data-act="dj-play">Ya está abierto: reproducir</button>' : ""}
        ${playing && s.device ? `<p class="muted small">En «${esc(s.device.name)}». Cambia de canción en Spotify o aquí: cada salto le enseña al DJ lo que te apetece ahora.</p>` : ""}
        ${lang}${taste}
      </section>
      <section class="card"><h2>Ahora mismo</h2>
        <div class="btns"><button class="chip" data-act="dj-mode" data-v="" aria-pressed="${!st.mode}">Normal</button><button class="chip" data-act="dj-mode" data-v="triste" aria-pressed="${st.mode === "triste"}">Triste</button><button class="chip" data-act="dj-office" aria-pressed="${st.office}">En la oficina</button><button class="chip" data-act="dj-only-en" aria-pressed="${st.onlyEn}">Solo inglés</button></div>
        <p class="muted small">«En la oficina»: lo que suene no cuenta como tu gusto. «Solo inglés» es estricto: solo pone canciones marcadas en inglés (${st.languagesKnown} con idioma conocido; márcalas mientras suenan).</p></section>
      ${s.notes.length ? `<section class="card"><h2>Por qué</h2><ul class="small">${s.notes.slice(0, 4).map((n) => `<li>${esc(n)}</li>`).join("")}</ul></section>` : ""}
      ${s.played.length ? `<section class="card"><h2>Esta sesión</h2>${s.played.slice(-8).reverse().map((p) => `<div class="row"><span class="grow small">${esc(p.title)} · <span class="muted">${esc(p.artist)}</span></span><span class="chip">${p.done ? "entera" : `saltada ${Math.round(p.ms / 1000)} s`}</span></div>`).join("")}</section>` : ""}
      <details class="card"><summary><b>Tus playlists para el DJ</b> <span class="muted small">· qué significa cada una</span></summary>
        <p class="muted small">No todas valen lo mismo. Núcleo = tu gusto (señal fuerte). Modo = solo cuenta en ese modo. Compartida = contexto (oficina), casi no cuenta como gusto.</p>
        ${st.catalog.playlists.map((p) => `<div class="row"><label class="grow small" for="djr-${esc(p.id)}">${esc(p.name)}${p.collaborative ? ' <span class="muted">(colaborativa)</span>' : ""}</label><select id="djr-${esc(p.id)}" data-dj-role="${esc(p.id)}">${["core", "mode:triste", "shared", "discovery"].map((v) => `<option value="${v}"${(p.role.role + (p.role.mode ? `:${p.role.mode}` : "")) === v ? " selected" : ""}>${ROLE_LABEL[v.split(":")[0]]}</option>`).join("")}</select></div>`).join("")}
      </details>
      <details class="card"><summary><b>Tu historial de Spotify</b> <span class="muted small">· opcional</span></summary>
        <p class="muted small">Elige los archivos <b>Streaming_History_Audio_*.json</b> de tu exportación de Spotify. Se leen en este iPhone; solo se guarda canción, artista, cuánto escuchaste y cuándo. Nada de IP ni país, y no sale del dispositivo.</p>
        <label class="btn ghost" for="djHistory" role="button" tabindex="0">Elegir archivos</label><input id="djHistory" type="file" accept=".json,application/json" multiple class="sr"></details>
      <p class="muted small">${esc(stats)} · <button class="link small" data-act="dj-retry" data-force="1">Actualizar desde Spotify</button></p>`;
  }
  const card = (inner) => `<section class="card dj-hero">${inner}</section>`;

  return { state: st, ensure, act, view, onRole, onHistoryFiles, loop };
}
