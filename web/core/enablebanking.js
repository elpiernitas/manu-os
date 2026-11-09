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
  } catch { throw new Error("No se puede contactar con el servidor bancario"); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body?.error ?? "Error de conexión bancaria").slice(0, 180));
  return body;
}
export function safeBankRedirect(url) {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.hostname !== "auth.enablebanking.com" || u.username || u.password) throw new Error("Dirección bancaria inesperada");
  return u.href;
}
