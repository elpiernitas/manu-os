// Limpieza digital (WEB-122, misión maestra idea 05). MANU revisa lo que GUARDA ÉL en este
// dispositivo y propone ordenarlo. Honesto con los límites: una web no puede ver el carrete del
// iPhone, las apps instaladas ni las pestañas de Safari, así que no lo finge.
// Reglas:
// - Cada propuesta dice qué ha encontrado y por qué.
// - Juntar duplicados y archivar se pueden deshacer (app.js guarda una copia de lo tocado).
// - Borrar fotos que ya nada usa es definitivo: pide una confirmación concreta.
import { findRepeat } from "./relate.js";

const DAY = 864e5;
const older = (at, now, days) => Boolean(at) && now - new Date(at) > days * DAY;

/** Ids de imagen que el vault menciona (en cualquier sitio: capturas, ideas, momentos, fuentes…). */
export function referencedImages(vault) {
  const ids = new Set();
  JSON.stringify(vault ?? {}, (k, v) => { if ((k === "imageId" || k === "fileId") && typeof v === "string") ids.add(v); return v; });
  return ids;
}

/**
 * Informe de limpieza. `imageIds` = ids guardados en IndexedDB (si se pudieron leer).
 * Devuelve [{ key, title, why, items: [{ id, label }], action, risky }] solo con lo que tiene algo.
 */
export function cleanupReport(v, now = new Date(), { imageIds = null } = {}) {
  const out = [];
  // 1) Duplicados en la Biblioteca (mismo enlace o mismo título).
  const lib = v?.library ?? [];
  const dups = [];
  lib.forEach((it, i) => { const prev = lib.slice(0, i).map((x) => ({ id: x.id, text: x.title, url: x.url })); const r = findRepeat({ text: it.title, url: it.url ?? null }, prev, { min: 0.95 }); if (r) dups.push({ id: it.id, keep: r.id, label: `${it.title} → se junta con la primera` }); });
  if (dups.length) out.push({ key: "dup-lib", title: "Repetidos en la Biblioteca", why: "Mismo enlace o mismo título. Se juntan en el primero, con sus notas.", items: dups, action: "Juntar", risky: false });
  // 2) Capturas en la bandeja sin revisar desde hace más de 30 días.
  const caps = (v?.captures ?? []).filter((c) => (c.status === "pending" || c.status === "read") && older(c.at, now, 30));
  if (caps.length) out.push({ key: "old-caps", title: "Capturas sin revisar (más de 30 días)", why: "Siguen en la bandeja. Archivarlas las quita de en medio; no se borran.", items: caps.map((c) => ({ id: c.id, label: c.name ?? c.title ?? "Captura" })), action: "Archivar", risky: false });
  // 3) Cosas en la bandeja de entrada sin clasificar desde hace más de 14 días.
  const pend = (v?.inbox ?? []).filter((i) => i.status === "PENDING" && older(i.at, now, 14));
  if (pend.length) out.push({ key: "old-inbox", title: "En la bandeja sin decidir (más de 14 días)", why: "Lo apuntaste y no se ha clasificado. Lo paso a ideas para que no se pierda.", items: pend.map((i) => ({ id: i.id, label: i.text })), action: "Pasar a ideas", risky: false });
  // 4) Enlaces guardados con un título que hay que revisar.
  const weak = lib.filter((l) => l.needsReview);
  if (weak.length) out.push({ key: "weak-lib", title: "Enlaces con título por revisar", why: "No abrí las páginas: el título lo saqué del enlace. Mejor que lo pongas tú.", items: weak.map((l) => ({ id: l.id, label: l.title })), action: "Revisar en Biblioteca", risky: false, go: "biblioteca" });
  // 5) Documentos vencidos hace más de 30 días.
  const exp = (v?.docs ?? []).filter((d) => d.expires && older(`${d.expires}T12:00:00`, now, 30));
  if (exp.length) out.push({ key: "old-docs", title: "Documentos vencidos", why: "Vencieron hace más de un mes. ¿Siguen haciendo falta o los renovaste?", items: exp.map((d) => ({ id: d.id, label: `${d.title} · venció el ${+d.expires.slice(8)}/${+d.expires.slice(5, 7)}/${d.expires.slice(0, 4)}` })), action: "Ver documentos", risky: false, go: "documentos" });
  // 6) Fotos guardadas que ya nada usa (huérfanas). Borrarlas es definitivo.
  if (Array.isArray(imageIds)) {
    const used = referencedImages(v);
    const orphans = imageIds.filter((id) => !used.has(id));
    if (orphans.length) out.push({ key: "orphans", title: "Fotos guardadas que ya nada usa", why: "Quedaron de cosas borradas. Ocupan espacio en este iPhone y no se ven en ningún sitio. Borrarlas no se puede deshacer.", items: orphans.map((id) => ({ id, label: id })), action: "Borrar", risky: true });
  }
  return out;
}

/** Lo que una web NO puede revisar, dicho claro, con dónde hacerlo en el iPhone. */
export const CANNOT = [
  ["Carrete y capturas del iPhone", "Fotos → Álbumes → Capturas de pantalla. Las que quieras conservar, compártelas con MANU."],
  ["Apps que casi no usas", "Ajustes → General → Almacenamiento del iPhone (te dice cuándo usaste cada una)."],
  ["Pestañas de Safari", "Safari → botón de pestañas → mantener pulsado «OK» → Cerrar todas."],
  ["Correo", "MANU sí lo revisa si conectaste Gmail: Tú → Correo."],
];
