import test from "node:test";
import assert from "node:assert/strict";
import { parseFrom, parseUnsubscribe, slim, summarize, mailSuggestions, findSender, fetchSnapshot, archive, trash, ensureLabel, GMAIL_SCOPE } from "../core/gmail.js";

const NOW = Date.parse("2026-09-29T10:00:00Z");
const msg = (id, from, subject, labels = ["INBOX"], extra = [], at = NOW - 3600000) => ({ id, labelIds: labels, internalDate: String(at), payload: { headers: [{ name: "From", value: from }, { name: "Subject", value: subject }, ...extra] } });

test("scope is gmail.modify: no permanent deletion", () => {
  assert.equal(GMAIL_SCOPE, "https://www.googleapis.com/auth/gmail.modify");
});

test("parses senders and List-Unsubscribe", () => {
  assert.deepEqual(parseFrom('"Banco Ejemplo" <No-Reply@Banco.example>'), { name: "Banco Ejemplo", email: "no-reply@banco.example", domain: "banco.example" });
  assert.equal(parseFrom("solo@correo.example").name, "solo");
  const u = parseUnsubscribe("<mailto:baja@x.example>, <https://x.example/baja?u=1>", "List-Unsubscribe=One-Click");
  assert.deepEqual(u, { http: "https://x.example/baja?u=1", mailto: "mailto:baja@x.example", oneClick: true });
  assert.equal(parseUnsubscribe("<http://inseguro.example>"), null); // only https or mailto
  assert.equal(parseUnsubscribe(""), null);
});

test("summary: bulk senders counted, important mail and ChatGPT export found", () => {
  const list = [
    ...Array.from({ length: 9 }, (_, i) => msg(`n${i}`, "Tienda <news@tienda.example>", `Oferta ${i}`, ["CATEGORY_PROMOTIONS", "UNREAD"], [{ name: "List-Unsubscribe", value: "<https://tienda.example/baja>" }])),
    msg("p1", "Persona Ejemplo <persona@correo.example>", "¿Quedamos?", ["INBOX", "UNREAD"]),
    msg("old", "Persona Ejemplo <persona@correo.example>", "Viejo", ["INBOX", "UNREAD"], [], NOW - 5 * 86400000),
    msg("x1", "OpenAI <noreply@tm.openai.com>", "Your data export is ready", ["INBOX"]),
  ].map(slim);
  const s = summarize(list, NOW);
  assert.equal(s.senders[0].email, "news@tienda.example");
  assert.equal(s.senders[0].count, 9);
  assert.equal(s.senders[0].unread, 9);
  assert.ok(s.senders[0].unsub.http);
  assert.deepEqual(s.important.map((m) => m.id), ["p1"]); // recent, unread, not bulk
  assert.equal(s.chatgptExport.id, "x1");
  const sug = mailSuggestions(s);
  assert.deepEqual(sug.map((x) => x.kind), ["export", "noisy"]);
  assert.deepEqual(mailSuggestions(s, ["export:x1", "sender:news@tienda.example"]), []);
  assert.equal(findSender(s, "tienda").email, "news@tienda.example");
  assert.equal(findSender(s, "nadie"), null);
});

test("snapshot asks only for metadata headers, never the body", async () => {
  const urls = [];
  const f = async (url) => {
    urls.push(url);
    if (url.includes("/messages?")) return { ok: true, status: 200, json: async () => ({ messages: [{ id: "a" }, { id: "b" }] }) };
    return { ok: true, status: 200, json: async () => msg(url.includes("/a?") ? "a" : "b", "X <x@y.example>", "Hola") };
  };
  const out = await fetchSnapshot("tok", f);
  assert.equal(out.length, 2);
  assert.ok(urls.slice(1).every((u) => u.includes("format=metadata") && !u.includes("format=full")));
  assert.ok(urls[0].includes(encodeURIComponent("newer_than:30d")));
});

test("actions: archive removes INBOX, trash is recoverable, labels are reused", async () => {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push([url, init.method ?? "GET", init.body ?? null]);
    if (url.endsWith("/labels") && !init.method) return { ok: true, status: 200, json: async () => ({ labels: [{ id: "L1", name: "Bancos" }] }) };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  await archive("t", ["a", "b"], f);
  assert.deepEqual(JSON.parse(calls[0][2]), { ids: ["a", "b"], removeLabelIds: ["INBOX"] });
  await trash("t", ["a"], f);
  assert.ok(calls[1][0].endsWith("/messages/a/trash") && calls[1][1] === "POST");
  assert.ok(!calls.some(([u, m]) => m === "DELETE" || u.includes("batchDelete")));
  assert.equal(await ensureLabel("t", "bancos", f), "L1");
});

test("401 becomes an auth error", async () => {
  await assert.rejects(fetchSnapshot("t", async () => ({ ok: false, status: 401 })), (e) => e.code === "auth");
});

test("Gemini can propose mail actions; the mail context only goes when marked", async () => {
  const { parseCalls } = await import("../core/ai.js");
  const { buildContext, BASIC_CONTEXT, FULL_CONTEXT } = await import("../core/converse.js");
  const json = { candidates: [{ content: { parts: [
    { functionCall: { name: "correo_baja", args: { remitente: "tienda" } } },
    { functionCall: { name: "correo_etiquetar", args: { remitente: "banco", etiqueta: "Bancos" } } },
    { functionCall: { name: "correo_etiquetar", args: { remitente: "banco" } } }, // missing label: dropped
    { functionCall: { name: "correo_borrar_para_siempre", args: { remitente: "x" } } }, // unknown: dropped
  ] } }] };
  assert.deepEqual(parseCalls(json), [{ name: "correo_baja", remitente: "tienda" }, { name: "correo_etiquetar", remitente: "banco", etiqueta: "Bancos" }]);
  const mail = { senders: [{ name: "Tienda", email: "news@tienda.example", count: 9, unsub: { http: "https://x" } }], important: [], chatgptExport: null };
  assert.ok(!buildContext({ mail }, BASIC_CONTEXT, new Date()).includes("CORREO"));
  assert.ok(buildContext({ mail }, FULL_CONTEXT, new Date()).includes("Tienda <news@tienda.example> 9 (tiene baja)"));
});

test("WEB-40: Gmail errors say what Google said, not a generic message", async () => {
  const { explainGmailError, fetchSnapshot: snap } = await import("../core/gmail.js");
  const disabled = { error: { code: 403, status: "PERMISSION_DENIED", message: "Gmail API has not been used in project 123 before or it is disabled.", details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "SERVICE_DISABLED" }] } };
  assert.equal(explainGmailError(403, disabled).code, "api-disabled");
  assert.ok(explainGmailError(403, disabled).message.includes("has not been used"));
  const scope = { error: { code: 403, status: "PERMISSION_DENIED", message: "Request had insufficient authentication scopes.", details: [{ reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT" }] } };
  assert.equal(explainGmailError(403, scope).code, "scope");
  assert.equal(explainGmailError(403, { error: { errors: [{ reason: "insufficientPermissions" }] } }).code, "scope");
  assert.equal(explainGmailError(401, null).code, "auth");
  assert.equal(explainGmailError(429, null).code, "rate");
  assert.equal(explainGmailError(500, { error: { message: "Backend Error" } }).message, "Gmail respondió 500 (Google: Backend Error)");
  await assert.rejects(snap("t", async () => ({ ok: false, status: 403, json: async () => disabled })), (e) => e.code === "api-disabled" && e.status === 403);
});
