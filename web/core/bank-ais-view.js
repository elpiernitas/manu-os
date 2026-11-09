// MANU OS / Dinero: read-only bank card. Data arrives only after user action and is not persisted.
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const btn = (id, label, primary = false) => `<button class="btn ${primary ? "" : "ghost"}" type="button" data-act="${id}">${label}</button>`;
export function bankAisCard(state, online) {
  const s = state ?? {};
  const busy = s.busy === true;
  let body = "";
  if (!online) body = '<p class="muted small">Para conectar el banco, entra primero en Tú → Tu nube. Ninguna clave del banco se guarda en MANU.</p>';
  else if (busy) body = '<p class="muted small">Consultando tu banco…</p>';
  else if (!s.checked) body = `<p class="muted small">Estamos preparando la conexión bancaria de solo lectura. Primero comprueba si el servidor está disponible; no se accede a tus cuentas automáticamente.</p>${btn("bank-ais-status", "Comprobar servidor", true)}`;
  else if (!s.connected && s.server && !s.server.ready) {
    const why = s.server.reachable === false ? "el servidor no ha podido identificarse ante Enable Banking (revisa el ID de la aplicación y su clave en los secretos de Supabase)"
      : !s.server.active ? "la aplicación de Enable Banking no está activa" : !s.server.production ? "la aplicación no está en producción"
      : !s.server.ais ? "la aplicación no tiene acceso a cuentas (AIS)" : "la URL de vuelta del servidor no está registrada en Enable Banking";
    body = `<p class="muted small">Todavía no se puede conectar: ${esc(why)}. No se ha accedido a ninguna cuenta.</p>${btn("bank-ais-status", "Volver a comprobar")}`;
  }
  else if (!s.connected) body = `<p class="muted small">Servidor comprobado${s.server?.ready ? " (aplicación activa, en producción y con la URL de vuelta registrada)" : ""}. Todavía no hay una sesión de lectura activa. Conectar te llevará al consentimiento oficial del banco.</p>${btn("bank-ais-start", "Conectar Sabadell", true)} ${btn("bank-ais-status", "Actualizar estado")}`;
  else {
    const accounts = (s.accounts ?? []).map((a) => `<option value="${Number(a.index)}"${a.index === s.index ? " selected" : ""}>${esc(a.label || "Cuenta")} (${esc(a.currency || "EUR")})</option>`).join("");
    const balances = (s.balances ?? []).map((b) => `<div class="row"><div class="grow">${esc(b.type || "Saldo")}</div><b class="num">${esc(b.amount)} ${esc(b.currency)}</b></div>`).join("");
    const transactions = (s.transactions ?? []).slice(0, 30).map((t) => `<div class="row"><div class="grow"><div>${esc(t.description || "Movimiento")}</div><div class="muted small">${esc(t.date)}</div></div><b class="num">${t.direction === "credit" ? "+" : t.direction === "debit" ? "−" : ""}${esc(t.amount)} ${esc(t.currency)}</b></div>`).join("");
    body = `<p class="muted small">Acceso de solo lectura. Consentimiento hasta ${esc(s.validUntil || "fecha no indicada")}. Los movimientos no se incorporan a tus gastos sin preguntarte.</p>
      <label for="bankAisAccount" class="muted small">Cuenta</label><select id="bankAisAccount">${accounts}</select>
      <div class="btns">${btn("bank-ais-balances", "Ver saldo", true)}${btn("bank-ais-movements", "Últimos movimientos")}${btn("bank-ais-disconnect", "Desconectar")}</div>
      ${balances ? `<div class="stack">${balances}</div>` : ""}
      ${transactions ? `<div class="stack">${transactions}</div>` : ""}
      ${s.continuation ? '<p class="muted small">Hay más movimientos disponibles; esta vista muestra la primera página.</p>' : ""}`;
  }
  return `<section class="card" id="bankAisCard"><h2>Banco Sabadell · Solo lectura</h2>${body}${s.error ? `<p class="muted small" role="alert">${esc(s.error)}</p>` : ""}</section>`;
}
