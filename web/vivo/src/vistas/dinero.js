// DINERO · las mareas. Tu saldo sube y baja como el mar; tus pagos cuentan historias.
// Regla: lo contado es HECHO, lo interpretado es HIPÓTESIS, y cada cosa lleva su base.
import { esc, icono, sello, olas, vacio, cargando, fallo, demo } from "../ui.js";
import { euros, hora, FRANJAS } from "../adaptadores.js";

function mareografo(marea) {
  if (!marea.length) return "";
  const ns = marea.map((m) => m.nivel), min = Math.min(...ns, 0), max = Math.max(...ns, 0), W = 360, H = 120;
  const x = (i) => (i / (marea.length - 1)) * W, y = (n) => H - 8 - ((n - min) / (max - min || 1)) * (H - 20);
  const linea = marea.map((m, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(m.nivel).toFixed(1)}`).join("");
  const alta = ns.indexOf(max), baja = ns.indexOf(min);
  return `<figure class="mareografo"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Marea de 90 días. Pleamar ${euros(max, 0)}, bajamar ${euros(min, 0)}, hoy ${euros(ns[ns.length - 1], 0)}.">
    <line x1="0" x2="${W}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="cero"/><path d="${linea}L${W} ${H}L0 ${H}Z" class="agua"/><path d="${linea}" class="cresta"/>
    <circle cx="${x(alta).toFixed(1)}" cy="${y(max).toFixed(1)}" r="4" class="marca"/><circle cx="${x(baja).toFixed(1)}" cy="${y(min).toFixed(1)}" r="4" class="marca marca-hueca"/></svg>
    <figcaption><span>● Pleamar ${euros(max, 0)}</span><span>○ Bajamar ${euros(min, 0)}</span><span>Nivel respecto a hace 90 días, no tu saldo</span></figcaption></figure>`;
}

function noche(n, estado) {
  const f = new Date(n.inicio);
  return `<article class="noche"><header><p class="ante">Una noche, en pagos</p><h3 class="titulo-2">${f.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</h3><p class="noche-total">${euros(n.total)} <span>· ${n.paradas.length} pagos · ${n.sitios} sitios</span></p></header>
    <ol class="ruta">${n.paradas.map((p) => `<li style="--peso:${Math.min(1, p.cents / 2500).toFixed(2)}"><time>${hora(p.at)}</time><span class="ruta-sitio">${esc(p.sitio)}</span><span class="ruta-eur">${euros(p.cents)}</span></li>`).join("")}</ol>
    <p>${sello("HECHO")} Pagos, horas e importes.</p>
    ${estado === "si" ? `<p>${sello("sabe")} Me dijiste que fue una fiesta. Apuntado.</p>` : estado === "no" ? `<p class="nota">Vale: no era lo que parecía. No lo vuelvo a suponer de esta noche.</p>` : `<p>${sello("HIPOTESIS")} Parece una noche de fiesta. ¿Lo fue?</p><div class="fila"><button class="boton boton-mini" data-act="noche-si" data-id="${n.id}">Sí, apúntalo</button><button class="boton boton-mini boton-linea" data-act="noche-no" data-id="${n.id}">No</button></div>`}</article>`;
}

function banco(S) {
  const e = S.ui.banco ?? "conectado";
  const cuerpo = {
    desconectado: `<p>Sin conectar. MANU solo podrá <strong>leer</strong>: nunca pagar ni mover dinero.</p><button class="boton" data-act="banco-estado" data-id="conectado">Conectar (demo)</button>`,
    cargando: cargando("Leyendo movimientos…"),
    error: fallo("El banco no responde. Tus datos siguen como estaban.", `<button class="boton boton-linea" data-act="banco-estado" data-id="conectado">Reintentar</button>`),
    caducado: `<p>El permiso de lectura ha caducado. Hay que renovarlo en el banco: eso solo puedes hacerlo tú.</p><button class="boton" data-act="banco-estado" data-id="conectado">Renovar (demo)</button>`,
    conectado: `<p>Conectado en solo lectura.</p><div class="fila"><button class="boton" data-act="importar">Importar todo (90 días)</button><button class="boton boton-linea" data-act="banco-estado" data-id="desconectado">Desconectar</button></div><p class="nota">Nada pasa a tus gastos sin que lo confirmes. Lo repetido no se duplica.</p>`,
  }[e];
  return `<section class="tarjeta banco" aria-labelledby="h-banco"><h2 id="h-banco" class="titulo-2">Banco Sabadell</h2><p class="nota">${demo("Demo · no hay ningún banco conectado aquí")}</p>${cuerpo}
    <label class="estado-demo">Ver otro estado <select data-input="banco">${["conectado", "desconectado", "cargando", "caducado", "error"].map((x) => `<option${x === e ? " selected" : ""}>${x}</option>`).join("")}</select></label>
    ${S.ui.importe ? `<p class="resultado" role="status">Importado: <strong>${S.ui.importe.nuevos} nuevos</strong> · ${S.ui.importe.duplicados} repetidos que no he duplicado.</p>` : ""}</section>`;
}

export function pinta(S) {
  const d = S.vm.dinero;
  const maxM = Math.max(1, ...d.momentos.flat());
  return `<header class="portada"><h1 class="rotulo">Mareas</h1><p class="tira"><span class="chapa">Este mes: ${euros(d.mes.gastado, 0)} gastados</span><span class="chapa">${d.mes.ahorro >= 0 ? "Sube" : "Baja"} ${euros(Math.abs(d.mes.ahorro), 0)}</span></p></header>${olas()}
    <div class="fondo">
      <p class="ante">Dinero ${demo()}</p>
      ${d.vacio ? vacio("Mar en calma", "Aún no hay movimientos. Conecta el banco o apunta un gasto y esto empieza a moverse.") : `
      <section class="cifra"><p class="cifra-n">${euros(d.mes.gastado)}</p><p class="nota">gastado este mes · entraron ${euros(d.mes.ingresado)} · ${d.mes.ahorro >= 0 ? "te quedan" : "faltan"} ${euros(Math.abs(d.mes.ahorro))}</p></section>
      ${mareografo(d.marea)}
      <div class="rejilla">
        <section aria-labelledby="h-hall"><h2 id="h-hall" class="ante">Hallazgos</h2><ul class="hallazgos">${d.hallazgos.map((h) => `<li>${sello(h.tipo)}<p>${esc(h.texto)}</p><details><summary>¿De dónde sale?</summary><p>${esc(h.base)}</p></details></li>`).join("")}</ul></section>
        <section aria-labelledby="h-noche"><h2 id="h-noche" class="oculto">Noches</h2>${d.noches[0] ? noche(d.noches[0], S.ui.noches?.[d.noches[0].id]) : ""}</section>
      </div>
      <div class="rejilla">
        <section aria-labelledby="h-mom"><h2 id="h-mom" class="ante">Cuándo se te va</h2>
          <table class="momentos"><thead><tr><td></td>${FRANJAS.map((f) => `<th scope="col">${f}</th>`).join("")}</tr></thead><tbody>${["L", "M", "X", "J", "V", "S", "D"].map((n, i) => `<tr><th scope="row">${n}</th>${d.momentos[i].map((c) => `<td><span class="celda" style="--i:${(c / maxM).toFixed(2)}" title="${euros(c, 0)}"><span class="oculto">${euros(c, 0)}</span></span></td>`).join("")}</tr>`).join("")}</tbody></table>
          <p class="nota">Más oscuro = más gasto. 90 días.</p></section>
        <section class="ticket" aria-labelledby="h-tic"><h2 id="h-tic" class="ticket-t">*** EN QUÉ ***</h2>
          <ul>${d.categorias.map((c) => `<li><span>${esc(c.nombre)}</span><span class="puntos" aria-hidden="true"></span><span>${euros(c.cents)}</span></li>`).join("")}</ul>
          <p class="ticket-total"><span>TOTAL 90 DÍAS</span><span>${euros(d.total)}</span></p>
          <h3 class="ticket-t">*** DÓNDE ***</h3>
          <ul>${d.sitios.map((s) => `<li><span>${esc(s.sitio)} ×${s.veces}</span><span class="puntos" aria-hidden="true"></span><span>${euros(s.cents)}</span></li>`).join("")}</ul>
          <p class="ticket-pie">GRACIAS POR SU VISITA A SU PROPIA VIDA</p></section>
      </div>`}
      ${banco(S)}
    </div>`;
}
export const confirmarImporte = () => `<h2 class="titulo-2">¿Importar los últimos 90 días?</h2><p>Se leerán los movimientos y se añadirán a tus gastos e ingresos <strong>en este dispositivo</strong>.</p><ul class="lista"><li>Solo lectura: no se paga ni se mueve nada.</li><li>Lo que ya tengas no se duplica.</li><li>No se guarda nada en la memoria de MANU.</li><li>Subirlo a Tu nube lo decides tú aparte.</li></ul><p class="nota">${demo("Demo · se importará un extracto inventado")}</p><div class="fila"><button class="boton" data-act="importar-si">Sí, importar</button><button class="boton boton-linea" data-act="cerrar-hoja">Ahora no</button></div>`;
