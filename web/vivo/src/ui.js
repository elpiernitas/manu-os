// Piezas reutilizables de HORIZONTE: escapar texto, iconos, la cara de MANU, sellos, hojas y avisos.
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

// Iconos propios: trazo de 1.75 sobre 24 px, extremos redondos, todos con una línea de horizonte.
const TRAZOS = {
  bahia: '<path d="M10 20V9l2-4 2 4v11M8.5 20h7M10 12h4M3 20h3M18 20h3"/><path d="M15.5 6.5l4-1.5M8.5 6.5l-4-1.5"/>',
  hoy: '<path d="M3 17h18M6.5 17a5.5 5.5 0 0 1 11 0M12 5v2.5M4.6 9.6l1.8 1.8M19.4 9.6l-1.8 1.8M7 20.5h10"/>',
  dinero: '<circle cx="12" cy="8" r="4.2"/><path d="M12 6.2v3.6M3 17c2 0 2-1.6 4.5-1.6S10 17 12 17s2-1.6 4.5-1.6S19 17 21 17M5 20.5h14"/>',
  proyectos: '<path d="M3 14h18l-2.5 5.5h-13zM12 14V4l6 7H12M12 6L7.5 11H12"/>',
  tu: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M14.8 9.2l-1.6 4-4 1.6 1.6-4z"/>',
  agenda: '<path d="M4 6.5h16v13H4zM4 10.5h16M8 4v4M16 4v4"/><path d="M7 16c1.2 0 1.2-1.5 2.5-1.5S10.8 16 12 16s1.2-1.5 2.5-1.5S15.8 16 17 16"/>',
  sonda: '<path d="M12 3v11M12 14l-3.5 5.5h7zM4 6.5c1.5 0 1.5-1.4 3-1.4M17 5.1c1.5 0 1.5 1.4 3 1.4"/>',
  estrella: '<path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9-1.9 5.6-1.9-5.600L4.5 11l5.6-1.900z"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  botella: '<path d="M10 3h4v4l2.5 3.500V19a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-8.500L10 7zM7.5 13h9"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
};
export const icono = (n, cls = "") => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRAZOS[n] ?? ""}</svg>`;

/**
 * La cara de MANU: dos ojos asomados a la línea del horizonte. No es un robot ni un avatar:
 * es tu reflejo mirándote desde el agua. Gestos: calma, piensa, duda, zasca, feliz.
 */
export function cara(gesto = "calma", { grande = false } = {}) {
  const ojo = { calma: [5, 6.5], piensa: [5, 6.5], duda: [5, 6.5], zasca: [5.5, 3.2], feliz: [5, 6.5] }[gesto] ?? [5, 6.5];
  const feliz = gesto === "feliz";
  const ojos = feliz
    ? '<path class="cara-ojo" d="M17 21q5-8 10 0M37 21q5-8 10 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'
    : `<g class="cara-ojos"><ellipse class="cara-ojo" cx="22" cy="19" rx="${ojo[0]}" ry="${ojo[1]}"/><ellipse class="cara-ojo" cx="42" cy="${gesto === "duda" ? 17 : 19}" rx="${gesto === "duda" ? 4 : ojo[0]}" ry="${gesto === "duda" ? 4.6 : ojo[1]}"/></g>`;
  const ceja = gesto === "zasca" ? '<path d="M36 9.500l12-3.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' : gesto === "duda" ? '<path d="M37 8q5-3 10 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' : "";
  return `<svg class="cara cara-${esc(gesto)}${grande ? " cara-grande" : ""}" viewBox="0 0 64 40" role="img" aria-label="MANU, gesto: ${esc(gesto)}">${ceja}${ojos}<path class="cara-agua" d="M2 30c5 0 5-3 10-3s5 3 10 3 5-3 10-3 5 3 10 3 5-3 10-3 5 3 10 3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><g class="cara-reflejo" opacity=".28"><ellipse cx="22" cy="36" rx="4" ry="1.6"/><ellipse cx="42" cy="36" rx="4" ry="1.6"/></g></svg>`;
}

/** Sello de certeza. Nunca solo color: forma del borde + palabra. */
export const sello = (tipo) => { const t = { HECHO: "Hecho", HIPOTESIS: "Hipótesis", sabe: "Lo sé", sospecha: "Lo sospecho", confirmar: "Confírmamelo" }[tipo] ?? tipo; return `<span class="sello sello-${esc(String(tipo).toLowerCase())}">${esc(t)}</span>`; };
export const demo = (t = "Demo · datos inventados") => `<span class="demo">${esc(t)}</span>`;

/** La línea de olas que separa cielo y papel en todas las pantallas. */
export const olas = () => '<svg class="olas" viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true"><path class="olas-mar" d="M0 10c25 0 25-8 50-8s25 8 50 8 25-8 50-8 25 8 50 8 25-8 50-8 25 8 50 8 25-8 50-8 25 8 50 8v14H0z"/><path class="olas-papel" d="M0 17c25 0 25-6 50-6s25 6 50 6 25-6 50-6 25 6 50 6 25-6 50-6 25 6 50 6 25-6 50-6 25 6 50 6v7H0z"/></svg>';

/** Estados que toda lista necesita: vacío, error, cargando. */
export const vacio = (titulo, texto, accion = "") => `<div class="estado"><p class="estado-t">${esc(titulo)}</p><p>${esc(texto)}</p>${accion}</div>`;
export const cargando = (texto = "Un momento…") => `<div class="estado" role="status"><span class="marea-carga" aria-hidden="true"></span><p>${esc(texto)}</p></div>`;
export const fallo = (texto, accion = "") => `<div class="estado estado-error" role="alert"><p class="estado-t">No ha salido</p><p>${esc(texto)}</p>${accion}</div>`;

// ---------- Hoja (dialog nativo: foco atrapado, Esc y lector de pantalla sin trabajo extra) ----------
export function hoja(html, { etiqueta = "Detalle", clase = "" } = {}) {
  cerrarHoja();
  const d = document.createElement("dialog");
  d.className = `hoja ${clase}`; d.setAttribute("aria-label", etiqueta);
  d.innerHTML = `<button class="hoja-x" data-act="cerrar-hoja" aria-label="Cerrar">${icono("cerrar")}</button><div class="hoja-c">${html}</div>`;
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  d.addEventListener("close", () => d.remove());
  document.getElementById("capas").append(d);
  d.showModal();
  return d;
}
export const cerrarHoja = () => document.querySelectorAll("dialog.hoja").forEach((d) => d.close());

let reloj = null;
export function aviso(texto) {
  const el = document.getElementById("aviso");
  el.textContent = texto; el.classList.add("visible");
  clearTimeout(reloj); reloj = setTimeout(() => el.classList.remove("visible"), 3200);
}
export const quieto = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
