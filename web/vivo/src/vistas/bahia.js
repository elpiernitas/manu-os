// BAHÍA · tu segunda vida. El mismo cielo que el resto de MANU OS, y lo que haces fuera se ve aquí:
// cada proyecto terminado es un barco en el agua y enciende el faro. Descansar no quita nada.
import { esc, olas, demo } from "../ui.js";

const LUGAR = {
  faro: (b) => b.faro ? `El faro está encendido: has botado ${b.flota.length} ${b.flota.length === 1 ? "proyecto" : "proyectos"}.` : "El faro se enciende cuando botes tu primer proyecto. Sin prisa.",
  cafe: () => "Café Salitre. Aquí se apuntan las ideas. Ninguna caduca por no usarla.",
  oficina: (b) => `La oficina. ${b.hechas} tareas hechas en total. Las de hoy no cuentan más que las de ayer.`,
  playa: (b, S) => S.ui.botella === "playa" ? "Hay una botella en la orilla. Está también en la portada de Hoy." : "La playa. Cuando MANU tenga algo que decirte, llegará aquí en una botella.",
  gaviota: () => "La gaviota te mira el bocadillo. No es una metáfora: quiere el bocadillo.",
  astillero: () => "El astillero. Lo que construyes está en Proyectos.",
};
const HOT = (id, label, cuerpo) => `<g class="lugar" role="button" tabindex="0" data-act="lugar" data-id="${id}" aria-label="${label}">${cuerpo}</g>`;

export function escena(S) {
  const b = S.vm.bahia, bote = S.ui.botella === "playa";
  const barcos = b.flota.slice(0, 4).map((f, i) => `<g class="barco" style="--d:${i * 0.7}s" transform="translate(${70 + i * 62} ${214 + (i % 2) * 26})"><path d="M-16 0h32l-6 9h-20z" class="casco"/><path d="M0 0v-24l13 18z" class="vela"/><path d="M-2-3v-17l-9 14z" class="vela vela-2"/><title>${esc(f.nombre)}</title></g>`).join("");
  return `<svg class="bahia" viewBox="0 0 400 300" role="group" aria-label="Bahía: un pueblo junto al mar">
    <path class="monte" d="M250 172c30-52 70-70 110-66 20 2 34 20 40 30v36z"/>
    ${HOT("faro", "El faro", `<path class="haz ${b.faro ? "haz-on" : ""}" d="M352 78L250 40v60z"/><path class="faro-torre" d="M344 110l4-34h8l4 34z"/><path class="faro-franja" d="M345.6 96h12.800l-.700-7h-11.400z"/><rect class="faro-luz ${b.faro ? "on" : ""}" x="347" y="68" width="10" height="9" rx="2"/><path class="faro-torre" d="M345 68h14l-7-7z"/><rect class="toque" x="330" y="56" width="44" height="60"/>`)}
    <rect class="mar" x="0" y="172" width="400" height="128"/>
    <path class="espuma" d="M0 196c20 0 20-5 40-5s20 5 40 5 20-5 40-5 20 5 40 5 20-5 40-5 20 5 40 5 20-5 40-5 20 5 40 5 20-5 40-5 20 5 40 5"/>
    <path class="espuma espuma-2" d="M0 250c20 0 20-5 40-5s20 5 40 5 20-5 40-5 20 5 40 5 20-5 40-5 20 5 40 5 20-5 40-5 20 5 40 5 20-5 40-5 20 5 40 5"/>
    <rect class="muro" x="0" y="152" width="300" height="22"/><path class="baranda" d="M0 152h300M10 152v-9M40 152v-9M70 152v-9M100 152v-9M130 152v-9M160 152v-9M190 152v-9M220 152v-9M250 152v-9M280 152v-9M0 143h290"/>
    ${HOT("oficina", "La oficina", `<rect class="edif" x="150" y="84" width="46" height="68"/><g class="ventanas"><rect x="157" y="92" width="9" height="9"/><rect x="171" y="92" width="9" height="9"/><rect x="157" y="108" width="9" height="9"/><rect x="171" y="108" width="9" height="9"/><rect x="157" y="124" width="9" height="9"/><rect x="171" y="124" width="9" height="9"/></g><rect class="edif edif-2" x="196" y="104" width="34" height="48"/><g class="ventanas"><rect x="203" y="112" width="8" height="8"/><rect x="215" y="112" width="8" height="8"/><rect x="203" y="128" width="8" height="8"/></g>`)}
    ${HOT("cafe", "El café", `<rect class="edif edif-2" x="74" y="112" width="52" height="40"/><path class="toldo" d="M70 126h60l-6-12H76z"/><rect class="puerta" x="94" y="132" width="12" height="20"/><g class="ventanas"><rect x="80" y="132" width="9" height="9"/><rect x="111" y="132" width="9" height="9"/></g>`)}
    ${HOT("astillero", "El astillero", `<path class="grada" d="M252 172l40-18v18z"/><path class="casco casco-obra" d="M256 160l28-12-4 12z"/><rect class="toque" x="246" y="140" width="52" height="36"/>`)}
    <path class="farola" d="M40 152v-34h10"/><circle class="farola-luz" cx="52" cy="118" r="3"/>
    ${HOT("gaviota", "Una gaviota", `<path class="gaviota" d="M34 114q5-7 8 0q3-7 8 0" /><circle class="toque" cx="42" cy="110" r="22"/>`)}
    <g class="yo-bahia" transform="translate(240 139)"><circle r="5" cy="-9"/><path d="M-5 13v-10a5 5 0 0 1 10 0v10z"/><text y="-19" text-anchor="middle">Nv ${b.nivel}</text></g>
    ${HOT("playa", "La playa", `<path class="arena" d="M0 300V236c40-18 90-8 130 22 20 16 40 30 70 42z"/>${bote ? '<g transform="translate(96 262) rotate(-24)"><g class="botella-playa"><rect x="-4" y="-12" width="8" height="18" rx="3"/><rect x="-2" y="-18" width="4" height="7"/></g></g>' : ""}`)}
    ${barcos}
  </svg>`;
}

export function pinta(S) {
  const b = S.vm.bahia;
  return `<header class="portada portada-bahia"><h1 class="oculto">Bahía</h1>${escena(S)}</header>${olas()}
    <div class="fondo">
      <p class="ante">Bahía ${demo()}</p>
      <p class="titular titular-2" aria-live="polite">${esc(S.ui.lugar ? LUGAR[S.ui.lugar](b, S) : "Tu pueblo sigue donde lo dejaste.")}</p>
      <p class="nota">Toca el faro, el café, la oficina, la playa… y busca a la gaviota.</p>
      <div class="rejilla">
        <section class="tarjeta"><h2 class="ante">Tú, aquí</h2><p class="cifra-n cifra-media">Nivel ${b.nivel}</p>
          <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="60" aria-valuenow="${60 - b.siguiente}" aria-label="Camino al siguiente nivel"><i style="width:${((60 - b.siguiente) / 60 * 100).toFixed(0)}%"></i></div>
          <p class="nota">${b.hechas} tareas · ${b.ideas} ideas · ${b.flota.length} barcos. Solo suma: si un día descansas, aquí no se pierde nada.</p></section>
        <section class="tarjeta"><h2 class="ante">La flota</h2>${b.flota.length ? `<ul class="lista">${b.flota.map((f) => `<li>${esc(f.emoji ?? "⛵")} ${esc(f.nombre)} <span class="mini">botado el ${new Date(f.botado).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span></li>`).join("")}</ul>` : '<p class="nota">Aún no hay barcos. El primero se bota desde Proyectos.</p>'}</section>
      </div>
    </div>`;
}
