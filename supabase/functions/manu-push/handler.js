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
  for (const row of rows) {
    if (now - Date.parse(row.at) > STALE_MS) { out.stale++; continue; }
    for (const s of subs.filter((x) => x.user_id === row.user_id)) {
      if (!allowedEndpoint(s.endpoint)) { out.skipped++; continue; }
      const body = await encrypt(payload(row, site), { p256dh: s.p256dh, auth: s.auth });
      const status = await send(s.endpoint, { Authorization: await vapidHeader(s.endpoint, keys, { sub, now }), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "3600", Urgency: "high" }, body);
      if (status === 404 || status === 410) { out.dead++; await db.dropSub(s); } else if (status >= 200 && status < 300) out.sent++;
    }
  }
  return out;
}
