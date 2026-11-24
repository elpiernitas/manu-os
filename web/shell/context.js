// Panel de MANU con contexto (WEB-124). Puro: recibe lo que la app sabe de la vista actual y
// devuelve qué enseñar, separado SIEMPRE en cuatro cajas:
//   «Lo sé»          → datos del vault con su fuente;
//   «Lo deduzco»     → inferencias explicadas (nunca se presentan como hechos);
//   «Te propongo»    → acciones que Manu confirma con un toque;
//   «Me falta»       → lo que no sé o no está conectado.
// El contenido del vault es DATO: aquí solo se escapa y se enseña, nunca se interpreta como orden.
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const attrs = (a = {}) => Object.entries(a).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}="${esc(v)}"`).join(" ");

/** @returns {{ title, know: {text, src}[], infer: {text, why}[], propose: {text, label, attrs}[], gaps: string[] }} */
export function contextModel(m) {
  return { title: m.title ?? "Esto", know: (m.know ?? []).filter((x) => x?.text), infer: (m.infer ?? []).filter((x) => x?.text), propose: (m.propose ?? []).filter((x) => x?.text), gaps: (m.gaps ?? []).filter(Boolean) };
}

export function contextHtml(model, { reply = null, busy = false } = {}) {
  const m = contextModel(model);
  const empty = !m.know.length && !m.infer.length && !m.propose.length;
  const box = (title, cls, body) => (body ? `<section class="ctx-box ${cls}"><h3>${title}</h3>${body}</section>` : "");
  return `<header class="ctx-head"><div><b>MANU</b><span class="muted small"> · ${esc(m.title)}</span></div><button class="ctx-close" data-act="ctx-close" aria-label="Cerrar el panel de MANU (Esc)">✕</button></header>
    <div class="ctx-body">
      ${box("Lo sé", "ctx-know", m.know.map((k) => `<p>${esc(k.text)} <span class="ctx-src">${esc(k.src)}</span></p>`).join(""))}
      ${box("Lo deduzco", "ctx-infer", m.infer.map((k) => `<p>${esc(k.text)} <span class="ctx-why">${esc(k.why)}</span></p>`).join(""))}
      ${box("Te propongo", "ctx-propose", m.propose.map((k) => `<div class="ctx-prop"><p>${esc(k.text)}</p>${k.label ? `<button class="btn ghost small-btn" ${attrs(k.attrs)}>${esc(k.label)}</button>` : ""}</div>`).join(""))}
      ${empty ? '<p class="muted">Aquí no tengo nada que contarte todavía. No me lo invento.</p>' : ""}
      ${box("Me falta", "ctx-gaps", m.gaps.map((g) => `<p class="muted small">${esc(g)}</p>`).join(""))}
    </div>
    <form class="ctx-ask" id="ctxAsk"><label for="ctxQ" class="sr">Pregúntale a MANU</label><input id="ctxQ" autocomplete="off" placeholder="Pregúntale a MANU…" enterkeyhint="send"><button class="btn small-btn" type="submit">${busy ? "…" : "Enviar"}</button></form>
    ${reply ? `<div class="ctx-reply" aria-live="polite"><p class="muted small">MANU respondió:</p><p>${esc(reply)}</p></div>` : '<p class="muted small ctx-hint">Lo que escribas va al chat de MANU, como siempre. Esc cierra el panel.</p>'}`;
}

/** Enlaces de segundo nivel de cada área (barra lateral). Sin crear secciones nuevas: son subpantallas que ya existen. */
export const SIDE_SUB = {
  hoy: [["repaso", "Repaso y semana"], ["rutinas", "Rutinas y dejar listo"], ["fichaje", "Fichaje"], ["dj", "DJ"]],
  agenda: [["repaso", "Preparar la semana"], ["documentos", "Documentos con fecha"], ["personas", "Personas"]],
  manu: [["memoria", "Memoria"], ["cerebro", "Tu cerebro"], ["archivo", "Tu archivo"]],
  dinero: [["documentos", "Seguros y contratos"]],
  proyectos: [],
  tu: [["biblioteca", "Biblioteca"], ["momentos", "Momentos"], ["cerebro", "Tu cerebro"], ["aficiones", "Aficiones y aprender"], ["limpieza", "Limpieza digital"], ["apariencia", "Apariencia"], ["permisos", "Permisos"], ["nube", "Tu nube"], ["datos", "Tus datos"]],
};
export function sideSubHtml(tab, { sub = null, projects = [], openProject = null } = {}) {
  const links = (SIDE_SUB[tab] ?? []).map(([k, l]) => `<button class="side-link" data-act="side-go" data-to="${k}" aria-current="${sub === k ? "page" : "false"}">${esc(l)}</button>`).join("");
  const proj = tab === "proyectos" ? projects.slice(0, 12).map((p) => `<button class="side-link" data-act="side-proj" data-id="${esc(p.id)}" aria-current="${openProject === p.id ? "page" : "false"}"><span aria-hidden="true">${esc(p.emoji ?? "📁")}</span> ${esc(p.name)}</button>`).join("") : "";
  return links || proj ? `<p class="side-label">${tab === "proyectos" ? "Tus proyectos" : "En esta sección"}</p>${links}${proj}` : "";
}
