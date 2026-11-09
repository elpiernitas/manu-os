// Pantalla Tú → Memoria (WEB-94). Solo construye HTML a partir del estado; las acciones
// (data-act="mem-…") las atiende app.js con las funciones puras de brain/learn/proposals.

import { KIND_LABEL, STATUS_LABEL, SOURCES, current, history, related, search, staleness, stats, contested, proposed, staleClaims } from "./brain.js";
import { proposals } from "./proposals.js";
import { QUESTIONS, progress } from "./conocernos.js";
import { featureText } from "./learn.js";
import { HUMOR_LABEL, FRANQUEZA_LABEL, WHEN, line } from "./voice.js";
import { CATEGORIES } from "./money.js";

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const day = (d) => (d ? new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—");
const chip = (t, cls = "") => `<span class="chip ${cls}">${esc(t)}</span>`;
const statusCls = { ACTIVE: "ok", PROPOSED: "warn", CONTESTED: "bad", SUPERSEDED: "", REJECTED: "", RETRACTED: "" };
export const FILTERS = [["vigentes", "Vigentes"], ["sin-confirmar", "Sin confirmar"], ["en-duda", "En duda"], ["revisar", "Por revisar"], ["historial", "Historial"]];

function list(brain, { filter = "vigentes", query = "", now }) {
  if (query.trim()) return search(brain, query, { now, history: filter === "historial", limit: 50 }).map((h) => ({ claim: h.claim, why: h.why }));
  const all = {
    vigentes: () => current(brain, { now }).filter((c) => c.status === "ACTIVE"),
    "sin-confirmar": () => proposed(brain),
    "en-duda": () => contested(brain),
    revisar: () => staleClaims(brain, now),
    historial: () => brain.claims.filter((c) => !current(brain, { now }).includes(c)),
  }[filter]?.() ?? [];
  return all.sort((a, b) => String(b.recordedAt).localeCompare(a.recordedAt)).slice(0, 100).map((claim) => ({ claim }));
}

function proposalCard(p, ui) {
  const why = `<details class="why"><summary>Por qué</summary><p class="small muted">${esc(p.why)}</p></details>`;
  let body = `<p>${esc(p.body)}</p>`;
  let acts = p.actions.map((a) => `<button class="btn ${a.primary ? "" : "ghost"} small" data-act="mem-prop" data-key="${esc(p.key)}" data-action="${esc(a.id)}">${esc(a.label)}</button>`).join("");
  if (p.kind === "pregunta") {
    body = `<p class="mem-q">${esc(p.body)}</p>`;
    acts = p.options
      ? p.options.map(([v, l]) => `<button class="btn ghost small" data-act="mem-answer" data-q="${esc(p.question)}" data-v="${esc(v)}">${esc(l)}</button>`).join("")
      : `<form class="row mem-inline" id="memAnswerForm" data-q="${esc(p.question)}"><label class="sr" for="memAnswer">Tu respuesta</label><input id="memAnswer" maxlength="300" placeholder="${esc(p.hint ?? "Tu respuesta")}" autocomplete="off"><button class="btn small" type="submit">Guardar</button></form>`;
    acts += `<button class="link small" data-act="mem-skip" data-q="${esc(p.question)}" data-forever="0">Otro día</button><button class="link small" data-act="mem-skip" data-q="${esc(p.question)}" data-forever="1">Prefiero no responder</button>`;
  }
  if (ui.choosing === p.key && p.kind === "gasto") acts = `<form class="row mem-inline" id="memCatForm" data-key="${esc(p.key)}"><label class="sr" for="memCat">Categoría</label><select id="memCat">${Object.entries(CATEGORIES).filter(([k]) => k !== "OTHER").map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select><button class="btn small" type="submit">Guardar</button><button class="link small" type="button" data-act="mem-choose" data-key="">Cancelar</button></form>`;
  if (ui.choosing === p.key && p.kind === "vigencia") acts = `<form class="row mem-inline" id="memChangeForm" data-key="${esc(p.key)}"><label class="sr" for="memChange">Cómo es ahora</label><input id="memChange" maxlength="300" placeholder="¿Cómo es ahora?" required><button class="btn small" type="submit">Guardar</button><button class="link small" type="button" data-act="mem-choose" data-key="">Cancelar</button></form>`;
  return `<article class="card mem-prop" data-kind="${p.kind}"><p class="small muted mem-kicker">${esc(p.title)}</p>${body}<div class="btns">${acts}</div>${why}</article>`;
}

function claimRow(c, why) {
  const st = staleness(c);
  return `<button class="item mem-row" data-act="mem-open" data-id="${esc(c.id)}"><span class="grow"><span>${esc(c.text)}</span><br><span class="muted small">${esc(KIND_LABEL[c.kind])} · ${esc(STATUS_LABEL[c.status])}${c.when ? ` · ${esc(c.when)}` : ""}${c.place ? ` · ${esc(c.place)}` : ""}${st.stale ? " · por revisar" : ""}${why?.length ? ` · coincide en ${esc(why.join(", "))}` : ""}</span></span><span class="chev">›</span></button>`;
}

function detail(brain, id, ui, now) {
  const c = brain.claims.find((x) => x.id === id);
  if (!c) return "";
  const h = history(brain, id);
  const rel = related(brain, id, { now });
  const st = staleness(c, now);
  const live = ["ACTIVE", "PROPOSED", "CONTESTED"].includes(c.status);
  const rows = [
    ["Tipo", KIND_LABEL[c.kind]], ["Estado", STATUS_LABEL[c.status]], ["Sobre", c.subject], c.when && ["Fecha", c.when], c.place && ["Lugar", c.place],
    ["Origen", `${SOURCES[c.source?.kind] ?? "Desconocido"}${c.source?.excerpt ? ` — «${c.source.excerpt}»` : ""}`],
    c.confidence != null && ["Confianza", `${Math.round(c.confidence * 100)} % — ${c.reason}`],
    ["Apuntado", day(c.recordedAt)], c.confirmedAt && ["Confirmado", day(c.confirmedAt)], c.validUntil && ["Válido hasta", day(c.validUntil)],
    st.stale && ["Vigencia", `Hace ${st.ageDays} días que no lo confirmas`], c.sensitive && ["Privacidad", "Sensible: no sale en avisos ni en pantallas bloqueadas"],
  ].filter(Boolean);
  return `<section class="card mem-detail" aria-label="Detalle del recuerdo"><div class="row"><h2 class="grow">${esc(c.text)}</h2><button class="link small" data-act="mem-open" data-id="">Cerrar</button></div>
    <dl class="mem-dl">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    ${ui.correcting === id ? `<form class="stack" id="memCorrectForm" data-id="${esc(id)}"><label for="memCorrectText" class="small muted">Cómo es en realidad</label><textarea id="memCorrectText" rows="3" maxlength="600" required>${esc(c.text)}</textarea><div class="btns"><button class="btn" type="submit">Guardar corrección</button><button class="btn ghost" type="button" data-act="mem-correct" data-id="">Cancelar</button></div><p class="small muted">La versión anterior no se borra: queda en el historial como sustituida.</p></form>`
      : `<div class="btns">${live && (c.status === "PROPOSED" || st.stale) ? `<button class="btn small" data-act="mem-confirm" data-id="${esc(id)}">${c.status === "PROPOSED" ? "Es verdad" : "Sigue así"}</button>` : ""}${c.status === "PROPOSED" ? `<button class="btn ghost small" data-act="mem-reject" data-id="${esc(id)}">No es verdad</button>` : ""}${live ? `<button class="btn ghost small" data-act="mem-correct" data-id="${esc(id)}">Corregir</button><button class="btn ghost small" data-act="mem-expire" data-id="${esc(id)}">Ya no es así</button>` : ""}<button class="link small danger-link" data-act="mem-forget" data-id="${esc(id)}">Olvidar para siempre</button></div>`}
    ${h.length > 1 ? `<h3 class="small muted">Historial</h3><ol class="mem-hist">${h.map((x) => `<li${x.id === id ? ' aria-current="true"' : ""}><b>${esc(x.text)}</b> <span class="muted small">${esc(STATUS_LABEL[x.status])} · ${day(x.recordedAt)}${x.validUntil ? ` → ${day(x.validUntil)}` : ""}</span></li>`).join("")}</ol>` : ""}
    ${rel.length ? `<h3 class="small muted">Relacionado</h3><div class="list">${rel.map((r) => claimRow(r.claim, r.why)).join("")}</div>` : ""}</section>`;
}

function voiceCard(brain) {
  const v = brain.voice ?? {};
  const seg = (k, labels) => `<div class="segmented mem-seg" role="group" aria-label="${k === "humor" ? "Humor" : "Franqueza"}">${labels.map((l, i) => `<button data-act="mem-voice" data-k="${k}" data-v="${i}" aria-pressed="${Number(v[k] ?? 1) === i}">${esc(l)}</button>`).join("")}</div>`;
  const sample = { recordedAt: "2026-03-03T10:00:00Z", value: "té verde", text: "Prefiero el té verde" };
  return `<section class="card"><h2>Cómo te hablo</h2>
    <p class="small muted">Humor</p>${seg("humor", HUMOR_LABEL)}<p class="small muted">Franqueza cuando te contradices</p>${seg("franqueza", FRANQUEZA_LABEL)}
    <p class="small mem-sample">Ejemplo inventado: «${esc(line(v, "saved", 1))}». Si un día dices algo distinto de lo que me contaste, te lo señalo citando tus palabras y la fecha.</p>
    <h3 class="small muted">Tus expresiones</h3><p class="small muted">Las uso tal cual, solo en el momento que elijas y de vez en cuando. No me invento frases tuyas.</p>
    ${(v.examples ?? []).length ? `<ul class="mem-ex">${v.examples.map((e, i) => `<li><span class="grow">«${esc(e.text)}» <span class="muted small">${esc(WHEN[e.when] ?? "")}</span></span><button class="link small" data-act="mem-ex-del" data-i="${i}" aria-label="Quitar">Quitar</button></li>`).join("")}</ul>` : ""}
    <form class="row" id="memExampleForm"><label class="sr" for="memExText">Expresión</label><input id="memExText" maxlength="140" placeholder="Una expresión tuya" required><label class="sr" for="memExWhen">Cuándo</label><select id="memExWhen">${Object.entries(WHEN).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select><button class="btn small" type="submit">Añadir</button></form></section>`;
}

function rulesCard(brain) {
  const rules = (brain.learn?.rules ?? []).filter((r) => r.status !== "REJECTED");
  if (!rules.length) return "";
  const st = { ACTIVE: "Activa", PAUSED: "En pausa" };
  return `<section class="card"><h2>Lo que he aprendido</h2><p class="small muted">Lo aplico siempre como deducción: lo verás marcado y lo puedes corregir. Si me corriges a menudo, la regla se pausa sola.</p><ul class="mem-rules">${rules.map((r) => `<li><span class="grow">Gastos ${esc(featureText(r.feature))} → <b>${esc(CATEGORIES[r.label] ?? r.label)}</b><br><span class="muted small">${esc(st[r.status] ?? r.status)} · basada en ${r.basis?.agree ?? "?"} de ${r.basis?.total ?? "?"} respuestas tuyas${r.hits + r.misses ? ` · después: ${r.hits} aciertos, ${r.misses} correcciones` : ""}</span></span>${r.status === "ACTIVE" ? `<button class="link small" data-act="mem-rule" data-id="${esc(r.id)}" data-s="PAUSED">Pausar</button>` : `<button class="link small" data-act="mem-rule" data-id="${esc(r.id)}" data-s="ACTIVE">Reactivar</button>`}<button class="link small danger-link" data-act="mem-rule" data-id="${esc(r.id)}" data-s="REJECTED">Olvidar</button></li>`).join("")}</ul></section>`;
}

/**
 * The whole Memoria page. `ui`: { filter, query, open, correcting, choosing }.
 */
export function memoriaPage(brain, { spending = [], ui = {}, now = new Date() } = {}) {
  const s = stats(brain, now);
  const props = proposals(brain, { spending, now });
  const pr = progress(brain);
  const items = list(brain, { filter: ui.filter ?? "vigentes", query: ui.query ?? "", now });
  return `<section class="card mem-hero"><p class="muted small">Tu memoria externa: lo que me cuentas, con su origen y su fecha. Lo puedes consultar, corregir y borrar. MANU propone; decides tú.</p>
      <div class="mem-stats">${chip(`${s.active} vigentes`, "ok")}${s.proposed ? chip(`${s.proposed} sin confirmar`, "warn") : ""}${s.contested ? chip(`${s.contested} en duda`, "bad") : ""}${s.stale ? chip(`${s.stale} por revisar`) : ""}${chip(`Conocernos: ${pr.done}/${pr.total}`)}</div></section>
    ${props.length ? `<h2 class="section-title">Para ti</h2>${props.map((p) => proposalCard(p, ui)).join("")}` : `<p class="muted small">Nada pendiente. Cuando tenga algo útil que proponerte, aparecerá aquí.</p>`}
    <h2 class="section-title">Apuntar algo</h2>
    <form class="card stack" id="memAddForm"><label for="memText" class="sr">Qué quieres que recuerde</label><textarea id="memText" rows="2" maxlength="600" placeholder="Ej.: el 3 de marzo fui a Oviedo al concierto · mi café favorito es el cortado" required></textarea>
      <div class="row"><label for="memKind" class="sr">Tipo</label><select id="memKind">${["MEMORY", "FACT", "PREFERENCE", "DECISION"].map((k) => `<option value="${k}">${esc(KIND_LABEL[k])}</option>`).join("")}</select><label for="memWhen" class="sr">Fecha</label><input id="memWhen" type="date"><label for="memPlace" class="sr">Lugar</label><input id="memPlace" placeholder="Lugar" maxlength="80"></div>
      <label class="small"><input type="checkbox" id="memSensitive"> Es sensible (no aparece en avisos ni en pantallas bloqueadas)</label>
      <button class="btn" type="submit">Recordar</button><p class="small muted">También desde el chat: «recuerda que…», «¿qué sabes de…?», «olvida lo de…».</p></form>
    ${ui.open ? detail(brain, ui.open, ui, now) : ""}
    <h2 class="section-title">Tus recuerdos</h2>
    <form id="memSearchForm" class="row" role="search"><label for="memQuery" class="sr">Buscar en tu memoria</label><input id="memQuery" type="search" placeholder="Buscar: Oviedo, café, marzo de 2024…" value="${esc(ui.query ?? "")}"><button class="btn small" type="submit">Buscar</button></form>
    <div class="mem-filters" role="group" aria-label="Filtrar recuerdos">${FILTERS.map(([k, l]) => `<button class="chip" data-act="mem-filter" data-f="${k}" aria-pressed="${!ui.query && (ui.filter ?? "vigentes") === k}">${esc(l)}</button>`).join("")}</div>
    ${items.length ? `<div class="list">${items.map((x) => claimRow(x.claim, x.why)).join("")}</div>` : `<p class="muted small">${ui.query ? "No encuentro nada con eso." : "Aquí no hay nada todavía."}</p>`}
    ${rulesCard(brain)}
    ${voiceCard(brain)}
    <p class="small muted">Se guarda en este dispositivo y en tu copia de seguridad. Si activas Tu nube, viaja con el resto de tus datos. No se envía a ninguna IA. Lo que olvidas se borra de verdad: solo queda que hubo un borrado, sin el texto.</p>`;
}

/** A short card for Hoy with the single most useful proposal, if the daily budget allows. */
export function hoyMemCard(p) {
  if (!p) return "";
  return `<section class="card mem-hoy"><p class="small muted mem-kicker">MANU · ${esc(p.title)}</p><p>${esc(p.body)}</p><div class="btns"><button class="btn small" data-sub-go="memoria">Responder</button><button class="link small" data-act="mem-prop" data-key="${esc(p.key)}" data-action="later">Luego</button></div></section>`;
}

export const QUESTION_IDS = QUESTIONS.map((q) => q.id);
