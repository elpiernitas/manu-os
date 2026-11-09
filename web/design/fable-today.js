// Fable 5.1 / Hoy: presentation-only view model. NO demo data, API requests or side effects.
// All data is passed explicitly by the existing MANU OS core.
const e = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const int = (v) => Number.isFinite(v) ? String(Math.round(v)) : null;
const badge = (label, variant = "") => `<span class="ft-tag ${variant}" role="status">${e(label)}</span>`;
const localDate = (value) => {
  if (!value || !Number.isFinite(new Date(value).getTime())) return null;
  return new Date(value).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

// The weather model comes from MANU's existing Open-Meteo adapter, never from Fable's sample.
export function fableHoyIntro({ greeting, date, mode, weather, city, next, tasks = 0, reminders = 0 } = {}) {
  const name = e(greeting || "Hola");
  const now = weather?.now;
  const today = weather?.today;
  const temperature = int(now?.temp);
  const min = int(today?.min), max = int(today?.max);
  const w = temperature !== null ? `<button class="ft-weather" type="button" data-act="weather-open" aria-label="Abrir el tiempo completo de ${e(city || "tu ciudad")}">
    <span class="ft-temp">${temperature}<span aria-hidden="true">°</span></span>
    <span class="ft-weather-info"><b>${e(city)}</b><span>${e(now?.text ?? "")}</span>${min !== null && max !== null ? `<small>${min}° – ${max}°</small>` : ""}</span>
    <span class="ft-more" aria-hidden="true">↗</span>
  </button>` : `<div class="ft-weather ft-weather-empty"><span>${e(city || "Tiempo")}</span><span class="ft-weather-placeholder">Sin previsión confirmada</span></div>`;
  const ev = next ? `<button type="button" class="ft-next" data-tab="agenda">
      <span class="ft-overline">Lo siguiente</span><span class="ft-next-body">
      <span class="ft-next-time">${e(next.time || "Hoy")}</span><span class="ft-next-title">${e(next.title)}</span><span class="ft-next-arrow" aria-hidden="true">↗</span></span>
    </button>` : `<div class="ft-next ft-next-empty"><span class="ft-overline">Lo siguiente</span><span class="ft-next-body"><span class="ft-next-title">Sin un próximo evento confirmado.</span><button type="button" class="link small" data-tab="agenda">Abrir Agenda</button></span></div>`;
  return `<header class="ft-intro">
    <div class="ft-kicker"><span>${e(date)}</span>${badge(mode || "Hoy")}</div>
    <h1 class="ft-greeting">${name}, Manu<span class="ft-dot">.</span></h1>
    <p class="ft-subline">Tu día, sin montarte una junta directiva.</p>
    ${w}${ev}
    <div class="ft-briefline" aria-label="Pendientes hoy"><span>${Math.max(0, Math.trunc(tasks))} tarea${tasks === 1 ? "" : "s"} abierta${tasks === 1 ? "" : "s"}</span><span aria-hidden="true">·</span><span>${Math.max(0, Math.trunc(reminders))} recordatorio${reminders === 1 ? "" : "s"}</span></div>
  </header>`;
}

export function fableHoyServices({ cloud = {}, push = {}, bank = {} } = {}) {
  const cloudStatus = !cloud.signedIn ? "Sin conectar" : cloud.conflict ? "Conflicto pendiente" : cloud.error ? "Error al sincronizar" : cloud.dirty ? "Cambios pendientes" : cloud.lastAt ? "Última sincronización: " + localDate(cloud.lastAt) : "Sesión iniciada · sin verificar";
  const cloudKind = cloud.conflict || cloud.error ? "warn" : cloud.dirty ? "pending" : cloud.signedIn && cloud.lastAt ? "ok" : "idle";
  const pushStatus = !push.enabled ? "Desactivados" : !push.here ? "No activados en este dispositivo" : push.error ? "Revisar configuración" : "Activados en este dispositivo";
  const pushKind = push.enabled && push.here && !push.error ? "ok" : push.error ? "warn" : "idle";
  // No affirmative bank status without a server check. Enable Banking provider activation != API session.
  const bankStatus = bank.connected === true ? "Lectura conectada" : bank.available === true ? "Conexión disponible · sin verificar" : "Integración de lectura pendiente";
  const bankKind = bank.connected === true ? "ok" : "idle";
  const item = ({ icon, title, value, tone, attr, desc }) => `<button class="ft-service" type="button" ${attr}><span class="ft-service-icon" aria-hidden="true">${icon}</span>
    <span class="ft-service-copy"><b>${e(title)}</b><small>${e(value)}</small>${desc ? `<small class="ft-service-hint">${e(desc)}</small>` : ""}</span>
    <span class="ft-status-dot" data-status="${tone}" aria-hidden="true"></span></button>`;
  return `<section class="ft-services" aria-label="Conexiones de MANU">
    <div class="ft-section-label">Conexiones <span>Estados de este dispositivo, no promesas</span></div>
    <div class="ft-services-list">
      ${item({ icon: "◉", title: "Tu nube · Supabase", value: cloudStatus, tone: cloudKind, attr: 'data-sub-go="nube"', desc: cloud.signedIn && !cloud.lastAt ? "Comprueba la sincronización en Tú" : "" })}
      ${item({ icon: "↗", title: "Notificaciones", value: pushStatus, tone: pushKind, attr: 'data-sub-go="avisos"', desc: push.enabled && push.here ? "Prueba y gestiona tus avisos" : "" })}
      ${item({ icon: "≡", title: "Banco Sabadell", value: bankStatus, tone: bankKind, attr: 'data-tab="dinero"', desc: bank.connected ? "Solo lectura · sin pagos" : "Consulta el estado desde Dinero" })}
    </div>
  </section>`;
}
