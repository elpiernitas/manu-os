// Tu nube y tus datos personales (WEB-98).
//
// Manu decide (2026-11-09) que la memoria y el estilo viajen en Tu nube. Este módulo es lo que
// se interpone entre el vault y la nube:
// - `cloudPayload`: lo que sube. Sin lo que MANU refresca solo, con los ejemplos de estilo
//   enmascarados (nombres, cifras, enlaces) y sin la memoria si Manu la deja solo en el dispositivo.
// - `applyRemote`: lo que baja. Si la memoria no viaja, la de este dispositivo no se toca.
// - `erasedVault` / `isErased`: «Vaciar mi nube» desde el iPhone, sin SQL ni panel de Supabase.
// - `cloudInventory`: qué hay en la nube, en recuentos, para verlo antes de decidir.
//
// No hay cifrado de extremo a extremo (ADR-0017): lo protegen la cuenta de Manu (RLS), TLS en el
// camino y el cifrado en reposo del proveedor. Supabase, como empresa, técnicamente podría leerlo.
import { scrubStyle } from "./style.js";

export const brainInCloud = (vault) => vault?.settings?.cloudBrain !== false;

/** What goes up. Never mutates the vault. */
export function cloudPayload(vault) {
  const out = { ...vault };
  if (!brainInCloud(vault)) delete out.brain;
  else if (out.brain?.style) out.brain = { ...out.brain, style: scrubStyle(out.brain.style) };
  return out;
}

/** What comes down. If the memory stays on each device, this device's memory is kept. */
export function applyRemote(remote, local) {
  if (brainInCloud(remote)) return remote;
  const out = { ...remote };
  if (local?.brain !== undefined) out.brain = local.brain; else delete out.brain;
  return out;
}

// «Vaciar mi nube»: the row keeps existing (the table only allows updating it), but its content
// becomes an empty vault with a mark. Another device that sees the mark never applies it: it
// keeps its own data and disconnects, instead of being wiped.
export function erasedVault({ now = new Date(), device = null } = {}) {
  return { schema: 1, inbox: [], spending: [], chat: [], settings: {}, erased: { at: now.toISOString(), device } };
}
export const isErased = (data) => Boolean(data && typeof data === "object" && data.erased && typeof data.erased.at === "string");

/** Counts only, never contents: what is (or would be) in the cloud. */
export function cloudInventory(vault) {
  const v = cloudPayload(vault ?? {});
  const claims = v.brain?.claims ?? [];
  const live = claims.filter((c) => c.status !== "RETRACTED" && c.status !== "REJECTED");
  const style = v.brain?.style;
  const n = (k) => (Array.isArray(v[k]) ? v[k].length : 0);
  return {
    brain: brainInCloud(vault),
    memories: live.length,
    thirdParty: live.filter((c) => c.thirdParty).length,
    sensitive: live.filter((c) => c.sensitive && !c.thirdParty).length,
    decisions: live.filter((c) => c.kind === "DECISION").length,
    styleMsgs: style?.msgs ?? 0,
    styleExpressions: style ? Object.keys(style.grams ?? {}).length : 0,
    examples: style ? Object.values(style.grams ?? {}).filter((g) => g.ex).length : 0,
    jokes: v.brain?.voice?.jokes?.length ?? 0,
    expressions: v.brain?.voice?.examples?.length ?? 0,
    rest: { tareas: n("inbox"), gastos: n("spending"), ingresos: n("income"), recordatorios: n("reminders"), personas: n("people"), proyectos: n("projects"), salud: n("health"), lugares: n("places"), chat: n("chat") },
  };
}
