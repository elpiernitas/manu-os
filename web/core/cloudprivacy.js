// Tu nube y tus datos personales (WEB-98).
//
// Manu decide (2026-11-09) que la memoria y el estilo viajen en Tu nube. Este módulo es lo que
// se interpone entre el vault y la nube:
// - `cloudPayload`: lo que sube. Sin lo que MANU refresca solo, con los ejemplos de estilo
//   enmascarados (nombres, cifras, enlaces) y sin la memoria si Manu la deja solo en el dispositivo.
// - `applyRemote`: lo que baja. Si la memoria no viaja, la de este dispositivo no se toca.
// - `erasedVault` / `isErased`: «Vaciar mi nube» desde el iPhone, sin SQL ni panel de Supabase.
// - `cloudInventory`: qué hay en la nube, en recuentos, para verlo antes de decidir.
// WEB-99 (decisión de Manu: sincronización selectiva):
// - Las conversaciones completas (el chat con MANU y el de cada proyecto) no suben: cada
//   dispositivo guarda las suyas.
// - Los recuerdos sobre otras personas se quedan en el dispositivo salvo que Manu autorice uno
//   («Sincronizar entre dispositivos»), y los íntimos (salud, sexualidad, pareja, dinero,
//   religión, política, justicia…) no suben nunca, aunque se autoricen.
// - Las «lápidas» (`brain.forgotten`: id y fecha, sin texto) viajan siempre, y se aplican al
//   subir, al bajar y al resolver un conflicto: lo olvidado no reaparece.
//
// No hay cifrado de extremo a extremo (ADR-0017): lo protegen la cuenta de Manu (RLS), TLS en el
// camino y el cifrado en reposo del proveedor. Supabase, como empresa, técnicamente podría leerlo.
import { scrubStyle } from "./style.js";
import { normalise } from "./text.js";

export const brainInCloud = (vault) => vault?.settings?.cloudBrain !== false;

// Intimate topics about other people: never uploaded (they stay on the device).
const INTIMATE = /\b(salud|enferm\w*|medic\w*|hospital\w*|terapia|psicolog\w*|psiquiatr\w*|ansiedad|depresi\w*|embaraz\w*|aborto|cancer|diagnostic\w*|sexo|sexual\w*|gay|lesbiana|bisexual|trans|novi[oa]s?|pareja|ligue|divorci\w*|separad[oa]s?|infiel\w*|cuernos|religi\w*|politic\w*|vota|deuda\w*|sueldo|nomina|paro|desp[ie]di\w*|alcohol\w*|droga\w*|suicid\w*|maltrat\w*|denuncia\w*|juicio|carcel|muri[oó]|fallec\w*)\b/;
export const intimate = (text) => INTIMATE.test(normalise(String(text ?? "")));

/** Whether one memory travels, and why (for the Memoria screen). */
export function claimCloud(c) {
  if (!c?.thirdParty) return { sync: true, canAuthorize: false, why: "Tuyo: viaja con tu memoria." };
  if (intimate(`${c.text ?? ""} ${c.value ?? ""}`)) return { sync: false, canAuthorize: false, why: "Sobre otra persona y de un tema íntimo: solo en este dispositivo, siempre." };
  return c.cloud === true ? { sync: true, canAuthorize: true, why: "Sobre otra persona: lo autorizaste para viajar entre tus dispositivos." } : { sync: false, canAuthorize: true, why: "Sobre otra persona: solo en este dispositivo salvo que lo autorices." };
}

const tombs = (b) => new Set((b?.forgotten ?? []).map((t) => t.id));
export function mergeTombstones(a = [], b = []) {
  const by = new Map();
  for (const t of [...a, ...b]) if (t?.id && (!by.has(t.id) || by.get(t.id).at > t.at)) by.set(t.id, t);
  return [...by.values()].sort((x, y) => String(x.at).localeCompare(String(y.at))).slice(-2000);
}
/** Removes from `brain` every claim (and its events) that `other` forgot; merges both lists. */
export function applyTombstones(brain, other) {
  if (!brain) return brain;
  const forgotten = mergeTombstones(brain.forgotten, other?.forgotten);
  const dead = new Set(forgotten.map((t) => t.id));
  return { ...brain, forgotten, claims: (brain.claims ?? []).filter((c) => !dead.has(c.id)), events: (brain.events ?? []).filter((e) => !e.claimId || !dead.has(e.claimId)) };
}

/** What goes up. Never mutates the vault. */
export function cloudPayload(vault) {
  const out = { ...vault };
  delete out.chat;
  if (Array.isArray(out.projects)) out.projects = out.projects.map((p) => { const { chat, ...rest } = p; return rest; });
  if (!brainInCloud(vault)) { delete out.brain; return out; }
  if (out.brain) {
    const keep = (out.brain.claims ?? []).filter((c) => claimCloud(c).sync);
    const ids = new Set(keep.map((c) => c.id));
    out.brain = { ...out.brain, claims: keep, events: (out.brain.events ?? []).filter((e) => !e.claimId || ids.has(e.claimId)), style: out.brain.style ? scrubStyle(out.brain.style) : out.brain.style };
  }
  return out;
}

/** What comes down, merged with what this device keeps for itself. */
export function applyRemote(remote, local) {
  const out = { ...remote };
  // Conversations never travel: this device's stay.
  out.chat = Array.isArray(local?.chat) ? local.chat : [];
  if (Array.isArray(out.projects)) { const mine = new Map((local?.projects ?? []).map((p) => [p.id, p.chat])); out.projects = out.projects.map((p) => ({ ...p, chat: mine.get(p.id) ?? p.chat ?? [] })); }
  if (!brainInCloud(remote)) {
    if (local?.brain !== undefined) out.brain = local.brain; else delete out.brain;
    return out;
  }
  if (!local?.brain) return out;
  const rb = remote.brain ?? { schema: 1, claims: [], events: [] };
  // The other device's memory, minus what this one forgot; plus the memories this device keeps
  // for itself (other people's, not authorized or intimate) unless the other device forgot them.
  const merged = applyTombstones(rb, local.brain);
  const dead = tombs(merged);
  const have = new Set(merged.claims.map((c) => c.id));
  const localOnly = local.brain.claims.filter((c) => !claimCloud(c).sync && !have.has(c.id) && !dead.has(c.id));
  const localIds = new Set(localOnly.map((c) => c.id));
  out.brain = { ...merged, claims: [...merged.claims, ...localOnly], events: [...merged.events, ...(local.brain.events ?? []).filter((e) => localIds.has(e.claimId))] };
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
    localOnly: (vault?.brain?.claims ?? []).filter((c) => c.status !== "RETRACTED" && c.status !== "REJECTED" && !claimCloud(c).sync).length,
    tombstones: (vault?.brain?.forgotten ?? []).length,
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
