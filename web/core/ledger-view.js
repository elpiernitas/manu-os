// DINERO 2.0 (WEB-111): lo que se ve. HTML puro a partir de core/ledger.js; todo pasa por `esc`.
// Sin estilos en línea (la CSP de la app los prohíbe).
import { euros, CATEGORIES, CATEGORY_EMOJI } from "./money.js";
import { KIND, kindsFor, kindLabel, CASH_USE, LINK, ME, RELIABLE_PENDING_SHARE } from "./ledger.js";

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const fecha = (at) => new Date(at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
const catLabel = (c) => `${CATEGORY_EMOJI[c] ?? "📦"} ${CATEGORIES[c] ?? c ?? "Sin categoría"}`;
const signed = (r) => `${r.dir === "in" ? "+" : "−"}${euros(r.cents)}`;
// El sello de estado de cada movimiento: forma + palabra, nunca solo color.
export function badge(r) {
  if (r.pending > 0) return `<span class="lg-badge lg-pending">Pendiente</span>`;
  const who = r.people?.length ? ` · ${esc([...new Set(r.people.map((p) => p.name.split(" ")[0]))].join(", "))}` : "";
  return `<span class="lg-badge lg-${r.auto ? "auto" : "ok"}">${esc(r.label)}${who}${r.auto ? " · supuesto" : ""}</span>`;
}

/** El resumen del mes: banco, consumo, ingresos propios, dinero de otros, neutro y pendiente. */
export function summaryCard(s, { monthName = "este mes" } = {}) {
  const row = (label, value, help, cls = "") => `<div class="lg-sum-row ${cls}"><div><b>${label}</b><span class="muted small">${help}</span></div><span class="num">${value}</span></div>`;
  return `<section class="card lg-sum" aria-labelledby="lgSumT"><h2 id="lgSumT">Tu dinero de verdad · ${esc(monthName)}</h2>
    ${s.nivel ? `<p class="lg-level lg-level-${esc(s.nivel.toLowerCase())}"><b>Fiabilidad:</b> ${esc(s.nivelLabel)}${s.nivel === "INTERPRETADA" ? ` · ${esc(euros(s.consumoConfirmado))} confirmados, ${esc(euros(s.consumoAuto))} supuestos` : ""}</p>` : ""}
    ${s.fiable ? "" : `<p class="lg-warn" role="status"><b>Cifras provisionales.</b> Hay ${esc(euros(s.pending.cents))} en ${s.pending.count} ${s.pending.count === 1 ? "movimiento" : "movimientos"} sin atribuir (${Math.round(s.pendingShare * 100)} % de lo que se ha movido). Hasta revisarlos no te doy consejos, previsiones ni ahorro.</p>`}
    ${row("Consumo personal", euros(s.consumo), s.consumoAuto ? `Incluye ${esc(euros(s.consumoAuto))} supuestos (compras normales sin revisar)` : "Todo revisado", "lg-main")}
    ${row("Ingresos propios", euros(s.ingreso), "Nómina e ingresos que has dicho que son tuyos")}
    ${row(s.fiable ? (s.ahorro >= 0 ? "Ahorro personal" : "Gastas más de lo que ingresas") : "Ahorro personal", s.fiable ? euros(Math.abs(s.ahorro)) : "—", s.fiable ? "Ingresos propios menos consumo. Sin dinero de otras personas" : "Se calcula cuando no quede casi nada pendiente")}
    ${row("Pendiente de atribuir", euros(s.pending.cents), `${s.pending.count} ${s.pending.count === 1 ? "movimiento" : "movimientos"}: ni tuyo ni de nadie hasta que lo digas`, s.pending.count ? "lg-pend" : "")}
    ${s.others.in || s.others.out ? row("Dinero de otras personas", `+${euros(s.others.in)} / −${euros(s.others.out)}`, "Entró y salió por tu cuenta, pero no es tuyo", "lg-two") : ""}
    ${s.refunds ? row("Devoluciones descontadas", euros(s.refunds), "Ya restadas de la compra a la que corresponden") : ""}
    ${s.refundsLeft ? row("Devoluciones sin compra", euros(s.refundsLeft), "No encuentro una compra de su categoría que rebajar: relaciónalas en su ficha", "lg-pend") : ""}
    ${s.neutral ? row("Movimientos neutros", euros(s.neutral), "Entre tus cuentas, efectivo que volviste a ingresar, devoluciones ya aplicadas") : ""}
    ${row("Movimientos del banco", `−${euros(s.bank.out)} / +${euros(s.bank.in)}`, `${s.bank.count} movimientos tal como los da el banco`, "lg-bank")}
    <div class="btns">${s.pending.count ? `<button class="btn" data-act="lg-filter" data-f="pending">Revisar ${s.pending.count} pendientes</button>` : ""}<button class="btn ghost" data-act="lg-select">Corregir varios</button></div>
    <details><summary class="muted small">Cómo se calcula</summary><ul class="small lg-rules">
      <li>Las compras normales cuentan como consumo tuyo hasta que digas otra cosa («supuesto»).</li>
      <li>Retiradas de efectivo, Bizum y transferencias quedan <b>pendientes</b>: no son consumo ni ingreso hasta que lo digas.</li>
      <li>El dinero de otra persona y su parte de un gasto compartido no cuentan como tuyos.</li>
      <li>Una devolución relacionada rebaja su compra; sin relacionar, rebaja tus compras anteriores de su categoría (90 días como mucho). Así el resumen, las categorías, la serie y los patrones dicen lo mismo.</li>
      <li>Con más del ${Math.round(RELIABLE_PENDING_SHARE * 100)} % pendiente, no hay consejos, previsiones ni ahorro.</li>
      <li>Los movimientos del banco no se cambian nunca: lo que corriges se guarda aparte y se puede deshacer.</li></ul></details></section>`;
}

/** Relaciones sugeridas. Nunca se aplican solas. */
export function suggestionsCard(list, byKey, { only = null } = {}) {
  const items = only ? list.filter((x) => x.a === only || x.b === only) : list;
  if (!items.length) return "";
  return `<section class="card lg-sug" aria-labelledby="lgSugT"><h2 id="lgSugT">${only ? "Posibles relaciones" : "¿Están relacionados?"}</h2>
    <p class="muted small">Son sugerencias: no doy nada por hecho porque coincidan importes.</p>
    ${items.map((x) => { const a = byKey.get(x.a), b = byKey.get(x.b); if (!a || !b) return ""; return `<article class="lg-sug-item">
      <p class="small"><span class="lg-conf lg-conf-${esc(x.confidence)}">Confianza ${esc(x.confidence)}</span> ${esc(LINK[x.kind])}</p>
      <div class="lg-pair"><button class="link" data-act="mv-open" data-k="${esc(a.key)}">${esc(a.name)} · ${fecha(a.at)} · <b class="num">${signed(a)}</b></button><button class="link" data-act="mv-open" data-k="${esc(b.key)}">${esc(b.name)} · ${fecha(b.at)} · <b class="num">${signed(b)}</b></button></div>
      <p class="muted small">Por qué lo pienso: ${esc(x.reasons.join(" · "))}.</p>
      <div class="btns"><button class="btn small-btn" data-act="lg-link" data-kind="${esc(x.kind)}" data-a="${esc(x.a)}" data-b="${esc(x.b)}" data-s="CONFIRMED">Sí, están relacionados</button><button class="btn ghost small-btn" data-act="lg-link" data-kind="${esc(x.kind)}" data-a="${esc(x.a)}" data-b="${esc(x.b)}" data-s="REJECTED">No</button></div></article>`; }).join("")}</section>`;
}

/** Saldos con cada persona: lo suyo que tienes, lo que te deben y lo que debes. */
export function balancesCard(list, { people = [], form = false } = {}) {
  // Dinero suyo en tu cuenta (p. ej., de tu madre) o una deuda: se dice distinto.
  const suyo = (b) => b.items.some((i) => /suyo|su dinero|su compra/.test(i.what));
  const line = (b) => b.cents > 0 ? (suyo(b) ? `Tienes ${euros(b.cents)} suyos en tu cuenta` : `Le debes ${euros(b.cents)}`) : `Te debe ${euros(-b.cents)}`;
  return `<section class="card lg-bal" aria-labelledby="lgBalT"><h2 id="lgBalT">Con otras personas</h2>
    ${list.length ? list.map((b) => `<details class="lg-bal-p"><summary><span class="grow"><b>${esc(b.name)}</b><br><span class="muted small">${esc(line(b))}</span></span><b class="num ${b.cents > 0 ? "" : "pos"}">${b.cents > 0 ? "" : "+"}${esc(euros(Math.abs(b.cents)))}</b></summary>
      <ul class="lg-bal-items">${b.items.slice(0, 12).map((i) => `<li><span class="grow">${esc(i.name)} <span class="muted small">· ${esc(i.what)} · ${fecha(i.at)}</span></span><span class="num">${i.cents > 0 ? "+" : "−"}${esc(euros(Math.abs(i.cents)))}</span>${i.debt ? `<button class="link small" data-act="lg-debt-drop" data-id="${esc(i.debt)}">Quitar</button>` : ""}</li>`).join("")}</ul>
      <div class="btns"><button class="btn ghost small-btn" data-act="lg-settle" data-who="${esc(b.who)}" data-name="${esc(b.name)}" data-cents="${b.cents}">Dejar a cero (saldado sin movimiento)</button></div>
      <p class="muted small">Si te pagó o le pagaste por Bizum, mejor abre ese movimiento y márcalo como «pago de una deuda».</p></details>`).join("") : '<p class="muted small">Nadie te debe ni guardas dinero de nadie.</p>'}
    ${form ? `<form id="lgDebtForm" class="lg-debt-form"><p class="small"><b>Apuntar una deuda sin movimiento</b> (pagó otra persona por ti, o al revés)</p>
      <label for="lgDebtWho">Persona</label><input id="lgDebtWho" list="lgPeople" maxlength="40" required autocomplete="off"><datalist id="lgPeople">${people.map((p) => `<option value="${esc(p.name)}"></option>`).join("")}</datalist>
      <label for="lgDebtCents">Importe (€)</label><input id="lgDebtCents" inputmode="decimal" required>
      <fieldset class="lg-radios"><legend class="small">Quién debe</legend><label><input type="radio" name="lgDebtDir" value="owesMe" checked> Me debe</label><label><input type="radio" name="lgDebtDir" value="iOwe"> Le debo</label></fieldset>
      <label for="lgDebtNote">Nota</label><input id="lgDebtNote" maxlength="120" placeholder="Cena del sábado">
      <div class="btns"><button class="btn" type="submit">Apuntar</button><button class="btn ghost" type="button" data-act="lg-debt-form">Cancelar</button></div></form>` : '<button class="link small" data-act="lg-debt-form">Apuntar una deuda sin movimiento</button>'}</section>`;
}

// Lo que ya decía la fila de antes: subcategoría, origen y de dónde sale la categoría (si no la
// has fijado tú en la ficha).
function meta(r) {
  const x = r.m?.raw ?? {};
  const own = r.category === (x.category ?? null);
  const why = !own ? "categoría tuya" : x.review ? '<b class="review">revisar</b>' : x.learned && x.inferred ? `deducción aprendida (${Math.round(x.learned.confidence * 100)} %)` : x.inferred ? "categoría propuesta" : x.ruled ? "según tus reglas" : "";
  return [x.sub ? esc(x.sub) : "", x.source === "BANK" ? "banco" : x.source === "SABADELL" ? "Sabadell" : "", r.dir === "out" ? why : ""].filter(Boolean).map((t) => ` · ${t}`).join("");
}
/** Fila de la lista de movimientos (toca para abrir la ficha). */
export function moveRow(r, { selecting = false, picked = false } = {}) {
  return `<div class="lg-row${r.pending > 0 ? " lg-row-pend" : ""}">${selecting ? `<label class="lg-pick"><input type="checkbox" data-act="lg-pick" data-k="${esc(r.key)}"${picked ? " checked" : ""} aria-label="Elegir ${esc(r.name)}"></label>` : ""}
    <button class="lg-open" data-act="mv-open" data-k="${esc(r.key)}"><span class="cat-emoji" aria-hidden="true">${r.dir === "in" ? "💶" : CATEGORY_EMOJI[r.category] ?? "📦"}</span>
    <span class="grow"><span class="lg-name">${esc(r.name)}</span><span class="muted small">${fecha(r.at)}${meta(r)} · ${badge(r)}</span></span>
    <span class="lg-amt"><b class="num ${r.dir === "in" ? "pos" : ""}">${signed(r)}</b>${r.dir === "out" && r.consumo !== r.cents && r.pending === 0 ? `<span class="muted small">tuyo: ${esc(euros(r.consumo))}</span>` : ""}</span></button></div>`;
}

// ---------- La ficha de un movimiento ----------
/**
 * `r` = fila resuelta; `d` = borrador del formulario { kind, name, category, parts, cashUse, note }.
 * `ctx` = { people, suggestions (html), links: [{id, kind, other, status}], history: [notas] }.
 */
export function editorPage(r, d, ctx = {}) {
  const kinds = kindsFor(r.dir);
  const parts = d.parts ?? [];
  const sum = parts.reduce((s, p) => s + (p.cents || 0), 0);
  const needsParts = ["OTHERS", "SHARED", "SETTLE"].includes(d.kind);
  const chosen = new Set(parts.map((p) => p.who));
  const chips = (ctx.people ?? []).filter((p) => !chosen.has(p.who)).slice(0, 10).map((p) => `<button type="button" class="chip" data-act="mv-person" data-who="${esc(p.who)}" data-name="${esc(p.name)}">${esc(p.name)}</button>`).join("");
  const partRows = parts.map((p) => `<div class="lg-part" data-who="${esc(p.who)}">
      <div class="lg-part-name"><b>${esc(p.who === ME ? "Yo" : p.name)}</b>${p.who === ME ? "" : `<button type="button" class="link small" data-act="mv-person-del" data-who="${esc(p.who)}" aria-label="Quitar a ${esc(p.name)}">Quitar</button>`}</div>
      <div class="lg-part-in"><label><span class="sr">Importe de ${esc(p.who === ME ? "mí" : p.name)} en euros</span><input inputmode="decimal" data-mv-cents="${esc(p.who)}" value="${(p.cents / 100).toFixed(2).replace(".", ",")}"><span aria-hidden="true">€</span></label>
      <label><span class="sr">Porcentaje de ${esc(p.who === ME ? "mí" : p.name)}</span><input inputmode="decimal" data-mv-pct="${esc(p.who)}" value="${String(r.cents ? Math.round((p.cents / r.cents) * 1000) / 10 : 0).replace(".", ",")}"><span aria-hidden="true">%</span></label></div></div>`).join("");
  const kindHelp = { MINE: r.dir === "out" ? "Lo pagaste para ti." : "Es tuyo: cuenta como ingreso propio.", OTHERS: r.dir === "out" ? "Lo pagaste con dinero de otra persona, o es suyo (puedes dejar una parte para ti)." : "Es dinero de otra persona que está en tu cuenta (p. ej., de tu madre).", SHARED: "Pagaste tú y lo repartes: lo de los demás te lo deben.", TRANSFER: "Movimiento entre tus cuentas: ni gasto ni ingreso.", CASH: r.dir === "out" ? "Sacaste efectivo: dime qué pasó con él." : "Ingresaste efectivo: ni gasto ni ingreso.", REFUND: "Te devolvieron una compra: rebaja lo que gastaste.", SETTLE: r.dir === "out" ? "Pagaste una deuda a alguien." : "Alguien te paga lo que te debía.", REVIEW: "No lo sabes todavía: no cuenta ni como tuyo ni como de nadie." };
  return `<button class="link" data-act="mv-close">‹ Dinero</button>
  <div class="lg-ed-head"><h1>${esc(d.name || r.name)}</h1><p class="lg-ed-amt num ${r.dir === "in" ? "pos" : ""}">${signed(r)}</p></div>
  <div class="stack">
  <section class="card lg-orig" aria-label="Lo que dice el banco"><h2>Lo que dice el banco</h2>
    <dl class="lg-dl"><dt>Concepto original</dt><dd>${esc(r.concept || "—")}</dd><dt>Fecha</dt><dd>${fecha(r.at)}</dd><dt>Importe</dt><dd class="num">${signed(r)}</dd><dt>Origen</dt><dd>${esc(r.m?.source === "SABADELL" ? "Sabadell (lectura)" : r.m?.source === "BANK" ? "Extracto del banco" : r.m?.source ?? "Apuntado en MANU")}</dd></dl>
    <p class="muted small">Esto no se cambia nunca. Lo que corrijas abajo se guarda aparte y se puede deshacer.</p></section>
  <form id="mvForm" class="card lg-form" aria-label="Qué es para ti"><h2>Qué es para ti</h2>
    <label for="mvName">Nombre</label><input id="mvName" maxlength="80" value="${esc(d.name ?? "")}" placeholder="${esc(r.name)}" autocomplete="off">
    <fieldset class="lg-kinds"><legend>Tipo</legend>${kinds.map((k) => `<label class="lg-kind${d.kind === k ? " on" : ""}"><input type="radio" name="mvKind" value="${k}"${d.kind === k ? " checked" : ""}><span><b>${esc(kindLabel(k, r.dir))}</b><span class="muted small">${esc(kindHelp[k])}</span></span></label>`).join("")}</fieldset>
    ${d.kind === "CASH" && r.dir === "out" ? `<fieldset class="lg-radios"><legend>¿Qué pasó con el efectivo?</legend>${Object.entries(CASH_USE).map(([k, l]) => `<label><input type="radio" name="mvCash" value="${k}"${(d.cashUse ?? "UNKNOWN") === k ? " checked" : ""}> ${esc(l)}</label>`).join("")}<p class="muted small">Si lo volviste a ingresar, relaciónalo abajo con ese ingreso.</p></fieldset>` : ""}
    ${r.dir === "out" || d.kind === "REFUND" ? `<label for="mvCat">Categoría</label><select id="mvCat">${Object.keys(CATEGORIES).map((k) => `<option value="${k}"${k === (d.category ?? r.category) ? " selected" : ""}>${esc(catLabel(k))}</option>`).join("")}</select>` : ""}
    ${needsParts ? `<fieldset class="lg-parts"><legend>${d.kind === "SETTLE" ? "¿Con quién?" : d.kind === "OTHERS" ? "¿De quién es?" : "Reparto"}</legend>
      ${partRows || '<p class="muted small">Elige personas abajo.</p>'}
      <p class="lg-total small" id="mvTotal" aria-live="polite">${sum === r.cents ? `Repartido: ${esc(euros(sum))} de ${esc(euros(r.cents))}` : sum < r.cents ? `Repartido: ${esc(euros(sum))} de ${esc(euros(r.cents))} · lo que falta ${d.kind === "SETTLE" ? "debe asignarse" : "será tuyo"}` : `Te pasas: ${esc(euros(sum))} de ${esc(euros(r.cents))}`}</p>
      ${d.kind === "SHARED" && parts.length > 1 ? '<button type="button" class="btn ghost small-btn" data-act="mv-equal">A partes iguales</button>' : ""}
      <div class="chips lg-people" role="group" aria-label="Personas">${chips}</div>
      <div class="lg-add"><label for="mvPerson" class="sr">Otra persona</label><input id="mvPerson" maxlength="40" placeholder="Otra persona (p. ej., Mamá)" autocomplete="off"><button type="button" class="btn ghost small-btn" data-act="mv-person-add">Añadir</button></div></fieldset>` : ""}
    <label for="mvNote">Notas</label><textarea id="mvNote" rows="2" maxlength="500">${esc(d.note ?? "")}</textarea>
    <p class="lg-effect small"><b>Importe personal atribuible:</b> ${esc(euros(ctx.preview?.personal ?? 0))}${ctx.preview?.pending ? ` · <span class="lg-badge lg-pending">${esc(euros(ctx.preview.pending))} pendiente</span>` : ""}${ctx.preview?.others ? ` · de otras personas: ${esc(euros(ctx.preview.others))}` : ""}</p>
    <div class="btns"><button class="btn" type="submit">Guardar</button>${r.auto ? "" : '<button type="button" class="btn ghost" data-act="mv-revert">Volver a lo que dice el banco</button>'}</div>
    ${r.auto && r.why ? `<p class="muted small">Ahora mismo: ${esc(r.why)}.</p>` : ""}</form>
  ${ctx.suggestionsHtml ?? ""}
  ${ctx.links?.length ? `<section class="card"><h2>Relacionado</h2>${ctx.links.map((x) => `<div class="row"><span class="grow">${esc(LINK[x.kind])}: <button class="link" data-act="mv-open" data-k="${esc(x.otherKey)}">${esc(x.otherName)}</button><br><span class="muted small">${x.status === "CONFIRMED" ? "Confirmado por ti" : "Descartado por ti"}</span></span><button class="link small" data-act="lg-unlink" data-id="${esc(x.id)}">Deshacer</button></div>`).join("")}</section>` : ""}
  ${ctx.history?.length ? `<section class="card"><h2>Historial</h2>${ctx.history.map((h, i) => `<div class="row"><span class="grow">${esc(kindLabel(h.kind, r.dir))}${h.name ? ` · ${esc(h.name)}` : ""}<br><span class="muted small">${esc(new Date(h.at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</span></span><button class="link small" data-act="mv-restore" data-i="${i}">Restaurar</button></div>`).join("")}</section>` : ""}
  </div>`;
}

// ---------- Corrección múltiple ----------
export function bulkBar(n) {
  return `<section class="card lg-bulk" aria-label="Corregir varios"><p><b>${n}</b> ${n === 1 ? "movimiento elegido" : "movimientos elegidos"}</p>
    <label for="lgBulkKind">Tipo</label><select id="lgBulkKind"><option value="">Sin cambiar</option>${Object.keys(KIND).filter((k) => !["SHARED", "OTHERS", "SETTLE", "REFUND"].includes(k)).map((k) => `<option value="${k}">${esc(KIND[k].out ?? KIND[k].in)}</option>`).join("")}</select>
    <label for="lgBulkCat">Categoría</label><select id="lgBulkCat"><option value="">Sin cambiar</option>${Object.keys(CATEGORIES).map((k) => `<option value="${k}">${esc(catLabel(k))}</option>`).join("")}</select>
    <div class="btns"><button class="btn" data-act="lg-bulk-plan"${n ? "" : " disabled"}>Revisar los cambios</button><button class="btn ghost" data-act="lg-select">Cancelar</button></div>
    <p class="muted small">Nada se guarda hasta que veas la lista y confirmes.</p></section>`;
}
export function bulkPreview(plan) {
  const d = (c) => `${c > 0 ? "+" : c < 0 ? "−" : ""}${euros(Math.abs(c))}`;
  return `<button class="link" data-act="lg-bulk-cancel">‹ Volver</button><h1>Revisa antes de guardar</h1>
  <div class="stack"><section class="card"><p>Consumo personal ${esc(d(plan.delta.consumo))} · pendiente ${esc(d(plan.delta.pending))} · ingresos propios ${esc(d(plan.delta.ingreso))}</p>
  <ul class="lg-plan">${plan.rows.map((x) => `<li><b>${esc(x.name)}</b><br><span class="small">${esc(x.before.label)} · ${esc(CATEGORIES[x.before.category] ?? "—")} → <b>${esc(x.after.label)} · ${esc(CATEGORIES[x.after.category] ?? "—")}</b></span>${x.skipped ? `<br><span class="small lg-warn-t">No se cambia: ${esc(x.skipped)}</span>` : ""}</li>`).join("")}</ul>
  <div class="btns"><button class="btn" data-act="lg-bulk-apply">Aplicar a ${plan.rows.length - plan.skipped.length}</button><button class="btn ghost" data-act="lg-bulk-cancel">Cancelar</button></div>
  <p class="muted small">Cada movimiento guarda su versión anterior: puedes restaurarla desde su ficha.</p></section></div>`;
}
