// Copia del contrato de web/core/cerebro.js para el servidor. La prueba web/tests/cerebro.test.js
// comprueba que ambas copias validan igual.
export const RAMAS = {
  trabajo: { label: "Trabajo", hint: "RK Iglesias: marketing, Tablero, campañas, reels", subramas: { marketing: "Marketing", general: "General" } },
  proyectos: { label: "Proyectos", hint: "Un proyecto en cada subrama (su nombre en minúsculas y con guiones)", subramas: null },
  "manu-os": { label: "MANU OS", hint: "Tu vida: dinero, salud, personas, aprendizaje, ideas, casa y la propia app", subramas: { dinero: "Dinero", salud: "Salud", personas: "Personas", aprendizaje: "Aprendizaje", ideas: "Ideas", "vida-casa": "Vida y casa", desarrollo: "Desarrollo de MANU OS" } },
};
export const ORIGENES = { claude: "Claude", "claude-code": "Claude Code", codex: "Codex", chatgpt: "ChatGPT", manu: "Tú" };
export const LIMITES = { titulo: 160, resumen: 4000, etiquetas: 12, lote: 20 };
const SLUG = /^[a-z0-9-]{2,40}$/;

const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, n);
export const slug = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
// Secretos que nunca deben entrar en el cerebro (por si una IA los copia de la conversación).
const SECRET = /(sbp_[a-z0-9]{20,}|sk-[a-z0-9_-]{20,}|ghp_[a-z0-9]{20,}|xox[bap]-[a-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[a-z0-9_-]{20,}\.[a-z0-9_-]{20,}\.|\bES\d{2}(?:\s?\d{4}){5}\b)/i;

/**
 * Valida una entrada. Devuelve la versión limpia o lanza un error que explica qué falta.
 * Las IAs eligen la rama; nunca crean ramas nuevas. En «proyectos», la subrama es el proyecto.
 */
export function validarEntrada(e, { origen }) {
  if (!e || typeof e !== "object") throw new Error("Entrada vacía");
  if (!ORIGENES[origen]) throw new Error("Origen desconocido");
  const rama = String(e.rama ?? "");
  if (!RAMAS[rama]) throw new Error(`Rama no válida: usa ${Object.keys(RAMAS).join(", ")}`);
  let subrama = e.subrama ? slug(e.subrama) : null;
  const subs = RAMAS[rama].subramas;
  if (subs && subrama && !subs[subrama]) throw new Error(`Subrama no válida en ${rama}: usa ${Object.keys(subs).join(", ")}`);
  if (rama === "proyectos" && !subrama) throw new Error("En proyectos, la subrama es el nombre del proyecto");
  if (subrama && !SLUG.test(subrama)) subrama = null;
  const titulo = clean(e.titulo, LIMITES.titulo);
  const resumen = clean(e.resumen, LIMITES.resumen);
  if (!titulo || !resumen) throw new Error("Faltan título o resumen");
  if (SECRET.test(`${titulo} ${resumen}`)) throw new Error("Parece que lleva una clave, un token o un IBAN: no se guarda");
  const etiquetas = [...new Set((Array.isArray(e.etiquetas) ? e.etiquetas : []).map((t) => slug(t)).filter((t) => t.length >= 2))].slice(0, LIMITES.etiquetas);
  return {
    rama, subrama, categoria: clean(e.categoria, 60) || null, titulo, resumen, etiquetas,
    proyecto: clean(e.proyecto, 80) || (rama === "proyectos" ? subrama : null),
    origen, conversacion: clean(e.conversacion, 200) || null,
  };
}

/** Árbol para MANU: ramas → subramas → entradas, con recuentos. */
export function arbol(entradas) {
  const out = {};
  for (const [k, r] of Object.entries(RAMAS)) out[k] = { label: r.label, total: 0, sinRevisar: 0, subramas: {} };
  for (const e of entradas ?? []) {
    const r = out[e.rama]; if (!r || e.estado === "archivado") continue;
    r.total++; if (e.estado === "sin_revisar") r.sinRevisar++;
    const k = e.subrama ?? "general";
    (r.subramas[k] ??= { label: RAMAS[e.rama].subramas?.[k] ?? k.replace(/-/g, " "), entradas: [] }).entradas.push(e);
  }
  return out;
}

/** Lo que sabe el cerebro de un proyecto de MANU (por nombre o subrama). */
export function deProyecto(entradas, nombre) {
  const k = slug(nombre);
  return (entradas ?? []).filter((e) => e.estado !== "archivado" && ((e.rama === "proyectos" && e.subrama === k) || slug(e.proyecto ?? "") === k));
}

/** Búsqueda local de texto (todas las palabras). */
export function buscar(entradas, q) {
  const ts = slug(q).split("-").filter((w) => w.length >= 2);
  if (!ts.length) return [];
  return (entradas ?? []).filter((e) => { const h = `-${slug(`${e.titulo} ${e.resumen} ${(e.etiquetas ?? []).join(" ")} ${e.subrama ?? ""}`)}-`; return ts.every((t) => h.includes(`-${t}`)); });
}

