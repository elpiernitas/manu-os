// TÚ · la bitácora. No son ajustes: es lo que MANU cree de ti, escrito en prosa, y cada frase se
// puede tocar para confirmarla, corregirla, ponerla en duda o borrarla.
import { esc, sello, olas, demo } from "../ui.js";
import { NIVEL } from "../adaptadores.js";
import { TIEMPOS } from "../cielo.js";

export function pinta(S) {
  const { estrellas, cuenta } = S.vm.memoria, borrados = S.vault.brain?.forgotten?.length ?? 0;
  return `<header class="portada"><h1 class="rotulo">Bitácora</h1><p class="tira"><span class="chapa">${cuenta.sabe} cosas sé</span><span class="chapa">${cuenta.sospecha} sospecho</span><span class="chapa">${cuenta.confirmar} por confirmar</span></p></header>${olas()}
    <div class="fondo">
      <p class="ante">Tú ${demo()}</p>
      <section aria-labelledby="h-ret"><h2 id="h-ret" class="titulo-2">Quién creo que eres</h2>
        ${estrellas.length ? `<p class="retrato">${estrellas.map((e) => `<span role="button" tabindex="0" class="frase frase-${e.nivel}" data-act="frase" data-id="${esc(e.id)}" aria-label="${esc(NIVEL[e.nivel])}: ${esc(e.texto)}">${esc(e.texto)}</span>`).join(". ")}.</p>` : '<p class="nota">Todavía no sé nada de ti. Mejor eso que inventármelo.</p>'}
        <p class="leyenda"><span><b class="frase frase-sabe">Subrayado firme</b> lo sé</span><span><b class="frase frase-sospecha">a rayas</b> lo sospecho</span><span><b class="frase frase-confirmar">ondulado</b> confírmamelo</span></p>
      </section>
      <div class="rejilla">
        <section aria-labelledby="h-dec"><h2 id="h-dec" class="ante">Decisiones que tomaste</h2>
          <ol class="decisiones">${(S.vault.decisiones ?? []).map((d) => `<li><time>${new Date(d.at).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</time><p class="dec-ahora">${esc(d.texto)}</p>${d.antes ? `<p class="dec-antes">Antes: ${esc(d.antes)}</p>` : ""}</li>`).join("")}</ol>
          <p class="nota">Las decisiones son tuyas. MANU las recuerda; no toma ninguna nueva por ti.</p></section>
        <section aria-labelledby="h-olv"><h2 id="h-olv" class="ante">Lo que borraste</h2>
          <p class="cifra-n cifra-media">${borrados}</p><p class="nota">De lo borrado solo queda una marca sin texto, para que no vuelva desde otro dispositivo. No puedo recordarlo ni queriendo.</p>
          <h2 class="ante">Sala de máquinas</h2>
          <ul class="lista maquinas"><li>Tu nube<span class="mini">como en la app actual</span></li><li>Avisos<span class="mini">como en la app actual</span></li><li>Permisos y conexiones<span class="mini">como en la app actual</span></li></ul>
          <label class="estado-demo">Tiempo de la demo <select data-input="tiempo">${TIEMPOS.map((t) => `<option${t === S.tiempo ? " selected" : ""}>${t}</option>`).join("")}</select></label>
          <button class="boton boton-linea" data-act="reiniciar">Reiniciar la demo</button></section>
      </div>
    </div>`;
}
export const fichaRecuerdo = (e) => `${sello(e.nivel)}<h2 class="titulo-2">${esc(e.texto)}</h2>${e.razon ? `<p class="nota">Por qué lo pienso: ${esc(e.razon)}</p>` : ""}<p class="nota">Desde ${new Date(e.desde).toLocaleDateString("es-ES", { month: "long", year: "numeric" })} · temas: ${e.tags.map(esc).join(", ")}</p>
  <form data-form="corregir" class="form"><input type="hidden" name="id" value="${esc(e.id)}"><label>Corregir<input name="texto" value="${esc(e.texto)}" maxlength="200" autocomplete="off"></label><button class="boton boton-linea">Guardar corrección</button></form>
  <div class="fila">${e.nivel !== "sabe" ? `<button class="boton" data-act="mem-confirmar" data-id="${esc(e.id)}">Es verdad</button>` : `<button class="boton boton-linea" data-act="mem-dudar" data-id="${esc(e.id)}">Ya no estoy seguro</button>`}<button class="boton boton-linea boton-peligro" data-act="mem-olvidar" data-id="${esc(e.id)}">Olvidar para siempre</button></div>`;
