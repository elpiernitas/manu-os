// Avisos con MANU cerrada (WEB-99), lado de la app.
//
// - La cola que sube a Supabase es lo mínimo: un id opaco y la hora. El texto solo va si Manu
//   activa «Mostrar el texto» (y entonces, recortado a 120 caracteres).
// - Solo recordatorios pendientes de las próximas 48 h, como mucho 50.
// - Sin duplicados: un id por recordatorio y hora; la cola se reemplaza, no se acumula.
// - Todo se apaga desde MANU: se borra la suscripción de este dispositivo y la cola.
// Los Recordatorios de iOS («Al iPhone» / atajo) siguen como alternativa: esto no los sustituye.

export const HORIZON_MS = 48 * 3600 * 1000;
export const MAX_ROWS = 50;

const b64uDec = (s) => { const t = String(s).replace(/-/g, "+").replace(/_/g, "/"); const p = atob(t + "===".slice((t.length + 3) % 4)); return Uint8Array.from(p, (c) => c.charCodeAt(0)); };
const b64uEnc = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// An opaque id: the reminder's id is random (uid), never its text.
export const rowId = (r) => `r_${String(r.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}_${Math.floor(Date.parse(r.at) / 60000)}`;

/** The rows to upload. Pure. */
export function pushQueue(reminders = [], { now = new Date(), showText = false } = {}) {
  const t = now.getTime();
  const seen = new Set();
  return reminders
    .filter((r) => r && !r.done && r.id && Number.isFinite(Date.parse(r.at)) && Date.parse(r.at) > t && Date.parse(r.at) <= t + HORIZON_MS)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((r) => ({ id: rowId(r), at: new Date(Date.parse(r.at)).toISOString(), body: showText ? String(r.text ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || null : null }))
    .filter((x) => (seen.has(x.id) ? false : seen.add(x.id)))
    .slice(0, MAX_ROWS);
}
export const queueKey = (rows) => JSON.stringify(rows.map((r) => [r.id, r.at, r.body]));

/** What this browser allows. iOS: only from the home-screen icon, 16.4+. */
export function pushSupport(env = globalThis) {
  const nav = env.navigator ?? {};
  if (!nav.serviceWorker || !("PushManager" in env)) return { ok: false, why: env.matchMedia?.("(display-mode: standalone)")?.matches || nav.standalone ? "Este dispositivo no admite avisos push." : "Abre MANU desde el icono de la pantalla de inicio (iOS 16.4 o posterior)." };
  if (!("Notification" in env)) return { ok: false, why: "Este navegador no tiene avisos." };
  return { ok: true, permission: env.Notification.permission };
}

/** Subscribes this device. Asks for the notification permission first (must follow a tap). */
export async function subscribe(publicKey, env = globalThis) {
  if (env.Notification.permission === "default") await env.Notification.requestPermission();
  if (env.Notification.permission !== "granted") throw new Error("Sin permiso de avisos. Actívalos en Ajustes → Notificaciones → MANU.");
  const reg = await env.navigator.serviceWorker.ready;
  const old = await reg.pushManager.getSubscription();
  // A subscription made with another server key cannot be reused.
  if (old && old.options?.applicationServerKey && b64uEnc(old.options.applicationServerKey) !== publicKey) await old.unsubscribe();
  const sub = (old && (!old.options?.applicationServerKey || b64uEnc(old.options.applicationServerKey) === publicKey)) ? old : await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uDec(publicKey) });
  const j = sub.toJSON();
  if (!j?.endpoint || !j.keys?.p256dh || !j.keys?.auth) throw new Error("La suscripción no es válida.");
  return { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth };
}

export async function unsubscribe(env = globalThis) {
  try { const reg = await env.navigator.serviceWorker.ready; const s = await reg.pushManager.getSubscription(); if (s) { const endpoint = s.endpoint; await s.unsubscribe(); return endpoint; } } catch {}
  return null;
}

// ---------- Supabase REST (same session as Tu nube) ----------
const H = (cfg, s, extra = {}) => ({ apikey: cfg.key, Authorization: `Bearer ${s.access}`, "Content-Type": "application/json", ...extra });
const err = async (res, what) => { let d = ""; try { d = (await res.text()).slice(0, 160); } catch {} return Object.assign(new Error(`${what}: ${res.status}${d ? ` ${d}` : ""}`), { status: res.status, missing: res.status === 404 || /PGRST20[0-9]|does not exist|Could not find/.test(d) }); };

/** The server's public key, or null if the server is installed but has not created it yet. Throws {missing} if not installed. */
export async function serverKey(cfg, s, fetchImpl = fetch) {
  const res = await fetchImpl(`${cfg.url}/rest/v1/rpc/manu_push_public_key`, { method: "POST", headers: H(cfg, s), body: "{}" });
  if (!res.ok) throw await err(res, "Avisos push");
  const k = await res.json();
  return typeof k === "string" && k.length > 80 ? k : null;
}
export async function saveSub(cfg, s, sub, device, fetchImpl = fetch) {
  const res = await fetchImpl(`${cfg.url}/rest/v1/manu_push_subs?on_conflict=user_id,endpoint`, { method: "POST", headers: H(cfg, s, { Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify({ ...sub, device }) });
  if (!res.ok) throw await err(res, "Guardar la suscripción");
}
export async function dropSub(cfg, s, endpoint, fetchImpl = fetch) {
  const res = await fetchImpl(`${cfg.url}/rest/v1/manu_push_subs?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "DELETE", headers: H(cfg, s) });
  if (!res.ok) throw await err(res, "Quitar la suscripción");
}
/** Replaces the whole queue: upsert the current rows, then delete the rest (no duplicates). */
export async function replaceQueue(cfg, s, rows, fetchImpl = fetch) {
  if (rows.length) {
    const res = await fetchImpl(`${cfg.url}/rest/v1/manu_push_queue?on_conflict=user_id,id`, { method: "POST", headers: H(cfg, s, { Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify(rows) });
    if (!res.ok) throw await err(res, "Subir los avisos");
  }
  const keep = rows.map((r) => r.id).join(",");
  const res = await fetchImpl(`${cfg.url}/rest/v1/manu_push_queue?${keep ? `id=not.in.(${keep})` : "id=not.is.null"}`, { method: "DELETE", headers: H(cfg, s) });
  if (!res.ok) throw await err(res, "Limpiar los avisos");
}
/** «Desactivar todo»: every subscription and every queued notice of Manu's account. */
export async function dropAll(cfg, s, fetchImpl = fetch) {
  for (const t of ["manu_push_queue", "manu_push_subs"]) {
    const res = await fetchImpl(`${cfg.url}/rest/v1/${t}?user_id=not.is.null`, { method: "DELETE", headers: H(cfg, s) });
    if (!res.ok && res.status !== 404) throw await err(res, "Desactivar");
  }
}

/**
 * «Comprobar seguridad» from Manu's device: what someone with only the public key (anon) can
 * see, and that even his own session cannot read the server's private keys. Read-only.
 */
export async function securityCheck(cfg, s, fetchImpl = fetch) {
  const anon = { apikey: cfg.key };
  const look = async (path, headers) => { const r = await fetchImpl(`${cfg.url}/rest/v1/${path}`, { headers }); if (!r.ok) return { blocked: true, status: r.status }; const j = await r.json(); return { blocked: Array.isArray(j) && j.length === 0, rows: Array.isArray(j) ? j.length : null, status: r.status }; };
  const checks = [
    ["Tu nube sin sesión", await look("manu_sync?select=rev&limit=1", anon)],
    ["Suscripciones sin sesión", await look("manu_push_subs?select=id&limit=1", anon)],
    ["Cola sin sesión", await look("manu_push_queue?select=id&limit=1", anon)],
    ["Claves privadas sin sesión", await look("manu_push_keys?select=id&limit=1", anon)],
    ["Claves privadas con tu sesión", await look("manu_push_keys?select=id&limit=1", H(cfg, s))],
    ["Token del servidor con tu sesión", await look("manu_push_cron?select=id&limit=1", H(cfg, s))],
  ];
  return checks.map(([label, r]) => ({ label, ok: r.blocked, status: r.status }));
}
