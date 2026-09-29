// «Buzón» (WEB-43): what iPhone Shortcuts can see and a web app cannot
// (Apple Pay, Health, location). Each Shortcut appends one line to a text
// file in iCloud Drive; MANU reads that file when Manu picks it. Opening a URL
// from Shortcuts lands in Safari, whose storage is not the installed app's,
// so a file is the only route that needs no server.
//
// One line per event, fields separated by «|»:
//   gasto|2026-09-29 17:40|12,50 €|Mercadona
//   pasos|2026-09-29|8432
//   sueño|2026-09-29|7,5
//   peso|2026-09-29|72,4
//   lugar|2026-09-29 17:40|Calle Ejemplo 1, Gijón
import { normalise } from "./text.js";

export const LIMITS = { lines: 5000, seen: 5000, places: 1000, text: 120 };
const KINDS = { gasto: "expense", compra: "expense", pago: "expense", pasos: "steps", sueno: "sleep", dormir: "sleep", peso: "weight", lugar: "place", ubicacion: "place" };
const pad = (n) => String(n).padStart(2, "0");
const clip = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

// «12,50 €», «€12.50», «1.234,56», «-3,20» → cents (always positive), or null.
export function amountCents(text) {
  let t = String(text ?? "").replace(/[^\d.,-]/g, "").replace(/^-/, "");
  if (!/\d/.test(t)) return null;
  const lastSep = Math.max(t.lastIndexOf(","), t.lastIndexOf("."));
  let whole = t, frac = "";
  if (lastSep >= 0 && t.length - lastSep - 1 <= 2) { whole = t.slice(0, lastSep); frac = t.slice(lastSep + 1); }
  whole = whole.replace(/[.,]/g, "");
  if (!/^\d{1,7}$/.test(whole || "0") || !/^\d{0,2}$/.test(frac)) return null;
  const cents = Number(whole || 0) * 100 + Number(frac.padEnd(2, "0") || 0);
  return cents > 0 ? cents : null;
}

// «2026-09-29 17:40», «2026-09-29T17:40:00+02:00», «29/9/2026 17:40», «29/9/26».
// Returns a local Date or null.
export function parseWhen(text) {
  const t = clip(text, 40);
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T,]+(\d{1,2}):(\d{2}))?/);
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(t)) return valid(new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 12), +(m[5] ?? 0)), +m[3]);
  if (m) { const d = new Date(t); return Number.isNaN(d.getTime()) ? null : d; }
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ ,]+(\d{1,2}):(\d{2}))?/);
  if (m) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return valid(new Date(y, +m[2] - 1, +m[1], +(m[4] ?? 12), +(m[5] ?? 0)), +m[1]); }
  return null;
}
const valid = (d, day) => (Number.isNaN(d.getTime()) || d.getDate() !== day ? null : d);
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const number = (text) => { const v = Number(String(text ?? "").replace(/[^\d.,-]/g, "").replace(",", ".")); return Number.isFinite(v) ? v : null; };

// Small stable hash, so the same line imported twice is skipped.
export function lineId(line) {
  let h = 2166136261;
  for (const ch of normalise(line).replace(/\s+/g, " ")) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return `bz-${h.toString(36)}`;
}

// One line → an event, or { error } for a line that is not understood.
export function parseLine(raw, now = new Date()) {
  const line = clip(raw, 400).replace(/^manu\s*\|/i, "");
  if (!line) return null;
  const [k, when, value, ...rest] = line.split("|").map((x) => x.trim());
  const kind = KINDS[normalise(k ?? "")];
  if (!kind) return { error: "tipo desconocido" };
  const at = parseWhen(when);
  if (!at) return { error: "fecha no válida" };
  if (at.getTime() > now.getTime() + 86400000) return { error: "fecha en el futuro" };
  const id = lineId(line);
  if (kind === "expense") {
    const cents = amountCents(value);
    return cents ? { id, kind, at, cents, merchant: clip(rest.join(" "), LIMITS.text) || null } : { error: "importe no válido" };
  }
  if (kind === "place") {
    const text = clip([value, ...rest].join(" "), LIMITS.text);
    return text ? { id, kind, at, text } : { error: "lugar vacío" };
  }
  const v = number(value);
  const ok = v !== null && (kind === "steps" ? v >= 0 && v < 200000 : kind === "sleep" ? v > 0 && v <= 24 : v > 20 && v < 400);
  return ok ? { id, kind, at, value: kind === "steps" ? Math.round(v) : Math.round(v * 10) / 10 } : { error: "valor no válido" };
}

const HEALTH = { steps: "STEPS", sleep: "SLEEP", weight: "WEIGHT" };

// Applies a buzón file to a copy of the vault parts it touches. `newEntry`
// categorises an expense like any other (money.js). Pure: returns what changed.
export function applyBuzon(text, vault, { now = new Date(), newEntry }) {
  const seen = new Set(vault.settings?.buzonSeen ?? []);
  const out = { spending: [], health: [...(vault.health ?? [])], places: [...(vault.places ?? [])], seen: [], counts: { expense: 0, steps: 0, sleep: 0, weight: 0, place: 0 }, repeated: 0, errors: [] };
  const all = String(text ?? "").split(/\r?\n/);
  const skip = Math.max(0, all.length - LIMITS.lines); // the file only grows: the newest lines matter
  all.slice(skip).forEach((raw, j) => {
    const i = skip + j;
    const ev = parseLine(raw, now);
    if (!ev) return;
    if (ev.error) { out.errors.push({ line: i + 1, error: ev.error }); return; }
    if (seen.has(ev.id)) { out.repeated++; return; }
    seen.add(ev.id); out.seen.push(ev.id);
    out.counts[ev.kind]++;
    if (ev.kind === "expense") out.spending.push({ ...newEntry({ id: ev.id, cents: ev.cents, merchant: ev.merchant, at: ev.at.toISOString() }), source: "APPLEPAY" });
    else if (ev.kind === "place") out.places.push({ id: ev.id, at: ev.at.toISOString(), text: ev.text });
    else {
      const day = dayKey(ev.at), kind = HEALTH[ev.kind];
      out.health = out.health.filter((h) => !(h.day === day && h.kind === kind));
      out.health.push({ day, kind, value: ev.value, source: "buzon" });
    }
  });
  out.places = out.places.sort((a, b) => a.at.localeCompare(b.at)).slice(-LIMITS.places);
  out.seenAll = [...(vault.settings?.buzonSeen ?? []), ...out.seen].slice(-LIMITS.seen);
  out.added = out.seen.length;
  return out;
}

// «3 gastos, pasos de 2 días y 5 lugares».
export function buzonSummary(r) {
  const c = r.counts, parts = [];
  if (c.expense) parts.push(`${c.expense} ${c.expense === 1 ? "gasto" : "gastos"}`);
  if (c.steps) parts.push(`pasos de ${c.steps} ${c.steps === 1 ? "día" : "días"}`);
  if (c.sleep) parts.push(`sueño de ${c.sleep} ${c.sleep === 1 ? "día" : "días"}`);
  if (c.weight) parts.push(`${c.weight} ${c.weight === 1 ? "peso" : "pesos"}`);
  if (c.place) parts.push(`${c.place} ${c.place === 1 ? "lugar" : "lugares"}`);
  const main = parts.length ? parts.join(", ").replace(/, ([^,]*)$/, " y $1") : "nada nuevo";
  return `${main}${r.repeated ? ` · ${r.repeated} ya estaban` : ""}${r.errors.length ? ` · ${r.errors.length} líneas no entendidas` : ""}`;
}
