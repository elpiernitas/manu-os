// Aficiones y aprender (WEB-121, misión maestra ideas 13 y 14): un sitio ligero para lo que a Manu
// le gusta aunque no dé dinero ni resultados, y para lo que quiere aprender. No es una plataforma
// de cursos ni un sistema de objetivos: sin rachas, sin porcentajes, sin metas obligatorias.
// - Una afición puede no tener ningún «siguiente paso»; está bien así.
// - El siguiente paso lo escribe Manu. MANU no se lo inventa.
// - Los recursos salen de la Biblioteca (lo que ya guardó), por palabras del nombre.
import { normalise } from "./text.js";

export const INTEREST_KINDS = { aficion: "Afición", aprender: "Quiero aprender" };
const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function newInterest({ id, kind = "aficion", name, step = "", project = null }) {
  const n = clip(name, 60);
  if (!n) throw new Error("Ponle un nombre: guitarra, fotografía, inglés…");
  return { id, kind: INTEREST_KINDS[kind] ? kind : "aficion", name: n, ...(clip(step, 140) ? { step: clip(step, 140) } : {}), ...(project ? { project: String(project) } : {}) };
}

/** Lo que ya tiene guardado sobre esto en la Biblioteca (libros, vídeos, cursos…). */
export function resourcesFor(interest, library = []) {
  const ws = normalise(interest?.name ?? "").split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4);
  if (!ws.length) return [];
  return (library ?? []).filter((l) => { const h = normalise(`${l.title} ${l.topic ?? ""} ${(l.tags ?? []).join(" ")} ${l.notes ?? ""}`); return ws.some((w) => h.includes(w)); });
}
