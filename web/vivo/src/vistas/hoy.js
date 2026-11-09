// HOY · la portada. Una revista sobre tu día: cabecera, titular y sumario. El sol se arrastra.
import { esc, icono, sello, olas, demo } from "../ui.js";
import { euros, hora } from "../adaptadores.js";
import { describe } from "../cielo.js";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"], DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function botella(S) {
  if (S.ui.botella !== "playa") return "";
  const n = S.vm.dinero.noches[0];
  if (!n) return "";
  return `<aside class="botella" aria-label="Una propuesta de MANU">
    <div class="botella-ico">${icono("botella")}</div>
    <div><p class="ante">Ha llegado una botella</p>
    <p class="botella-t">Tus noches largas te cuestan ${esc(euros(n.total))} de media. ¿Te propongo un tope y te aviso solo si lo pasas?</p>
    <p class="nota">${sello("HECHO")} el importe · ${sello("HIPOTESIS")} que te interese</p>
    <div class="fila"><button class="boton" data-act="botella-abrir">Vale, propónmelo</button><button class="boton boton-linea" data-act="botella-tirar">Devolver al mar</button></div>
    <button class="enlace" data-act="botella-nunca">No me propongas cosas así</button></div></aside>`;
}

export function pinta(S) {
  const p = S.vm.portada, ahora = S.instante, real = S.minutos == null;
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  const b = S.vm.astillero.barcos.filter((x) => !x.botado && x.avance != null).sort((x, y) => y.avance - x.avance)[0];
  const sumario = [
    ["02", "Agenda", p.luego.length ? `${p.luego.length} por delante · ${hora(p.luego[0].at)} ${p.luego[0].title}` : "Nada más hoy", "agenda"],
    ["04", "Dinero", `Ayer: ${euros(p.gastadoAyer)}`, "dinero"],
    ["06", "Astillero", b ? `${b.nombre}: ${Math.round(b.avance * 100)} %` : "Sin proyectos en marcha", "proyectos"],
    ["08", "Memoria", `${S.vm.memoria.cuenta.confirmar + S.vm.memoria.cuenta.sospecha} cosas esperan tu sí o tu no`, "manu"],
    ["10", "Bahía", `Nivel ${S.vm.bahia.nivel} · ${S.vm.bahia.flota.length} barcos en el agua`, "bahia"],
  ];
  return `<header class="portada portada-hoy">
      <p class="cabecera" aria-hidden="true">MANU</p>
      <h1 class="oculto">Hoy</h1>
      <p class="tira"><span class="chapa">Nº ${p.numero}</span><span class="chapa">${DIAS[ahora.getDay()]} ${ahora.getDate()} ${MESES[ahora.getMonth()]}</span><button class="chapa chapa-boton" data-act="tiempo-ciclo" aria-label="Tiempo de demostración: ${esc(S.cielo.tiempo)}. Tocar para cambiarlo">Gijón · ${esc(describe(S.cielo).toLowerCase())} ↻</button></p>
    </header>${olas()}
    <div class="fondo">
      <section class="titular-caja">
        <p class="ante">${esc(p.antetitulo)} ${real ? "" : "· viajando por el día"} ${demo()}</p>
        <p class="titular">${esc(p.titular)}</p>
        <div class="dial">
          <label for="dial">Arrastra el día <output>${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}</output></label>
          <input id="dial" type="range" min="0" max="1425" step="15" value="${min}" data-input="dial" aria-valuetext="${ahora.getHours()} horas ${ahora.getMinutes()} minutos">
          ${real ? "" : '<button class="enlace" data-act="dial-ahora">Volver a ahora</button>'}
        </div>
      </section>
      ${botella(S)}
      <div class="rejilla">
        <section aria-labelledby="h-sum"><h2 id="h-sum" class="ante">En este número</h2>
          <ol class="sumario">${sumario.map(([n, t, d, ir]) => `<li><a href="#${ir}" data-ir="${ir}"><span class="sum-n">${n}</span><span class="sum-t">${t}</span><span class="sum-d">${esc(d)}</span>${icono("flecha")}</a></li>`).join("")}</ol>
        </section>
        <section aria-labelledby="h-dia"><h2 id="h-dia" class="ante">${real ? "Ahora y luego" : "A esa hora"}</h2>
          ${p.antes.length + p.luego.length ? `<ol class="linea">${[...p.antes.map((c) => [c, true]), ...p.luego.map((c) => [c, false])].map(([c, pas]) => `<li class="${pas ? "pasado" : ""}"><time>${hora(c.at)}</time><span>${esc(c.title)}</span>${c.tipo === "aviso" ? '<span class="mini">aviso</span>' : ""}</li>`).join("")}</ol>` : '<p class="nota">Día en blanco.</p>'}
          ${p.tareas.length ? `<p class="nota">Pendiente: ${p.tareas.map((t) => esc(t.text)).join(" · ")}</p>` : ""}
        </section>
      </div>
      <div class="atajos"><button class="atajo" data-act="sonda">${icono("sonda")}<span>Echar la sonda</span></button><a class="atajo" href="#agenda" data-ir="agenda">${icono("agenda")}<span>Tabla de mareas</span></a><button class="atajo" data-act="constelacion">${icono("estrella")}<span>Constelación</span></button></div>
    </div>`;
}
