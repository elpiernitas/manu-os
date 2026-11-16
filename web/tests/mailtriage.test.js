// Triaje del correo. Datos ficticios: remitentes y asuntos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../core/mailtriage.js";
import { slim } from "../core/gmail.js";
import { cloudPayload, applyRemote } from "../core/cloudprivacy.js";

const NOW = Date.parse("2026-11-16T12:00:00Z");
const h = (n) => NOW - n * 3600000;
const msg = (id, { name = "Ana Prueba", email = "ana@ejemplo.test", subject = "Hola", at = h(2), labels = ["INBOX", "UNREAD"], threadId = `t-${id}`, unsub = null } = {}) =>
  ({ id, threadId, from: { name, email, domain: email.split("@")[1] }, subject, at, labels, unsub });

test("clasifica por remitente y asunto, con motivos y sin darlo por hecho", () => {
  const c = (m) => T.classify(m).kind;
  assert.equal(c(msg("a", { subject: "¿Puedes revisar el presupuesto?" })), "REPLY");
  assert.equal(c(msg("b", { subject: "Re: la reunión" })), "REPLY", "una conversación de una persona");
  assert.equal(c(msg("c", { email: "no-reply@tienda.test", subject: "Tu factura de noviembre" })), "INVOICE", "una factura de un no-reply no es publicidad");
  assert.equal(c(msg("d", { email: "avisos@seguro.test", subject: "Tu póliza vence el 30" })), "RENEWAL");
  assert.equal(c(msg("e", { email: "noreply@clinica.test", subject: "Confirmación de tu cita" })), "APPOINTMENT");
  assert.equal(c(msg("f", { email: "news@marca.test", subject: "Ofertas de la semana", labels: ["INBOX", "CATEGORY_PROMOTIONS"], unsub: { url: "https://x.test" } })), "BULK");
  assert.equal(c(msg("g", { subject: "Fotos del finde" })), "INFO", "una persona sin pedir nada");
  const r = T.classify(msg("a", { subject: "¿Puedes revisar el presupuesto?" }));
  assert.equal(r.sure, false, "es una suposición");
  assert.ok(r.why.length >= 2);
});

test("sin leer no es importante, y si ya contestaste en el hilo no pide respuesta", () => {
  const leido = T.classify(msg("a", { subject: "¿Quedamos el jueves?", labels: ["INBOX"] }));
  const sinLeer = T.classify(msg("b", { subject: "Fotos del finde", labels: ["INBOX", "UNREAD"] }));
  assert.equal(leido.kind, "REPLY", "leído y aún sin contestar sigue pidiendo algo");
  assert.equal(sinLeer.kind, "INFO", "sin leer no lo hace importante");
  const recibido = msg("in", { subject: "¿Quedamos el jueves?", threadId: "t1", at: h(5) });
  const mio = msg("out", { name: "Yo", email: "yo@ejemplo.test", subject: "Re: ¿Quedamos el jueves?", threadId: "t1", at: h(3), labels: ["SENT"] });
  const list = T.triageList([recibido, mio], { now: NOW });
  assert.equal(list.length, 1, "lo que envié no sale en la lista");
  assert.equal(list[0].kind, "INFO"); assert.equal(list[0].replied, true);
  assert.match(list[0].why.join(" "), /Ya escribiste/);
  // Contesté antes y me vuelven a escribir: vuelve a pedir respuesta.
  const otraVez = T.triageList([{ ...recibido, at: h(1) }, mio], { now: NOW });
  assert.equal(otraVez[0].kind, "REPLY");
});

test("un proyecto en el asunto lo relaciona; lo antiguo (más de 7 días) no entra", () => {
  const list = T.triageList([msg("p", { subject: "Planos de la reforma del baño" }), msg("old", { subject: "¿Me llamas?", at: NOW - 9 * 86400000 })], { now: NOW, projects: [{ id: "pr1", name: "Reforma baño" }] });
  assert.deepEqual(list.map((x) => x.id), ["p"]);
  assert.equal(list[0].kind, "PROJECT"); assert.equal(list[0].project, "pr1");
});

test("correcciones: la de un correo y la de un remitente se recuerdan y ganan a la suposición", () => {
  const m = msg("x", { email: "club@ejemplo.test", subject: "Newsletter de socios", labels: ["INBOX", "CATEGORY_PROMOTIONS"] });
  let st = T.emptyTriageState();
  assert.equal(T.triageList([m], { now: NOW, state: st })[0].kind, "BULK");
  st = T.fixKind(st, T.triageList([m], { now: NOW })[0], "INFO");
  const one = T.triageList([m], { now: NOW, state: st })[0];
  assert.equal(one.kind, "INFO"); assert.equal(one.sure, true); assert.match(one.why[0], /corregiste/);
  st = T.fixKind(T.emptyTriageState(), one, "REPLY", { sender: true });
  assert.equal(T.triageList([{ ...m, id: "y" }], { now: NOW, state: st })[0].kind, "REPLY", "vale para los siguientes del mismo remitente");
  assert.throws(() => T.fixKind(st, one, "INVENTADO"));
});

test("revisado: sale de pendientes solo en MANU y se puede deshacer; las marcas viejas se limpian", () => {
  const m = msg("a", { subject: "¿Puedes firmar?" });
  let st = T.markReviewed(T.emptyTriageState(), "a", new Date(NOW));
  assert.equal(T.pendingMail(T.triageList([m], { now: NOW, state: st })).length, 0);
  st = T.markReviewed(st, "a", new Date(NOW), false);
  assert.equal(T.pendingMail(T.triageList([m], { now: NOW, state: st })).length, 1);
  st = T.pruneTriage(T.markReviewed(st, "gone"), [{ id: "a" }]);
  assert.deepEqual(Object.keys(st.reviewed), []);
});

test("se guarda lo mínimo: sin cuerpo ni destinatarios, y el hilo viene de Gmail", () => {
  const raw = { id: "1", threadId: "th", labelIds: ["INBOX", "UNREAD", "IMPORTANT", "Label_9"], snippet: "texto privado", internalDate: String(h(1)), payload: { headers: [{ name: "From", value: "Ana Prueba <ana@ejemplo.test>" }, { name: "Subject", value: "¿Vienes?" }] } };
  const s = slim(raw);
  assert.equal(s.threadId, "th");
  const kept = T.keepForTriage([s], NOW);
  assert.equal(kept.length, 1);
  assert.ok(!JSON.stringify(kept).includes("texto privado"), "sin el texto del correo");
  assert.deepEqual(kept[0].labels, ["INBOX", "UNREAD"], "solo las etiquetas que hacen falta");
  assert.equal(T.triageList(kept, { now: NOW })[0].kind, "REPLY", "se puede reclasificar con lo guardado");
});

test("Tu nube: el correo leído no sube; las correcciones sí; al bajar se conserva el de este dispositivo", () => {
  const v = { schema: 1, chat: [], mail: { senders: [{ email: "x@y.test" }], triage: [] }, mailTriage: { reviewed: { a: "2026-11-16" }, fixes: {}, senders: {} } };
  const up = cloudPayload(v);
  assert.equal(up.mail, undefined);
  assert.deepEqual(up.mailTriage, v.mailTriage);
  const down = applyRemote({ schema: 1, mailTriage: v.mailTriage }, v);
  assert.deepEqual(down.mail, v.mail);
  assert.equal(applyRemote({ schema: 1, mail: { senders: [] } }, { schema: 1 }).mail, undefined, "un correo viejo de la nube no se mete en otro dispositivo");
});
