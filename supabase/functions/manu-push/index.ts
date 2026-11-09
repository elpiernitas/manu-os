// Supabase Edge Function «manu-push» (WEB-99). Called every minute by pg_cron (see the migration
// 20261109120000_push.sql) with the header «x-manu-cron». It reads due notices with the
// project's own service key (injected by Supabase, never in this repository) and sends them.
// Deployed with --no-verify-jwt: the cron sends no user JWT; this function checks its own token.
import { runDue } from "./handler.js";

const URL_ = Deno.env.get("SUPABASE_URL") ?? "";
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? (() => { try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default ?? ""; } catch { return ""; } })();
const SITE = "https://elpiernitas.github.io/manu-os/";
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rest = (path: string, init: RequestInit = {}) => fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...h, ...(init.headers ?? {}) } });
const json = async (r: Response) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.status === 204 ? null : r.json(); };

const db = {
  keys: async () => { const [k] = await json(await rest("manu_push_keys?id=eq.1&select=public_key,private_jwk")); return k ? { publicKey: k.public_key, privateJwk: k.private_jwk } : null; },
  saveKeys: async (k: { publicKey: string; privateJwk: unknown }) => json(await rest("manu_push_keys", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ id: 1, public_key: k.publicKey, private_jwk: k.privateJwk }) })),
  // Claim: delete the due rows and get them back in the same statement (no double sending).
  claim: async (nowIso: string) => json(await rest(`manu_push_queue?at=lte.${encodeURIComponent(nowIso)}&select=user_id,id,at,body`, { method: "DELETE", headers: { Prefer: "return=representation" } })),
  subs: async (users: string[]) => json(await rest(`manu_push_subs?user_id=in.(${users.join(",")})&select=id,user_id,endpoint,p256dh,auth`)),
  dropSub: async (s: { id: string }) => json(await rest(`manu_push_subs?id=eq.${s.id}`, { method: "DELETE" })),
};

Deno.serve(async (req) => {
  const token = req.headers.get("x-manu-cron") ?? "";
  const [row] = await json(await rest("manu_push_cron?id=eq.1&select=token"));
  if (!row || token.length < 40 || token !== row.token) return new Response("no", { status: 401 });
  const send = async (endpoint: string, headers: Record<string, string>, body: Uint8Array) => (await fetch(endpoint, { method: "POST", headers, body })).status;
  try {
    const out = await runDue({ db, send, site: SITE });
    return Response.json(out); // counts only, never contents
  } catch (e) {
    return new Response(String(e).slice(0, 200), { status: 500 });
  }
});
