// Copia del contrato de web/core/tablero.js (COLUMNS y sanitizeFeed) para el servidor.
// La prueba web/tests/tablero.test.js comprueba que ambas copias dan lo mismo.
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

