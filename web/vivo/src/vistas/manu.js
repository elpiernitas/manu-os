// MANU · tu alter ego. Dos ojos en la línea del horizonte. Habla con tres voces que se distinguen
// siempre: lo sé / lo sospecho / confírmamelo. Y cuando no sabe, lo dice.
import { esc, icono, sello, olas, cara, demo } from "../ui.js";
import { NIVEL } from "../adaptadores.js";

/** La constelación: cada recuerdo es una estrella; la forma dice cuánta certeza tiene. */
export function constelacion(S) {
  const { estrellas, hilos, cuenta } = S.vm.memoria, sel = S.ui.estrellas ?? [];
  const pos = Object.fromEntries(estrellas.map((e) => [e.id, e]));
  const P = (e) => [(e.x * 360 + 20).toFixed(1), (e.y * 360 + 20).toFixed(1)];
  const hilo = sel.length === 2 ? hilos.find((h) => sel.includes(h.a) && sel.includes(h.b)) : null;
  const elegidas = sel.map((id) => pos[id]).filter(Boolean);
  return `<section class="cons" aria-labelledby="h-cons">
    <h2 id="h-cons" class="titulo-2">Constelación</h2>
    <p class="nota">Toca una estrella para verla. Toca dos y te enseño el hilo que las une. ${demo()}</p>
    <p class="leyenda"><span><i class="st st-sabe"></i>Lo sé · ${cuenta.sabe}</span><span><i class="st st-sospecha"></i>Lo sospecho · ${cuenta.sospecha}</span><span><i class="st st-confirmar"></i>Confírmamelo · ${cuenta.confirmar}</span></p>
    <div class="cons-cielo"><svg viewBox="0 0 400 400" role="group" aria-label="Mapa de recuerdos">
      ${hilos.map((h) => { const [x1, y1] = P(pos[h.a]), [x2, y2] = P(pos[h.b]); const on = sel.includes(h.a) && sel.includes(h.b); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="hilo${h.tension ? " hilo-tension" : ""}${on ? " hilo-on" : ""}"/>`; }).join("")}
      ${estrellas.map((e) => { const [x, y] = P(e); return `<g class="estrella estrella-${e.nivel}${sel.includes(e.id) ? " elegida" : ""}" role="button" tabindex="0" data-act="estrella" data-id="${esc(e.id)}" aria-label="${esc(NIVEL[e.nivel])}: ${esc(e.texto)}" aria-pressed="${sel.includes(e.id)}" transform="translate(${x} ${y})"><circle r="22" class="toque"/><circle r="${e.nivel === "sabe" ? 6 : 7}" class="nucleo"/>${e.nivel === "confirmar" ? '<circle r="12" class="anillo"/>' : ""}</g>`; }).join("")}
    </svg></div>
    ${elegidas.length ? `<div class="cons-panel" aria-live="polite">${elegidas.map((e) => `<article class="recuerdo">${sello(e.nivel)}<p class="recuerdo-t">${esc(e.texto)}</p>${e.razon ? `<p class="nota">Por qué lo pienso: ${esc(e.razon)}</p>` : ""}<div class="fila">${e.nivel !== "sabe" ? `<button class="boton boton-mini" data-act="mem-confirmar" data-id="${e.id}">Es verdad</button>` : `<button class="boton boton-mini boton-linea" data-act="mem-dudar" data-id="${e.id}">Ya no estoy seguro</button>`}<button class="boton boton-mini boton-linea" data-act="mem-corregir" data-id="${e.id}">Corregir</button><button class="boton boton-mini boton-linea" data-act="mem-olvidar" data-id="${e.id}">Olvidar</button></div></article>`).join("")}
      ${sel.length === 2 ? (hilo ? `<p class="hilo-texto">${sello("HIPOTESIS")} Las une <strong>${hilo.comun.map(esc).join(", ")}</strong>.${hilo.tension ? " Y hay tensión: una de las dos está en duda." : ""} Es una relación que veo yo; tú decides si significa algo.</p>` : `<p class="hilo-texto">No veo ningún hilo entre estas dos. No me lo invento.</p>`) : ""}</div>` : ""}
  </section>`;
}

const globo = (m) => m.de === "yo" ? `<li class="yo"><p>${esc(m.texto)}</p></li>` : `<li class="el ${m.nose ? "el-niebla" : ""}">
    <div class="el-cara">${cara(m.cara ?? "calma")}</div>
    <div class="el-cuerpo">${m.nivel ? sello(m.nivel) : ""}<p class="el-texto">${esc(m.texto)}</p>
      ${m.pruebas?.length ? `<details class="recibo"><summary>Ver las pruebas</summary><ul>${m.pruebas.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>${m.sospecha ? `<p>${sello("HIPOTESIS")} ${esc(m.sospecha)}</p>` : ""}</details>` : ""}
      ${m.cara === "zasca" && !m.cerrado ? `<div class="fila"><button class="boton boton-mini" data-act="zasca-touche" data-id="${m.id}">Touché</button><button class="boton boton-mini boton-linea" data-act="zasca-recurso" data-id="${m.id}">Recurro</button></div>` : ""}
      ${m.elegir && !m.cerrado ? `<div class="fila">${m.elegir.map((id) => `<button class="boton boton-mini boton-linea" data-act="contra" data-id="${id}" data-msg="${m.id}">Caducó: «${esc(S_texto(m, id))}»</button>`).join("")}</div>` : ""}
      ${m.confirmarId && !m.cerrado ? `<div class="fila"><button class="boton boton-mini" data-act="mem-confirmar" data-id="${m.confirmarId}" data-msg="${m.id}">Es verdad</button><button class="boton boton-mini boton-linea" data-act="mem-olvidar" data-id="${m.confirmarId}" data-msg="${m.id}">No, olvídalo</button></div>` : ""}
    </div></li>`;
const S_texto = (m, id) => m.textos?.[id] ?? id;

export function pinta(S) {
  const modo = S.ui.manu ?? "hablar", ultimo = [...S.chat].reverse().find((m) => m.de === "manu");
  return `<header class="portada portada-manu"><h1 class="oculto">MANU</h1><div class="manu-grande" data-act="cara" role="button" tabindex="0" aria-label="Saludar a MANU">${cara(S.ui.pensando ? "piensa" : ultimo?.cara ?? "calma", { grande: true })}</div></header>${olas()}
    <div class="fondo">
      <div class="pestanas" role="tablist"><button role="tab" aria-selected="${modo === "hablar"}" data-act="manu-modo" data-id="hablar">Hablar</button><button role="tab" aria-selected="${modo === "cielo"}" data-act="manu-modo" data-id="cielo">Constelación</button></div>
      ${modo === "cielo" ? constelacion(S) : `<p class="nota">${demo("Demo · respuestas de guion, sin IA conectada")}</p>
        <ol class="charla" aria-live="polite">${S.chat.map(globo).join("")}${S.ui.pensando ? `<li class="el"><div class="el-cara">${cara("piensa")}</div><p class="pensando" role="status">Mirando en el fondo<span>…</span></p></li>` : ""}</ol>
        <div class="sugerencias">${["¿Estoy ahorrando?", "¿Madrugo o no?", "¿Qué pasa los domingos?", "¿Qué sabes de mí?", "¿Qué me regalo por Reyes?"].map((s) => `<button class="pildora" data-act="decir" data-id="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        <form class="redactar" data-form="decir"><label class="oculto" for="decir">Escribe a MANU</label><input id="decir" name="texto" placeholder="Dile algo a tu reflejo…" autocomplete="off" maxlength="300"><button class="boton" aria-label="Enviar">${icono("flecha")}</button></form>`}
    </div>`;
}
