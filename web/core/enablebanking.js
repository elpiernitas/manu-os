// Browser adapter for the server-only Enable Banking AIS bridge.
// No private key, authorization code, IBAN or session ID reaches this module.
export async function bankRequest(cfg, session, action, params = {}, fetchImpl = fetch) {
  const origin = new URL(cfg?.url ?? "").origin;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(origin)) throw new Error("Proyecto Supabase no válido");
  if (!session?.access) throw new Error("Conecta primero Tu nube");
  const allowed = ["status", "start", "balances", "transactions", "disconnect"];
  if (!allowed.includes(action)) throw new Error("Acción bancaria no permitida");
  let response;
  try {
    response = await fetchImpl(origin + "/functions/v1/manu-bank", {
      method: "POST",
      headers: { apikey: cfg.key, authorization: "Bearer " + session.access, "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...params }),
    });
  } catch { throw new Error("No se puede contactar con el servidor de MANU. Sabadell no se ha consultado."); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Function not installed ≠ bank failure. The frontend can be published before the backend.
    const known = {
      401: "Tu sesión de Tu nube ha caducado. Vuelve a iniciar sesión.",
      404: "El servidor bancario de MANU todavía no está publicado en Supabase. No se ha consultado Sabadell.",
      503: "El servidor bancario todavía no está configurado. No se ha consultado Sabadell.",
    };
    throw new Error(known[response.status] ?? String(body?.error ?? "No se pudo completar la solicitud al servidor bancario").slice(0, 180));
  }
  return body;
}
export function safeBankRedirect(url) {
  const u = new URL(url);
  // Only Enable Banking's own consent hosts (tilisy.* is its former brand, still returned by POST /auth).
  if (u.protocol !== "https:" || !["auth.enablebanking.com", "tilisy.enablebanking.com"].includes(u.hostname) || u.username || u.password || u.port) throw new Error("Dirección bancaria inesperada");
  return u.href;
}
