// HORIZONTE (WEB-108): piezas visuales del tema. Reciben datos ya calculados por core/horizonte.js
// (o por los módulos de siempre) y devuelven HTML. Todo el texto pasa por `esc`. Sin estilos en
// línea: la CSP de la app los prohíbe, así que los tamaños van como atributos SVG o clases.
import { euros } from "../core/money.js";
import { FRANJAS, ESTADOS, describeCielo } from "../core/horizonte.js";

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"], DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const fechaCorta = (iso) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}` : ""; };

/** MANU: dos ojos asomados a la línea del horizonte. Gestos: calma, piensa, feliz. */
export function hzCara(gesto = "calma", { grande = false, etiqueta = null } = {}) {
  const ojos = gesto === "feliz"
    ? '<path class="hz-ojo" d="M17 21q5-8 10 0M37 21q5-8 10 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'
    : '<g class="hz-ojos"><ellipse class="hz-ojo" cx="22" cy="19" rx="5" ry="6.5" fill="currentColor"/><ellipse class="hz-ojo" cx="42" cy="19" rx="5" ry="6.5" fill="currentColor"/></g>';
  const a11y = etiqueta ? `role="img" aria-label="${esc(etiqueta)}"` : 'aria-hidden="true"';
  return `<svg class="hz-cara hz-cara-${esc(gesto)}${grande ? " hz-cara-grande" : ""}" viewBox="0 0 64 40" ${a11y}>${ojos}<path class="hz-agua" d="M2 30c5 0 5-3 10-3s5 3 10 3 5-3 10-3 5 3 10 3 5-3 10-3 5 3 10 3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><g opacity=".28" fill="currentColor"><ellipse cx="22" cy="36" rx="4" ry="1.6"/><ellipse cx="42" cy="36" rx="4" ry="1.6"/></g></svg>`;
}
export const hzOlas = () => '<svg class="hz-olas" viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true"><path class="hz-olas-mar" d="M0 10c25 0 25-8 50-8s25 8 50 8 25-8 50-8 25 8 50 8 25-8 50-8 25 8 50 8 25-8 50-8 25 8 50 8v14H0z"/><path class="hz-olas-papel" d="M0 17c25 0 25-6 50-6s25 6 50 6 25-6 50-6 25 6 50 6 25-6 50-6 25 6 50 6 25-6 50-6 25 6 50 6v7H0z"/></svg>';
/** Sello de certeza: forma + palabra, nunca solo color. */
export const hzSello = (tipo) => { const t = { HECHO: "Hecho", HIPOTESIS: "Hipótesis", PENDIENTE: "Pendiente", ...ESTADOS }[tipo] ?? tipo; return `<span class="hz-sello hz-sello-${esc(String(tipo).toLowerCase())}">${esc(t)}</span>`; };

// ---------- Hoy ----------
/**
 * La portada. `p` = portada() de core/horizonte.js; `c` = cielo(); `w` = tiempo real o null.
 * `minutos` = posición del dial (null = ahora).
 */
export function hzPortada({ p, c, w = null, ciudad = "", fecha = new Date(), minutos = null, modo = "" }) {
  const ahora = minutos == null ? fecha : new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), Math.floor(minutos / 60), minutos % 60);
  const valor = ahora.getHours() * 60 + ahora.getMinutes() - ((ahora.getHours() * 60 + ahora.getMinutes()) % 15);
  const lista = [...p.antes.map((x) => [x, true]), ...p.luego.map((x) => [x, false])];
  const temp = w?.now?.temp != null ? ` · ${esc(w.now.temp)}°` : "";
  return `<header class="hz-portada">
    <p class="hz-cabecera" aria-hidden="true">MANU</p>
    <h1 class="sr">Hoy</h1>
    <p class="hz-tira"><span class="hz-chapa">Nº ${p.numero}</span><span class="hz-chapa">${DIAS[fecha.getDay()]} ${fecha.getDate()} ${MESES[fecha.getMonth()]}</span><span class="hz-chapa">${esc(ciudad)}${w ? ` · ${esc(describeCielo(c))}${temp}` : " · sin datos del tiempo"}</span>${modo ? `<span class="hz-chapa">${esc(modo)}</span>` : ""}</p>
  </header>${hzOlas()}
  <section class="hz-papel hz-titular-caja" aria-labelledby="hzTitular">
    <p class="hz-ante">${esc(p.antetitulo)}${minutos == null ? "" : " · viajando por el día"}</p>
    <p class="hz-titular" id="hzTitular">${esc(p.titular)}</p>
    <div class="hz-dial"><label for="hzDial">Arrastra el día <output id="hzDialOut">${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}</output></label>
      <input id="hzDial" type="range" min="0" max="1425" step="15" value="${valor}" aria-valuetext="${ahora.getHours()} horas ${ahora.getMinutes()} minutos">
      ${minutos == null ? "" : '<button class="link small" data-act="hz-dial-ahora">Volver a ahora</button>'}</div>
    ${lista.length ? `<ol class="hz-linea">${lista.map(([x, pasado]) => `<li class="${pasado ? "hz-pasado" : ""}"><time>${esc(x.hora)}</time><span>${esc(x.title)}</span>${x.tipo === "aviso" ? '<span class="hz-mini">aviso</span>' : ""}</li>`).join("")}</ol>`
      : `<p class="hz-nota">${p.todoElDia.length ? `Todo el día: ${p.todoElDia.map(esc).join(" · ")}` : "Sin citas ni avisos hoy. Si tu agenda está en Google, actualízala desde Agenda."}</p>`}
    <button class="link small" data-tab="agenda">Abrir la agenda</button>
  </section>`;
}

/** La botella: la propuesta real de MANU (motor de propuestas). Sin propuesta, no hay botella. */
export function hzBotella(prop) {
  if (!prop) return "";
  const acts = (prop.actions ?? []).filter((a) => !["choose", "change", "later"].includes(a.id)).slice(0, 3);
  return `<aside class="hz-botella" aria-label="Una propuesta de MANU">
    <div class="hz-botella-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3h4v4l2.5 3.5V19a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-8.5L10 7zM7.5 13h9"/></svg></div>
    <div class="hz-botella-c"><p class="hz-ante">Ha llegado una botella · ${esc(prop.title)}</p><p class="hz-botella-t">${esc(prop.body)}</p>
      ${prop.why ? `<details><summary>Por qué te lo propongo</summary><p class="hz-nota">${esc(prop.why)}</p></details>` : ""}
      <div class="btns">${acts.map((a) => `<button class="btn small${a.primary ? "" : " ghost"}" data-act="mem-prop" data-key="${esc(prop.key)}" data-action="${esc(a.id)}">${esc(a.label)}</button>`).join("")}<button class="btn ghost small" data-sub-go="memoria">Más opciones</button><button class="link small" data-act="mem-prop" data-key="${esc(prop.key)}" data-action="later">Luego</button></div></div></aside>`;
}

// ---------- Dinero ----------
function mareografo(marea) {
  const ns = marea.map((m) => m.nivel), min = Math.min(...ns, 0), max = Math.max(...ns, 0), W = 360, H = 120;
  const x = (i) => (i / Math.max(1, marea.length - 1)) * W, y = (n) => H - 8 - ((n - min) / (max - min || 1)) * (H - 20);
  const linea = marea.map((m, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(m.nivel).toFixed(1)}`).join("");
  const alta = ns.indexOf(max), baja = ns.indexOf(min);
  return `<figure class="hz-mareografo"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Marea de ${marea.length} días: lo que entra menos lo que sale. Máximo ${esc(euros(max))}, mínimo ${esc(euros(min))}, hoy ${esc(euros(ns.at(-1) ?? 0))}.">
    <line x1="0" x2="${W}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="hz-cero"/><path d="${linea}L${W} ${H}L0 ${H}Z" class="hz-agua-g"/><path d="${linea}" class="hz-cresta"/>
    <circle cx="${x(alta).toFixed(1)}" cy="${y(max).toFixed(1)}" r="4" class="hz-marca"/><circle cx="${x(baja).toFixed(1)}" cy="${y(min).toFixed(1)}" r="4" class="hz-marca hz-marca-hueca"/></svg>
    <figcaption><span>● Pleamar ${esc(euros(max))}</span><span>○ Bajamar ${esc(euros(min))}</span><span>Ingresos menos gastos apuntados en MANU desde hace ${marea.length} días. No es tu saldo.</span></figcaption></figure>`;
}
function momentos(m) {
  const max = Math.max(1, ...m.flat()), cw = 52, ch = 22, g = 4, ox = 22, oy = 16;
  const celdas = m.flatMap((fila, d) => fila.map((c, f) => `<rect x="${ox + f * (cw + g)}" y="${oy + d * (ch + g)}" width="${cw}" height="${ch}" class="hz-celda" fill-opacity="${(0.06 + 0.94 * (c / max)).toFixed(2)}"><title>${["L", "M", "X", "J", "V", "S", "D"][d]} · ${FRANJAS[f]}: ${esc(euros(c))}</title></rect>`)).join("");
  const W = ox + 4 * (cw + g), H = oy + 7 * (ch + g);
  return `<svg class="hz-momentos" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gasto por día de la semana y franja horaria">${FRANJAS.map((f, i) => `<text x="${ox + i * (cw + g) + cw / 2}" y="10" text-anchor="middle">${f.slice(0, 5)}</text>`).join("")}${["L", "M", "X", "J", "V", "S", "D"].map((d, i) => `<text x="8" y="${oy + i * (ch + g) + 15}" text-anchor="middle">${d}</text>`).join("")}${celdas}</svg>`;
}
const hora = (iso) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
function noche(n, estado) {
  const f = new Date(n.inicio);
  return `<article class="hz-noche"><p class="hz-ante">Una noche, en pagos</p><h3>${esc(f.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }))}</h3>
    <p class="hz-noche-total">${esc(euros(n.total))} <span>· ${n.paradas.length} pagos · ${n.sitios} ${n.sitios === 1 ? "sitio" : "sitios"}</span></p>
    <ol class="hz-ruta">${n.paradas.map((p) => `<li class="${p.cents >= 2000 ? "hz-grande" : ""}"><time>${esc(hora(p.at))}</time><span>${esc(p.sitio)}</span><b>${esc(euros(p.cents))}</b></li>`).join("")}</ol>
    <p>${hzSello("HECHO")} Pagos, horas e importes de tus movimientos.</p>
    ${estado === "si" ? `<p>${hzSello("confirmada")} Me dijiste que fue una fiesta: está en tu memoria.</p>` : estado === "no" ? '<p class="hz-nota">Vale: no era lo que parecía. No te lo vuelvo a preguntar de esta noche.</p>'
      : `<p>${hzSello("HIPOTESIS")} ¿Fue una noche de fiesta?</p><div class="btns"><button class="btn small" data-act="hz-noche" data-id="${esc(n.id)}" data-v="si">Sí, apúntalo</button><button class="btn ghost small" data-act="hz-noche" data-id="${esc(n.id)}" data-v="no">No</button></div>`}</article>`;
}
/** Mareas: lectura de tus movimientos reales. `respuestas` = { [idNoche]: "si"|"no" }. */
export function hzMareas(m, { respuestas = {} } = {}) {
  if (m.vacio) return `<section class="card hz-mareas"><p class="hz-ante">Mareas · 90 días</p><p class="hz-titular hz-t2">Mar en calma.</p><p class="hz-nota">Aún no hay movimientos en MANU. Apunta un gasto, importa un extracto o, con Sabadell conectado, usa «Importar todo (90 días)». No me invento ninguno.</p></section>`;
  const n = m.noches.find((x) => !respuestas[x.id]) ?? m.noches[0];
  return `<section class="card hz-mareas" aria-labelledby="hzMareasT"><p class="hz-ante">Mareas · 90 días · ${m.gastos} ${m.gastos === 1 ? "gasto" : "gastos"} y ${m.ingresos} ${m.ingresos === 1 ? "ingreso" : "ingresos"}</p><h2 id="hzMareasT" class="sr">Mareas</h2>
    ${mareografo(m.marea)}
    ${m.hallazgos.length ? `<ul class="hz-hallazgos">${m.hallazgos.map((h) => `<li>${hzSello(h.tipo)}<p>${esc(h.texto)}${h.cents != null ? ` <b>${esc(euros(h.cents))}</b>${h.centsLabel ? ` ${esc(h.centsLabel)}` : ""}` : ""}</p><details><summary>¿De dónde sale?</summary><p class="hz-nota">${esc(h.base)}</p></details>${h.ir === "review" ? '<button class="link small" data-act="money-filter">Revisar ahora</button>' : ""}</li>`).join("")}</ul>` : '<p class="hz-nota">Todavía hay pocos movimientos para sacar conclusiones.</p>'}
    ${m.total ? `<h3 class="hz-ante">Cuándo se te va</h3>${momentos(m.momentos)}<p class="hz-nota">Más oscuro, más gasto. Sin Bizum ni transferencias.</p>` : ""}
    ${n ? noche(n, respuestas[n.id]) : ""}</section>`;
}

// ---------- MANU: constelación ----------
export function hzConstelacion(c, { sel = null, detalle = "" } = {}) {
  if (!c.estrellas.length) return `<section class="hz-cons"><p class="hz-titular hz-t2">Cielo despejado.</p><p class="hz-nota">Todavía no recuerdo nada de ti. Cuéntame algo en el chat («recuerda que…») o responde a una pregunta en Tú → Memoria. No relleno el cielo con estrellas falsas.</p></section>`;
  const P = (e) => [(e.x * 360 + 20).toFixed(1), (e.y * 360 + 20).toFixed(1)];
  const pos = Object.fromEntries(c.estrellas.map((e) => [e.id, e]));
  const hilos = sel ? c.hilos.filter((h) => h.a === sel || h.b === sel) : [];
  return `<section class="hz-cons" aria-labelledby="hzConsT"><h2 id="hzConsT" class="sr">Constelación</h2>
    <p class="hz-nota">Cada estrella es algo que recuerdo de ti. Toca una para ver de dónde sale, sus hilos y qué hacer con ella.${c.total > c.estrellas.length ? ` Se ven las ${c.estrellas.length} más recientes de ${c.total}.` : ""}</p>
    <p class="hz-leyenda">${Object.entries(ESTADOS).map(([k, l]) => `<span><svg viewBox="0 0 16 16" class="hz-st hz-st-${k}" aria-hidden="true"><circle cx="8" cy="8" r="5"/></svg>${esc(l)} · ${c.cuenta[k]}</span>`).join("")}</p>
    <div class="hz-cielo-mem"><svg viewBox="0 0 400 400" role="group" aria-label="Mapa de recuerdos">
      ${c.hilos.map((h) => { const [x1, y1] = P(pos[h.a]), [x2, y2] = P(pos[h.b]); const on = sel && (h.a === sel || h.b === sel); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="hz-hilo${on ? " hz-hilo-on" : ""}"/>`; }).join("")}
      ${c.estrellas.map((e) => { const [x, y] = P(e); return `<g class="hz-estrella hz-estrella-${e.estado}${e.id === sel ? " hz-elegida" : ""}" role="button" tabindex="0" data-act="hz-estrella" data-id="${esc(e.id)}" aria-label="${esc(ESTADOS[e.estado])}: ${esc(e.texto)}" aria-pressed="${e.id === sel}" transform="translate(${x} ${y})"><circle r="20" class="hz-toque"/><circle r="6.5" class="hz-nucleo"/>${e.estado === "pendiente" || e.estado === "caducada" ? '<circle r="11.5" class="hz-anillo"/>' : ""}</g>`; }).join("")}
    </svg></div>
    ${sel ? `<div class="hz-cons-panel" aria-live="polite">${hilos.length ? `<p class="hz-hilo-texto">${hzSello("HECHO")} ${hilos.length === 1 ? "Un hilo" : `${hilos.length} hilos`}: ${hilos.map((h) => `«${esc(pos[h.a === sel ? h.b : h.a].texto)}» (${esc(h.por.join(", "))})`).join(" · ")}</p>` : '<p class="hz-nota">Esta estrella no comparte tema, lugar, fecha ni cuestión con ninguna otra. No me invento hilos.</p>'}${detalle}</div>` : ""}
  </section>`;
}

// ---------- Proyectos: el astillero ----------
/** El casco: lo construido en tinta; lo que falta, en línea de plano. */
export function hzCasco(b, { botadura = false } = {}) {
  const a = b.avance ?? 0, id = `hzc-${String(b.id).replace(/[^A-Za-z0-9_-]/g, "")}${botadura ? "-b" : ""}`;
  return `<svg class="hz-plano" viewBox="0 0 200 96" aria-hidden="true"><defs><clipPath id="${id}"><rect x="0" y="0" width="${(a * 200).toFixed(0)}" height="96"/></clipPath></defs>
    <g class="hz-plano-linea"><path d="M12 54h176l-24 32H38z"/><path d="M100 54V8l52 38H100M96 14L52 46h44"/></g>
    <g class="hz-plano-hecho" clip-path="url(#${id})"><path d="M12 54h176l-24 32H38z"/><path d="M100 54V8l52 38H100M96 14L52 46h44"/></g>
    <path class="hz-plano-cota" d="M12 92h176M12 89v6M188 89v6"/></svg>`;
}
export const hzBarcoCarta = (b) => `<button class="proj-card hz-barco" data-act="proj-open" data-id="${esc(b.id)}">${hzCasco(b)}<b>${esc(b.emoji)} ${esc(b.nombre)}</b><span class="muted small">${b.botado ? `En el agua desde el ${esc(fechaCorta(b.botado))}` : b.avance == null ? "Solo el plano: sin piezas" : `${b.hechas} de ${b.piezas.length} piezas`} · ${b.fuentes} ${b.fuentes === 1 ? "fuente" : "fuentes"}</span>${b.listo && !b.botado ? '<span class="hz-listo">Lista para botar</span>' : ""}</button>`;
/** El bloque de astillero dentro de un proyecto real. `ui.botar` = id en espera de confirmar. */
export function hzAstillero(b, ui = {}) {
  return `<section class="card hz-astillero" aria-labelledby="hzAstT"><div class="row"><h2 id="hzAstT" class="grow">Astillero</h2><span class="muted small">${b.avance == null ? "Solo el plano" : `${Math.round(b.avance * 100)} %`}</span></div>
    ${hzCasco(b)}
    <p class="hz-nota">El casco crece con las piezas que tú creas y marcas. Sin piezas no hay porcentaje: no me lo invento.</p>
    ${b.piezas.length ? `<ul class="hz-piezas">${b.piezas.map((x) => `<li><label><input type="checkbox" data-act="hz-pieza" data-id="${esc(x.id)}"${x.done ? " checked" : ""}><span>${esc(x.t)}</span></label><button class="link small" data-act="hz-pieza-del" data-id="${esc(x.id)}" aria-label="Quitar la pieza ${esc(x.t)}">Quitar</button></li>`).join("")}</ul>` : ""}
    <form id="hzPiezaForm" class="composer-inline"><label for="hzPieza" class="sr">Nueva pieza</label><input id="hzPieza" maxlength="120" placeholder="Nueva pieza: «Tres rutas de logo»" autocomplete="off"><button class="btn" type="submit">Añadir</button></form>
    ${b.botado ? `<p>${hzSello("HECHO")} Botado el ${esc(fechaCorta(b.botado))}.</p><button class="link small" data-act="hz-varar">Volver a ponerlo en el astillero</button>`
      : ui.botar === b.id ? `<div class="hz-confirmar" role="alert"><p><b>¿Botarlo?</b> El proyecto pasa a «en el agua». Sus fuentes y su chat no cambian, y puedes deshacerlo.</p><div class="btns"><button class="btn" data-act="hz-botar-si">Sí, botar</button><button class="btn ghost" data-act="hz-botar-no">Todavía no</button></div></div>`
      : `<button class="btn${b.listo ? "" : " ghost"} block" data-act="hz-botar"${b.listo ? "" : " disabled"}>${b.listo ? "Botar al agua" : b.piezas.length ? "Faltan piezas para botarlo" : "Añade piezas para poder botarlo"}</button>`}</section>`;
}
export const hzBotadura = (b) => `<div class="hz-botadura" role="dialog" aria-modal="true" aria-labelledby="hzBotNombre"><div class="hz-bot-cielo"><div class="hz-gallardetes" aria-hidden="true">${"<i></i>".repeat(9)}</div>
  <p class="hz-ante">Botadura</p><p class="hz-bot-nombre" id="hzBotNombre">${esc(b.nombre)}</p><p class="hz-bot-texto">Ya flota. ${b.piezas.length} piezas, ${b.fuentes} ${b.fuentes === 1 ? "fuente" : "fuentes"}.</p></div>
  <div class="hz-bot-mar"><div class="hz-bot-barco">${hzCasco({ ...b, avance: 1 }, { botadura: true })}</div><span class="hz-salpica" aria-hidden="true"></span></div>
  <div class="hz-bot-fila"><button class="btn" data-act="hz-botadura-fin">Seguir</button></div></div>`;

// ---------- Tú ----------
export function hzBitacora(grupos) {
  if (!grupos.length) return `<section class="card hz-bitacora"><p class="hz-ante">Bitácora</p><p class="hz-nota">Todavía no sé nada de ti que pueda contarte. Mejor eso que inventármelo.</p></section>`;
  return `<section class="card hz-bitacora" aria-labelledby="hzBitT"><div class="row"><h2 id="hzBitT" class="grow">Bitácora</h2><button class="link small" data-sub="memoria">Toda la memoria</button></div>
    <p class="hz-nota">Lo que creo de ti. Toca una frase para ver de dónde sale y confirmarla, corregirla, darla por pasada u olvidarla.</p>
    ${grupos.map((g) => `<h3 class="hz-ante">${esc(g.titulo)}</h3><p class="hz-retrato">${g.frases.map((f) => `<button class="hz-frase hz-frase-${f.estado}" data-act="hz-frase" data-id="${esc(f.id)}" aria-label="${esc(ESTADOS[f.estado])}: ${esc(f.texto)}">${esc(f.texto)}</button>`).join('<span aria-hidden="true"> · </span>')}</p>`).join("")}
    <p class="hz-leyenda"><span><b class="hz-frase hz-frase-confirmada">firme</b> confirmada</span><span><b class="hz-frase hz-frase-inferida">a rayas</b> inferida</span><span><b class="hz-frase hz-frase-pendiente">punteada</b> pendiente</span><span><b class="hz-frase hz-frase-caducada">ondulada</b> en duda o caducada</span></p></section>`;
}
export function hzApariencia(skin) {
  const op = (id, t, d) => `<button class="hz-tema" data-act="hz-skin" data-v="${id}" aria-pressed="${skin === id}"><span class="hz-tema-m hz-tema-${id}" aria-hidden="true"></span><span class="grow"><b>${t}</b><br><span class="muted small">${d}</span></span>${skin === id ? '<span class="hz-mini">en uso</span>' : ""}</button>`;
  return `<section class="card"><h2>Apariencia</h2><div class="stack">${op("horizonte", "Horizonte", "Papel y tinta bajo el cielo real de tu ciudad. El color cambia con la hora y el tiempo.")}${op("clasico", "Clásico", "La interfaz azul y negra de siempre.")}</div>
    <p class="muted small">Cambiar de tema no borra nada ni cierra ninguna sesión. La elección se guarda en este dispositivo y viaja con Tu nube si la usas.</p></section>`;
}
