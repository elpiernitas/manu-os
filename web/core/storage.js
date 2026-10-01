// Local-first storage behind a tiny adapter (AGENTS.md: keep adapter interfaces).
// Everything stays on the device; nothing is sent anywhere.
export const SCHEMA_VERSION = 1;

const OPTIONAL_LISTS = ["reminders", "habits", "people", "meals", "health", "moods", "income", "projects", "places", "captures", "clock"];

export function emptyVault() {
  return { schema: SCHEMA_VERSION, inbox: [], spending: [], chat: [], settings: {}, income: [], projects: [], reminders: [], habits: [], people: [], meals: [], health: [], moods: [], places: [], captures: [], clock: [] };
}

// Validates a vault read from storage or from a backup file.
// Unknown or broken data never crashes the app: it is rejected with a reason.
export function validateVault(data) {
  if (!data || typeof data !== "object") return { ok: false, reason: "No es una copia de MANU OS." };
  if (data.schema !== SCHEMA_VERSION) return { ok: false, reason: `Versión de copia no compatible (${data.schema}).` };
  for (const key of ["inbox", "spending", "chat"]) {
    if (!Array.isArray(data[key])) return { ok: false, reason: `Falta la sección «${key}».` };
  }
  for (const key of OPTIONAL_LISTS) {
    if (data[key] !== undefined && !Array.isArray(data[key])) return { ok: false, reason: `La sección «${key}» no es válida.` };
  }
  const ids = new Set();
  const withIds = [...data.inbox, ...data.spending, ...["reminders", "habits", "people", "meals", "income", "projects"].flatMap((k) => data[k] ?? [])];
  for (const item of withIds) {
    if (!item || typeof item.id !== "string") return { ok: false, reason: "Hay un elemento sin identificador." };
    if (ids.has(item.id)) return { ok: false, reason: `Identificador repetido: ${item.id}.` };
    ids.add(item.id);
  }
  if (data.calendar !== undefined && data.calendar !== null && (typeof data.calendar.days !== "object" || Array.isArray(data.calendar.days))) return { ok: false, reason: "El calendario guardado no es válido." };
  for (const key of ["agenda", "agendaTomorrow"]) {
    const a = data[key];
    if (a !== undefined && a !== null && (typeof a.day !== "string" || !Array.isArray(a.events))) return { ok: false, reason: "La agenda guardada no es válida." };
  }
  if (data.agenda !== undefined && data.agenda !== null) {
    if (typeof data.agenda.day !== "string" || !Array.isArray(data.agenda.events)) return { ok: false, reason: "La agenda guardada no es válida." };
  }
  for (const entry of data.spending) {
    if (!Number.isInteger(entry.cents) || entry.cents <= 0) return { ok: false, reason: "Hay un gasto con un importe no válido." };
  }
  for (const entry of data.income ?? []) {
    if (!Number.isInteger(entry.cents) || entry.cents <= 0 || typeof entry.at !== "string") return { ok: false, reason: "Hay un ingreso con un importe no válido." };
  }
  const vault = { ...emptyVault(), ...data, settings: data.settings ?? {} };
  for (const key of OPTIONAL_LISTS) vault[key] = data[key] ?? [];
  // WEB-46: an old or hand-edited copy may lack a project's lists; one bad
  // project must not break the whole Proyectos tab.
  vault.projects = vault.projects.filter((p) => p && typeof p.id === "string").map((p) => ({ ...p, name: String(p.name ?? "Proyecto"), emoji: p.emoji ?? "📁", sources: Array.isArray(p.sources) ? p.sources : [], chat: Array.isArray(p.chat) ? p.chat : [] }));
  vault.captures = vault.captures.filter((c) => c && typeof c.id === "string" && typeof c.status === "string");
  // WEB-74: one record per day; a broken one is dropped, never the whole vault.
  vault.clock = vault.clock.filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.day) && Array.isArray(d.events)).map((d) => ({ ...d, events: d.events.filter((e) => e && ["in", "pause", "back", "out"].includes(e.t) && typeof e.at === "string") }));
  return { ok: true, vault };
}

export class LocalStore {
  constructor(backend, key = "manuos.vault") {
    this.backend = backend;
    this.key = key;
  }

  load() {
    let raw = null;
    try { raw = this.backend.getItem(this.key); } catch { return { vault: emptyVault(), warning: "No se puede leer el almacenamiento." }; }
    if (!raw) return { vault: emptyVault(), warning: null };
    try {
      const result = validateVault(JSON.parse(raw));
      if (result.ok) return { vault: result.vault, warning: null };
      return this.quarantine(raw, result.reason);
    } catch {
      return this.quarantine(raw, "Los datos guardados estaban dañados.");
    }
  }

  // Unreadable data is kept aside, never overwritten by the next save.
  quarantine(raw, reason) {
    try { this.backend.setItem(`${this.key}.damaged`, raw); } catch {}
    return { vault: emptyVault(), warning: `${reason} Los he apartado sin borrarlos.` };
  }

  save(vault) {
    try {
      this.backend.setItem(this.key, JSON.stringify(vault));
      return true;
    } catch {
      return false;
    }
  }
}

// «Borrar todos los datos»: every MANU key on this device, including what
// deliberately lives outside the vault (Gemini key, Spotify tokens, PKCE).
export function wipeDeviceKeys(storages) {
  let removed = 0;
  for (const s of storages) {
    if (!s) continue;
    const keys = [];
    for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k?.startsWith("manuos.")) keys.push(k); }
    for (const k of keys) { s.removeItem(k); removed++; }
  }
  return removed;
}

// Audit 2026-10: how full the device storage is. Safari keeps about 5 MB per
// site for localStorage (NO_VERIFICADO exact figure; it varies by version).
export const STORAGE_BUDGET = 5 * 1024 * 1024;
export function storageUse(storage, prefix = "manuos.") {
  let chars = 0;
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k?.startsWith(prefix)) chars += k.length + (storage.getItem(k)?.length ?? 0);
    }
  } catch { return null; }
  // localStorage counts UTF-16 code units: 2 bytes each.
  const bytes = chars * 2;
  return { bytes, ratio: bytes / STORAGE_BUDGET, level: bytes / STORAGE_BUDGET >= 0.85 ? "full" : bytes / STORAGE_BUDGET >= 0.6 ? "warn" : "ok" };
}
