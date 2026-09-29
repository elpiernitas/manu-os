// Gmail (WEB-33, Manu's decision 2026-09-29: full access to his mail).
// Scope gmail.modify: read, archive, label and move to the Bin (recoverable
// for 30 days). Permanent deletion is deliberately left out.
// Only a small summary stays on the phone: bulk senders with counts, the
// latest important mails (sender + subject) and whether ChatGPT's export arrived.
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
export const LIMITS = { messages: 200, senders: 30, important: 12, perAction: 500 };

// WEB-40: Google's own error, not a generic one. A 403 can mean the API is
// off in the Cloud project, a token without the Gmail scope or a blocked app.
export function explainGmailError(status, body) {
  const e = body?.error ?? {};
  const reasons = [...(e.details ?? []).map((d) => d?.reason), ...(e.errors ?? []).map((x) => x?.reason), e.status].filter(Boolean);
  const has = (...r) => r.some((x) => reasons.includes(x));
  const google = e.message ? ` (Google: ${String(e.message).replace(/\s+/g, " ").slice(0, 180)})` : "";
  if (status === 401) return { code: "auth", message: "La sesión de Google ha caducado. Pulsa «Actualizar» otra vez." };
  if (has("SERVICE_DISABLED", "accessNotConfigured")) return { code: "api-disabled", message: `La API de Gmail no está activada en tu proyecto de Google Cloud${google}` };
  if (has("ACCESS_TOKEN_SCOPE_INSUFFICIENT", "insufficientPermissions")) return { code: "scope", message: `El permiso que dio Google no incluye Gmail${google}` };
  if (status === 429 || has("rateLimitExceeded", "userRateLimitExceeded", "RATE_LIMIT_EXCEEDED")) return { code: "rate", message: "Gmail pide esperar un poco (demasiadas peticiones seguidas)." };
  return { code: "http", message: `Gmail respondió ${status}${google}` };
}

async function call(token, url, init = {}, fetchImpl = fetch) {
  const res = await fetchImpl(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  if (!res.ok) {
    const body = await Promise.resolve().then(() => res.json()).catch(() => null); // some errors come without a body
    const x = explainGmailError(res.status, body);
    throw Object.assign(new Error(x.message), { code: x.code, status: res.status });
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

const clip = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);

// "Revolut <no-reply@revolut.com>" → { name, email, domain }
export function parseFrom(value) {
  const v = clip(value, 300);
  const m = v.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const email = (m ? m[2] : v).trim().toLowerCase();
  const name = (m && m[1].trim()) || email.split("@")[0] || email;
  return { name: clip(name, 60), email: clip(email, 120), domain: email.split("@")[1] ?? "" };
}

// List-Unsubscribe: "<https://…>, <mailto:…>" (RFC 2369) + one-click (RFC 8058).
export function parseUnsubscribe(value, post = "") {
  const out = { http: null, mailto: null, oneClick: false };
  for (const [, u] of String(value ?? "").matchAll(/<([^>]+)>/g)) {
    if (!out.http && /^https:\/\//i.test(u)) out.http = u.slice(0, 1000);
    if (!out.mailto && /^mailto:/i.test(u)) out.mailto = u.slice(0, 500);
  }
  out.oneClick = Boolean(out.http) && /List-Unsubscribe=One-Click/i.test(String(post ?? ""));
  return out.http || out.mailto ? out : null;
}

const header = (msg, name) => (msg.payload?.headers ?? []).find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

// Gmail message (format=metadata) → the few fields MANU uses.
export function slim(msg) {
  const from = parseFrom(header(msg, "From"));
  return {
    id: String(msg.id ?? ""),
    labels: msg.labelIds ?? [],
    from,
    subject: clip(header(msg, "Subject"), 140),
    at: Number(msg.internalDate) || Date.parse(header(msg, "Date")) || 0,
    unsub: parseUnsubscribe(header(msg, "List-Unsubscribe"), header(msg, "List-Unsubscribe-Post")),
  };
}

const BULK_LABELS = ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_UPDATES", "CATEGORY_FORUMS"];
const isBulk = (m) => Boolean(m.unsub) || m.labels.some((l) => BULK_LABELS.includes(l)) || /^(no-?reply|newsletter|news|info|marketing|notifications?)@/.test(m.from.email);
const isChatgptExport = (m) => /(^|\.)openai\.com$/.test(m.from.domain) && /(export|exportaci|tus datos|your data|data)/i.test(m.subject);

// Summary kept in the vault. `now` in ms.
export function summarize(messages, now = Date.now()) {
  const senders = new Map();
  for (const m of messages) {
    if (!isBulk(m) || !m.from.email) continue;
    const s = senders.get(m.from.email) ?? { email: m.from.email, name: m.from.name, domain: m.from.domain, count: 0, unread: 0, unsub: null, last: 0 };
    s.count++;
    if (m.labels.includes("UNREAD")) s.unread++;
    if (!s.unsub && m.unsub) s.unsub = m.unsub;
    s.last = Math.max(s.last, m.at);
    senders.set(m.from.email, s);
  }
  const important = messages
    .filter((m) => !isBulk(m) && m.labels.includes("INBOX") && m.labels.includes("UNREAD") && now - m.at < 3 * 86400000)
    .sort((a, b) => b.at - a.at).slice(0, LIMITS.important)
    .map((m) => ({ id: m.id, name: m.from.name, subject: m.subject, at: m.at }));
  const exp = messages.filter(isChatgptExport).sort((a, b) => b.at - a.at)[0];
  return {
    senders: [...senders.values()].sort((a, b) => b.count - a.count).slice(0, LIMITS.senders),
    important,
    chatgptExport: exp ? { id: exp.id, subject: exp.subject, at: exp.at } : null,
    total: messages.length,
  };
}

// What MANU brings up by itself. `seen`: keys Manu already answered.
export function mailSuggestions(summary, seen = []) {
  const out = [];
  const done = new Set(seen);
  if (summary?.chatgptExport && !done.has(`export:${summary.chatgptExport.id}`)) out.push({ kind: "export", key: `export:${summary.chatgptExport.id}`, id: summary.chatgptExport.id });
  const noisy = (summary?.senders ?? []).find((s) => s.count >= 8 && !done.has(`sender:${s.email}`));
  if (noisy) out.push({ kind: "noisy", key: `sender:${noisy.email}`, email: noisy.email, name: noisy.name, count: noisy.count, canUnsub: Boolean(noisy.unsub) });
  return out;
}

// Finds a sender by name, email or domain ("revolut").
export function findSender(summary, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return null;
  return (summary?.senders ?? []).find((s) => s.email === q || s.name.toLowerCase().includes(q) || s.domain.includes(q) || s.email.includes(q)) ?? null;
}

// Last 30 days of mail, metadata only (headers, never the body), newest first.
export async function fetchSnapshot(token, fetchImpl = fetch, { max = LIMITS.messages } = {}) {
  const ids = [];
  let pageToken = "";
  for (let page = 0; page < 5 && ids.length < max; page++) {
    const json = await call(token, `${API}/messages?q=${encodeURIComponent("newer_than:30d -in:chats")}&maxResults=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`, {}, fetchImpl);
    ids.push(...(json?.messages ?? []).map((m) => m.id));
    pageToken = json?.nextPageToken ?? "";
    if (!pageToken) break;
  }
  const wanted = ids.slice(0, max);
  const headers = ["From", "Subject", "Date", "List-Unsubscribe", "List-Unsubscribe-Post"].map((h) => `metadataHeaders=${h}`).join("&");
  const out = [];
  for (let i = 0; i < wanted.length; i += 8) {
    const batch = await Promise.all(wanted.slice(i, i + 8).map((id) =>
      call(token, `${API}/messages/${encodeURIComponent(id)}?format=metadata&${headers}`, {}, fetchImpl).catch((err) => { if (err.code === "auth") throw err; return null; })));
    out.push(...batch.filter(Boolean).map(slim));
  }
  return out;
}

// Ids of every message from a sender (up to LIMITS.perAction).
export async function idsFrom(token, email, fetchImpl = fetch) {
  const json = await call(token, `${API}/messages?q=${encodeURIComponent(`from:${email}`)}&maxResults=${LIMITS.perAction}`, {}, fetchImpl);
  return (json?.messages ?? []).map((m) => m.id);
}

const modify = (token, ids, body, fetchImpl) => ids.length
  ? call(token, `${API}/messages/batchModify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, ...body }) }, fetchImpl)
  : Promise.resolve(null);

export const archive = (token, ids, fetchImpl) => modify(token, ids, { removeLabelIds: ["INBOX"] }, fetchImpl);
export const unarchive = (token, ids, fetchImpl) => modify(token, ids, { addLabelIds: ["INBOX"] }, fetchImpl);
export const addLabel = (token, ids, labelId, fetchImpl) => modify(token, ids, { addLabelIds: [labelId] }, fetchImpl);
export const removeLabel = (token, ids, labelId, fetchImpl) => modify(token, ids, { removeLabelIds: [labelId] }, fetchImpl);

// Bin (recoverable for 30 days) and back.
export async function trash(token, ids, fetchImpl = fetch) {
  for (const id of ids) await call(token, `${API}/messages/${encodeURIComponent(id)}/trash`, { method: "POST" }, fetchImpl);
}
export async function untrash(token, ids, fetchImpl = fetch) {
  for (const id of ids) await call(token, `${API}/messages/${encodeURIComponent(id)}/untrash`, { method: "POST" }, fetchImpl);
}

// Returns the id of a label with that name, creating it when missing.
export async function ensureLabel(token, name, fetchImpl = fetch) {
  const clean = clip(name, 60);
  if (!clean) throw new Error("Nombre de etiqueta vacío");
  const json = await call(token, `${API}/labels`, {}, fetchImpl);
  const found = (json?.labels ?? []).find((l) => String(l.name).toLowerCase() === clean.toLowerCase());
  if (found) return found.id;
  const created = await call(token, `${API}/labels`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: clean, labelListVisibility: "labelShow", messageListVisibility: "show" }) }, fetchImpl);
  return created.id;
}

// Opens the message in Gmail (web or app).
export const messageUrl = (id) => `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(id)}`;
