// Tablero de marketing de la empresa, solo lectura (WEB-116).
//
// Camino: MANU → función propia `manu-tablero` (Supabase de Manu, con su sesión de Tu nube) →
// feed de solo lectura de la app de la empresa (token en los secretos del servidor de Manu, nunca
// en el navegador ni en el repositorio). La dirección de la empresa tampoco está en el repositorio.
//
// Lo que llega se valida y se recorta aquí (y otra vez en el servidor, `tablero-core.js` es copia):
// solo título, columna, fecha límite, cuándo cambió y quién lo pidió. Nada de descripciones,
// comentarios, teléfonos ni correos. Se guarda solo en este dispositivo (no en el vault, ni en
// Tu nube, ni en las copias) y nunca se manda a una IA. MANU no escribe nunca en el Tablero.
//
// Contrato v1 del feed:
// { version: 1, generatedAt: ISO, openUrl?: "https://…", cards: [{ id, title, column, due?: "YYYY-MM-DD",
//   updatedAt?: ISO, requestedBy?: "comercial"|"propio", estimateMin?: int }] }
export const COLUMNS = {
  EN_MENTE: "En mente",
  POR_HACER: "Por hacer",
  HACIENDO: "Haciendo",
  ESPERANDO_OK: "Esperando OK",
  ESPERANDO_COMERCIAL: "Esperando al comercial",
  HECHO: "Hecho",
};
export const ACTIVE = ["HACIENDO", "POR_HACER", "ESPERANDO_OK", "ESPERANDO_COMERCIAL"];
const LIMITS = { cards: 200, title: 140, id: 64 };
const DAY = 86400000;

// Lo que se parezca a un teléfono o a un correo sale de los títulos, por si se cuela.
const scrub = (s) => String(s ?? "")
  .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, " ")
  .replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, "[correo]")
  .replace(/\+?\d(?:[\s.-]?\d){8,}/g, "[teléfono]")
  .replace(/\s+/g, " ").trim();
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? "")) && !Number.isNaN(Date.parse(`${s}T12:00:00`));
const isIso = (s) => typeof s === "string" && s.length <= 40 && !Number.isNaN(Date.parse(s));

/** Valida y limpia el feed. Lanza un error con un mensaje para Manu si no cumple el contrato. */
export function sanitizeFeed(feed) {
  if (!feed || typeof feed !== "object" || feed.version !== 1 || !Array.isArray(feed.cards)) throw new Error("El Tablero ha respondido algo que no entiendo (contrato v1).");
  let openUrl = null;
  try { const u = new URL(String(feed.openUrl ?? "")); if (u.protocol === "https:" && !u.username && !u.password) openUrl = u.href.slice(0, 300); } catch { openUrl = null; }
  const cards = [];
  const seen = new Set();
  for (const c of feed.cards.slice(0, LIMITS.cards)) {
    if (!c || typeof c !== "object" || !COLUMNS[c.column]) continue;
    const id = String(c.id ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, LIMITS.id);
    const title = scrub(c.title).slice(0, LIMITS.title);
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    cards.push({
      id, title, column: c.column,
      ...(isDay(c.due) ? { due: c.due } : {}),
      ...(isIso(c.updatedAt) ? { updatedAt: new Date(c.updatedAt).toISOString() } : {}),
      ...(c.requestedBy === "comercial" || c.requestedBy === "propio" ? { requestedBy: c.requestedBy } : {}),
      ...(Number.isInteger(c.estimateMin) && c.estimateMin > 0 && c.estimateMin <= 600 ? { estimateMin: c.estimateMin } : {}),
    });
  }
  return { version: 1, generatedAt: isIso(feed.generatedAt) ? new Date(feed.generatedAt).toISOString() : null, openUrl, cards };
}

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Resumen para Hoy: lo vencido, lo de hoy, lo que tienes entre manos y lo que espera a otros. */
export function boardSummary(board, now = new Date()) {
  const cards = board?.cards ?? [];
  const today = dayKey(now), tomorrow = dayKey(new Date(now.getTime() + DAY));
  const active = cards.filter((c) => ACTIVE.includes(c.column));
  const overdue = active.filter((c) => c.due && c.due < today && !c.column.startsWith("ESPERANDO"));
  const dueToday = active.filter((c) => c.due === today && !c.column.startsWith("ESPERANDO"));
  const dueTomorrow = active.filter((c) => c.due === tomorrow && !c.column.startsWith("ESPERANDO"));
  const doing = active.filter((c) => c.column === "HACIENDO");
  const todo = active.filter((c) => c.column === "POR_HACER").sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  const waiting = { ok: active.filter((c) => c.column === "ESPERANDO_OK").length, comercial: active.filter((c) => c.column === "ESPERANDO_COMERCIAL").length };
  const minutes = active.filter((c) => c.column === "HACIENDO" || c.column === "POR_HACER").reduce((t, c) => t + (c.estimateMin ?? 0), 0);
  const doneWeek = cards.filter((c) => c.column === "HECHO" && c.updatedAt && now.getTime() - Date.parse(c.updatedAt) < 7 * DAY).length;
  // Lo siguiente: lo vencido, lo de hoy, lo que tienes empezado y lo primero por hacer.
  const next = overdue[0] ?? dueToday[0] ?? doing[0] ?? todo[0] ?? null;
  return { overdue, dueToday, dueTomorrow, doing, todo, waiting, minutes, doneWeek, next, count: active.length };
}

/** Filas para el centro de control de Hoy (mismo formato que core/control.js). */
export function boardItems(board, now = new Date(), { readAt = null } = {}) {
  const s = boardSummary(board, now);
  const src = `Tablero RK${readAt ? ` · leído ${readAt}` : ""}`;
  const go = { sub: "tablero" };
  const out = [];
  for (const c of s.overdue.slice(0, 3)) out.push({ level: "URGENT", icon: "📋", title: c.title, detail: `Vencía el ${new Date(`${c.due}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · ${COLUMNS[c.column]}`, source: src, why: "Fecha límite pasada en el Tablero", go, sort: now.getTime() - 1 });
  for (const c of s.dueToday.slice(0, 3)) out.push({ level: "IMPORTANT", icon: "📋", title: c.title, detail: `Vence hoy · ${COLUMNS[c.column]}`, source: src, why: "Su fecha límite en el Tablero es hoy", go, sort: now.getTime() + 1 });
  const shown = new Set(out.map((x) => x.title));
  for (const c of s.doing.filter((x) => !shown.has(x.title)).slice(0, 3)) out.push({ level: "IMPORTANT", icon: "📋", title: c.title, detail: `Haciendo${c.due ? ` · límite ${c.due.slice(8)}/${c.due.slice(5, 7)}` : ""}`, source: src, why: "La tienes empezada en el Tablero", go, sort: now.getTime() + 2 });
  if (s.waiting.ok || s.waiting.comercial) out.push({ level: "INFO", icon: "⏳", title: `Esperando: ${[s.waiting.ok ? `${s.waiting.ok} el OK` : "", s.waiting.comercial ? `${s.waiting.comercial} al comercial` : ""].filter(Boolean).join(" y ")}`, detail: "No dependen de ti ahora", source: src, why: "Columnas de espera del Tablero", go, sort: now.getTime() + 3 });
  if (s.minutes) out.push({ level: "INFO", icon: "⏱️", title: `Carga estimada: ${Math.round(s.minutes / 6) / 10} h`, detail: "Por hacer y haciendo, con estimación", source: src, why: "Suma de las estimaciones del Tablero", go, sort: now.getTime() + 4 });
  return out;
}

/** Cuándo se leyó, en palabras: «a las 09:41» o «el 15 nov». */
export function readLabel(iso, now = new Date()) {
  if (!iso) return null;
  const d = new Date(iso);
  return dayKey(d) === dayKey(now) ? `a las ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : `el ${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
}

// ---------- Cliente: pide el Tablero a la función propia de Manu ----------
export async function tableroRequest(cfg, session, fetchImpl = fetch) {
  const origin = new URL(cfg?.url ?? "").origin;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(origin)) throw Object.assign(new Error("Conecta primero Tu nube"), { code: "setup" });
  if (!session?.access) throw Object.assign(new Error("Inicia sesión en Tu nube para leer el Tablero"), { code: "setup" });
  let response;
  try {
    response = await fetchImpl(origin + "/functions/v1/manu-tablero", { method: "POST", headers: { apikey: cfg.key, authorization: "Bearer " + session.access, "Content-Type": "application/json" }, body: JSON.stringify({ action: "read" }) });
  } catch { throw Object.assign(new Error("Sin conexión: enseño la última copia que tengo"), { code: "network" }); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const known = {
      401: ["Tu sesión de Tu nube ha caducado. Vuelve a iniciar sesión.", "setup"],
      404: ["Pendiente: la conexión con el Tablero todavía no está publicada.", "pending"],
      503: ["Pendiente: falta configurar el permiso de lectura del Tablero.", "pending"],
    };
    const [msg, code] = known[response.status] ?? [String(body?.error ?? "El Tablero no ha respondido").slice(0, 160), "error"];
    throw Object.assign(new Error(msg), { code });
  }
  return sanitizeFeed(body);
}
