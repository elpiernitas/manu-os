import { envelopeProblem } from "./crypto.js";

// More Google services with the same OAuth consent as Calendar:
// Tasks (two-way), Contacts birthdays (read) and a Drive backup in the
// app's private folder (drive.appdata: MANU cannot see the rest of Drive).
// One scope per feature, requested only when that feature is switched on and used.
export const SCOPE = {
  calendar: "https://www.googleapis.com/auth/calendar.events",
  calendarList: "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  tasks: "https://www.googleapis.com/auth/tasks",
  contacts: "https://www.googleapis.com/auth/contacts.readonly",
  drive: "https://www.googleapis.com/auth/drive.appdata",
  gmail: "https://www.googleapis.com/auth/gmail.modify", // WEB-33, Manu's decision
};

// Runs each enabled service with a token for its own scope only. A denied or
// failing service never stops the others. Returns { key: "ok: …" | "error: …" | "off" }.
export async function runServices(services, enabled, tokenFor) {
  const status = {};
  for (const svc of services) {
    if (!enabled[svc.key]) { status[svc.key] = "off"; continue; }
    try {
      const token = await tokenFor(svc.scope);
      status[svc.key] = `ok: ${await svc.run(token)}`;
    } catch (err) {
      status[svc.key] = `error: ${err?.message ?? "fallo"}`;
    }
  }
  return status;
}

const TASKS = "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks";
const PEOPLE = "https://people.googleapis.com/v1/people/me/connections?personFields=names,birthdays,phoneNumbers&pageSize=1000";
const DRIVE = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
export const BACKUP_NAME = "manu-os-vault.json";

async function call(token, url, init = {}, fetchImpl = fetch) {
  const res = await fetchImpl(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  if (res.status === 401) throw Object.assign(new Error("Sesión de Google caducada"), { code: "auth" });
  if (res.status === 403) throw Object.assign(new Error("Falta activar esta API en Google Cloud o dar permiso"), { code: "forbidden" });
  if (!res.ok) throw new Error(`Google respondió ${res.status}`);
  return res.status === 204 ? null : res.json();
}

// ---- Pagination ----
// Follows nextPageToken until exhausted. Stops (complete: false) on a repeated
// token, on too many pages or on any error, so callers never infer deletions
// or closures from a partial listing.
export const MAX_PAGES = 20;
export async function paginate(fetchPage, { maxPages = MAX_PAGES } = {}) {
  const items = [];
  const seen = new Set();
  let token;
  for (let page = 0; page < maxPages; page++) {
    let json;
    try { json = await fetchPage(token); } catch (err) {
      // No page at all: report the error. A later page failing: keep what we have, marked incomplete.
      if (page === 0 || err?.code === "auth") throw err;
      return { items, complete: false };
    }
    items.push(...(json?.items ?? []));
    const next = json?.nextPageToken;
    if (!next) return { items, complete: true };
    if (seen.has(next)) return { items, complete: false };
    seen.add(next);
    token = next;
  }
  return { items, complete: false };
}

// ---- Tasks ----
// `complete` must be true (the whole open list was read) to infer that a
// linked task was closed in Google; otherwise nothing is closed locally.
export function planTaskSync(localItems, remoteTasks, { complete = false } = {}) {
  const remoteIds = new Set(remoteTasks.map((t) => t.id));
  const known = new Set(localItems.filter((i) => i.googleId).map((i) => i.googleId));
  return {
    push: localItems.filter((i) => i.status === "TASK" && !i.done && !i.googleId),
    complete: localItems.filter((i) => i.status === "TASK" && i.done && i.googleId && !i.googleDone),
    // done in Google (no longer in the open list) -> done here
    closedRemotely: complete ? localItems.filter((i) => i.status === "TASK" && !i.done && i.googleId && !remoteIds.has(i.googleId)) : [],
    pull: remoteTasks.filter((t) => !known.has(t.id) && t.title && t.status !== "completed"),
  };
}

// Returns { tasks, complete }.
export async function listOpenTasks(token, fetchImpl) {
  const { items, complete } = await paginate((pageToken) =>
    call(token, `${TASKS}?showCompleted=false&maxResults=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`, {}, fetchImpl));
  return { tasks: items.map((t) => ({ id: t.id, title: String(t.title ?? "").slice(0, 140), status: t.status, due: t.due ?? null })), complete };
}

export const insertTask = (token, title, fetchImpl) =>
  call(token, TASKS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: String(title).slice(0, 1024) }) }, fetchImpl);

export const completeTask = (token, id, fetchImpl) =>
  call(token, `${TASKS}/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) }, fetchImpl);

// ---- Contacts birthdays ----
export function birthdaysFrom(json) {
  const out = [];
  for (const p of json?.connections ?? []) {
    const name = p.names?.[0]?.displayName;
    const b = (p.birthdays ?? []).find((x) => x.date?.month && x.date?.day)?.date;
    if (!name || !b) continue;
    out.push({ googleId: p.resourceName, name: String(name).slice(0, 60), birthday: `${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}` });
  }
  return out;
}

// Every contact, for autocompleting names in Personas (WEB-38). Stays on the device.
export function contactsFrom(json) {
  const out = [];
  for (const p of json?.connections ?? []) {
    const name = p.names?.[0]?.displayName;
    if (!name) continue;
    const b = (p.birthdays ?? []).find((x) => x.date?.month && x.date?.day)?.date;
    const phone = (p.phoneNumbers ?? []).map((x) => String(x.canonicalForm ?? x.value ?? "").replace(/[^\d+]/g, "")).find(Boolean) ?? null;
    out.push({ googleId: p.resourceName, name: String(name).slice(0, 60), birthday: b ? `${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}` : null, phone: phone ? phone.slice(0, 20) : null });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

// Returns { people, complete }. Merging only adds or updates; nothing is ever
// deleted because a contact is missing, so a partial listing is harmless.
export async function contactBirthdays(token, fetchImpl) {
  const { items, complete } = await paginate(async (pageToken) => {
    const json = await call(token, `${PEOPLE}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`, {}, fetchImpl);
    return { items: json?.connections ?? [], nextPageToken: json?.nextPageToken };
  });
  return { people: birthdaysFrom({ connections: items }), contacts: contactsFrom({ connections: items }).slice(0, 3000), total: items.length, complete };
}

export function mergePeople(people, fromGoogle, makeId) {
  const byGoogle = new Map(people.filter((p) => p.googleId).map((p) => [p.googleId, p]));
  const next = people.map((p) => {
    const g = p.googleId && fromGoogle.find((x) => x.googleId === p.googleId);
    return g ? { ...p, name: g.name, birthday: g.birthday } : p;
  });
  let added = 0;
  for (const g of fromGoogle) {
    if (byGoogle.has(g.googleId)) continue;
    next.push({ id: makeId(), name: g.name, birthday: g.birthday, notes: null, lastContact: null, googleId: g.googleId, source: "GOOGLE" });
    added++;
  }
  return { people: next, added };
}

// ---- Drive backup (appDataFolder) ----
export async function findBackup(token, fetchImpl) {
  const q = new URLSearchParams({ spaces: "appDataFolder", q: `name = '${BACKUP_NAME}'`, fields: "files(id,name,modifiedTime)" });
  const json = await call(token, `${DRIVE}?${q}`, {}, fetchImpl);
  return json?.files?.[0] ?? null;
}

// Only encrypted envelopes are ever uploaded (see core/crypto.js).
export async function saveBackup(token, envelope, fetchImpl) {
  const problem = envelopeProblem(envelope);
  if (problem) throw new Error(`Solo se suben copias cifradas válidas (${problem})`);
  const body = JSON.stringify(envelope);
  const existing = await findBackup(token, fetchImpl);
  if (existing) {
    return call(token, `${UPLOAD}/${existing.id}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body }, fetchImpl);
  }
  const boundary = "manuos" + Math.random().toString(36).slice(2);
  const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: BACKUP_NAME, parents: ["appDataFolder"] })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  return call(token, `${UPLOAD}?uploadType=multipart`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: multipart }, fetchImpl);
}

export async function loadBackup(token, fetchImpl) {
  const file = await findBackup(token, fetchImpl);
  if (!file) return null;
  return { file, data: await call(token, `${DRIVE}/${file.id}?alt=media`, {}, fetchImpl) };
}
