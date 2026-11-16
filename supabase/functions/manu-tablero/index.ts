// MANU OS / Tablero de marketing de la empresa, SOLO LECTURA (WEB-116).
// NOT deployed by this PR: Manu deploys it explicitly once the company feed exists.
//
// - Only Manu's own Tu nube session can call it (Supabase Auth of his personal project).
// - The company feed URL and its read-only token live in this project's secrets
//   (RK_TABLERO_URL, RK_TABLERO_TOKEN). They never reach the browser, the repo or the chat.
// - GET only towards the company: this function cannot write to the Tablero.
// - The answer is validated and trimmed (tablero-core.js) before it reaches the browser.
import { sanitizeFeed } from "./tablero-core.js";

const SUPABASE = Deno.env.get("SUPABASE_URL") ?? "";
const PUBLIC = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const FEED = Deno.env.get("RK_TABLERO_URL") ?? "";
const TOKEN = Deno.env.get("RK_TABLERO_TOKEN") ?? "";
const APP_ORIGIN = "https://elpiernitas.github.io";
const cors = { "Access-Control-Allow-Origin": APP_ORIGIN, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Vary": "Origin" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors } });

async function identity(req: Request) {
  const bearer = req.headers.get("authorization") ?? "";
  if (!/^Bearer [^\s]+$/.test(bearer) || !PUBLIC) return null;
  const r = await fetch(SUPABASE + "/auth/v1/user", { headers: { apikey: PUBLIC, Authorization: bearer } });
  if (!r.ok) return null;
  const user = await r.json();
  return /^[0-9a-f-]{36}$/i.test(user?.id ?? "") ? user.id : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);
  if (req.headers.get("origin") && req.headers.get("origin") !== APP_ORIGIN) return reply({ error: "Origen no permitido" }, 403);
  const feedUrl = (() => { try { const u = new URL(FEED); return u.protocol === "https:" && !u.username && !u.password ? u.href : ""; } catch { return ""; } })();
  if (!feedUrl || TOKEN.length < 32) return reply({ error: "El Tablero todavía no está configurado" }, 503);
  if (!(await identity(req))) return reply({ error: "Inicia sesión en Tu nube para leer el Tablero" }, 401);
  let res: Response;
  try {
    res = await fetch(feedUrl, { method: "GET", headers: { Authorization: "Bearer " + TOKEN, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(8000) });
  } catch { return reply({ error: "No he podido contactar con el Tablero" }, 502); }
  if (res.status === 401 || res.status === 403) return reply({ error: "El Tablero ha rechazado el permiso de lectura" }, 502);
  if (!res.ok) return reply({ error: "El Tablero no ha respondido bien" }, 502);
  const text = await res.text();
  if (text.length > 300_000) return reply({ error: "El Tablero ha devuelto demasiados datos" }, 502);
  try { return reply(sanitizeFeed(JSON.parse(text))); }
  catch (err) { return reply({ error: String((err as Error)?.message ?? "Respuesta no válida").slice(0, 160) }, 502); }
});
