// AGENDA · la tabla de mareas. Cada día es un arco de sol con sus citas colgadas.
import { esc, icono, olas, vacio, demo } from "../ui.js";
import { hora } from "../adaptadores.js";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const arco = (citas) => `<svg viewBox="0 0 48 26" class="arco" aria-hidden="true"><path d="M3 23A21 21 0 0 1 45 23" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".35"/>${citas.map((c) => { const d = new Date(c.at), t = Math.max(0, Math.min(1, (d.getHours() + d.getMinutes() / 60 - 7) / 16)), a = Math.PI * (1 - t); return `<circle cx="${(24 + Math.cos(a) * 21).toFixed(1)}" cy="${(23 - Math.sin(a) * 21).toFixed(1)}" r="2.6" class="${c.tipo === "aviso" ? "punto-aviso" : "punto"}"/>`; }).join("")}</svg>`;

export function pinta(S) {
  const dias = S.vm.semana, sel = dias.find((d) => d.clave === S.ui.dia) ?? dias[0];
  return `<header class="portada"><h1 class="rotulo">Tabla de mareas</h1><p class="tira"><span class="chapa">Tu semana, día a día</span></p></header>${olas()}
    <div class="fondo">
      <p class="ante">Agenda ${demo()}</p>
      <div class="semana" role="tablist" aria-label="Días">${dias.map((d) => `<button role="tab" aria-selected="${d === sel}" class="dia" data-act="dia" data-id="${d.clave}"><span class="dia-n">${d.hoy ? "hoy" : DIAS[d.fecha.getDay()].slice(0, 3)}</span><span class="dia-d">${d.fecha.getDate()}</span>${arco(d.citas)}<span class="oculto">${d.citas.length} citas</span></button>`).join("")}</div>
      <section class="dia-detalle"><h2 class="titulo-2">${sel.hoy ? "Hoy" : DIAS[sel.fecha.getDay()]} ${sel.fecha.getDate()}</h2>
        ${sel.citas.length ? `<ol class="linea linea-grande">${sel.citas.map((c) => `<li><time>${hora(c.at)}</time><span>${esc(c.title)}</span>${c.tipo === "aviso" ? '<span class="mini">aviso</span>' : c.minutes ? `<span class="mini">${c.minutes} min</span>` : ""}</li>`).join("")}</ol>` : vacio("Día en blanco", "No es un fallo, es un lujo. MANU no lo va a rellenar por ti.")}
        <button class="boton boton-linea" data-act="cita-nueva" data-id="${sel.clave}">${icono("mas")} Añadir cita</button>
      </section>
    </div>`;
}
export const formulario = (clave) => `<h2 class="titulo-2">Nueva cita</h2><p class="nota">Solo en esta demo: no toca tu calendario.</p><form data-form="cita" class="form"><input type="hidden" name="dia" value="${esc(clave)}"><label>Qué<input name="title" required maxlength="120" autocomplete="off"></label><label>Hora<input name="hora" type="time" value="18:00" required></label><button class="boton">Guardar</button></form>`;
