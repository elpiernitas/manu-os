// Triaje del correo (misión «asistente real»). No es otra bandeja: separa lo que probablemente
// pide algo de Manu del resto, y explica por qué. Puro y local: solo usa remitente, asunto,
// etiquetas de Gmail y si Manu ya escribió en el mismo hilo. Nunca lee el cuerpo, nunca manda
// nada a una IA y nunca archiva, borra, responde ni da de baja por su cuenta.
//
// vault.mailTriage = { reviewed: {[id]: iso}, fixes: {[id]: kind}, senders: {[email]: kind} }
import { normalise } from "./text.js";

export const TRIAGE = {
  REPLY: { label: "Probablemente necesita tu respuesta", short: "Responder", icon: "↩️", rank: 0 },
  RENEWAL: { label: "Renovación, vencimiento o suscripción", short: "Vence", icon: "⏳", rank: 1 },
  APPOINTMENT: { label: "Cita, reserva o confirmación", short: "Cita", icon: "📅", rank: 2 },
  INVOICE: { label: "Factura o recibo", short: "Factura", icon: "🧾", rank: 3 },
  PROJECT: { label: "De uno de tus proyectos", short: "Proyecto", icon: "📁", rank: 4 },
  INFO: { label: "Informativo", short: "Info", icon: "ℹ️", rank: 5 },
  BULK: { label: "Publicidad o repetitivo", short: "Masivo", icon: "📣", rank: 6 },
};
export const TRIAGE_KINDS = Object.keys(TRIAGE);
// Lo que se enseña en Hoy y arriba del todo en Correo: lo que puede pedir algo de Manu.
export const ACTIONABLE = new Set(["REPLY", "RENEWAL", "APPOINTMENT", "INVOICE", "PROJECT"]);

const RE = {
  RENEWAL: /\b(renova\w*|renew\w*|se renovara|vence\w*|vencimiento|caduc\w*|expira\w*|expir\w*|suscripci\w*|subscription|ultimo aviso|recordatorio de pago|tu plan|periodo de prueba|trial)\b/,
  APPOINTMENT: /\b(cita|citas|reserva\w*|booking|appointment|reservation|confirmaci\w*|confirmad[oa]|confirmed|tu visita|check-?in|billete|entradas?|invitaci\w*|invitation|convocatoria)\b/,
  INVOICE: /\b(factura\w*|invoice|recibo|receipt|justificante|pago realizado|pago recibido|payment received|tu pedido|order|pedido n|cargo|ticket de compra)\b/,
  QUESTION: /(\?|\b(puedes|podrias|podeis|necesito|necesitamos|me dices|me confirmas|confirmame|esperamos tu|quedamos|te viene bien|que te parece|urgente|respuesta|responde|contesta|firma|firmar|documentacion pendiente)\b)/,
};
const BULK_LABELS = ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_UPDATES", "CATEGORY_FORUMS"];
const AUTOMATED = /^(no-?reply|noreply|do-?not-?reply|newsletter|news|info|marketing|notifications?|notificaciones|alertas?|avisos?|mailer|bounce|support|soporte|hello|hola)[@+.]/;
const isBulk = (m) => Boolean(m.unsub) || (m.labels ?? []).some((l) => BULK_LABELS.includes(l));
const isAutomated = (m) => AUTOMATED.test(m.from?.email ?? "");

/** Por hilo: la última vez que Manu escribió (mensajes con la etiqueta SENT). */
export function lastSentByThread(messages) {
  const by = new Map();
  for (const m of messages ?? []) if ((m.labels ?? []).includes("SENT") && m.threadId) by.set(m.threadId, Math.max(by.get(m.threadId) ?? 0, m.at ?? 0));
  return by;
}

/**
 * Clasifica un mensaje recibido. Devuelve { kind, why: string[], replied, sure }.
 * `sure` es falso cuando solo es una pista (nunca se presenta como un hecho).
 */
export function classify(m, { projects = [], sentByThread = new Map(), fixes = {}, senders = {} } = {}) {
  const subject = normalise(m.subject ?? "");
  const why = [];
  const replied = Boolean(m.threadId && (sentByThread.get(m.threadId) ?? 0) > (m.at ?? 0));
  if (fixes[m.id]) return { kind: fixes[m.id], why: ["Lo corregiste tú"], replied, sure: true };
  const email = m.from?.email ?? "";
  if (email && senders[email]) return { kind: senders[email], why: [`Tú dijiste que lo de ${m.from?.name || email} es así`], replied, sure: true };
  const bulk = isBulk(m), auto = isAutomated(m);
  // Lo administrativo va antes que lo masivo: una factura llega casi siempre de un no-reply.
  if (RE.RENEWAL.test(subject)) return { kind: "RENEWAL", why: ["El asunto habla de renovar, vencer o una suscripción"], replied, sure: false };
  if (RE.APPOINTMENT.test(subject)) return { kind: "APPOINTMENT", why: ["El asunto habla de una cita, reserva o confirmación"], replied, sure: false };
  if (RE.INVOICE.test(subject)) return { kind: "INVOICE", why: ["El asunto parece una factura, recibo o pedido"], replied, sure: false };
  const proj = projects.find((p) => { const w = normalise(p.name ?? "").split(/[^a-z0-9ñ]+/).filter((x) => x.length >= 4); return w.length && w.some((x) => subject.includes(x)); });
  if (proj && !bulk) return { kind: "PROJECT", why: [`El asunto menciona «${proj.name}»`], replied, sure: false, project: proj.id };
  if (bulk) { why.push(m.unsub ? "Trae enlace para darse de baja" : "Gmail lo clasifica como promociones, social o notificaciones"); return { kind: "BULK", why, replied, sure: false }; }
  if (!auto) {
    // Una persona te escribe. Si ya contestaste después, no se pide nada.
    if (replied) return { kind: "INFO", why: ["Ya escribiste en este hilo después de este correo"], replied, sure: false };
    const q = RE.QUESTION.test(subject), inThread = /^(re|rv|fw|fwd)\s*:/i.test(m.subject ?? "");
    if (q || inThread) {
      if (q) why.push("El asunto pregunta o pide algo");
      if (inThread) why.push("Es parte de una conversación");
      why.push("Te escribe una persona, no un envío automático");
      return { kind: "REPLY", why, replied, sure: false };
    }
    return { kind: "INFO", why: ["Te escribe una persona, pero el asunto no pide nada claro"], replied, sure: false };
  }
  return { kind: "INFO", why: ["Envío automático sin nada que hacer a la vista"], replied, sure: false };
}

/**
 * Lo que se guarda del correo para el triaje: solo recibidos de los últimos 7 días, sin cuerpo.
 * `messages` son los de `gmail.slim`. Devuelve una lista ordenada por importancia y fecha.
 */
export function triageList(messages, { now = Date.now(), projects = [], state = {} } = {}) {
  const sentByThread = lastSentByThread(messages);
  const fixes = state.fixes ?? {}, senders = state.senders ?? {}, reviewed = state.reviewed ?? {};
  return (messages ?? [])
    .filter((m) => !(m.labels ?? []).includes("SENT") && (m.labels ?? []).includes("INBOX") && now - (m.at ?? 0) < 7 * 86400000)
    .map((m) => { const c = classify(m, { projects, sentByThread, fixes, senders }); return { id: m.id, threadId: m.threadId ?? null, name: m.from?.name || m.from?.email || "Desconocido", email: m.from?.email ?? "", subject: m.subject ?? "", at: m.at ?? 0, unread: (m.labels ?? []).includes("UNREAD"), ...c, reviewed: Boolean(reviewed[m.id]) }; })
    .sort((a, b) => TRIAGE[a.kind].rank - TRIAGE[b.kind].rank || b.at - a.at);
}

/**
 * Lo mínimo que se guarda de cada mensaje (en este dispositivo, no en Tu nube) para poder
 * reclasificar sin volver a pedir nada a Gmail: los recibidos de 7 días y los tuyos (para saber
 * si ya contestaste). Sin cuerpo ni destinatarios.
 */
export function keepForTriage(messages, now = Date.now()) {
  const KEEP = new Set(["INBOX", "UNREAD", "SENT", ...BULK_LABELS]);
  return (messages ?? []).filter((m) => now - (m.at ?? 0) < 7 * 86400000 || (m.labels ?? []).includes("SENT"))
    .slice(0, 250)
    .map((m) => ({ id: m.id, threadId: m.threadId ?? null, from: { name: m.from?.name ?? "", email: m.from?.email ?? "" }, subject: m.subject ?? "", at: m.at ?? 0, labels: (m.labels ?? []).filter((l) => KEEP.has(l)), unsub: m.unsub ? true : null }));
}

/** Lo pendiente de verdad: accionable y no revisado. */
export const pendingMail = (items) => (items ?? []).filter((x) => ACTIONABLE.has(x.kind) && !x.reviewed);

// ---------- Estado (correcciones y revisados), puro ----------
export const emptyTriageState = () => ({ reviewed: {}, fixes: {}, senders: {} });
export const triageStateOf = (v) => ({ ...emptyTriageState(), ...(v?.mailTriage ?? {}) });
export function markReviewed(state, id, now = new Date(), on = true) {
  const reviewed = { ...state.reviewed };
  if (on) reviewed[id] = now.toISOString(); else delete reviewed[id];
  return { ...state, reviewed };
}
/** Corrige la clase de un correo; con `sender`, la de todo lo que llegue de ese remitente. */
export function fixKind(state, item, kind, { sender = false } = {}) {
  if (!TRIAGE[kind]) throw new Error("Tipo de correo desconocido");
  if (sender && item.email) return { ...state, senders: { ...state.senders, [item.email]: kind } };
  return { ...state, fixes: { ...state.fixes, [item.id]: kind } };
}
/** Borra marcas de correos que ya no están en la lista, para que no crezca sin fin. */
export function pruneTriage(state, items, keepIds = []) {
  const ids = new Set([...(items ?? []).map((x) => x.id), ...keepIds]);
  const only = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => ids.has(k)));
  return { ...state, reviewed: only(state.reviewed), fixes: only(state.fixes) };
}
