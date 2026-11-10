// PROYECTOS · el astillero. Cada proyecto es un barco en construcción sobre su plano; cada área,
// un muelle distinto (no se mezclan si tú no lo mueves). Terminar no dice «Completado»: se bota.
import { esc, icono, olas, vacio, demo } from "../ui.js";
import { AREAS } from "../adaptadores.js";

/** El casco: lo construido va en tinta; lo que falta, en línea de plano. */
export const casco = (b) => { const a = b.avance ?? 0, id = `c-${esc(b.id)}`; return `<svg class="plano" viewBox="0 0 200 96" aria-hidden="true"><defs><clipPath id="${id}"><rect x="0" y="0" width="${(a * 200).toFixed(0)}" height="96"/></clipPath></defs>
  <g class="plano-linea"><path d="M12 54h176l-24 32H38z"/><path d="M100 54V8l52 38H100M96 14L52 46h44"/></g>
  <g class="plano-hecho" clip-path="url(#${id})"><path d="M12 54h176l-24 32H38z"/><path d="M100 54V8l52 38H100M96 14L52 46h44"/></g>
  <path class="plano-cota" d="M12 92h176M12 89v6M188 89v6"/></svg>`; };

export function pinta(S) {
  const { muelles, flota } = S.vm.astillero;
  return `<header class="portada"><h1 class="rotulo">Astillero</h1><p class="tira"><span class="chapa">${muelles.reduce((n, m) => n + m.barcos.length, 0)} en construcción</span><span class="chapa">${flota.length} en el agua</span></p></header>${olas()}
    <div class="fondo fondo-plano">
      <p class="ante">Proyectos ${demo()}</p>
      ${muelles.length ? muelles.map((m) => `<section class="muelle" aria-labelledby="mu-${m.id}"><h2 id="mu-${m.id}" class="muelle-t"><span>Muelle</span> ${esc(m.nombre)}</h2><div class="gradas">${m.barcos.map((b) => `<button class="barco-carta" data-act="proyecto" data-id="${esc(b.id)}">${casco(b)}<span class="barco-n">${esc(b.emoji)} ${esc(b.nombre)}</span><span class="mini">${b.avance == null ? "Solo el plano: sin tareas" : `${b.hechas}/${b.tareas.length} piezas`} · ${b.fuentes.length} fuentes · ${b.ideas.length} ideas</span>${b.listo ? '<span class="lista-botar">Lista para botar</span>' : ""}</button>`).join("")}</div></section>`).join("") : vacio("Gradas vacías", "Cuando empieces un proyecto, aquí verás crecer su casco.")}
      ${flota.length ? `<section class="muelle"><h2 class="muelle-t"><span>Ya en</span> el agua</h2><ul class="lista">${flota.map((b) => `<li>${esc(b.emoji)} ${esc(b.nombre)} <a class="enlace" href="#bahia" data-ir="bahia">verlo en Bahía</a></li>`).join("")}</ul></section>` : ""}
    </div>`;
}

export function expediente(b) {
  return `<p class="ante">Muelle ${esc(AREAS[b.area])}</p><h2 class="titulo-2">${esc(b.emoji)} ${esc(b.nombre)}</h2>${casco(b)}
    <h3 class="ante">Piezas</h3>${b.tareas.length ? `<ul class="piezas">${b.tareas.map((t) => `<li><label><input type="checkbox" data-input="tarea" data-id="${esc(b.id)}" data-tid="${esc(t.id)}"${t.done ? " checked" : ""}><span>${esc(t.t)}</span></label></li>`).join("")}</ul>` : '<p class="nota">Este proyecto es solo un plano todavía.</p>'}
    <h3 class="ante">Expediente · fuentes</h3>${b.fuentes.length ? `<ul class="cajas">${b.fuentes.map((f) => `<li>${esc(f.title)}</li>`).join("")}</ul>` : '<p class="nota">Sin fuentes.</p>'}
    <h3 class="ante">Bocetos · ideas</h3>${b.ideas.length ? `<ul class="notas-adhesivas">${b.ideas.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : '<p class="nota">Sin ideas apuntadas.</p>'}
    <label class="estado-demo">Cambiar de muelle <select data-input="muelle" data-id="${esc(b.id)}">${Object.entries(AREAS).filter(([k]) => k !== "sin").map(([k, v]) => `<option value="${k}"${k === b.area ? " selected" : ""}>${v}</option>`).join("")}</select></label>
    <button class="boton boton-botar" data-act="botar" data-id="${esc(b.id)}"${b.listo ? "" : " disabled"}>${icono("proyectos")} ${b.listo ? "Botar al agua" : "Faltan piezas para botarlo"}</button>`;
}

/** La botadura: el barco baja por la grada, cae al agua y suena la sirena. Una vez, y se acabó. */
export const botadura = (b) => `<div class="botadura" role="alertdialog" aria-label="Botadura de ${esc(b.nombre)}"><div class="bot-cielo"><div class="gallardetes" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>
  <p class="ante">Botadura</p><p class="bot-nombre">${esc(b.nombre)}</p><p class="bot-texto">Ya flota. Lo hiciste tú: ${b.tareas.length} piezas, ${b.fuentes.length} fuentes, ${b.ideas.length} ideas.</p></div>
  <div class="bot-mar"><div class="bot-barco">${casco({ ...b, avance: 1, id: `${b.id}-bot` })}</div><span class="salpica" aria-hidden="true"></span></div>
  <div class="fila bot-fila"><a class="boton" href="#bahia" data-ir="bahia" data-act="botadura-fin">Verlo en la Bahía</a><button class="boton boton-linea" data-act="botadura-fin">Seguir</button></div></div>`;
