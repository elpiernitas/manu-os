// Tu nube (WEB-64): the vault synced between Manu's iPhone and Mac through
// his own free Supabase project. Everything is encrypted on the device with a
// phrase only he knows (core/crypto.js): Supabase stores an unreadable blob.
// Plain REST (Auth + PostgREST), no SDK, so the CSP stays «script-src 'self'».
//
// Table (created once by Manu, see SUPABASE_SQL): one row per user and kind,
// with an integer `rev` so two devices never overwrite each other silently.
// Pure where possible; the network goes through an injectable fetch.

export const SUPABASE_SQL = `create table if not exists public.manu_sync (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('vault')),
  data jsonb not null check (octet_length(data::text) < 8000000),
  rev bigint not null default 1,
  device text,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.manu_sync enable row level security;
revoke all on public.manu_sync from anon;
grant select, insert, update on public.manu_sync to authenticated;
drop policy if exists "solo lo mio" on public.manu_sync;
create policy "solo lo mio" on public.manu_sync for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));`;

// ---------- Configuration ----------
const URL_RE = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/;
const KEY_RE = /^(sb_publishable_[A-Za-z0-9_-]{10,200}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

export function configProblem({ url, key } = {}) {
  const u = String(url ?? "").trim().replace(/\/+$/, "");
  const k = String(key ?? "").trim();
  if (!URL_RE.test(u)) return "La Project URL debe ser como https://xxxxxxxxxxxxxxxxxxxx.supabase.co";
  if (/^sb_secret_/.test(k) || /service_role/.test(k)) return "Esa es la clave SECRETA: no la pongas nunca aquí. Usa la «publishable» o «anon».";
  if (k.startsWith("eyJ")) {
    try { const role = JSON.parse(atob(k.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role; if (role !== "anon") return "Esa clave no es la «anon»: no la pongas aquí."; } catch { return "La clave no es válida."; }
  }
  if (!KEY_RE.test(k)) return "La clave debe empezar por sb_publishable_ (o ser la «anon»).";
  return null;
}
export const cleanConfig = ({ url, key }) => ({ url: String(url).trim().replace(/\/+$/, ""), key: String(key).trim() });

// «…/manu-os/#nube=<url>|<key>»: a link Manu opens once per device so he
// doesn't have to paste the two values. The fragment never reaches a server.
export function parseSyncLink(hash) {
  const m = /^#nube=([^|]+)\|(.+)$/.exec(String(hash ?? ""));
  if (!m) return null;
  let cfg;
  try { cfg = cleanConfig({ url: decodeURIComponent(m[1]), key: decodeURIComponent(m[2]) }); } catch { return null; }
  return configProblem(cfg) ? null : cfg;
}

// ---------- HTTP ----------
const fail = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
async function detail(res) {
  try { const j = await res.json(); return String(j?.msg ?? j?.error_description ?? j?.message ?? j?.error ?? "").slice(0, 200); } catch { return ""; }
}
async function call(fetchImpl, url, init) {
  let res;
  try { res = await fetchImpl(url, init); } catch { throw fail("network", "Sin conexión con tu nube"); }
  return res;
}
const authHeaders = (cfg) => ({ apikey: cfg.key, "Content-Type": "application/json" });

// ---------- Auth (email + password) ----------
const session = (j, now) => ({ access: j.access_token, refresh: j.refresh_token, exp: now + (Number(j.expires_in) || 3600) * 1000, userId: j.user?.id ?? null, email: j.user?.email ?? null });

export async function signUp(cfg, { email, password }, fetchImpl = fetch) {
  if (String(password ?? "").length < 8) throw fail("weak", "La contraseña debe tener al menos 8 caracteres.");
  const res = await call(fetchImpl, `${cfg.url}/auth/v1/signup`, { method: "POST", headers: authHeaders(cfg), body: JSON.stringify({ email, password }) });
  if (!res.ok) { const d = await detail(res); throw fail(res.status === 422 || /registered|exists/i.test(d) ? "exists" : "auth", d || `Error ${res.status}`, { status: res.status }); }
  const j = await res.json();
  return j.access_token ? { confirm: false, session: session(j, Date.now()) } : { confirm: true };
}

export async function signIn(cfg, { email, password }, fetchImpl = fetch, now = Date.now()) {
  const res = await call(fetchImpl, `${cfg.url}/auth/v1/token?grant_type=password`, { method: "POST", headers: authHeaders(cfg), body: JSON.stringify({ email, password }) });
  if (!res.ok) {
    const d = await detail(res);
    if (/confirm/i.test(d)) throw fail("unconfirmed", "Aún no has confirmado tu correo: abre el enlace que te ha mandado Supabase.");
    throw fail("login", res.status === 400 ? "Correo o contraseña incorrectos." : d || `Error ${res.status}`, { status: res.status });
  }
  return session(await res.json(), now);
}

export async function refreshSession(cfg, s, fetchImpl = fetch, now = Date.now()) {
  const res = await call(fetchImpl, `${cfg.url}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: authHeaders(cfg), body: JSON.stringify({ refresh_token: s.refresh }) });
  if (!res.ok) throw fail("expired", "Tu sesión ha caducado: vuelve a entrar.", { status: res.status });
  return session(await res.json(), now);
}
export const needsRefresh = (s, now = Date.now()) => !s?.access || s.exp - now < 60000;

// ---------- Rows ----------
const restHeaders = (cfg, s, extra = {}) => ({ apikey: cfg.key, Authorization: `Bearer ${s.access}`, "Content-Type": "application/json", ...extra });
async function restError(res) {
  const d = await detail(res);
  if (res.status === 401) return fail("expired", "Tu sesión ha caducado: vuelve a entrar.", { status: 401 });
  if (res.status === 404 || /manu_sync/.test(d)) return fail("table", "Falta crear la tabla en Supabase (paso 2 de la guía).", { status: res.status });
  return fail("http", `Tu nube respondió ${res.status}${d ? `: ${d}` : ""}`, { status: res.status });
}

// Only the revision (cheap): is there something newer?
export async function remoteHead(cfg, s, fetchImpl = fetch) {
  const res = await call(fetchImpl, `${cfg.url}/rest/v1/manu_sync?kind=eq.vault&select=rev,device,updated_at`, { headers: restHeaders(cfg, s) });
  if (!res.ok) throw await restError(res);
  const rows = await res.json();
  return rows[0] ?? null;
}
export async function remoteGet(cfg, s, fetchImpl = fetch) {
  const res = await call(fetchImpl, `${cfg.url}/rest/v1/manu_sync?kind=eq.vault&select=rev,device,updated_at,data`, { headers: restHeaders(cfg, s) });
  if (!res.ok) throw await restError(res);
  const rows = await res.json();
  return rows[0] ?? null;
}

// Writes only if the row is still at `baseRev` (null: it must not exist yet).
// Returns the new revision, or throws code «conflict» if another device won.
export async function remotePut(cfg, s, { data, baseRev, device }, fetchImpl = fetch) {
  const prefer = { Prefer: "return=representation" };
  if (baseRev === null || baseRev === undefined) {
    const res = await call(fetchImpl, `${cfg.url}/rest/v1/manu_sync?select=rev`, { method: "POST", headers: restHeaders(cfg, s, prefer), body: JSON.stringify({ kind: "vault", data, rev: 1, device }) });
    if (res.status === 409) throw fail("conflict", "Otro dispositivo ya ha subido datos.");
    if (!res.ok) throw await restError(res);
    return (await res.json())[0]?.rev ?? 1;
  }
  const res = await call(fetchImpl, `${cfg.url}/rest/v1/manu_sync?kind=eq.vault&rev=eq.${Number(baseRev)}&select=rev`, { method: "PATCH", headers: restHeaders(cfg, s, prefer), body: JSON.stringify({ data, rev: Number(baseRev) + 1, device, updated_at: new Date().toISOString() }) });
  if (!res.ok) throw await restError(res);
  const rows = await res.json();
  if (!rows.length) throw fail("conflict", "Otro dispositivo ha cambiado los datos mientras tanto.");
  return rows[0].rev;
}

// ---------- What to do ----------
/**
 * @param {object} x
 * @param {number|null} x.lastRev   revision this device last saw (null: never synced)
 * @param {boolean} x.dirty         local changes not uploaded yet
 * @param {object|null} x.remote    remoteHead(): { rev } or null
 * @param {boolean} x.localEmpty    this device has nothing worth keeping
 * @returns {"none"|"push"|"pull"|"conflict"}
 */
export function decide({ lastRev = null, dirty = false, remote = null, localEmpty = false }) {
  if (!remote) return localEmpty ? "none" : "push";
  if (lastRev === null) return localEmpty ? "pull" : "conflict";
  if (remote.rev === lastRev) return dirty ? "push" : "none";
  if (remote.rev > lastRev) return dirty ? "conflict" : "pull";
  return "conflict"; // remote went back (restored): ask
}

// A fresh vault with nothing typed yet (new device).
export function isEmptyVault(v) {
  if (!v) return true;
  const lists = ["inbox", "spending", "income", "projects", "reminders", "habits", "people", "meals", "health", "moods", "places", "captures"];
  return lists.every((k) => !(v[k] ?? []).length) && !v.profile?.text;
}

export function syncErrorText(err) {
  switch (err?.code) {
    case "network": return "Sin conexión: lo subo cuando vuelva la red.";
    case "expired": return "Tu sesión en la nube ha caducado: entra otra vez en Tú → Tu nube.";
    case "table": return "Falta crear la tabla en Supabase: mira el paso 2 en Tú → Tu nube.";
    case "phrase": return "La frase de cifrado no coincide con la de tus datos en la nube.";
    case "conflict": return "Hay cambios en este dispositivo y en el otro: elige con cuál te quedas en Tú → Tu nube.";
    default: return `No he podido sincronizar: ${String(err?.message ?? "error").slice(0, 160)}`;
  }
}
