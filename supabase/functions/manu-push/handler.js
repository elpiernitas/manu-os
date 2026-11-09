// What the «manu-push» function does every minute (WEB-99). Pure: the database and the network
// are injected, so the tests run it with fakes. Rules:
// - Only rows that are due (and not older than STALE_MS: a late notice is noise) are sent.
// - Without the text option the notice is generic: «Tienes un recordatorio en MANU».
// - Only to Manu's own subscriptions, only to real push services; dead ones (404/410) are removed.
// - No duplicates: due rows are *claimed* by deleting them first (one atomic DELETE … RETURNING),
//   so two overlapping runs can never send the same notice twice. The server keeps nothing it
//   no longer needs.
import { encrypt, vapidHeader, newVapidKeys, allowedEndpoint } from "./webpush.js";

export const STALE_MS = 6 * 3600 * 1000;
// Transient failures (429, 5xx, network) are retried for that device only, at most MAX_TRIES
// times, after 1, 4 and 16 minutes. A notice that already reached a device is never re-sent to it.
export const MAX_TRIES = 3;
export const retryDelayMs = (attempt) => 60000 * 4 ** (attempt - 1);
const transient = (status) => status === null || status === 429 || status >= 500;
export const GENERIC = "Tienes un recordatorio en MANU";

// Declarative Web Push (Safari 18.4+): shown by iOS itself; the service worker understands it too.
export const payload = (row, site) => JSON.stringify({ web_push: 8030, notification: { title: "MANU", body: row.body || GENERIC, navigate: `${site}#avisos`, tag: row.id } });

export async function runDue({ db, send, now = Date.now(), site, sub = site }) {
  let keys = await db.keys();
  if (!keys) { keys = await newVapidKeys(); await db.saveKeys(keys); }
  const rows = await db.claim(new Date(now).toISOString());
  const out = { sent: 0, stale: 0, dead: 0, skipped: 0, rows: rows.length };
  if (!rows.length) return out;
  const subs = await db.subs([...new Set(rows.map((r) => r.user_id))]);
  out.retried = 0; out.failed = 0;
  for (const row of rows) {
    if (now - Date.parse(row.first_at ?? row.at) > STALE_MS) { out.stale++; continue; }
    const targets = subs.filter((x) => x.user_id === row.user_id && (!row.sub_id || x.id === row.sub_id));
    for (const s of targets) {
      if (!allowedEndpoint(s.endpoint)) { out.skipped++; continue; }
      let status = null;
      try {
        const body = await encrypt(payload(row, site), { p256dh: s.p256dh, auth: s.auth });
        status = await send(s.endpoint, { Authorization: await vapidHeader(s.endpoint, keys, { sub, now }), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "3600", Urgency: "high" }, body);
      } catch { status = null; }
      if (status === 404 || status === 410) { out.dead++; await db.dropSub(s); }
      else if (status >= 200 && status < 300) out.sent++;
      else if (transient(status) && (row.attempts ?? 0) + 1 < MAX_TRIES) {
        const attempts = (row.attempts ?? 0) + 1;
        await db.requeue({ user_id: row.user_id, id: `${row.id.slice(0, 60)}_t${attempts}_${String(s.id).slice(0, 8)}`, at: new Date(now + retryDelayMs(attempts)).toISOString(), body: row.body ?? null, attempts, sub_id: s.id, first_at: row.first_at ?? row.at });
        out.retried++;
      } else out.failed++;
    }
  }
  return out;
}
